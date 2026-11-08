# 真实通关回归台账（realplay）

> 目的：验证"玩家真的能玩通"这条链路，而不是只调用内部函数。全部为**真实鼠标点击**（CDP Input.dispatchMouseEvent），先静音（公共场所禁止外放）。
> 路径：hub 真实入口（点卡片 → 开始校验）→ iframe 内真实点击 → 游戏自判通关 → 真实 postMessage → hub 写回进度/标题/统计。

## 一、已完成（9/9）

| 关卡 | 解字段来源 | 目标数 | 真实点击 | 通关校验 | hub 回写 |
|---|---|---|---|---|---|
| V-40057 game5-lights | `pz.sol`（按压掩码） | 2 | 2 | `solvedFlag=true` | `{lv:1,stars:3}` · stats moves=2 secs=3 pass=true |
| V-40059 game7-nonogram | `pz.answer`（1=涂黑） | 13 | 13 | `solved=true` `marked=13` | `{lv:1,stars:3}` · stats moves=13 secs=3.4 pass=true |
| V-40055 game4-camping | `pz.sol`（帐篷坐标） | 3 | 3 | `solved=true` `marked=3` | `{lv:1,stars:3}` · stats moves=3 secs=1.8 pass=true |
| V-40053 game1-circuit | `pz.tiles[i]`（每格点 `(4-k)%4` 次回 mask0，固定块跳过） | 15 | 15 | `solvedFlag=true` | `{lv:1,stars:3}` · stats moves=15 secs=3.1 pass=true |
| V-40060 game8-targets | 目标格 = 序号 `< pz.targetCount` | 3 | 3 | `solvedFlag=true` | `{lv:1,stars:3}` · stats secs=3.2 pass=true |
| V-40058 game6-code | `pz.secret` → `.key[data-sym]` + `#btnSubmit` | 4 键 + 1 提交 | 5 | `solvedFlag=true` | `{lv:1,stars:3}` · stats moves=1 secs=3.5 pass=true |
| V-40056 game3-gems | `bestSol` 落点序列（点**目标落点**即可） | 8 | 8 | `solvedFlag=true` | `{lv:1,stars:3}` · stats moves=8 secs=5.7 pass=true |
| V-40054 puzzle2 | **自研求解器**（形状精确覆盖 **+ 行列颜色计数**） | 7 | 7 | `solved=true` `illegal=0` `placed=7` | `{lv:1,stars:3}` · stats **ts=2026-11-07T03:24:35.597Z** moves=7 secs=7.2 pass=true |
| V-40061 game9-slide | **自研 BFS**（3×3 从实时 `board` 反向/正向搜索，目标判定复用页面 `isSolved`） | 24 | 24 | `solved=true` `moves=24`（=最优 `ref`） | `{lv:1,stars:3}` · stats **ts=2026-11-07T06:08:20.166Z** moves=24 secs=5.76 pass=true |

## 二、各关定位方式（踩过的坑，供后续复用）

| 关卡 | 格子定位 | 备注 |
|---|---|---|
| game5-lights | `#c-<i>`（一维）或 `#board > .cell` 行主序 | 行主序与模型索引一致（已核对源码 `i=y*n+x`） |
| game7-nonogram | `#c-<x>-<y>` | **不能用 gridRow/gridColumn 推算**：提示格占用了前面的行列，会错位（曾导致 13 目标只命中 3） |
| game4-camping | dataset `x/y` | 容器 `#grid` |
| game3-gems | `.spot` 的 dataset `x/y` | 点击**目标落点**即可，不需要先点棋子（点棋子只是高亮提示）；`bestSol` 是落点序列，不是宝石位置 |

## 三、未完成（0/9）

九关全部完成真实点击通关回归（每关都以"游戏自判通关 → 真实 postMessage → hub 写回进度/统计"闭环验证）。

> 修正记录：game9-slide 曾被误判为"非游戏缺陷 / 测试工件"（见 §三之二 的更正），实际是**真实 P0 缺陷**，已修复。

（已解决的历史条目：game1 的 `k` 语义＝该格当前 mask，点 `(4-k)%4` 次归零；game3 的交互是"点目标落点"，先前 moves=3 是落点序列含义理解错误；game6 需点自绘键盘再提交；puzzle2 无需拖拽——是**点击 + 旋转/翻面**类。）

## 二之一、通用坑：有「忙碌守卫」的页面必须等状态，不能用固定间隔

- game3-gems：`tap()` 开头是 `if(!cur||solvedFlag||deadFlag||busy)return;` —— **跳吃动画期间 `busy=true`，点击被直接丢弃**（且不留任何日志，看 console 也查不到）。
- 现象极易误判：前几步成功、之后连续失效（我一度以为落点序列错了、或坐标漂移了）。
- 正解：**点击前轮询 `busy===false`**、点击后**轮询步数是否增加**；改完后 8/8 次点击全部生效。
- 通用结论：凡是有动画/防抖/守卫标志的交互，自动化的正确做法是"**等状态**"而不是"睡固定毫秒"。

## 二之二、通用坑：点击目标会因 UI 更新而位移（务必每次重取坐标）

- game6-code：填满 4 位输入后，**提交按钮位置发生变化**；用事先取好的坐标点击 → 提交无效（表现为 `guesses=0`、`solved=false`，看着像"提交没生效"）。改为**点击前重新读取按钮坐标**并校验 `document.elementFromPoint(x,y)` 落在 iframe 上（`topHit.id==='frame'`）后，一次通关。
- 结论：任何"先读坐标、后多次交互"的脚本都要在**每次点击前重取坐标**；一次性坐标只适用于布局绝对不变的静态目标。

## 三之二、game9-slide：**真实 P0 缺陷（已修复）** —— 以及一次误判的更正

**症状（用户可见）**：点击任意可移动方块后，**被移动的方块从画面上消失**，而新的空格位置冒出一个**幽灵 "0" 方块**；虚线空位仍留在旧位置。随后那个消失的方块**点不动**（它所在格的 `data-empty='1'` 被 `cellFromEvent` 拒绝）→ 第一步之后游戏实际上无法继续。

**证据链**：
1. 状态不一致：`board=[2,4,5,7,1,6,8,0,3]`（逻辑正确、唯一 0 在位置 7），而 DOM 是 `位置7="0|0"`、`位置8="0|1"` —— 真正空格没被标记为空，反倒是持有方块 3 的位置被标成空并清空了内容。
2. 视觉确认：`shots/g9_before.png`（方块 3 在右下邻位、右下角虚线空位）vs `shots/g9_after1.png`（**3 消失**、原空格处显示 "0"）。
3. 行为确认：修复前真实点击序列只有前 5 步生效，之后`empty=true` 导致点击被拒；修复后同一脚本 24 步（=最优 `ref=24`）全部生效并通关。

**根因**：`doMove()` 里两处 DOM 更新把"移动前空格 `z`"与"移动后空格 `j`"写反了。`applyMove(a,n,j)` 的定义是 `a[z]=a[j]; a[j]=0`，所以移动后**空格在 `j`**、方块落在 `z`；而原代码给 `z` 打上空标记、给 `j` 写 `data-v=board[j]`——`board[j]` 在 `applyMove` 之后**恒为 0**，于是渲染出幽灵 0。修复即两处对调（并让 `pop` 动画作用在落点 `z`）。

**为什么之前误判为"测试工件"**：我当时只验证了"**单次**点击生效（moves 0→1）"，又把连续点击失败归因于 `setPointerCapture` + CDP pointerId 复用。单次点击恰好用的是初始渲染（DOM 尚未被污染），所以看不出问题；而"卡在固定位置 7"正是 `data-empty` 被误标的同一个格子。**教训：单次交互成功不构成输入链路健康的证据；必须逐步比对 DOM 与内部状态的不变量，并连点足够多步。** 当时的原始归因记录已删除，以免后人按错误结论跳过这个缺陷。

**修复后复验**：DOM 与 `board` 逐步一致（`clear_g9_touch2.mjs` 每步比对，24/24 匹配）；selftest `lv1–lv5 PASS · 汇总 5/5 100%`；真实通关 stats `ts=2026-11-07T06:08:20.166Z stars=3 moves=24 pass=true`。

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

## 六、puzzle2 专章：几何拼满 ≠ 通关

1. **颜色约束是硬条件**：`fbCheck()` 除了"每块都放下"还要求**每行/每列的 green/blue 计数**与 `rowHints/colHints` 全等。只做形状精确覆盖会得到"7/7 落位、`illegal=0`、看着完美"却 `solvedFlag=false` 的棋盘（我据此白跑了一轮）。每块的颜色是**块自身属性**（`piece.color`，`fbColorOf` 只认 `'blue'`，其余算 green）。
2. **别照抄核心层签名**：页面全局是 `canPlace(pieceId, cells, ax, ay)`（4 参，内部再转发 6 参的核心层）。我照核心层写成 6 参 → 每次抛错被 `res[0]==='{'` 吞掉 → 表现为"8 次朝向调整仍无可行锚点"。**探测函数签名前先读宿主页面的包装函数**。
3. **"落位成功"的判据不能只看 `illegal` 没涨**：早期版本只比较 `illegal` 前后值，把"点击根本没生效"也计成成功（假 5/7）。必须 diff `Object.keys(w.placed).length` 并确认 `w.placed[pid]` 存在。
4. **历史统计记录会冒充本轮证据**：hub 的 `?reset=1` **不清空** `endland-stats`/`endland-hub-progress`。判据是 **ts**：修复前后两次读到的 ts 完全相同（`22:57:38.769Z`）→ 那是**旧记录**；真通关后才出现新 ts `2026-11-07T03:24:35.597Z`。
5. **`raw()` 要加非字符串守卫**：把 async 函数（`cellXY`）忘了 `await` 就传进 `Runtime.evaluate`，CDP 只回一句 `Failed to deserialize params.expression - BINDINGS: string value expected at position 34`，没有调用栈。守卫里打印 `typeof` 与堆栈即可一眼定位。

## 七、脚本位置

- `clear_g5.mjs`（单关）、`clear_multi2.mjs`（多关，含各关定位分派）
- `clear_p2.mjs`（puzzle2：把求解器当函数源码内联进页面 + 按 `placed` 增量校验落位）
- `clear_g9_touch2.mjs`（game9：触摸事件 + **逐步比对 DOM↔board**）、`clear_g9_touch.mjs`（首版）、`g9vis.mjs`（点击前后截图取证）、`g9self.mjs`（自检 + 读 stats）
- `shots/g9_before.png`、`shots/g9_after1.png`（缺陷取证截图）
- `audit_dom.mjs` / `audit_dom2.mjs` / `audit_dom3.mjs`（渲染↔状态一致性审计，方法与本轮结论见 `docs/dom-consistency.md`）
- `shortfit2.mjs` / `g5parts.mjs` / `g5check.mjs` / `g5win.mjs`（短视口量测、高度分解分解、手机视口核对、手机视口真实点击通关；见 `docs/layout-viewport.md`）
- `g9probe.mjs`（game9：3×3 BFS 最优解 / 4×4 反向重放 + 成对冗余，A/B/B′ 三场景读 postMessage 与印章）
- `g5band.mjs`（game5：各档采样 `{k,min}` 分布，判定容忍带在哪些档位存在）、`g5probe2.mjs`（容忍带局的纯失误路径，期望星级随 MCAP 变）
- `touch_smoke.mjs`（九关触摸点击到达性 + 触摸完整通关）、`g9touch.mjs`（game9 触摸拖拽通关）、`g9touchdiag.mjs`（触摸事件计数与几何诊断，用于排除探针自身问题）

## 八、C 轮：失误门控的真实点击复验（当前 HEAD，2026-11-07）

**口径**：每关只统计本关的错误语义；3★ = 原效率判据 **且** `失误<=MCAP[lv-1]`（`MCAP=[2,2,1,1,0]`）。落地提交：game1 `a0395e3` / game3 `dedc892` / game5 `95967f0` / game6 `1b15725` / game9 `6f3d07c`（判据表见 `docs/star-rubric.md` §四）。

同一表现、不同档位得到不同星级，证明门控与梯度同时生效（全部为真实 CDP 点击 + 真实 postMessage）：

| 关卡 | 干净解 | V1 冗余表现 | V5 冗余表现 |
|---|---|---|---|
| game1-circuit | 旋转=best，失误0 → 3★ | 失误1（19/19）→ **3★** | 失误1（40/40）→ **2★** |
| game3-gems | steps=best，失误0 → 3★ | 失误1（8/11）→ **3★** | 失误1（15/16）→ **2★** |
| game5-lights | moves=min，失误0 → 3★ | 失误2（5 次/min3）→ 2★ | 失误2（16 次/min14）→ 2★ |
| game6-code | 1 次命中，失误0 → 3★ | 错1 → **3★**；错2 → **3★** | 错1 → **2★**；错2 → **2★** |

game9-slide（三场景，含最优/冗余2/冗余4）：

| 档位 | A 最优 | B 冗余 +2 | B′ 冗余 +4 |
|---|---|---|---|
| V1 (3×3) | ref24 / moves24 / 失误0 → 3★ | moves26 / 失误2 → 3★ | moves26 / 失误4 → 2★ |
| V4 (4×4) | ref200 / moves200 / 失误0 → 3★ | moves202 / 失误2 → 2★ | moves204 / 失误4 → 2★ |
| V5 (4×4) | ref300 / moves300 / 失误0 → 3★ | moves302 / 失误2 → 2★ | moves304 / 失误4 → 2★ |

（V1 的 B′ 因 `moves<=ceil(ref*1.2)` 效率项本身已放宽到 2★，与门控正交——两者同时具备才给 3★。）

### 八之一、新坑：滑块类的失误只能成对构造

- 3×3 与 4×4 滑块移动图都是**二部图**：每走一步，与目标状态的"逆序距离"奇偶性翻转。因此**不存在只多走 1 步的中性步**，`moves-ref` 只能取偶数——想验证"失误 1"这种场景在滑块上手写不出来。
- 4×4 更受限：只能构造**偶数**失误增量（同格来回两次）。因此探针的冗余场景取 **+2 / +4**，而非 +1 / +2。
- 其它关不适用此限制（game6 的错 1 次、game3 的 1 次拒绝落点都能精确构造）。

### 八之二、新坑：解序列生成必须用**本地模拟棋盘**，不能用实时棋盘

- 现象：探针生成的"最优序列"是 300 个**同一个索引**（`[3,3,3,…]`），执行后 `moves` 只涨到 1。
- 根因：生成序列时对**实时 `board`**（此刻没有任何移动发生，故始终不变）反复求"下一步该走哪"，于是每轮选出同一个格子，且永远不满足"已解开"。
- 正解：`var sim=w.board.slice();` 每选一步就 `sim=w.applyMove(sim,n,pick)`，判定与搜索全部基于 `sim`。
- 教训：**生成期用模拟状态、执行期用真实状态**；任何"边算边改而不推进状态"的循环都要先怀疑它。

### 八之三、game5 容忍带只在 **V4 及以上** 存在（附一次误判的更正）

- **分布实测**（`g5band.mjs`，各档采样 10 局）：V1 与 V3 的 `k-min` **10/10 全为 0**；V4 出现 `k-min=1`(5 次) / `=2`(4 次) / `=3`(1 次)。
- **原因**：`genOne()` 是按目标值**精确采样**题面（`cosetMin===target` 才返回，game5-lights.html:362-376），只要该网格能走到 `k`，就必有 `min===k`。V4 的 `kMin=8` 超过了 4×4 网格的可达上限 7，于是退化成「能走到的最大步数」，才留下 `k>min` 的余量。
- **更正**：此前 `g5probe2` 默认跑 V2，报 `SKIP: 12 局内无 k>=min+2（容忍带在生成分布内不可达）`——「不可达」这个结论是**错的**，它只是不在 V1–V3 出现。改跑 V4 后第 0 局即命中。
- **决定性验证（V4）**：`k=10, min=7` 局，先浪费 2 步再按 `sol` 解 → `moves=9<=k`（效率项**通过**）、`mistakes=2`；`MCAP[3]=1` 使门控**拦下** → 结算 **2★**（若无门控，按原判据本是 3★）。印章：`难度 V4 · ★★☆ · 抖动 9 次（目标 10，最短解 7） · 失误 2`。
- **结论**：game5 的失误门控在 V1–V3 被效率判据蕴含（`min===k` ⇒ 3★ 只在 `moves=min` 时成立），但在 **V4 起真正生效**，是有效判据而非冗余项。

## 九、触摸路径复验（手机视口 390×844，触摸事件仿真）

> 起因：此前所有"真实点击"都用 `Input.dispatchMouseEvent`（鼠标），而真机走的是 pointer/touch。这是唯一无法由桌面替代、又能在无头环境里逼近的轴——真机测试仍需用户完成。

**方法**：`Emulation.setDeviceMetricsOverride(390×844, dsf=3, mobile)` + `Emulation.setTouchEmulationEnabled{maxTouchPoints:1,configuration:"mobile"}`，手势用 `Input.dispatchTouchEvent`（touchStart/touchMove/touchEnd）。脚本：`touch_smoke.mjs`、`g9touch.mjs`、`g9touchdiag.mjs`。

### 九之一、九关触摸点击到达性：9/9 PASS

逐关打开 `?direct=1&lv=1`，在可交互单元上装捕获监听后真实触摸点一下，三个事件各计一次：

| 关卡 | 目标元素 | pointerdown / pointerup / click |
|---|---|---|
| game1-circuit | `[data-i]` | 1 / 1 / 1 |
| puzzle2 | `.piece[data-pid]` | 1 / 1 / 1 |
| game3-gems | `.spot[data-x][data-y]` | 1 / 1 / 1 |
| game4-camping | `#grid [data-x]` | 1 / 1 / 1 |
| game5-lights | `#board .cell` | 1 / 1 / 1 |
| game6-code | `.key[data-sym]` | 1 / 1 / 1 |
| game7-nonogram | `[id^="c-"]` | 1 / 1 / 1 |
| game8-targets | `[data-idx]` | 1 / 1 / 1 |
| game9-slide | `#board .tile` | 1 / 1 / 1 |

九关均声明了 `touch-action:manipulation`（消除 300ms 延迟、允许点击），触摸事件链路完整。

### 九之二、触摸完整通关（端到端）

| 场景 | 手势 | 结果 |
|---|---|---|
| game5-lights（经 hub iframe，触摸点开卡片） | 触摸点击 `sol` 单元 | **PASS** `pz-solved stars=3 moves=2 mistakes=0`，印章完整 |
| game9-slide（经 hub iframe，**拖拽式**） | 触摸滑动 20 次（每次：瓦片中心 → 相邻空格中心） | **PASS** 20/20 滑动全部生效、`moves=20=ref`、`stars=3 mistakes=0`、印章「滑动 20 次 · 失误 0 · 参考 20 步」 |

game9 的拖拽在真机不被判为滚动的关键是 `.board{touch-action:none}`（game9-slide.html:72）；若缺此项，浏览器会把手势当滚动并抛 `pointercancel`，拖拽即失效。此项已核实存在。

### 九之三、两个探针教训（都曾伪装成"游戏缺陷"）

1. **就绪判据必须包含"版面稳定"**：首次跑触摸拖拽时前 4/18 次滑动失效，看着像"开局第一秒点不动"。加仪器后真因是：`pz` 已存在且 `moves===0`，但 iframe 版面尚未排完，`getBoundingClientRect()` 返回**退化值**（相邻两格返回同一坐标 8.79/85.3），触点落在棋盘外。改为"单元 rect 宽>20 且首尾单元坐标可区分"后，**20/20 全部生效**。教训：`pz` 存在 ≠ 可交互；判据要包含几何有效性。
2. **自定义事件计数器的键名要与事件名一致**：首版写成 `{down:0,up:0,click:0}` 却累加 `__tap[k]`（k 为 `pointerdown`），得到 `undefined++` → `NaN` → `JSON.stringify` 输出 `null`，结果**八关全部显示"未触发"**，而同一份数据里 `click:1` 已经证明事件到达。教训：读数出现 `null`/`NaN` 时先怀疑度量代码，别先怀疑被测对象。


