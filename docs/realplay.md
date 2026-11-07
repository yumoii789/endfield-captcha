# 真实通关回归台账（realplay）

> 目的：验证"玩家真的能玩通"这条链路，而不是只调用内部函数。全部为**真实鼠标点击**（CDP Input.dispatchMouseEvent），先静音（公共场所禁止外放）。
> 路径：hub 真实入口（点卡片 → 开始校验）→ iframe 内真实点击 → 游戏自判通关 → 真实 postMessage → hub 写回进度/标题/统计。

## 一、已完成（8/9）

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

## 二、各关定位方式（踩过的坑，供后续复用）

| 关卡 | 格子定位 | 备注 |
|---|---|---|
| game5-lights | `#c-<i>`（一维）或 `#board > .cell` 行主序 | 行主序与模型索引一致（已核对源码 `i=y*n+x`） |
| game7-nonogram | `#c-<x>-<y>` | **不能用 gridRow/gridColumn 推算**：提示格占用了前面的行列，会错位（曾导致 13 目标只命中 3） |
| game4-camping | dataset `x/y` | 容器 `#grid` |
| game3-gems | `.spot` 的 dataset `x/y` | 点击**目标落点**即可，不需要先点棋子（点棋子只是高亮提示）；`bestSol` 是落点序列，不是宝石位置 |

## 三、未完成（1/9）

| 关卡 | 状态 | 已知要点 |
|---|---|---|
| V-40061 game9-slide | 真实点击通道受限（**非缺陷**，见 §三之二） | 逻辑正确性已由 selftest 覆盖；要自动化须换真实触摸输入或绕过 pointer capture |

（已解决的历史条目：game1 的 `k` 语义＝该格当前 mask，点 `(4-k)%4` 次归零；game3 的交互是"点目标落点"，先前 moves=3 是落点序列含义理解错误；game6 需点自绘键盘再提交；puzzle2 无需拖拽——是**点击 + 旋转/翻面**类。）

## 二之一、通用坑：有「忙碌守卫」的页面必须等状态，不能用固定间隔

- game3-gems：`tap()` 开头是 `if(!cur||solvedFlag||deadFlag||busy)return;` —— **跳吃动画期间 `busy=true`，点击被直接丢弃**（且不留任何日志，看 console 也查不到）。
- 现象极易误判：前几步成功、之后连续失效（我一度以为落点序列错了、或坐标漂移了）。
- 正解：**点击前轮询 `busy===false`**、点击后**轮询步数是否增加**；改完后 8/8 次点击全部生效。
- 通用结论：凡是有动画/防抖/守卫标志的交互，自动化的正确做法是"**等状态**"而不是"睡固定毫秒"。

## 二之二、通用坑：点击目标会因 UI 更新而位移（务必每次重取坐标）

- game6-code：填满 4 位输入后，**提交按钮位置发生变化**；用事先取好的坐标点击 → 提交无效（表现为 `guesses=0`、`solved=false`，看着像"提交没生效"）。改为**点击前重新读取按钮坐标**并校验 `document.elementFromPoint(x,y)` 落在 iframe 上（`topHit.id==='frame'`）后，一次通关。
- 结论：任何"先读坐标、后多次交互"的脚本都要在**每次点击前重取坐标**；一次性坐标只适用于布局绝对不变的静态目标。

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

## 六、puzzle2 专章：几何拼满 ≠ 通关

1. **颜色约束是硬条件**：`fbCheck()` 除了"每块都放下"还要求**每行/每列的 green/blue 计数**与 `rowHints/colHints` 全等。只做形状精确覆盖会得到"7/7 落位、`illegal=0`、看着完美"却 `solvedFlag=false` 的棋盘（我据此白跑了一轮）。每块的颜色是**块自身属性**（`piece.color`，`fbColorOf` 只认 `'blue'`，其余算 green）。
2. **别照抄核心层签名**：页面全局是 `canPlace(pieceId, cells, ax, ay)`（4 参，内部再转发 6 参的核心层）。我照核心层写成 6 参 → 每次抛错被 `res[0]==='{'` 吞掉 → 表现为"8 次朝向调整仍无可行锚点"。**探测函数签名前先读宿主页面的包装函数**。
3. **"落位成功"的判据不能只看 `illegal` 没涨**：早期版本只比较 `illegal` 前后值，把"点击根本没生效"也计成成功（假 5/7）。必须 diff `Object.keys(w.placed).length` 并确认 `w.placed[pid]` 存在。
4. **历史统计记录会冒充本轮证据**：hub 的 `?reset=1` **不清空** `endland-stats`/`endland-hub-progress`。判据是 **ts**：修复前后两次读到的 ts 完全相同（`22:57:38.769Z`）→ 那是**旧记录**；真通关后才出现新 ts `2026-11-07T03:24:35.597Z`。
5. **`raw()` 要加非字符串守卫**：把 async 函数（`cellXY`）忘了 `await` 就传进 `Runtime.evaluate`，CDP 只回一句 `Failed to deserialize params.expression - BINDINGS: string value expected at position 34`，没有调用栈。守卫里打印 `typeof` 与堆栈即可一眼定位。

## 七、脚本位置

`_verify/endfield-captcha/clear_g5.mjs`（单关）、`clear_multi2.mjs`（多关，含各关定位分派）、`clear_p2.mjs`（puzzle2：函数源码内联求解器 + 按 placed 增量校验落位）、`clear_g9*.mjs`（game9 受限尝试）。
