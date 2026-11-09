# 渲染 ↔ 状态一致性审计（dom-consistency）

> 起因：game9-slide 的真实 P0 缺陷（`doMove` 把移动前后的空格写反 → 方块消失 + 幽灵 0 + 消失方块不可点）**在 selftest 全绿、且"单次点击生效"的情况下潜伏了很久**。本审计用一套与具体游戏无关的判据，排查其余 8 关是否存在同类"增量更新与整体重绘不一致"的缺陷。

## 一、方法：零知识 oracle

不去猜每关"应该渲染成什么样"，而是利用一个必然成立的不变量：

> **增量更新后的 DOM，必须与"调用该页自己的整体重绘入口后的 DOM"一致。**

因为整体重绘是"从内部状态重建视图"的权威路径；只要增量路径与它分歧，就说明增量更新漏了/写错了东西——正是 game9 的缺陷形态。

- 逐子元素序列化：`tagName[属性名=值(排序)]`（含 class/data-*），并记录容器子元素数量。
- 两处自检，避免"假绿"：
  1. **有效性自检**：点击序列必须让 DOM 发生变化（`D1 !== D0`）。否则本次抽查对"点击后的一致性"无话可说，标为 ⚠无效 —— 我第一次跑就命中两关（靶点选错：game4 的前 49 个子元素是提示格；game6 的状态在 `#slots` 而非键盘容器）。
  2. **敏感性自检**：人为给首个子元素加一个属性后，摘要必须报出不一致。否则摘要没有牙齿，绿=无用。
- 另加一列"结构(去 class)是否一致"：把 class 属性剔除后再比一次，用来区分**纯外观差异**与**结构性差异**（后者才可能像 game9 那样丢内容/错位）。

## 二、结果（9/9 关）

| 关卡 | 容器 | 重绘入口 | 点击 | 有效性 | 一致性 | 敏感自检 |
|---|---|---|---|---|---|---|
| game1-circuit | `#grid` | `refresh` | 3/3 | 有效 | ✓ 一致 | 过 |
| puzzle2 | `#tray` | `renderPlaced` | 2/2 | 有效 | ✓ 一致 | 过 |
| game3-gems | `#grid` | `render` | 3/3 | 有效 | △ 仅 class 不同（15 格） | 过 |
| game4-camping | `#grid` | `refresh` | 4/4 | 有效（修正靶点后） | ✓ 一致 | 过 |
| game5-lights | `#board` | `paintBoard` | 3/3 | 有效 | ✓ 一致 | 过 |
| game6-code | `#slots` | `paintSlots` | 3/3 | 有效（修正容器后） | ✓ 一致 | 过 |
| game7-nonogram | `#grid` | `refreshAll` | 3/3 | 有效 | △ 仅 class 不同（1 格） | 过 |
| game8-targets | `[data-idx]` 父节点 | `refresh` | 3/3 | 有效 | ✓ 一致 | 过 |
| game9-slide | `#board` | `buildBoard`（整体重建，game9-slide.html:319；增量入口是 `paintMovable()`） | 24/24 | 有效 | ✓ 一致（修复后；逐步比对全部匹配） | 过 |

**结论：其余 8 关未发现 game9 同类（内容/结构级）渲染缺陷。** 两处 class-only 差异均已定位到具体机制，判定为设计内的瞬态高亮，不需要改动：

1. **game3-gems（15 格）**：增量态 `spot origin` / `spot shake` ↔ 重绘态 `spot origin legal hint` / `spot`。
   `render()` 会按当前局面给合法落点加 `legal`、给可吃子加 `hint`；而提示是 `hintAll()` **定时循环**（`HINT_SHOW`）驱动的，点击后处于提示循环的间歇相位。`shake` 是 `320ms` 级的错误抖动动画。**去 class 后结构完全一致**，无内容丢失。
2. **game7-nonogram（1 格）**：增量态 `cell fill bad wrong` ↔ 重绘态 `cell fill`。
   `wrong`/`bad` 是"填错"的反馈（点击时加上，定时器只摘 `bad`，`wrong` 常驻）；而 `paintCell()` 只按填充状态重建 class，`refreshAll()` 因此不会还原 `wrong`。但 `refreshAll()` 的调用点只有初始化/换关（`buildGrid();refreshAll();`），**正常游玩路径不经过它**，所以玩家不会看到错误标记被抹掉。属于"重绘不完整"的隐患而非当前缺陷——若将来新增"重绘中途状态"的入口，需要同时补 `wrong` 的重算。

## 三、复现

> 2026-11-09 复核：上表除 game9 一行的入口名外均与代码一致。game9 那行的证据来自 `clear_g9_touch2.mjs`——它做的是**状态级**逐步比对（页面 `board` 数组 vs 模拟 board），不是本文 §一 的 DOM 增量/重绘对比；文档早期把入口名写成了并不存在的 `renderBoard`，已更正为 `buildBoard`。

```bash
cd _verify/endfield-captcha
node audit_dom.mjs    # 8 关总表（零知识 oracle + 两项自检）
node audit_dom2.mjs   # game3/game7 差异定性（去 class 对比）+ game4/game6 无效原因诊断
node audit_dom3.mjs   # game4/game6 修正靶点后补测
node clear_g9_touch2.mjs  # game9 修复后逐步比对（24/24）
```

前置：`node _gt_srv.js`（8099）+ 带 `--remote-debugging-port=9222` 的 Edge（全部探针先静音）。

## 四、局限（不要把这套结论当万能证明）

- oracle 要求页面**确有**一个"从状态重建视图"的整体入口；此套 9 关都有（见上表），换项目要重新确认。
- 审计走 `?direct=1` 直连页面，不覆盖 hub/iframe 宿主层（宿主层另由真实通关台账覆盖）。
- 只抽查每关 2–4 次点击后的一个时间切片；**不构成"任意步数后都一致"的证明**（game9 的缺陷正好在第 6 步才暴露）。
- 移动端布局与真实触摸手感不在本审计范围（见 `layout-viewport.md` 与 `realplay.md`）。
