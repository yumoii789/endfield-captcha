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
- `vpsweep.mjs`（九关 × 4 手机视口的横向溢出/纵向内滚扫描，定位越界元素）、`p2clip.mjs` / `p2why.mjs` / `p2verify.mjs`（puzzle2 棋盘裁切取证、计算样式与修复前后几何核对）、`vpsweep_shell.mjs`（terminal/hub/admin 入口页同款扫描 + 控件遮挡命中测试）、`admin_land.mjs`（横屏下登录键可达性取证）
- `phone_clear.mjs`（手机视口 390×844 + 触摸事件下六关真实通关）、`shapes.mjs`（dump 各关解字段的运行时形状，供写计划前先验证）、`selftest_all.mjs`（逐关跑 `?selftest=1` 并捕获 console，作为改动后的不变量回归）、`p2relayout.mjs` / `p2relayout2.mjs`（puzzle2 旋转后尺寸重算与状态保留、旋转后继续放置）、`boardvis.mjs`（九关棋盘/交互区是否落在首屏内，竖屏与横屏对照）、`scrollreach.mjs`（滚动后逐个命中测试，用于区分"点不到"与"要先滚一下"）、`consoleclean.mjs`（线上逐页捕获异常与 console error，两方向扫描）、`where.mjs` / `parts.mjs` / `dumppanel.mjs`（单元素定位、高度分解、面板内部构成）、`termjourney.mjs`（主线流程真实通关：清档→注册→匹配→在终端 iframe 内真玩抽到的关卡→读回写）、`hubcards.mjs`（hub 九卡逐张点开并用各关自身状态信号确认就绪）、`adminmenus.mjs`（admin 人机验证+登录+六菜单逐个切换）、`seedcheck.mjs`（`?seed` 复现性逐关实测）、`rootredir.mjs`（根路径跳转与 https 下 localStorage 可写）、`diffbtns.mjs`（页内 V1–V5 难度按钮逐档点击：档位变量 + 新题面双断言）

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
- **原因**：`genOne()` 是按目标值**精确采样**题面（`cosetMin===target` 才返回，game5-lights.html:378-392），只要该网格能走到 `k`，就必有 `min===k`。V4 的 `kMin=8` 超过了 4×4 网格的可达上限 7，于是退化成「能走到的最大步数」，才留下 `k>min` 的余量。
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

## 十、手机视口通关矩阵：九关 9/9（触摸事件）

§九 验证了触摸事件链路与 game5/game9 的端到端通关，§六 扫描了布局；本节补齐**其余六关在手机视口下的真实通关**，使矩阵完整。

**方法**：`phone_clear.mjs` —— 390×844 + `Emulation.setTouchEmulationEnabled`，各关以 `?direct=1&lv=1` 直开；每一步**点击前重取坐标**；game3 点击前轮询 `busy===false`（其 `tap()` 在动画期直接丢弃点击）；目标用**属性名/值**定位（避免把解数据拼进选择器）。

| 关卡 | 计划步数 | 实际触摸次数 | solved | 印章 |
|---|---|---|---|---|
| game1-circuit | 9 格（按 `t.k` 算旋转次数） | 21 | ✔ | 难度 V1 · ★★★ |
| game3-gems | 15 落点 | 15 | ✔ | 难度 V1 · ★★★ |
| game4-camping | 4 帐篷 | 4 | ✔ | 难度 V1 · ★★★ |
| game6-code | 4 键 + 提交 | 5 | ✔ | 难度 V1 · ★★★ |
| game7-nonogram | 13 格 | 13 | ✔ | 难度 V1 · 5×5 · ★★★ 落笔 13 次 · 错涂 0 次 |
| game8-targets | 3 目标 + 提交 | 4 | ✔ | 难度 V1 · ★★★ · 误点 0 次 |

与既有结果合并，**手机视口（390×844，触摸）通关矩阵 9/9**：game5（经 hub iframe 触摸点击）、game9（触摸**拖拽** 20/20 次滑动）、puzzle2（`clear_p2.mjs 390 844 1`，7/7 落位）、以及上表六关。

### 十之一、三个被运行时形状纠正的假设（值得复用）

写计划时我按"常见形状"猜了三个字段，全部猜错。**dump 运行时形状**后一次修正：

| 关卡 | 我的假设 | 实际 | 后果 |
|---|---|---|---|
| game1-circuit | `pz.tiles` 是数字数组 | **对象数组** `{i,mask0,mask,k,vd,deg,kind,fixed}` | 取 `ts[idx]` 得对象 → 算出 `NaN` → 计划为空（0 次点击） |
| game4-camping | `pz.sol` 是 `[x,y]` 数组 | `[{x,y},…]` | `s[i][0]` 为 undefined → 3 个目标全部"未定位" |
| game6-code | `pz.secret` 是字符串 | **数字数组** `[3,2,3,3]`，而 `data-sym` 是**字符串** | 严格比较失败 → 4 键全未定位，只有提交键那 1 次命中 |
| puzzle2 | `canPlace(...)` 返回布尔 | 返回 **`{ok, reason}` 对象** | 对象恒为真 → 锚点搜索永远命中第一个格子 (0,0) → `tryPlace` 被拒 → 伪报"旋转后无法放置"（见下） |

两条通用教训：

1. **先 dump 形状再写计划**：`JSON.stringify({keys:Object.keys(pz),sample:…})` 一次调用胜过三次猜测。类型不匹配在 JS 里往往**静默失败**（`undefined`、`NaN`、严格比较 false），不会抛错。
2. **"部分执行"是探针缺陷的信号，不是部分成功**：game6 显示"实际触摸 1 次/未定位 4"，若只看"有动作发生"就会误判为"这关需要更多步骤"。计数与计划不符时，先怀疑定位代码。
3. **返回值语义也要 dump**：`canPlace` 那条最贵——我把 `{ok,reason}` 当布尔用，导致连续两次得出"旋转后放置失效"的结论，差点当成 puzzle2 的旋转回归去改产品代码。判定"合法/成功"的调用，必须先确认返回的是布尔还是对象（读**已经跑通的**脚本怎么用：`clear_p2.mjs:83` 用的就是 `r.ok`）。教训：**新写探测前先抄一个已验证脚本的调用方式**，比读函数定义更快也更不易错。

## 十一、九关内置自检回归（C 轮 + puzzle2 修复后全绿）

前述各节用**外部探针**验证真实交互；本节跑的是**项目自带的不变量套件**（各关 `?selftest=1`），用于确认全部改动没有破坏各关自身的生成/可解性约束。

**方法**：`selftest_all.mjs` —— 逐关加载 `?selftest=1`，捕获 `Runtime.consoleAPICalled` 输出（不依赖 DOM 结果区）。

| 关卡 | 自检结论（原文摘要） |
|---|---|
| game1-circuit | `五档各 60 局（V1:60 V2:60 V3:60 V4:60 V5:60）全部通过可解性检测；可解性检测失败 0 次` |
| puzzle2 | `generated:300, solveReject:0, colorized:true, avgPieces:8.78`（按档列出 cols/rows/piecesMin） |
| game3-gems | `25 关全部可解：是；难度分布 V1:5 V2:5 V3:5 V4:5 V5:5；搜索超限 0` |
| game4-camping | `五档共生成 300 局 · 解配置通过判定器 300 局 · 失败 0 局；生成重试 3 次；可解性校验拒绝 0 次` |
| game5-lights | `lv1–lv5 PASS` 5/5（K 区间与最优步数逐档核对） |
| game6-code | `lv1–lv5 PASS` 5/5（`any-code worst ≤ 预算` 逐档成立） |
| game7-nonogram | `lv1–lv5 PASS` 5/5（唯一解确认、答案自身即合法解、全空/全满均不误判） |
| game8-targets | `5/5 100.0% · 共 15 局 · 校验通过 15 · 生成重试 0` |
| game9-slide | `汇总 5/5 100.0%`（空位=1 重复=0 越界=0、最短解 ≤ k、逆序回放判定通过） |

全日志 **0 处 FAIL**（各关的"失败/拒绝/超限"计数均为 0）。

**一处交叉印证**：game5 自检的 lv4 行为 `k∈[8,10] · 生成 k=10 · 最优 7 步`，与 §八之三 独立测得的"V4 才出现 `k>min` 容忍带"完全一致——两条互不相关的路径得到同一结论。

## 十二、主线流程（终端身份验证）真实通关复验

前述各节验证的是"各关能玩"；本节验证**项目的主线框架**——终端抽题 → 真实游玩 → 回写。此前该流程只有 **合成消息**验证（`termwin.mjs` 用 `eval` 直接 `postMessage`），DEPLOY.md 清单第 2 项因此长期未勾选。

**方法**：`termjourney.mjs` —— 清空档案 → 线上 `terminal.html` 注册 → 等匹配 → 在其 `#frame` iframe 内**用触摸事件真玩随机抽到的那一关** → 读 `endland-matchlog` 与 `endland-stats`。抽到无内置真解法的关（puzzle2）或 iframe 未就绪时自动重抽。

**线上实测（3 次真实通关）**：

| 抽到的设备/难度 | 触摸次数 | matchlog | stats |
|---|---|---|---|
| V-40057 game5 **V5** | 12 | `{game:"lights",id:"V-40057-lv5",lv:5}` | `{stars:3,moves:12,pass:true}` |
| V-40057 game5 **V4** | 7 | `{id:"V-40057-lv4",lv:4}` | `{stars:3,moves:7,pass:true}` |
| V-40059 game7 **V4** | 32 | `{game:"nonogram",id:"V-40059-lv4",lv:4}` | `{game:"nonogram",stars:3,moves:32,pass:true}` |

**附带印证**：`matchlog` 的 `lv` 与抽到的档位一致（V5/V4），说明历史上"终端流程里 `?lv=` 失效、难度永远 V1"的坑确实已修（见 `docs/difficulty-axis.md`）。

**探针限制（如实记录）**：终端收到 `pz-solved` 后先 `logStats`、再打印成功文字、随即 `location.href` 跳到 `hub.html`；跳转后 CDP 的执行上下文销毁，故探针读 `#screen` 常得到空串。**功能性完成由 `pass:true` 与 `lv` 正确性证明**，不依赖那段可见文字。

## 十三、页内难度切换按钮实测（此前只用过 `?lv=`，按钮从未被点过）

`level-spec.md` §四 声明"挑战界面顶部加难度选择：V1–V5 五个切换按钮（当前高亮），**切换即按新难度重开一局**"。此前所有探针都靠 URL 的 `?lv=` 设档，**这些按钮本身从未被验证**——若某关按钮失效，用户就无法在页内换档。

**方法**：`diffbtns.mjs` —— 390×844 触摸，逐关加载 `?direct=1&lv=1`，然后**依次点击 V1→V5 五个按钮**（每次点击前重取坐标、必要时滚入视口），每次断言两件事：① 该关的档位变量等于所点档位；② 题面签名与上一次不同（即真的重开了一局）。

| 关卡 | 按钮定位 | 结果 |
|---|---|---|
| game1-circuit | `.lvbtns button`（第 N 个） | 5/5 |
| puzzle2 | `#lvBar .lvbtn[data-lv]` | 5/5 |
| game3-gems | `#tabs .tab`（第 N 个） | 5/5 |
| game4-camping | `#diffBar .diffbtn[data-lv]` | 5/5 |
| game5-lights | 同上 | 5/5 |
| game6-code | 同上 | 5/5 |
| game7-nonogram | 同上 | 5/5 |
| game8-targets | `.diffbtn`（第 N 个） | 5/5 |
| game9-slide | `#diffBar .diffbtn[data-lv]` | 5/5 |

**合计 9 关 × 5 档 = 45/45 起效**（每档均为"档位变量✔ + 新题面✔"）。题面签名取各关自身状态（game1 每块旋转数、puzzle2 块列表、game3 关卡 id、game4 帐篷坐标、game5 init+k、game6 secret、game7 尺寸+答案、game8 尺寸+目标数、game9 盘面大小+参考步数）。

## 十四、`?export=1` 导出契约核验（2026-11-09：发现并修复 3 处断线）

`docs/conventions.md` 承诺「九关全部」在 `?export=1` 时向 console 打印当前局 level JSON，但此前只核验过 5 关。
本轮用 `_verify/endfield-captcha/exportcheck4.mjs`（CDP + `Runtime.consoleAPICalled` 捕获）把 4 个未核验关卡 × 2 条入口路径各跑一遍，字段按 game/id/lv/name/desc/play/params/enabled 核对：

| 关卡 | `?direct=1&lv=3&export=1` | `?lv=3&export=1` | 字段 |
|---|---|---|---|
| game4 露营 | ✔ camping-3-lv3-* | ✔ | 8/8 |
| game5 灯光 | ✔ lights-3-lv3-* | ✔ | 8/8 |
| game7 残影 | ✔ nonogram-3-lv3-* | ✔ | 8/8 |
| game9 滑块 | ✔ sliding-3-lv3-* | ✔ | 8/8 |

三处断线同属一类：导出挂在 `onReady()` 上，而入口路径根本没走到它。

1. **game5**：`bootChallenge()` 结尾漏调 `onReady()`（该函数此前在 game5 里是死代码）⇒ 任何路径都不打印 `[GT-INIT]`/`[EXPORT]`。已在 `bootChallenge()` 末尾补 `onReady();`。
2. **game4 / game7**：`?direct=1` 只自动点人机验证框，题面由「验证成功」回调里的 `newChallenge()` 建立，而该回调不调 `onReady()` ⇒ 直通路径既无 `[G*-INIT]` 也无导出。已在两处回调的 `newChallenge();` 之后补 `onReady();`。
3. **game9**：`onReady()` 只打 INIT；导出写在 selftest 与默认分支（game9-slide.html:729/736；`?direct=1` 分支的导出补在 :723），`?direct=1` 分支没有 ⇒ 直通路径不导出。已在该分支补 `if(qs.get('export')==='1')doExport();`。

回归（`selftest4.mjs`）：game4「五档 300 局 · 失败 0 局」、game5「全档通过 · 5/5」、game7 `[G7-TEST] lv1–lv5 PASS`、game9「汇总 5/5 100.0%」；八次导航 `exceptionThrown` 均为 0。

遗留（只改文档、未动代码）：`LEVELS_META` 仅定义于 game3/game4/game6/game8/game9，game1/puzzle2/game5/game7 没有；当前没有任何页面消费它（管理后台未接入），故本轮把 `docs/level-spec.md` 的表述改成实况，未给四关补该变量。**（→ 已于 2026-11-10 补齐四关并回改本句所述的表述，见 §三十二。）**

## 十五、钩子契约逐项行为核验（2026-11-09：`?stage` / `?fast` / `?pause` / `?reset` / `?wait`）

`docs/conventions.md` 的钩子表此前只有 `?lv`/`?seed`/`?selftest`/`?export` 真正实测过；本轮把余下五项逐条跑到行为层。

| 钩子 | 文档口径 | 实现位置 | 行为证据 | 结论 |
|---|---|---|---|---|
| `?stage=N` | 仅 game3：关卡号，优先于 `?lv` | game3-gems.html:772-779 | 导出 id 形如 `'gems-'+L.id+'-'+随机四位`（game3-gems.html:742）：`?stage=1`→`gems-1-*`、`?stage=3`→`gems-3-*`、`?stage=3&lv=1`→`gems-3-*`（中段是关卡号，故优先级成立） | ✔ |
| `?fast=1` | 仅 game8：跳过动画/加速 | game8-targets.html:184/410/549/572 | `#mask` 显形耗时：常规 600/620ms，`?fast=1` **39/42ms** | ✔（修复后） |
| `?pause=1` | 仅 admin：自测时停在登录门禁 | admin.html:2230-2239 | `admin.html?selftest=1&pause=1` → console 出现 `[ADMIN-TEST] pause=1：停留登录界面…`（2 条），登录界面仍在 | ✔ |
| `?reset=1` | 仅 terminal：清空 `endland-user` | terminal.html:151-152 | 播种 `{name:'哨兵乙'}` 后带 reset 打开：打印「档案已清除，重新注册」、localStorage 不再含哨兵乙、随后按输入重建档案（含「探针」） | ✔ |
| `?wait=N` | 仅 terminal：结果等待超时（默认 600000） | terminal.html:61/143 | `?wait=2500`：iframe 出现后 **+2.3s** 打印「设备无响应（等待超时），连接已中止」→ 数据行 → 失败台词 → 跳 hub | ✔ |

**本轮修掉的缺陷（game8）**：`?direct=1&fast=1` 下面板永不显形。原因：直通分支在 `box.onclick` 接线（game8-targets.html:563）**之前**同步执行 `$id('captchaBox').click()`，而 FAST 走的正是这条同步路径，点击落空；非 FAST 路径因为 `setTimeout(…,150)` 反而正常。已改成 FAST 也延到下一轮事件循环（`setTimeout(…,0)`）并留注释：实测 42ms vs 修复前「3s 内从不显形」。

**已确认不是缺陷**：`mistakes` 字段。`docs/conventions.md:28` 明写「父页当前不读取它（hub.html / terminal.html 均未改动）」，与实现一致——terminal.html 内没有任何 `mistakes` 引用（grep 只命中一句台词里的「失误」二字）。

**待定（只记录，未改代码）**：terminal 在失败/超时后仍会打印「身份验证成功」并跳转 hub（terminal.html:198-209 无条件执行），与上一行「设备无响应（等待超时），连接已中止」口径相冲。属产品口径问题，交你定夺。 **（→ 已于 2026-11-10 处理，见 §三十二。）**

探针：`hooks3.mjs`（stage）、`fastcheck.mjs`（fast 计时）、`pausecheck.mjs`（pause）、`termreset.mjs` / `termwait2.mjs` / `termwait3.mjs`（reset 与 wait，含 150ms 高频采样抓 1.5s 超时窗口）。

## 十八、admin 写面扫尾：发现并修复「危险区两步确认走不完」（2026-11-09）

**缺陷（已修）**：三个危险操作（清空统计 / 重置配置 / 全部清空）用 `confirmTwice` 做两步确认，但**第二步模态刚打开就被关掉**，导致「执行」永远点不到、操作永远不执行。

- 代码链：`showModal` 开头就 `closeModal()`（admin.html:570）；`showModal` 的按钮处理器在 `bd.onClick()` 未返回 `true` 时会再 `closeModal()`（:586-590）。而 `confirmTwice` 第一步「继续」的处理器里调用了第二段 `showModal(...)` 却没返回 `true`（:1965-1971，**此行号写于修复前**；修复后该段为 :1965-1972，`return true;` 与说明注释在 :1971-1972）⇒ 第二段模态被立刻关闭。
- 实测证据（修复前）：点「继续」后 DOM 内已无模态、`执行` 按钮 NOT_FOUND，`endland-stats` 哨兵值原封不动 ⇒ 三个按钮全是死路。
- 修复：在「继续」处理器末尾 `return true;`（admin.html:1971-1972，附说明注释）。
- 修复后实测：`继续` → `执行` 均命中且真的执行——**清空统计**（删除 `endland-stats`/`endland-matchlog`）、**重置配置**（`endland-admin-cfg` 删除后被 `loadCfg()` 立即重建为默认：`globalDist=20,20,20,20,20`）、**全部清空**（清空后仅剩 `endland-admin-cfg`（默认）与 `endland-hub-progress`，凭据/关卡/统计/用户键全删）。
- 影响面：`confirmTwice` 仅被这三个按钮调用（admin.html:1896 / 1911 / 1928）。

**本轮补齐的写面实测**

| 写面 | 驱动方式 | 证据 |
|---|---|---|
| 难度 · 全局概率 | 键盘方向键调 `.ph` 手柄（`role="slider"`，admin.html:925-963） | 20,20,20,20,20 → **24,16,20,20,20**，面板 Σ 仍显示「100% · 合法」，`endland-admin-cfg.globalDist` 随之落库 |
| 难度 · 关卡覆盖 | 25 个 `input[type=number]`（5 行 × 5 段）填 `[30,30,20,10,10]` → 点首行「保存覆盖」 | `levelDist = {"circuit":{"1":[30,30,20,10,10]}}`（非默认值） |
| 帐户 · 改凭据 | `#acCur` 当前密码 + `#acP1`/`#acP2` 新密码 → 保存凭据 | 当前密码错 → `.msg`「当前密码不正确」且不写；正确 → `endland-admin-cred.pass=probe123456` + 「✓ 已保存。帐号 admin…」；再用「恢复默认 admin / 123456」走两步模态恢复成功 |
| 危险区 · 三连 | 清空统计 / 重置配置 / 全部清空（各走两步模态） | 见上方修复后实测 |

**未验证项（如实记下）**：全局概率条的**拖拽**路径——处理器链已触发（`pointerdown`→`pointermove`→`pointerup` 后弹出「全局概率已保存（Σ=100%）」，即 `end()` 里的 `saveCfg()` 执行了），但本探针环境里 `.pbar` 量到宽度 0（该面板容器 `display:none`，CSS 本身是正常块级 flex），坐标→百分比映射未能验证。键盘路径已完整验证数值写入。

**回归**：`admin.html?selftest=1` → 15 条 `[ADMIN-TEST]`、0 异常、0 失败（`rendered menus` 全 `ok:true`）；`?selftest=1&pause=1` 仍停在登录门禁。

探针：`admin_rest.mjs`…`admin_rest6.mjs`、`admin_diag.mjs`（定位模态被关）、`admin_selfcheck.mjs`（修复后回归）。本轮我自己的探针坑：注入表达式里夹了真换行、选择器猜错（真实是 `input[type=number]` 与 `.msg`，不是 `#number`/`.errline`）、CDP 鼠标事件不合成 pointer 事件。

## 十九、dom-consistency 审计的复核重跑（2026-11-09）

把 `docs/dom-consistency.md` 的每条断言跑成机器检查，并重跑它自己的 oracle。

**静态核对（与文档表逐行对上）**：重绘入口定义齐全——game1 `refresh`:316、puzzle2 `renderPlaced`:597、game3 `render`:431、game4 `refresh`:452、game5 `paintBoard`:415、game6 `paintSlots`:575、game7 `refreshAll`:605、game8 `refresh`:350；机制断言也成立——game3 `HINT_SHOW=6000` 的定时 `hintAll()`（:462/:473 两处），game7 `refreshAll()` **全仓只有一处调用**（:679 `buildGrid();refreshAll();`，与「正常游玩路径不经过它」一致）。

**重跑结果**

| 脚本 | 复现内容 |
|---|---|
| `audit_dom.mjs` | 8 关总表：game1/puzzle2/game5/game8 「有效・✓一致・敏感自检过」；game3 ✗（`spot origin` ↔ `spot origin legal hint`）与 game7 ✗（`cell fill wrong` ↔ `cell fill`）——正是文档 §二 已定性的两处 class-only 差异，逐字复现；game4/game6 仍显示「⚠无效(点击未见DOM变化)」，与文档「有效性来自修正靶点后的补测」一致 |
| `audit_dom3.mjs` | game4、game6 修正靶点/容器后：`点击后变化=true · 入口=ok · 结构一致=true · 整串一致=true` ✔ |
| `clear_g9_touch2.mjs` | game9 逐步比对：22 步全程 `匹配=true`，终态 `solved:true · moves=22=ref · stars=3 · mistakes=0`，回传父页 `{lv:1,stars:3}` ✔ |

**本轮修正的一处文档错误**：`docs/dom-consistency.md` §二 表里 game9 的重绘入口写作 `renderBoard`——**该函数在 game9-slide.html 中不存在**。真实的整体重建入口是 `buildBoard()`（:319，`b.innerHTML=''` 后按 `board` 数组重建），增量入口是 `paintMovable()`（:357）。已更正，并在该文档 §三 前补一句说明：game9 那行的证据是**状态级**逐步比对（页面 `board` 数组 vs 模拟 board），而非本文 §一 的 DOM 增量/重绘对比。

**结论**：该审计的结论仍然成立（8 关无内容/结构级渲染缺陷，两处 class-only 差异属设计内瞬态；game9 修复后逐步全匹配），仅入口名一处笔误已修。

## 二十、worldbible 文本一致性核对（2026-11-09）

`docs/worldbible.md`（400 行）是**改皮提案 + UI 规范**，其中可机器核对的断言本轮逐条跑过。

**① 设备号 ↔ 关卡映射（与 conventions.md §一 一致）✔**
九关页面都显示自己的编号：game1 `V-40053` · puzzle2 `V-40054` · game4 `V-40055` · game3 `V-40056` · game5 `V-40057`（`.devid`）· game6 `V-40058` · game7 `V-40059` · game8 `V-40060`（`V-40060 · TARGET SCREENING` + `<h2>特征筛查 V-40060</h2>`）· game9 `V-40061`（`#mDev 设备 V-40061 · 滑块还原`）。§5.1 表九行完整（含 60/61）。

**② §5.1 的「新名称」是提案名，与线上现状名不同**——已在文档中标注对照：`V-40053` 源石电路维修 · `V-40054` 方块拼装作业 · `V-40056` 宝石神偷 · `V-40055` 露营达人 · `V-40057` 灯光矩阵校验 · `V-40058` 口令破译 · `V-40059` 图形校验 · `V-40060` 目标点选 · `V-40061` 滑块还原（即各页 `<title>`）。

**③ §4 幕次表的「4 台设备」是世界设定层说法**：线上实际 9 台，终端每次访问**随机派 1 台**（本轮观察到 V-40057 lv5 / V-40060 lv4 / V-40061 / V-40056 lv3 等不同派单）；文档里已加「线上实现口径」说明，避免读者以为终端会依次跑 4 台。

**④ §7.1 色板 Token：文档列出的名字与值全部已存在于页面 ✔，仅两处偏离**
全部 token（`--bg-deep:#0d1217`、`--bg-line:#0e1318`、`--surface-1/2/3`、`--tile`、`--tile-alt`、`--line2:#3a4550`、`--warn:#ff8f5e` 等）都能在页面 `:root` 里按文档值找到。偏离清单：
- `terminal.html` 自带一套暗色面（`--bg:#050708`、`--ink:#c8d2da`，另有自己的 `--bad`），其余 12 页统一 `--bg:#0b0e11` / `--ink:#d9e0e7`——判为 CRT 风格的刻意差异；
- `puzzle2.html` / `game4-camping.html` / `game8-targets.html` 的 `--bad` 用了 `#ff5d5d` / `#ff5f56`，其余 10 页为标准的 `#ff5252`——这正是该文档「规范化」目标里的一条待收敛项（未改代码，属设计决定）。

**⑤ §6 文案库落地情况（16 条）**
- 通关文案 8 条：**仅 1 条**已在关卡中出现（「通行印已签发」→ game6）；
- 失败吐槽 8 条：**4 条**已逐字出现（「快得像在被谁遥控」game7、「判定为疑似渗透体」game6+game7、「偷运的零件」game6+game7、「机器精度，人类代价」game7）。
其余 11 条仅存在于文档，属提案未落地；各关另有自己的 `QUIPS`/`FAILQUIPS` 数组（§4 第三幕即取其风格，「行为特征：…✔ 人类概率 99.x%」）。两节都已加上落地核对标注。

**探针/方法**：本轮以「逐条标记 → 全仓 grep → 按文件汇总」的方式核对（`worldbible.md` 的 16 条文案标记、9 个设备号、20 个 token 名值），未新增脚本文件。

**我自己的工具坑（两次踩到，记此备查）**：`grep` 工具上限 250 条匹配，我先后因截断误判「game8/game9 不显示设备号」与「§5.1 只列 7 台」——两次都是假象；用窄模式或分次 grep 才能得到完整结论。

## 二十一、交付摘要（2026-11-09 · 本会话）

范围：九关拼图验证套件「访客协议」（hub → iframe 关卡 → terminal → admin）。本会话在既有基线上做「文档承诺 vs 实测」的逐条核验与修复。

### 修掉的真缺陷（5 处，均有修复前后证据）

1. **game9 滑块 P0 渲染**：doMove 把移动前后的空格写反 → 方块消失 + 幽灵 0 + 消失方块不可点；selftest 全绿却可复现，逐步比对定位到首步分歧。
2. **?export=1 断线（提交 fd3b6bc）**：game5 的 bootChallenge() 漏调 onReady()（该函数成死代码）；game4/game7 的「验证成功」回调不调 onReady()；game9 的 ?direct=1 分支漏导出。修后 4 关 × 2 条入口路径共 8/8 都打 INIT+EXPORT、字段齐全。
3. **game8 ?direct=1&fast=1 面板永不显形（提交 b5dcdc6）**：直通分支在 box.onclick 接线之前同步 click()，而 FAST 走的正是这条同步路径。修后 42ms，常规路径 620ms。
4. **admin 危险区两步确认走不完（提交 d25a73e）**：confirmTwice 打开第二段 showModal 后未返回 true，被外层 closeModal() 立刻关掉 ⇒ 清空统计 / 重置配置 / 全部清空三个按钮全是死路。修前实测：点「继续」后 DOM 内已无模态、执行按钮 NOT_FOUND、哨兵数据未被清。
5. **横屏「页脚不可达」（提交 d38dd8b）**：game1 / game3 / game8 的面板（固定层 `#mask` 内的 `.modal`）无高度上限且 `overflow:hidden`，横屏 844×390 下面板高 575 / 535 / 683 而视口仅 390 —— 页面虽可滚但带不动固定层面板，于是 **game1 的 V1–V5 难度按钮与「换一个」、game3 的「换一关」、game8 的「提交核验/放弃/静音」全部点不到**。已按健康页（puzzle2/game6/admin）的模板补 `max-height:96vh;overflow-y:auto` 并把规则末尾的 `overflow:hidden` 改为 `overflow-x:hidden`（顺序细节见 §二十二）。

本会话更早已修复并验证：puzzle2 手机竖屏格子尺寸反算（含旋转后重排）、game5/game4/game6 横屏元素不可达（棋盘或提交按钮落到折叠线以下）、game3/game9 横屏留白压缩。

### 本会话完成的契约核验（全部有实测证据）

1. 导出契约：九关 ?export=1（?direct=1 与普通进入两条路径）→ 9/9，game/id/lv/name/desc/play/params/enabled 齐全、0 异常（§十四）。
2. 钩子契约：?stage / ?fast / ?pause / ?reset / ?wait 五项逐条行为核验通过（§十五）。
3. postMessage 契约：pz-solved 九关都发、pz-failed 四关发（game3/6/7/8）；13 个发送点全部在父窗判断内；以 hub 为父页实测失败分支闭环（toast + stars:0/pass:false 落库）（§十六）。
4. admin 写面：redirect、自定义关卡上传/样例写入/非法拦截、难度全局分布（键盘手柄）、关卡覆盖、改凭据、危险区三连——全部落到 localStorage，有消费方的都在 terminal/游戏端生效（§十七/§十八）。
5. 文档一致性：dom-consistency 的 oracle 重跑复现（8 关总表 + game4/game6 修正靶点 + game9 逐步全匹配），修正 1 处入口名笔误（renderBoard → buildBoard）（§十九）；worldbible 的设备号/现状名/色板/文案库逐条核对并标注（§二十）。

6. **控件可达性（§二十三）与动作级复核（§二十四）**：两朝向 × 九关 × 五档 = **90/90 无不可达控件**（判据含「容器是否用户可滚」）；横屏下真实触摸点 V5 / 换一关 / 放弃，状态与 toast 均生效。
7. **真机点检清单**：新增 `docs/realdevice-checklist.md`（第 10 篇文档），含竖屏各关 V3/V5 可点单元实测尺寸（最紧的是 game7 V5 约 20px）、18 条点检项与记录模板。

### 合计验收数字

九关导出契约 9/9 · 九关内置自检零失败 9/9 · 九关 × 五档难度按钮 45/45 · **控件可达性两朝向 90/90** · 竖屏触摸通关 9/9 · 12 页 × 两朝向 0 异常 · admin 自检 15 行 0 失败 · 线上 Pages 已带全部修复（含横屏修复 d38dd8b）。

### 未决（等你定，未动代码）

1. LEVELS_META 仅 game3/4/6/8/9 定义，game1/puzzle2/game5/game7 缺失（当前无任何页面消费）→ 触发条件：要接管理后台。 **（→ 已于 2026-11-10 按推荐路径补齐四关，见 §三十二。）**
2. terminal 失败/超时后仍打印「身份验证成功」并跳 hub（terminal.html:198-209 无条件执行）→ 触发条件：希望失败者被拦在门外。 **（→ 已于 2026-11-10 处理：terminal.html:198 改为随结果显示（pass→身份验证成功 / fail·timeout→身份验证未通过）；跳转**未改**，因 hub 的解锁门禁由 hub 自己监听 pz-solved 写入，terminal 的 pass/fail 不参与门禁。见 §三十二。）**

### 未验证 / 局限

- ~~全局概率条的拖拽坐标映射未验~~ → **已于 §二十六 验证通过**（此前量到 0 宽是面板 `display:none` 造成的测量假象）。
- 真机触摸手感（尺寸/帧率/发热）只能人工在手机上跑；本套证据只覆盖 CDP 触摸仿真。
- grep 工具 250 条上限让我两次误判（已记 §二十）；引用本套结论时请注意证据来源。
- 代码结论绑定各自那一节的提交（导出 `fd3b6bc`、game8 `b5dcdc6`、admin `d25a73e`、横屏 `d38dd8b`）；之后若有改动，需重新核对。
- 截至本摘要更新时，有若干纯文档提交因 **Watt Toolkit（Steam++）加速器未运行**（它写进 hosts 的 `# Steam++ Start…End` 段把 `github.com` / `api.github.com` 指向 `127.0.0.1`，而其本地代理未启动）尚未推到远端；线上运行时代码不受影响。详见 `DEPLOY.md`「重放的第三个坑」与本文 §三十三。

### 运行环境（复现用）

node _gt_srv.js（端口 8099，cwd 必须为仓库根）+ Edge --headless=new --mute-audio --remote-debugging-port=9222；探针全部位于 _verify/endfield-captcha/（不随仓库发布）；远端同步用 node --use-system-ca rebuild_history.mjs，且必须在仓库目录内执行。

## 二十二、横屏「页脚不可达」缺陷的发现与修复（2026-11-09）

### 缺陷

横屏 844×390 下，三关的关卡面板（固定层 #mask 内的 .modal）比视口还高、却又滚不动，页脚控件整块落在视口外且无任何滚动路径可达：

| 关卡 | 面板高度（V3 / V5） | .modal 规则 | 不可达控件（修复前实测） |
|---|---|---|---|
| game1-circuit | 575 / 575 | 无高度上限 + overflow:hidden | V1–V5 难度按钮 @447、换一个 ↻ @447（6 项全 out） |
| game3-gems | 535 / 535 | 同上 | 换一关 ↻ @423 |
| game8-targets | 661 / **683** | 同上 | 提交核验 @492、放弃 @492、静音 @492 |

关键点：页面虽然「可滚」（game1 82px / game3 104px），但面板在 position:fixed 的 #mask 里，页面滚动根本不带动它；#mask 自身 overflow-y:visible、.modal 又是 overflow:hidden ——三处都不提供滚动路径，所以这些控件是真的点不到。（game8 的提交按钮因「选够数量即自动提交」而影响较小，game1 的难度切换与 game3 的换关则是实打实的功能丧失。）

### 修复

对照健康页：puzzle2 / game6 / admin 的 .modal 都写了 max-height:96vh;overflow-y:auto，且规则里没有 overflow:hidden —— 所以它们的页脚永远能滚到。按同一模板给三关补规则：

1. .modal 增加 max-height:96vh;overflow-y:auto；
2. 把规则**末尾**的 overflow:hidden 改成 overflow-x:hidden。

> 第 2 步不可省：CSS 同规则内后者胜，末尾的 overflow:hidden 会把前面写的 overflow-y:auto 覆盖掉。我的第一版补丁就漏了这一步——面板被压到 374 但计算值仍是 overflow-y:hidden，探针里「滚到底后命中」是程序化设 scrollTop 造成的**假绿**；靠 getComputedStyle 复核 overflow-y 才抓到。

### 复核（修复后）

横屏 844×390，V3 与 V5 两档：三关 overflow-y 计算值均为 auto、**用户可滚**（scrollMax：game1 201 / game3 161 / game8 287）；滚到底后 V1–V5、换一个 ↻、换一关 ↻、放弃、提交核验**全部命中自身（:hit）**。

竖屏 390×844 零回归：三关 pageScroll=0、contentFits=true（内容未超高，不产生滚动条）；游戏自检 game1「五档各 60 局全部通过、可解性检测失败 0 次」、game8「[G8-TEST] 自测全部通过」、game3 0 失败 0 异常。

### 未改但记录在案

- game4 / game7 / game9 的 .modal 同样没有高度上限，当前内容不超高（V5 时 game7 439、game4 443、game9 374）所以无碍；内容一长会重演同类问题，届时按同一条模板补（YAGNI，先不动）。
- game7 的棋盘在 V5 时底行超出 81px，靠 .nono 自带的内部滚动兜住（设计内）；puzzle2 面板可滚、页脚需滚到底（设计内）；game5 的换一个超 11px 但页面可滚 61px（可达）。
- docs/layout-viewport.md §二 已补一条判定：横屏除了「横向溢出=0」，还要保证**页脚与难度控件在可滚动容器内可达**——原口径只测横向溢出与页面内滚，所以漏掉了这一类。

探针：measure_cells.mjs / measure_fold.mjs（两朝向的格子与折叠线测量）、submit_reach.mjs / landscape_reach2.mjs / landscape_reach3.mjs（可达性与仿真模式对照）、modal_reach.mjs / modal_matrix.mjs / modal_v5.mjs / g8_clip.mjs（面板几何与不可达清单）、modal_fix_verify.mjs / modal_fix_verify2.mjs（修复前后复核）、modal_fix_selftest.mjs（自检回归）。

## 二十三、控件可达性最终扫描：两朝向 × 九关 × 五档 = 90/90（2026-11-09）

修复 game1/game3/game8 的横屏页脚之后，按**同一口径**把两个朝向整体扫一遍，作为横竖屏的最终结论。

**判据（比早期版本严）**：对每关的 V1–V5 难度按钮、提交 / 换一个 / 换一关 / 放弃 等页脚控件逐个判定 —— 先在「滚动条归零」状态下看中心点是否命中自身；若不命中，**仅在容器真的用户可滚**时（`getComputedStyle` 的 `overflow-y` ∈ {auto, scroll}）滚到底再判一次；仍不命中则把页面滚到底再判一次。三次都不命中才判「不可达」。这条判据覆盖了「页面可滚但面板在 fixed 层里」这种早期漏掉的情形。

| 视口 | 扫描次数 | 有不可达控件的组合 | 结论 |
|---|---|---|---|
| 竖屏 390×844（dpr3，触摸仿真） | 九关 × 五档 = 45 | **0** | 45/45 全绿 |
| 横屏 844×390（dpr3，触摸仿真） | 九关 × 五档 = 45 | **0** | 45/45 全绿 |

每关五档逐条均为 `ok`。探针：`landscape_final.mjs`（横屏）、`portrait_final.mjs`（竖屏，同一脚本换视口）；两者都在 `?direct=1&lv=N` 下加载，等页面稳定后逐项做 `elementFromPoint` 命中测试。

**口径说明（与早期结论的差别）**：早先记录的「横屏 7/9 免滚动」测的是**棋盘与格子**是否可达；本次测的是**页脚控件**是否可达。两个口径合起来才是完整结论：横屏下 game1/game3/game8 的面板需要少量内滚（已修，见 §二十二）、puzzle2 面板需滚到底、game7 的棋盘靠 `.nono` 内部滚动 —— 但**没有任何一个控件是不可达的**。

**未覆盖**：真机触摸手感（尺寸/帧率/发热）仍需人工在手机上跑；本套证据只覆盖 CDP 触摸仿真。

## 二十四、横屏修复的动作级复核：命中 ≠ 生效（2026-11-09）

§二十三 判的是「控件可达（命中自身）」。可达只是必要条件——**按下去是否真的产生效果**要在动作层再验一次：在横屏 844×390 下用真实触摸事件（`Input.dispatchTouchEvent`）点这三关的页脚控件（先把面板滚到底），再读该关自己的状态。

| 关卡 | 点的控件 | 状态读数 | 结果 |
|---|---|---|---|
| game1-circuit | **V5** | `curLv` 3 → **5** | ✔ 难度真的切换 |
| game3-gems | **换一关 ↻** | `cur.id`/`cur.name`/题面签名：12 终局远征 → 14 断层回响 → 14（随机重抽到同一关）→ 12 终局远征 | ✔ 真的换关（第 2 次抽到同一关属随机，不是失效） |
| game8-targets | **放弃** | 点后 toast 出现「**筛查已放弃**」 | ✔ 处理器真的执行（棋盘 DOM 签名不变是因为放弃只提示、不重建盘面） |

**两条自省（都属探针问题，不是产品问题）**：

1. 首轮复核我用 `cur.id` 单一读数 + `pz.seed` 当指纹，得到「未变」的假阴性——`pz` 上没有 `seed`（读成 `undefined`），而换一关本来就可能随机抽到同一关。改为「id + 名称 + 题面签名」三读数、连点三次后，确认换关生效。
2. 第二轮 game8 的「DOM 签名不变」也一度像失效，直到把 toast 一起读出来——「放弃」的语义只给提示、不重建盘面，所以签名本就不该变。**判定效果要读该动作自己的语义字段，而不是随便挑一个看起来会变的量。**

探针：`landscape_tap_effect.mjs`（首轮，含假阴性）、`landscape_tap_effect2.mjs`（改进指纹后的复核）。

## 二十五、改动收口后的九关完整回归（2026-11-09）

本轮把会话内所有改动（4 个关卡的 JS + 3 个关卡的 CSS + 若干文档）之后的九关整体跑一遍，作为收口证据。

| 项 | 方法 | 结果 |
|---|---|---|
| 内置自检 | 九关 `?selftest=1`，统计 FAIL 行与 `exceptionThrown` | **9/9 零失败、零异常** |
| 导出契约 | 九关 `?direct=1&lv=3&export=1`，核对 `game/id/lv/name/desc/play/params/enabled` | **9/9 字段齐全**（circuit / packing / gems / camping / lights / code / nonogram / targets / sliding） |
| 竖屏触摸抽验 | 三个改过 CSS 的关卡（game1 / game3 / game8）在 390×844 下点棋盘中心格，比对点击前后的 DOM 指纹 | **3/3 状态确实变化** |

**第三次自省（探针的指纹选型）**：首轮抽验 game1 报「DOM 签名变化=false」，看着像点击失效。实际原因是两点叠加：① game1 的旋转走**内联 CSS 变量** `--r`（`.tile svg{transform:rotate(var(--r,0deg))}`，game1-circuit.html:67），改的是 style 而不是 className；② 我的签名把字符串**截断到前 60 字符**，而中心格是第 13 个元素，变化落在截断之外。改成「读取内联样式 + 不截断（只看长度与全串比对）」后，实测点两次签名长度 301 → 302 → 303，旋转矩阵也在变 —— 点击一直是好的。

> 教训（已累积三条同类）：判定「有没有变化」时，指纹要覆盖**该交互真正改写的那些属性**，并且**不要截断**；截断 + 选错属性会稳定地产生假阴性，而且方向总是「看起来像产品坏了」。

探针：`final_regression.mjs`（自检 + 导出 + 触摸抽验）、`g1_tap_probe.mjs`（game1 旋转指纹复核）。

## 二十六、收掉最后一个未验证项：admin 难度条拖拽（2026-11-09）

§二十一 的「未验证/局限」里曾记着一条：**全局概率条的拖拽坐标映射未验**（当时探针读到 `.pbar` 宽度为 0，怀疑面板没真正显示）。本轮把它收掉。

**关键发现：宽度 0 是测量artifact（面板当时 `display:none`）**。改用**真实鼠标事件**点「难度」菜单（而不是 `element.click()`）后：

- 面板可见性 = `block`，`.pbar` 宽度 = **955px**（此前 0）；
- 在分界手柄上派发 `pointerdown → pointermove → pointerup`（合成 PointerEvent，x 455 → 550）后：`endland-admin-cfg.globalDist` 由 `20,20,20,20,20` 变为 **`30.1,9.9,20,20,20`**（Σ 仍 100%），并弹出 toast「**全局概率已保存（Σ=100%）**」——即 `end()` 里的 `saveCfg()` 确实执行（admin.html:943-948；此处原写作 `endPointer`，本轮更正为该页面真实函数名 `end()`，行号本就正确）。

**结论**：难度条的两条调节路径（键盘方向键、拖拽手柄）都已实测，且都即时落库；`pointerup` 后自动保存、`sanitizeDist` 归一化到 Σ=100 也得到复核。此前记的「拖拽未验」应改为「已验证」——教训与 §二十五 同源：**面板是否真的可见要先测（`display`/宽度），否则会把「量不到」误当成「不工作」**。

探针：`admin_drag_verify.mjs`（真实鼠标切面板 + 合成 PointerEvent 拖拽 + 读 localStorage 与 toast）。

## 二十七、发布前自洽检查：页面引用完整性 + 站点文件清单（2026-11-09）

Pages 是把**仓库根目录**直接发出去的，所以「引用的东西都在、发出去的东西都有用」值得机器核一遍。

**引用完整性（`refcheck.mjs` / `refcheck2.mjs`）**

- **JS/HTML 里拼出来的页面路径共 21 处，指向不存在的文件 0 处**：`hub.html` → 九关（9 张卡片）、`terminal.html` → 九关 + `hub.html`、`index.html` → `terminal.html`、`admin.html` → `hub.html`。这类拼错（卡片/关卡表写错文件名）是本项目最容易出的「静默失效」，本轮确认没有。
- **静态资源引用**：只有 `puzzle2-core.js` 一条（被 `puzzle2.html` 引用）；页面是**单文件自包含**（CSS/JS 全内联），所以没有图片/音频/字体依赖 —— 也就不存在「线上缺资源」的可能。
  - 唯一被工具报为「失效」的 `about:blank` 是 JS 里的 `frame.src="about:blank"` 赋值，属误报。

**站点文件清单（发出去的就是这些）**

- 13 个 HTML：`index.html`（跳 terminal）+ `hub.html` + `terminal.html` + `admin.html` + 九关；
- 1 个外部 JS：`puzzle2-core.js`；
- `docs/`（10 篇维护文档）、`README.md`、`DEPLOY.md`、`.nojekyll`（Pages 需要）；
- **不发**：`_gt_srv.js`（本地静态服务器，已在 `.gitignore` 内，本轮确认无任何页面引用它）。

**结论**：发布树自洽，无失效引用、无随包死资源。

## 二十八、线上站点的行为级复核（2026-11-09）

前面 §二十二/§二十五 的复核都在本地 8099 上做；本轮**直接对已部署的线上站点**做一次行为级检查，确认「线上 artifact ≡ 本地」。

| 项 | 视口 | 结果 |
|---|---|---|
| game1 难度按钮 + 换一个 | 横屏 844×390 | `overflow-y:auto`、可滚 201px；滚到底后 **V1–V5 与「换一个」全部命中** ✔ |
| game3 换一关 | 横屏 | 可滚 161px；**换一关命中** ✔ |
| game8 放弃 / 提交核验 | 横屏 | 可滚 287px；滚到底后**两者均命中** ✔（`V1–V5` 在底部位置被滚到视口上方，属正常，顶部位置命中） |
| 三个改过的关卡 | 竖屏 390×844 | `pageScroll=0`；面板高度 **559 / 714 / 625**，与本地实测逐位相同 ⇒ 线上 CSS 与本地一致 ✔ |
| hub 九卡 | 竖屏 | `#cards` 子元素 = 9，`V-40053`~`V-40061` 设备号 **9/9 命中** ✔ |
| 入口跳转 | — | `/` → `/endfield-captcha/terminal.html` ✔ |

**全程 `exceptionThrown` = 0**（六次线上导航）。结论：线上部署与本地行为一致，横屏修复确实已生效于线上。

> 判据备注：本轮脚本只判「滚到底后是否命中」，所以 game8 一行把顶部位置的 `V1–V5` 记成了 out——那是正常现象（滚到底后它们本就在视口上方），完整判据见 §二十三（顶或底任一位置命中即算可达，结论 90/90）。

探针：`live_behave.mjs`（线上 hub / 入口跳转 / 三个改动关卡的横竖屏可达性与面板几何）。

## 二十九、README 逐条核对（2026-11-09）

README 是读者第一眼看到的东西，此前只零星改过几行，本轮通篇核对。

**核对通过（都有机器证据）**

- 「零依赖、零外链、零字体、零 CDN、断网可用」：全部页面的 `src=` / `href=` 外链子资源 **计数 = 0** ✔（页面是单文件自包含，唯二外部文件是 `puzzle2-core.js` 与不发布的 `_gt_srv.js`）。
- 九关表里的**代号 ↔ 文件**映射：V-40053 / 40054 / 40056 / 40055 / 40057 / 40058 / 40059 / 40060 / 40061 与页面逐一一致 ✔（§五 与 `conventions.md` 一致）。
- URL 钩子表：与 `conventions.md` 及本轮实测一致（`?seed` 八关、`?stage` 仅 game3、`?reset`/`?pause` 单页）✔（§十四/§十五）。
- 目录树与 docs 篇数：10 篇 ✔，站点文件清单一致 ✔（§二十七）。
- 在线地址、快速开始（8099 / 必须走 http 的理由）、双入口说明、星级规则指向 `docs/star-rubric.md` ✔。

**修掉的两处不实描述**

1. 旧文写着「灯光矩阵（game5）暂未内置 `?direct` / `?export` / `?selftest`」——**与它上方表格的「九关全部」自相矛盾，也与实测不符**：game5 三条都已内置，其中 `?export` 的接线缺口还是本会话修好的（§十四）。已改为如实说明并保留一句历史注记。
2. 旧文写「每局在 **V1 源码入门 → V5 深渊协议** 五档中选择」——这两个名字**全仓只出现在 README 自己**（grep 命中 1 处，就是它）。页面里没有全局档位别名，各关档位名各不相同（game5：教学/入门/常规/进阶/极限；game7：教学档…极限档）。已改为「V1–V5（V1 最易、V5 最难）」并注明没有全局别名。

**发现但未擅自改（涉及命名口径，见下）**

**game7 的名称在三个层面分裂**：

| 出现位置 | 名称 |
|---|---|
| game7 页头 `<title>`、`#mSub`、导出 JSON 的 `name`、`hub.html` 卡片、`terminal.html` 匹配表 | **图形校验** |
| game7 自己的档位引导文案（game7-nonogram.html:200-204 五处，如「残影重建 · 教学档：…」；**本节写于改动前，这 5 处已顺延为 :201-205**） | **残影重建** |
| README、`docs/conventions.md`、`admin.html` 关卡菜单、`worldbible.md` 提案 | **残影重建** |

即：**同一页面里页头说「图形校验」，它自己的引导文案说「残影重建」**；而 hub/terminal 卡片跟页头一致、README/admin 跟引导文案一致。这不是文档笔误，是命名口径本身没统一——**已作为待决项交给用户**（改哪一边都只是一行级改动，但选哪个名字是产品决定）。

**→ 已于 2026-11-10 处置（见 §三十二）**：统一采用**图形校验**。同时更正上表第 2 行的一处**列举错误**——本轮实测 `docs/conventions.md` 与 `worldbible.md` **并不含**「残影重建」；实际含该名的是 `README.md:41/114`、`docs/realdevice-checklist.md:24`、`admin.html:389`，另有 `docs/new-puzzles-proposal.md:26` 作为提案里的「主题包装」名保留至今。这条错误列举曾把后续审计引到并不存在的待改文件上。

**README 里尚未逐项实测的**：管理后台「统计页」的具体能力（今日/本周/本月/本年/全部五个时间窗、KPI、每日曲线、三维分布图、导出）——本轮只验过菜单能打开、写面能落库，页内的图表与导出尚未实测，如实记下。

## 三十、admin 统计页与导出的逐项实测（2026-11-09/10）

§二十九 挂出的最后一项（README 声称的统计页能力）本轮实测完毕。

**方法**：先播种跨五个时间窗的数据——`endland-stats` 5 条（0 / 1 / 10 / 40 / 400 天前，含一条 `pass:false`）、`endland-matchlog` 4 条（0–3 天前）；再用**真实鼠标**切菜单与时间窗（`.click()` 会让面板留在 `display:none`，见 §二十六）。

**① 五个时间窗的 KPI 与播种数据逐一吻合**

| 窗口 | 验证次数 | 通关次数 | 通关率 | 匹配次数 | 与播种对照 |
|---|---|---|---|---|---|
| 今天 | 1 | 1 | 100.0% | 1 | ✔ 0 天前各 1 条 |
| 本周 | 2 | 2 | 100.0% | 2 | ✔ 0/1 天前 |
| 本月 | 2 | 2 | 100.0% | 4 | ✔ 10 天前那条落在上月（窗口边界正确） |
| 本年 | 4 | 3 | 75.0% | 4 | ✔ 400 天前那条落在上一年 |
| 全部 | 5 | 4 | 80.0% | 4 | ✔ 全部 5 条、4 条通关 |

**② 图表**：统计页有 **4 个内联 SVG**（代码里是折线图 + 柱状图两个构造函数），几何元素数随窗口重绘：`29 → 31 → 47 → 185 → 189` —— 与 README 说的「每日曲线 + 游戏/星级/难度三维分布」在数量与形态上吻合。

**③ 导出（三个按钮逐一实测，钩 `URL.createObjectURL` + `HTMLAnchorElement.click` 捕获）**

| 按钮 | Blob | 文件名 | JSON 键 |
|---|---|---|---|
| 导出全部数据（JSON） | 36709 B | `endland-backup-2026-11-10.json` | `exportedAt, version, user, cfg, stats, matchlog, levels` |
| 仅导出当前范围 stats | 302 B | `endland-stats-today-2026-11-10.json` | `range, from, generatedAt, stats` |
| 导出汇总报告 | 506 B | `endland-report-today-2026-11-10.json` | `generatedAt, range, from, totals, byGame, byStar, byLv, byDay` |

键名与代码声明（admin.html:1770-1780）完全一致；全程 `exceptionThrown` = 0。结论：README 对统计页的描述成立，§二十九 的「尚未实测」到此关闭。

**第四次同类探针坑（已累积成规则）**：本轮先按精确文字找「导出」按钮——真名是三个（`导出全部数据（JSON）` / `仅导出当前范围 stats` / `导出汇总报告`），所以 NOT_FOUND；改对名字后又空捕获，因为按钮在长页面**视口之外**，真实鼠标点击落在窗口外。加 `scrollIntoView` 并在点击前断言 `inView` 后才拿到结果。

> **规则（四条同源，建议后续探针都照此写）**：判定交互前先确认 ① 目标选择器与真实文案一致、② 目标在视口内、③ 指纹覆盖该交互真正改写的属性、④ 指纹不要截断。四条都踩过，且每次的表象都像「产品坏了」。

探针：`admin_stats_check.mjs`（五窗口 KPI + 图表重绘）、`admin_export_check3.mjs`（三个导出按钮的 Blob/文件名/JSON 键）。

## 三十一、文档 `file:line` 引用漂移检查（2026-11-09）

README 里明确警告过「在文件前部插入行会把后面的引用推后」，而本会话往 7 个游戏页与 admin 里插过行——于是通篇扫一次引用是否漂移（`citecheck.mjs`：把 docs/ 与 README/DEPLOY 里所有 `xxx.html:NNN` 引用抓出来，打印它在当前文件的对应行，人工判定是否还指得中）。

**结果：本会话改动过的文件共 46 处引用，3 处漂移——全部是我自己插行造成的，已修**：

| 引用处 | 原引用 | 现在应指 | 漂移原因 |
|---|---|---|---|
| `realplay.md` §十四 | game9-slide.html:728/735 | **729/736**（并补注直通分支的导出在 :723） | 本轮在 :723 插入导出调用 ⇒ 其后 +1 |
| `realplay.md` §十五 | admin.html:2228-2237 | **2230-2239** | 本轮在 :1971 插入注释与 `return true` ⇒ 其后 +2 |
| `realplay.md` §二十二 | game8-targets.html:561 | **563** | 本轮在 :549 插入 FAST 说明注释 ⇒ 其后 +2 |
| `star-rubric.md` §一/§二（4 处） | puzzle2:862 / game7:692 / game1:392-393 / game5:525-526 | **863 / 693 / 393-394 / 526-527** | 本节在 game1:200、puzzle2:258、game5:179、game7:199 各插入 `LEVELS_META` ⇒ 其后 +1 |
| `layout-viewport.md` §（puzzle2 重排） | puzzle2.html:712-731 | **713-732** | 同上（+1） |
| `realplay.md` §（game5 采样） | game5-lights.html:377-391 | **378-392** | 同上（+1） |
| `realplay.md` §三十一 | game7-nonogram.html:713 | **714** | 同上（+1） |

本轮顺带核对（**无需改**）：`DEPLOY.md:44` 引 `hub.html:134`，实测该行正是 `var url=x.page+'?direct=1&lv='+lv;`；`realplay.md` 里那条「尚未实测的写面」的简写 `admin.html:1580` 指向 `lsSet(LS.cred, …)` 仍正确，而 `admin.html:2088` 曾指向一句 `}`（陈旧），已换成危险区三个按钮与三处 `confirmTwice` 调用的真实行号。

**未受影响的引用（核对通过）**：`star-rubric.md` 的全部九关判据引用（game1:392-393、game3:291/617-618、game4:524、game5:525-526、game6:744-745、game7:692、game8:396、game9:485-487）——它们都落在各自插入点**之前**；`difficulty-axis.md`（game1:199）、`layout-viewport.md`（game5:86 / 90-101）、`dom-consistency.md`（game9:319 `buildBoard`）也都指得中。

> 教训：**插行是有代价的**——每次在文件前部插入内容，都该把该项目文档里指向「插入点之后」的 `file:line` 引用一起 +N。本轮这三处就是代价；检查本身很便宜（一个脚本 + 一次人工对照），建议以后每次改完代码都跑。

node _gt_srv.js（端口 8099，cwd 必须为仓库根）+ Edge --headless=new --mute-audio --remote-debugging-port=9222；探针全部位于 _verify/endfield-captcha/（不随仓库发布）；远端同步用 node --use-system-ca rebuild_history.mjs，且必须在仓库目录内执行。


## 十六、`pz-failed` 失败分支闭环核验（2026-11-09：首次端到端实测）

`docs/conventions.md` §二 把失败消息定为 `{type:'pz-failed', device, lv, moves}`，并规定「仅当 window.parent !== window 时才发送」。此前只有 `pz-solved` 有端到端证据，失败分支从未实测。

**静态核对（全仓 13 个发送点）**：`pz-solved` 九关都发；`pz-failed` 由四关发——game3 `onDead()`（game3-gems.html:634）、game6 提交耗尽（game6-code.html:777）、game7 错误阈值（game7-nonogram.html:714）、game8 误点 2 次（game8-targets.html:423）。**13 个发送点全部位于 `window.parent && window.parent!==window` 判断之内**，顶层直开不发，与文档一致。消费方两处：hub.html:169-172（写统计 + toast）、terminal.html:141（结算进「通关失败」分支）。

**端到端实测**（`failclose.mjs`：以 hub.html 为父页，注入同源探针 iframe，调用各关自己的失败出口）：

| 关卡 | 父页收到的 payload | hub 反应 |
|---|---|---|
| game8-targets | `{type:'pz-failed',device:'V-40060',lv:3,moves:0}` | toast「设备 V-40060 本轮未通过 — 再试一次？」· `endland-stats` 新增 `{stars:0,pass:false}` |
| game3-gems | `{type:'pz-failed',device:'V-40056',lv:3,moves:0}` | toast「设备 V-40056 本轮未通过 — 再试一次？」· 同上 |

（`moves:0` 是探针直接调失败出口、没先做误点所致；误点路径的步数语义见 `docs/star-rubric.md` §四。）

**结论：契约成立，无缺陷。** 两点观察（不构成缺陷，未改代码）：

- 五关（game1 / puzzle2 / game4 / game5 / game9）不发 `pz-failed`——它们没有失败态（可一直重试），不是漏接线。
- game6 / game7 的失败 payload 额外带了 `game` 字段（契约只要求 device/lv/moves）；- game6 / game7 的失败 payload 额外带了 `game` 字段（契约只要求 device/lv/moves）；而 hub 在失败分支固定写 `game:''`（hub.html:170），即父页不读失败消息里的 `game`。

## 十七、admin 写操作闭环核验（2026-11-09：写入 → 落库 → 刷新回读 → 消费方生效）

admin 的全部写入都走 `lsSet`（admin.html:444）。本轮挑两条**有真实消费方**的写面跑到闭环；登录门禁按真实流程过（点 `#lgGate` → 口令 `CRED_DEFAULT` admin/123456，admin.html:381）。

**① 高级面板 · redirect（消费方：terminal）**

| 步骤 | 证据 |
|---|---|
| 写入 | 点「保存 redirect」→ toast「已保存 redirect = https://example.com/probe-xyz」 |
| 落库 | `endland-admin-cfg` 含 `probe-xyz` |
| 刷新回读 | 重载后台仍直入（取 sessionStorage 会话），`#adRedirect` 回读值与写入值一致 |
| 消费方生效 | terminal（`?selftest=1`）走外链分支：渲染 `a.jbtn` =「前往 https://example.com/probe-xyz」+ href 正确，且不自动跳转（与 terminal.html:200-204 一致） |
| 反向回写 | 同一次 terminal 访问后 `endland-admin-cfg` 新增 `visitByDate`（terminal.html:148） |
| 收尾 | redirect 已还原为 `hub.html` |

**② 关卡管理面板 · 自定义关卡（消费方：九关的 `readCustomLevels`）**

- **两侧同键**：game5 自检写入 5 条（`{n:5, id:lights-1-sample5xc9, hasInit:true}`）后，admin 面板的游戏按钮计数为「灯光矩阵 5 / V-40057」（其余为 源石电路 0 / 方块拼装 0 / 宝石神偷 0 / 露营达人 0，另有若干关因此前自检留有数据）——admin 读到的是游戏写的那份。
- **合法写入落库**：点「写入样例（走同一校验）」→ `endland-levels-lights` 5 → 6，新条 id `lights-mw912cng-xy`。
- **非法写入被拦**：点「写入一个非法样例」→ 校验行原文「✕ 校验未通过（1/1 条），未写入任何数据：· 第 1 条：lv 必须是 1–5 的整数（实际：9）；缺少 params 或 hand（关卡定义体）」，条数不变。
- **真上传通道**：用 `DOM.setFileInputFiles` 往 `#upFile`（admin.html:1323）喂入「game5 导出格式」的 JSON（由自检样例改造，含 `params.initial`）→ 游戏端 `[GT-INIT]` 的 `custom` 计数从 5 变 6。
- **游戏真播这条自定义关**：`game5-lights.html?lv=3` 页面内 `pz.custom = 'lights-3-samplegg6j'`，`#paramLine` 显示「参数 V3 · 网格 4×4 · 抖动上限 k=5-7 · 满星 ≤3 步满星 · 本题 k=6 · **自定义关卡 lights-3-samplegg6j**」。

**结论：两条写面闭环成立，无缺陷。** 一处**约定**说明（不是缺陷）：admin 的「合法样例」是通用生成型参数（`params:{n:…}`），而 game5 只采用带 `params.initial` 的自定义关（game5 `pickQueuedLevel`），所以样例会被读入、不会被 game5 采用；文档规定的流程是「拿该关 `?export=1` 的 JSON 上传」，该流程本轮已实测可用（`pz.custom` 即证据）。

**尚未实测的写面（如实记下）**：难度面板「保存全局概率 / 保存覆盖」（admin.html:1035 一路）、帐户面板改凭据（:1580）、高级面板危险区「清空统计 / 重置配置 / 全部清空」（按钮 :1895 / :1910 / :1927，调用 :1896 / :1911 / :1928）。

探针：`admin_write.mjs`（redirect 闭环）、`admin_levels_write.mjs`（样例写入 + 非法拦截）、`admin_upload.mjs` / `admin_upload2.mjs`（`#upFile` 真上传 + `pz.custom` 判定）、`admin_levels_inv2.mjs`（面板计数与游戏写入一致性）。本轮我自己的两个探针坑：正则里 `\n` 被展开成真换行导致浏览器端语法错误、一处括号不平衡——都属探针问题，不是产品问题。

## 三十二、三项待决项的处置与本轮验收（2026-11-10）

三项都在 `ask_user_question` 连续三次超时（540s / 540s / 600s）后按 G8「假设出口」执行，假设逐条登记在此，并写清什么情况下该推翻我。

### 处置 1：game7 名称统一为「图形校验」（共 9 处）
| 位置 | 改前 | 改后 |
|---|---|---|
| `game7-nonogram.html:201-205`（该页自己的档位引导文案 5 处） | 残影重建 · … | 图形校验 · … |
| `README.md:41` / `README.md:114` | 残影重建 | 图形校验 |
| `docs/realdevice-checklist.md:24` | game7 残影重建 | game7 图形校验 |
| `admin.html:389` | name:'残影重建' | name:'图形校验'（`key:'nonogram'` 与 `dev` 一字未动） |

**保留原样（不是对外名称）**：`docs/new-puzzles-proposal.md:26`（提案里的「主题包装」名）、`docs/realplay.md` 的 §二十八 与本节（审计记录本身）。实测 `grep -rn 残影重建` 全仓库仅剩这四处。
- 推翻条件：你想改用「残影重建」当对外名 → 反向替换上述 9 处即可，其余文件不受影响。

### 处置 2：补齐 4 个页面的 LEVELS_META（各页按自己的难度表形状写）
- `game1-circuit.html:200` → `{game:'circuit',lv,n,leaf}`
- `puzzle2.html:258` → `{game:'blocks',lv,cols,rows,piecesMax}`（该页是**数组**表，用 `LV_TABLE[k-1]` 取项）
- `game5-lights.html:179` → `{game:'lights',lv,n,kMax,name}`
- `game7-nonogram.html:199` → `{game:GAME_KEY,lv,w,h,d,name}`
  · 注意：该页标识变量 `GAME_KEY` 声明在难度表**之后**（:198），所以 LEVELS_META 必须插在它之后，否则 `game` 会取到 `undefined`；其余三页用字面量，无此顺序问题。
- 浏览器实测（`levels_live.mjs`）：9 个页面全部 `len=5`、无空值项、`exceptionThrown` 0；新增 4 页的 `game` 标识、`lv` 序 1→5、关键字段齐全，**4/4** 通过。
- 推翻条件：不想让无人消费的导出留在代码里 → 删掉这 4 行，并把 `docs/level-spec.md:69` 改回「仅部分页面提供」。

### 处置 3：terminal 失败口径（只改一句话，不动跳转）
`terminal.html:198` 由无条件的「身份验证成功」改为随结果显示：`pass → 身份验证成功(ok)`、`fail → 身份验证未通过(bad)`、`timeout → 身份验证未通过（设备无响应）(bad)`。

**跳转未改**：目标仍由 `cfg.redirect`（默认 `hub.html`）决定。依据是门禁归属——hub 的解锁进度由 **hub 自己**监听 `pz-solved` 写 `endland-prog`（`hub.html:160-168`），`pz-failed` 只写一条 `pass:false` 统计（`hub.html:169-171`），terminal 的 pass/fail 不参与门禁。所以这句话原本不代表「失败者被放行」，只代表「terminal 不拦人」，改的只是它别再说与上一句相反的话。
- 推翻条件：你希望失败/超时者被拦在门外（不跳转）→ 那需要另加停留 + 重试入口，属新交互，本轮未做。

### 本轮验收证据（都可复跑）
- 脚本语法：14 个页面、13 段内联脚本经 `new Function` 解析，**0 失败**（`syntax_all.mjs`）。
- terminal 分支：把 `terminal.html:188-198` 的**真实源码**抽出来喂三种输入（`term_branch.mjs`）——pass 只出现「身份验证成功」；fail/timeout 只出现「身份验证未通过」（超时带「（设备无响应）」）。端到端再跑 `terminal.html?selftest=1`：`[T-MATCH] nonogram lv2` + `[T-SOLVED] pass=true`，异常 0。
- LEVELS_META：见处置 2（`levels_live.mjs`）。
- 全量回归（`final_regression.mjs`）：自检零失败 **9/9**、导出契约 **9/9**、竖屏触摸抽验 **3/3**。
  · 抽验第一次是 2/3（game1 判 false），**是探针缺陷不是回归**：该探针指纹只比 `className`，而 game1 的旋转写在内联 CSS 变量 `--r` 上。分开测「不点击只等待 900ms 的漂移」= **0 格**、「点击后的变化」= 第 12 格 `--r: 0deg → 90deg`（计算 transform 由单位阵变 90° 旋转）后确认点击确实生效（`g1_tap_split.mjs`），随后给该探针加了按文件选用的指纹（`SIGEXPR`）并复跑得到 3/3。教训与 §二十四 同源：**指纹必须覆盖交互真正改写的那个属性**。
- **terminal 端到端（真实页面，失败/成功各一次，探针 `term_e2e3.mjs`）**：
  · 注入 `pz-failed`（守卫只判 `d.type`，无来源校验，见 `terminal.html:139-142`）→ 屏幕按序出现「匹配成功 → 通关失败 → 用户通关数据：难度 V2 · 步数 7 → 失败吐槽 → **身份验证未通过** → 正在跳转到设定的网址」，**未**出现成功字样；console `[T-SOLVED] pass=false`。
  · 注入 `pz-solved` → 「通关成功 → 难度 V2 · 2 星 · 步数 9 · 用时 12.5s → **身份验证成功** → 正在跳转」，**未**出现未通过字样；console `[T-SOLVED] pass=true`。
  · 两次 `endland-stats` 末条的 `pass` 字段分别为 `false` / `true`，与屏幕一致；两次 `endland-prog`（hub 的解锁进度键）都是 `NULL` —— **直接验证了本节处置 3 的门禁归属判断**：terminal 从不写它。
  · 顺带确认改名已进真实链路：成功那次 terminal 匹配行打印 `V-40059 — 图形校验 · 难度 V5`。
  · 探针自身的坑（记下以免重踩）：`document.body.textContent` 会把内联 `<script>` 源码算进去，关键词于是"在 0.0 秒就出现"；`innerText` 又只含可见文本。正确做法是只取**非 script/style/iframe 子元素**的 textContent。
  · **改名四处面实测（`rename_live.mjs`，真实浏览器）**：hub 9 张卡片全部显示「图形校验」且整页无「残影重建」；admin 登录后 `gName('nonogram')` = "图形校验"、`gDev('nonogram')` 仍为 "V-40059"（**`key` 未被我改动**）、关卡菜单同样只出现新名；game7 页面 `document.title` = "访客协议 VISITOR PROTOCOL · 图形校验"、`TIP_TABLE` 五条开头均为「图形校验 ·」且整页无旧名。加上端到端那次的 terminal 匹配行，改名的 4 个对外面（hub 卡片 / admin 菜单与解析函数 / game7 页头与引导文案 / terminal 匹配行）全部实测过。

## 三十三、推送不通的真因：Steam++（Watt Toolkit）加速器的 hosts 重定向（2026-11-10）

**结论**：不是网络故障，也不是谁设的屏蔽清单，而是 **Steam++（Watt Toolkit）的「网络加速」没在运行**。它把 GitHub / Steam / huggingface 等域名写进 hosts 指向 `127.0.0.1`（`# Steam++ Start…End`，共 50 条），再由它自己在 `127.0.0.1:443` 起本地代理转发；该进程不在，这些域名就一律 `ECONNREFUSED 127.0.0.1:443`。因此 `DEPLOY.md` 原先那句「本机经本地代理出网、代理挂掉」**是对的**。

**证据链**：① `curl -v https://github.com` → `* Trying 127.0.0.1:443`（`git ls-remote` 29ms 同样失败）；② `nslookup github.com` 直查 DNS 得真 IP `20.205.243.166`——nslookup 不读 hosts，两者不一致正是 hosts 重定向的特征；③ `curl --resolve github.com:443:20.205.243.166` → **200**，证明链路本身通畅；④ `codeload.github.com`（不在那段）→ 301、`yumoii789.github.io`（`github.io` 的子域、精确匹配不中）→ 200；⑤ hosts 文件里的 `# Steam++ Start` / `# Steam++ End` 标记与条目集合共同指明出处；⑥ 系统 `ProxyEnable=0`、无 `*_proxy`、7890 无监听——与「Watt Toolkit 自带本地代理」这一机制并不矛盾（它不是系统代理）。

**我在这一轮里连续更正自己两次判断**：先据现象断言「与代理无关」（对了一半——确实不是*系统*代理，但忽略了 hosts 条目的出处），随后又据条目形态误判为「有人有意设的屏蔽清单」并据此拒绝绕过。两次的同一个错误是：**没先读 hosts 文件首尾的注释就下结论**。教训与 §八 同源——下结论前先把「谁写的、什么时候写的」这类来源信息读到手。

**处置**：① 真因与三种解法已写进 `DEPLOY.md`；② 未改动 hosts、未改动任何系统设置；③ 机主可选：启动 Watt Toolkit 开加速（恢复原设计）/ 自行删掉 `# Steam++ Start…End` 整段 / 让我在本 session 内用本机隧道钉 IP 绕过。`ask_user_question` 四次超时，故按 G8 记录假设后继续。

**已解决（同日）**：改用重放脚本原路线——起一个仅监听本机的 CONNECT 隧道把 `api.github.com` 钉到真实 IP，再 `HTTPS_PROXY=http://127.0.0.1:8443 NODE_USE_ENV_PROXY=1 node --use-system-ca _verify/endfield-captcha/rebuild_history.mjs`（cwd 在仓库内）。结果 `main -> 09d67e5a`、**远端 HEAD 与本地逐字符相同**，93 个提交全部到位。

**线上复验**（Pages 重建后实测原始文件）：`README.md` 含「图形校验」2 处、含「残影重建」0 处；`game7-nonogram.html` 含「图形校验 ·」6 处且含 `LEVELS_META`；`terminal.html` 含「身份验证未通过」；`DEPLOY.md` 含 Steam++ 说明 3 处。至此三项修正与全部文档**已真实上线**。

**顺带确证的边界**：`github.com` 在这台网络下**本身不可达**（绕过 hosts、钉真实 IP 也会在 TLS 前被 RST/超时），`api.github.com` 可达——所以本机永远该走 Git Data API 重放，而不是 `git push`。

**部署后线上行为回归（同日，探针 `live_postdeploy.mjs`，直打 `https://yumoii789.github.io/endfield-captcha`）**——注意这次验的是**行为**，不是「文件里有没有那个字符串」：

- 九关 `?selftest=1`：**9/9 零失败**，九个页面 `exceptionThrown` 全为 0；
- 九关 `?direct=1&lv=3&export=1`：**导出契约 9/9**，每页都产出含 `game/id/lv/name/desc/play/params/enabled` 的 INIT JSON；
- 线上 `terminal.html` 注入 `pz-failed`：屏幕依次出现「通关失败 → 用户通关数据 → 失败吐槽 → **身份验证未通过** → 正在跳转」，**全程未出现「身份验证成功」**，`endland-stats` 末条 `pass:false`，`endland-prog`（hub 解锁键）仍为 `NULL` —— 与本地行为逐项一致。

## 三十四、移动端 `100vh`/`dvh` 审计（2026-11-10，含一次我自己的误报）

**起因**：清单第 8 项问「地址栏展开/收起时九关是否仍不需滚动」——这没法在 CDP 里验（仿真没有地址栏），只能静态审计。

**我先误报了一次**：`grep` 用的正则 `[^;}]*100vh[^;}]*` 在**第一个分号处就截断**，我只看到 `min-height:100vh;` 而没看到紧跟其后的 `min-height:100dvh`，据此断言「13 个页面都缺 dvh 兜底」。实际上项目**早已采用 `min-height:100vh;min-height:100dvh` 成对写法**——这也正是「把 body 的 min-height 归零后高度仍是 844」的原因：生效的本来就是 `dvh`，而它在 CDP 里等于 `vh`。教训与 §三十三 同源：**别信被截断的输出，先读完整规则块再下结论**。

**精确审计**（逐文件数 `100vh` 与 `100dvh` 并要求配对）：唯一缺口是 `admin.html` 三处——`#loginView:81`、`#appView:104` 的 `min-height`，以及 `.side:105` 的 `height`/`max-height`。已补成成对写法（老浏览器由前者兜底）。其余 12 页本就成对（game5 另有一处 `height:100dvh`）。

**验证**：14 页 13 段内联脚本解析 0 失败；admin 实测登录页 `#loginView`、后台 `#appView` 计算值正常，六个菜单齐（状态/难度/关卡管理/帐户/统计/高级），`exceptionThrown` 0，`pageScroll=0`。注意 **dvh 的收益在 CDP 里不可见**，所以这条只能算「无回归 + 符合规范」，最终仍需清单第 8 项在真机确认。

**顺带查出两条清单原本没覆盖的真机风险**（已补为清单 §三 第 19/20 项）：① 12 页都声明了 `viewport-fit=cover`，但**全仓库 0 处**使用 `safe-area-inset` → 刘海/挖孔与底部手势条可能压住页头页脚，尤其右下角固定的静音角标；② `admin.html:213` 的数字输入框 `font-size:11.5px`（<16px）→ iOS 聚焦会自动放大且常不缩回。

## 三十五、通关音效与静音门的机制验证（2026-11-10）

清单第 11/12 项此前只当真人机项，从没机械验证过「通关到底有没有走发声路径」。本轮补上。

**静态**：九关的通关处理**全部**调用发声函数——game1 `chime()`(:399)、game3 `sndWin()`(:627)、game4(:532)、game5(:533)、game6(:754)、game7(:700)、game8(:404)、game9(:495)、puzzle2(:879)；实现统一为 WebAudio（`createOscillator` + `createGain`），静音门是 `if(muted)return;`（`game5-lights.html:445`），`muted` 初值取自 `localStorage` 的 `endland-mute === 'on'`（**缺省即有声**）。

**行为**（探针 `audio_verify.mjs`：在页面脚本执行前插桩 `AudioContext.prototype.createOscillator` 计数，再真实点击解法通关 game5 V1）：

- 静音键 `off`：2 次点击解题 → `solvedFlag=true`、印章显形，振荡器 **0 → 6**（通关 `chime()` 四音 + 两下点击音）⇒ 通关确实触发发声路径；
- 静音键 `on`：同样通关，振荡器 **0 → 0** ⇒ 静音门确实拦住了发声，而不只是记住状态。

**能证明什么 / 不能证明什么**：能证明「通关 → 发声函数被调用」与「静音 → 不调用」；**不能**证明「扬声器真的响、音量不为 0」——那仍是真机项（清单第 11 项保留，已注明机制侧已验证）。

## 三十六、触屏输入框字号与两处「误读作用域」的更正（2026-11-10）

**真缺口（已修）**：项目本就有防 iOS 聚焦缩放的惯用法 `@media(pointer:coarse){.inp,select.inp,textarea.inp{font-size:16px}}`（`admin.html:287`），但它**漏了两个控件**：admin 难度面板的 `.ovr .oc input[type=number]`（11.5px）与 terminal 的名字输入框 `.tl .inl`（`font:inherit` → 实测 14px）。两处都在粗指针下补成 16px。

**双向验证**（探针 `coarse_input2.mjs`，用 CDP 切换 `setTouchEmulationEnabled` 让 `pointer:coarse` 真假互换）：粗指针下 admin 数字框与 terminal 名字框均为 **16px**（且名字框仍能正常输入）；切回细指针后分别回到 **11.5px / 14px**（桌面端零影响）；`exceptionThrown` 0，14 页 13 段脚本解析仍 0 失败。**注意脚本语法检查查不到 CSS**，这条结论是靠「计算值随媒体查询变化」证出来的，比静态解析更硬。

**同时更正我自己的两处误读**（都属于「把作用域读大/读小」）：

- 我曾说「hub / terminal / index 缺 `user-select:none`，与十关不一致」——**错**：`user-select` 在本项目是挂在**交互控件**上的（`.cell` / `.board` / `.captcha-box` / `.pbar` / `.gate`），从来不是页面级策略；hub 与 terminal 没有棋盘类控件，本就不需要。
- 我曾担心「手机上 admin 的 216px 侧栏 + 1fr 会把内容挤到 174px」——**也错**：`@media (max-width:640px)` 已把外壳改成单列、导航改成横向滚动条，`380px` 再降两列。

两次的同一个毛病：**只看了一处就推广到全局**。与 §三十三（没读 hosts 首尾注释）§三十四（没读完整规则块）是同一条纪律：**先确认作用域与出处，再下结论**。

## 三十七、长按选择菜单（清单第 6 项）的计算值审计（2026-11-10）

清单第 6 项要求「长按格子不应弹出系统选择菜单」。此前只当真人机项；本轮用**计算值**（`getComputedStyle().userSelect`，不是看声明）把九关棋盘与几个可点控件逐个量了一遍（探针 `userselect_probe.mjs` / `userselect_probe2.mjs`）。

**量到的分布**：`user-select:none` 在本项目只声明于 `.captcha-box`（八关的人机验证框）、`.cell`（game5）、`.board`（game9）、`.gate`/`.pbar`（admin）。九关棋盘的**计算值**因此是：game5/game9 = `none`，其余七关 = `auto`；其中**只有 game6 的口令槽位含可见字符**（`.slot`，1 字符），其余各关格内是纯 SVG、无文本。

**已修的只有证据支持的那一处**：`game6-code.html` 的 `.slot` 补 `user-select:none`（与 game5 `.cell` 同一做法）。其余各关格内无文本、暴露面≈0，按证据不动——不做无收益的全仓清扫。

**顺带量到的更大暴露面**：hub 的 `.card`（可点大块、**93 个字符**）也是 `auto`。它与项目已禁用的 `.captcha-box` 属同类（可点方块），故一并补 `user-select:none` ✔。

**按证据保留未处理**：game6 `.key`、admin `.nav button` 等 `<button>` 的计算值仍是 `auto`——长按可能选中键面文字，属浏览器行为、影响面小，留作真机判断（清单第 6 项已注明）。

**验证**：修后 game6 `.slot` 计算值 = `none`；hub `.card` 计算值 = `none` 且**真实点击仍能打开关卡**；全量回归复跑 **自检 9/9 · 导出契约 9/9 · 触摸 3/3**。

### 过程事实：本 session 子代理不可用（影响后续派发方式）
4 次派发——两份完整任务书 + 两个极小探针——在两条已授权路由（`nvidia/z-ai/glm-5.3`、`nvidia/moonshotai/kimi-k2.6`）上**全部**「failed before it finished，无收尾消息」，仓库零改动；两条路由都复现，排除路由因素，故按 R8（repeated errors）转由派发者亲自执行。另：运行时会硬拒未授权路由，白名单为 `nvidia/*`，本 Agent 自身路由不在其中，`subagent_fork`（继承父路由）同样不可用——后续若要再派发，必须显式给出白名单内的 provider/model。

### 仍只能等条件
- 远程同步：当时本地领先 11+ 个提交，`api.github.com` 仍 000；真因是 **Watt Toolkit（Steam++）加速器未运行**（hosts 重定向 + 本地代理缺位），2026-11-10 查明，见 §三十三 与 `DEPLOY.md`。`*.github.io` 正常。
- 真机触摸实测：只能由用户按 `docs/realdevice-checklist.md` 执行。











