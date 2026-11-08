# 星级判据台账（star rubric）

> **已定口径（用户决定）：保留各关自有判据，不跨关统一；但阈值必须随 V1–V5 难度梯度收紧。**

## 一、九关判据（file:line 为证）

| 设备 | 关卡 | 3★ 条件 | 2★ 容差（随档位） | 族 |
|---|---|---|---|---|
| V-40053 | game1-circuit | `moves<=best` | `moves<=ceil(best*1.5)` | B 效率比值 |
| V-40054 | puzzle2 | `illegal===0` | 容差表 `[2,2,1,1,0]`（puzzle2.html:830） | A 失误计数 |
| V-40055 | game4-camping | `badMoves===0` | 容差表 `[2,2,1,1,0]`（game4-camping.html:524） | A 失误计数 |
| V-40056 | game3-gems | `steps<=best` | `steps<=best+SM`，SM=`[2,2,2,1,1]`（game3-gems.html:291） | D 档位余量 |
| V-40057 | game5-lights | `mv<=k` | `mv<=ceil(k*1.5)` | B 效率比值 |
| V-40058 | game6-code | `used<=ceil(budget/2)` | `used<=budget-1` | C 预算 |
| V-40059 | game7-nonogram | `errors===0` | 容差表 `[2,2,1,1,0]`（game7-nonogram.html:692） | A 失误计数 |
| V-40060 | game8-targets | `fails===0` | 容差表 `[1,1,1,0,0]`（game8-targets.html:396，本就比同族严） | A 失误计数 |
| V-40061 | game9-slide | `moves<=ceil(ref*1.2)` **且** `失误<=MCAP[lv-1]`（MCAP=`[2,2,1,1,0]`，game9-slide.html:485-487） | `moves<=ceil(ref*1.5)`（失误=超参考步数 `max(0,moves-ref)`） | B 效率比值 + 失误门控 |

**说明**：B/C 族（game1/game5/game6/game9）的参照量（best / k / budget / ref）本身随档位放大，梯度已内建，故按「全部保留」不动；game9 额外叠加失误门控（见 §四）。

## 二、本次改动：让 A 族与 D 族的容差也随档位收紧

原先是扁平常数（任何难度都允许错 2 次即得 2★），现改为按档位取容差：

- game4-camping.html:524、game7-nonogram.html:692、puzzle2.html:830 → `[2,2,1,1,0]`
- game8-targets.html:396 → `[1,1,1,0,0]`（保留它本就更严的性格）
- game3-gems.html:291 → 2★ 余量 `[2,2,2,1,1]`（原为扁平 +2）

效果：**V5 时 2★ 不再可能（容差 0）** —— 高难度档要想拿星只能零失误。

## 三、实测证据（390×844 → 桌面 iframe 捕获真实 payload）

同样的表现，在 V1 与 V5 得到不同星级，证明梯度生效：

| 关卡 | 输入 | V1 结果 | V5 结果 |
|---|---|---|---|
| game4-camping | badMoves=1 | 2★ | 1★ |
| game7-nonogram | errors=1 | 2★ | 1★ |
| game8-targets | fails=1 | 2★ | 1★ |
| puzzle2 | illegal=1 | 2★ | 1★ |
| game3-gems | steps=3, best=1 | 2★ | 1★ |

方法：临时同源 iframe harness 承载目标页（使 `window.parent!==window` 成立），在子页内调用其自身通关处理函数，从父页捕获 `pz-solved` 的真实 payload 读取 stars。

## 四、失误计数与 3★ 门控（C 轮已落地，C-T1–C-T5）

原「未做」的双条件方案已按用户确认口径（A 口径）分关落地：每关只统计**该关自己的错误语义**，3★ = 原效率判据 **且** `失误<=MCAP[lv-1]`（`MCAP=[2,2,1,1,0]`，各关同表）；印章显示「失误 N」，`pz-solved` postMessage 增加可选 `mistakes` 字段（hub/terminal 无需改动）。

| 关卡 | 失误语义 | 判据处 |
|---|---|---|
| game1-circuit | 拨错固定块 + 超最优旋转 `max(0,moves-best)` | game1-circuit.html:392-393 |
| game3-gems | 被拒绝/坠毁的落点次数 | game3-gems.html:617-618 |
| game5-lights | 超最短解的浪费步 `max(0,moves-pz.min)` | game5-lights.html:510-511 |
| game6-code | 猜错次数 `max(0,提交数-1)` | game6-code.html:744-745 |
| game9-slide | 超最短路径步数 `max(0,moves-ref)` | game9-slide.html:486-487 |

**实测证据（game9 真实点击，CDP）**：V1 三场景 = A 最优 `ref:24 moves:24` 3★/失误0、B 冗余2 `moves:26` 3★/失误2、B′ 冗余4 `moves:26` 2★/失误4；V4/V5（4×4，`ref:200/300`）= A 3★/失误0，B（+2）与 B′（+4）均 2★。失误门控与 V1–V5 梯度生效。
