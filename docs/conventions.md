# 跨页约定（维护必读）

> 本文件记录九关之间共享的接口与键名。改动其中任何一项都要同步全仓库，避免出现"个别关卡悄悄偏离"的情况。

## 一、设备编号映射

| 设备 | 关卡文件 | 备注 |
|---|---|---|
| V-40053 | game1-circuit.html | 源石电路维修 |
| V-40054 | puzzle2.html | 方块拼合 |
| V-40055 | game4-camping.html | 露营落帐 |
| V-40056 | game3-gems.html | 宝石跳吃 |
| V-40057 | game5-lights.html | 灯光矩阵 |
| V-40058 | game6-code.html | 口令破解 |
| V-40059 | game7-nonogram.html | 数织 |
| V-40060 | game8-targets.html | 目标点选 |
| V-40061 | game9-slide.html | 滑块还原 |

## 二、父页消息契约（读端：hub.html:158-171、terminal.html:141）

```js
// 成功（全部扁平，缺字段会导致父页把星级兜底成 1、步数用时显示为 '—'）
window.parent.postMessage({type:'pz-solved', device, game, lv, stars, moves, secs, mistakes}, '*');
// 失败
window.parent.postMessage({type:'pz-failed', device, lv, moves}, '*');
```

`mistakes`（可选，C 轮新增）：本关失误次数。**父页当前不读取它**（hub.html / terminal.html 均未改动），它随 payload 上行供统计与后续扩展；缺失不影响父页的星级兜底。各关失误语义互不相同，见 `docs/star-rubric.md` §四。

注意：仅当 `window.parent !== window`（即被 iframe 嵌入）时才发送；顶层直接打开时不发。

## 三、URL 钩子语义

| 钩子 | 含义 |
|---|---|
| 钩子 | 含义 | 实际实现范围（2026-11-09 全仓库核对） |
|---|---|---|
| `?direct=1` | 跳过登记/验证，自动进入关卡 | 九关全部（hub 就按此拼 URL）。注意 game3 的语义是"延时后自动点人机验证框"（game3-gems.html:784），不是无条件放行 |
| `?lv=1..5` | **难度档位**（九关统一语义） | 九关全部 |
| `?stage=N` | 关卡号（优先于 `?lv`） | **仅 game3**（game3-gems.html:772）；hub 现在只传 `?lv=`，见 docs/difficulty-axis.md |
| `?selftest=1` | 运行页面自带自检，结果打到 console | 全部 12 页（含 hub/terminal/admin） |
| `?seed=N` | 复现同一题面 | **八关**（game1/puzzle2/game4/game5/game6/game7/game8/game9）；**game3 未实现**（其选关用 `Math.random()`，无种子注入） |
| `?export=1` | 导出关卡 JSON 到 console | 九关全部（直通 `?direct=1` 与普通进入都已接线；字段 game/id/lv/name/desc/play/params/enabled，核验见 docs/realplay.md 十四） |
| `?debug=1` | 调试输出（terminal 下同时使打字机瞬时完成） | 九关 + terminal |
| `?fast=1` | 跳过动画/加速 | **仅 game8**（game8-targets.html:184） |
| `?reset=1` | 清空本页存档 | **仅 terminal**（terminal.html:152，清除 `endland-user`） |
| `?wait=N` | 结果等待超时（毫秒，默认 600000） | **仅 terminal** |

> 历史坑：game3 原先把 `?lv=` 当关卡号，导致 terminal 流程里难度档位失效（永远 V1）。已统一，见 docs/difficulty-axis.md。
>
> **2026-11-09 钩子审计**：此前本表把 `?seed` / `?fast` / `?reset` 写成跨页统一契约，与实现不符（分别只有 8 关 / 1 关 / 1 页实现）。上表已按实际实现逐条修正。其中 `?seed` 用 `seedcheck.mjs` 在线上/本地实测：同一种子两次加载题面完全一致（八关均"同题面"），game3 两次不同（无种子机制）。**未新增实现**——这三项无人依赖，补做属功能开发而非修缺；若将来要用，需先按上表范围确认。

## 四、localStorage 键

| 键 | 用途 | 写入方 |
|---|---|---|
| `endland-user` | 访客档案 | terminal / 各关登记 |
| `endland-stats` | 通关统计流水 | hub / terminal |
| `endland-matchlog` | 匹配记录 | terminal |
| `endland-hub-progress` | 各设备进度与星级 | hub |
| `endland-levels-*` | 各关自定义关卡队列 | 各关 |
| `endland-mute` | **全局共享静音**（`'on'`=静音；缺省/其他=有声） | hub 的 `#muteAll` + 各关 btnMute（双向实时同步） |

## 五、音效约定

九关各自内置 WebAudio 合成音效（`tone()` + `chime()`，无资源文件），并通过各自的 `#btnMute` 切换 `muted` 标志。
自 2026-11 起：静音选择**持久化到 `endland-mute`**，在一关静音后打开其他关会自动继承；**默认仍为有声**（不改变既有观感）。

> 禁止再加"父页音效层"：曾给 hub/terminal 加过 iframe 点击音与结算音，与关卡内建音效叠成双响、并形成第二套互不相通的静音，已撤回。

### 全局开关（第二轮）

hub 提供**唯一入口的全局开关** `#muteAll`（右下角固定角标），与九关各自的 `#btnMute` 共用同一个 `endland-mute` 键，并用 `storage` 事件**实时双向同步**：父页写入 → iframe 内页面立即跟随；子页写入 → hub 图标立即跟随。同源文档之间浏览器会自动派发 `storage`，因此**不需要新增 iframe 消息协议**。

- **实现坑（必记）**：hub 的开关必须是 `body` 的**直接子级**，且 `z-index` 高于 `.mask`（`.mask` 为 `z-index:50`）。放在 `.wrap`（`z-index:1`，自成层叠上下文）内时，即使自身写 `z-index:130` 也会被遮罩压住 → **开着一局时点不到全局开关**（验收项"模态打开后正向同步"曾因此失败）。
- 直连打开单个设备页（`?direct=1` 或单独访问）时，页内 `#btnMute` 依然可用（读写同一键）。
- 九页的同步监听统一为 `window.addEventListener('storage', …)`，插在各自静音持久化块之后；验收脚本 `_verify/endfield-captcha/muteglobal.mjs`（9 页合成事件单测 + hub/iframe 双向真实点击，13 项全绿）。

## 八、在 .html / .js 里增删过行之后：必须重扫文档里的行号引用

本文档与其余 docs 大量用 `文件:行号` 定位实现。行号不是锚点：插入或删除一行，就会让它**之后**的所有引用静默失效，而失效的引用**看起来仍然像证据**。2026-11-10 本轮为此返工两次——在 `game1:200`、`puzzle2:258`、`game5:179`、`game7:199` 各插入一行 `LEVELS_META`，四个文件插入点之后共 15 处引用需要 +1。

规则：**任何增删行的改动，提交前重扫这三类引用**（第 2 类最容易漏，因为文件名只在句首出现一次，后面全是裸行号）：

1. 带文件名的：`grep -rnoE "(game[0-9]+-?[a-z]*|puzzle2|terminal|hub|admin)\.html:[0-9]+" docs/*.md`
2. 裸简写（`（:574）`、`、:678` 这种）：`grep -rnoE "[^a-zA-Z0-9_./-]:[0-9]{3,4}" docs/*.md | grep -vE "\.html:[0-9]|\.js:[0-9]"`
3. 其他写法：`grep -rn "L[0-9]\{3,4\}\|行 [0-9]\{3,4\}" docs/*.md`

改完之后要用**内容**核对目标行（read 那一行，看它是不是文档描述的同一个东西），**不要只按差值平移**：本轮按差值平移时又暴露出两处本来就错的引用——`layout-viewport.md:103` 把 puzzle2 的 `cellRect()` 写成了全仓不存在的 `cellXY`，以及「点击→格换算」记的是 `puzzle2.html:1025-1026` 而真实位置在 `puzzle2.html:1049-1050`（差 23 行，与本次插入无关）。

更稳的写法：能引**符号名**（函数名、常量名）就不要引行号；非要引行号，就同时写出该行的内容片段，失效时一眼看得出来。

**别在 realplay.md 里引用 realplay.md 自己的行号**：它的每次追加都会让这个引用过期——本轮我写下 `realplay.md:703` 的同一次编辑就在它前面插了 7 行，那句话当时就已经错了。引用别的文档用「章节号 + 一句话描述」，不要用自身行号。
**符号名同样要核**：文档里反引号写的函数名/常量名，也可能根本不存在于代码。2026-11-10 本轮就查出两个幽灵符号——`layout-viewport.md` 把 puzzle2 的 `cellRect()` 写成 `cellXY`（该名字其实只存在于探针 `clear_p2.mjs` 里），`realplay.md` 把 admin 的 pointerup 处理器 `end()` 写成 `endPointer`。查法：把 docs 里所有反引号标识符抽出来，逐个在**仓库代码 + 探针**（含文件名）里找，零命中的逐个核对上下文——脚本见 `_verify/endfield-captcha/doccheck.mjs`——**一条命令跑完四类**：行号引用（含裸简写按同行最近文件名继承）、符号名、文件引用、commit SHA 可解析；当前 10 文档 / 288 文件 / 135 标识符 / 9 SHA **全绿**（白名单里只放「有据可查的合法例外」，每条写理由：更正注记里刻意引用的错名、worldbible 的未落地提案文案、后台导出产物的下载名）。只查符号的部分在 `symbolcheck.mjs`。

**它现在可以当闸门**：有问题时 `doccheck` 以**非零退出**，所以 `node .../doccheck.mjs && git commit ...` 会真的拦下提交。（此前它无论发现多少问题都 `exit 0`，那条 `&&` 形同虚设——**"永远说通过"的验证器**与"撒谎的探针"是同一类毛病。）另外它会把 URL 里的端口（如 `…:8099/…`）与行号引用区分开，不会把 `:8099` 误读成 `文件:行号`。

**一键验收闸门（2026-11-10 新增）**：`bash _verify/endfield-captcha/accept.sh [组...]`（不带参数 = 跑全部组；组名：`docs syntax regress levels geometry live audio inputs select admin`）。它按每组的**预期 verdict 字符串**判定，任一组未达即**非零退出**，可直接接在 `&& git commit` 前面当闸门；基础设施（Edge `9222` + 本地 `8099`）未就绪时该组直接判失败并写明原因。本次经它实跑并通过的组：`docs syntax levels select inputs audio`；`regress geometry live admin` 此前已各自单独跑过，可用同一条命令复跑。

**这个闸门自己也被证伪过**（必须做的步骤，否则又是一个"永远说通过"的验证器）：临时移走被检查的探针 → `x levels（未达预期 verdict）` + `exit 1`；还原后 → `v levels` + `exit 0`。

**两个操作坑**：① `pkill -f msedge` 在本机**杀不掉** Edge（健康检查仍 200），要停它请用 `taskkill //F //IM msedge.exe`；② 探针输出经 `| tail` 管道会把退出码换成 `tail` 的，所以**别用管道读闸门结果**——直接看它最后两行与 `$?`。**闸门的分组与自愈（2026-11-11 扩充）**：共 16 组 ——`docs syntax termbranch terminal rename hubprog hubtap regress levels geometry live audio inputs select admin`。**基础设施自愈**：需要 Edge/8099 的组若发现不可用，会自动重启它们并**重试该组一次**；因为本机 Edge 会自己退出，而「进程死了」与「检查失败」在输出上长得一样。**完整跑一次 = 16/16 全绿**（2026-11-11 实测，约 15 分钟；日志 `_verify/endfield-captcha/accept_full.log`）——这是目前唯一的「一条命令覆盖产品 + 文档 + 线上」的验收入口。

**写脚本时别给「锚点查找」留静默默认值**：本轮我用 `grep -n "…" || echo "1:"` 找插入位置，grep 未命中时它回退成第 1 行——于是把闸门说明插到了文件标题下面。锚点找不到就该**报错退出**，而不是挑一个默认位置。这与「验证器永远说通过」同源：**静默回退 = 悄悄做错事**。

顺带：文档引用的 commit SHA 也应可解析。查法 `git cat-file -t <sha>`；注意本机 git 路径含空格，`G="/d/Program Files/Git/cmd/git.exe"` 这种不带内嵌引号的写法会被空格切断、静默失败并**假装**成「SHA 不存在」——要用带内嵌引号的写法，别据无效结果下结论。
