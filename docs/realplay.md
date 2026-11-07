# 真实通关回归台账（realplay）

> 目的：验证"玩家真的能玩通"这条链路，而不是只调用内部函数。全部为**真实鼠标点击**（CDP Input.dispatchMouseEvent），先静音（公共场所禁止外放）。
> 路径：hub 真实入口（点卡片 → 开始校验）→ iframe 内真实点击 → 游戏自判通关 → 真实 postMessage → hub 写回进度/标题/统计。

## 一、已完成（5/9）

| 关卡 | 解字段来源 | 目标数 | 真实点击 | 通关校验 | hub 回写 |
|---|---|---|---|---|---|
| V-40057 game5-lights | `pz.sol`（按压掩码） | 2 | 2 | `solvedFlag=true` | `{lv:1,stars:3}` · stats moves=2 secs=3 pass=true |
| V-40059 game7-nonogram | `pz.answer`（1=涂黑） | 13 | 13 | `solved=true` `marked=13` | `{lv:1,stars:3}` · stats moves=13 secs=3.4 pass=true |
| V-40055 game4-camping | `pz.sol`（帐篷坐标） | 3 | 3 | `solved=true` `marked=3` | `{lv:1,stars:3}` · stats moves=3 secs=1.8 pass=true |

## 二、各关定位方式（踩过的坑，供后续复用）

| 关卡 | 格子定位 | 备注 |
|---|---|---|
| game5-lights | `#c-<i>`（一维）或 `#board > .cell` 行主序 | 行主序与模型索引一致（已核对源码 `i=y*n+x`） |
| game7-nonogram | `#c-<x>-<y>` | **不能用 gridRow/gridColumn 推算**：提示格占用了前面的行列，会错位（曾导致 13 目标只命中 3） |
| game4-camping | dataset `x/y` | 容器 `#grid` |
| game3-gems | dataset `x/y` | 容器 `#grid` |

## 三、未完成（4/9）与已知要点

| 关卡 | 拟用解法 | 已知要点 |
|---|---|---|
| game1-circuit | `pz.tiles[i].k`（疑似每格需旋转次数） | 每次点击顺时针 90°，需验证 k 语义 |
| game3-gems | `bestSol` 落点序列 | **当前未通过**：8 个落点全命中但只有 3 次移动被接受（moves=3, solved=false）→ 交互是"先点棋子再点落点"，序列需重排；自检显示 25 关全部可解，**不能据此判定游戏缺陷** |
| game6-code | `pz.secret`（符号索引数组） | 需点自绘键盘输入后提交 |
| puzzle2 | `pz.grid` + `pieces` | 拖拽类，需构造 pointer 拖拽序列（最难） |

## 三之二、game9-slide：自动化通关受限（**非游戏缺陷**）

结论：**页面交互与逻辑无缺陷**，自动化未通过是测试输入受限。证据：

1. 单次真实点击**完全生效**：事件轨迹 `pointerdown@num → pointerup@tile movable dragging → click@tile movable`，`moves` 0→1。
2. 连续合成点击自第 3 次起**卡在固定位置**（连续 7 步都指向位置 7 且不生效）。
3. 归因：页面的 `pointerdown` 里调用 `el.setPointerCapture(e.pointerId)`；CDP 合成 pointer 事件的 pointerId 复用且捕获不自动释放 → 后续 `cellFromEvent(e)` 拿到被捕获的旧元素，若它恰好是空位（`data-empty==='1'`）就返回 null → 移动不生效。**这是测试工件**。
4. game9 自身的逻辑正确性已由 selftest 覆盖：`lv1–lv5 PASS · BFS最短=20 · 最短解≤k ✔ · 逆序回放判定=通过`。

**不要据此改游戏**；若将来要自动化 game9，需要改用真实触摸输入或先绕过 pointer capture。

### 读取 game9 实时状态的三次踩坑（都不可靠）

| 数据源 | 问题 |
|---|---|
| `pz.board` | **不是实时状态**（doMove 改的是全局 `board`） |
| 全局 `board` | 与 `pz.board` 引用不同；用它判定的序列执行到中途即错位 |
| DOM 的 `data-v` | 移动后更新不完全（曾读出两个 0）；且**空位必须靠 `data-empty==='1'` 判定**，位置 0 的元素根本没有 `data-v`（`parseInt` 得 NaN） |

## 四、读取回写的时序坑（重要）

部分关卡的通关消息**不是点击瞬间发出**，而在结算动画之后：

- game1-circuit：`onSolved()` 后 `setTimeout(closeAndVerify,1800)`，消息由 `closeAndVerify` 发出 → 校验读数需 **≥3.5s**，否则会误判为"没有回写"（我第一次就踩了）。

结论：所有真实通关脚本在最后一次点击后应等待 ≥4 秒再读 hub 进度与 stats。

## 五、脚本位置

`_verify/endfield-captcha/clear_g5.mjs`（单关）、`clear_multi2.mjs`（多关，含各关定位分派）。
