# 真实通关回归台账（realplay）

> 目的：验证"玩家真的能玩通"这条链路，而不是只调用内部函数。全部为**真实鼠标点击**（CDP Input.dispatchMouseEvent），先静音（公共场所禁止外放）。
> 路径：hub 真实入口（点卡片 → 开始校验）→ iframe 内真实点击 → 游戏自判通关 → 真实 postMessage → hub 写回进度/标题/统计。

## 一、已完成（3/9）

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

## 三、待完成（6/9）与已知要点

| 关卡 | 拟用解法 | 已知要点 |
|---|---|---|
| game1-circuit | `pz.tiles[i].k`（疑似每格需旋转次数） | 每次点击顺时针 90°，需验证 k 语义 |
| game3-gems | `bestSol` 落点序列 | **当前未通过**：8 个落点全命中但只有 3 次移动被接受（moves=3, solved=false）→ 交互是"先点棋子再点落点"，序列需重排；自检显示 25 关全部可解，**不能据此判定游戏缺陷** |
| game6-code | `pz.secret`（符号索引数组） | 需点自绘键盘输入后提交 |
| game8-targets | `pz.rules` + `pz.cells`（每格属性） | 需按规则筛出合格格再点击 |
| game9-slide | `pz.path`（80 步） | 需确认点击语义与是否逆序回放 |
| puzzle2 | `pz.grid` + `pieces` | 拖拽类，需构造 pointer 拖拽序列（最难） |

## 四、脚本位置

`_verify/endfield-captcha/clear_g5.mjs`（单关）、`clear_multi2.mjs`（多关，含各关定位分派）。
