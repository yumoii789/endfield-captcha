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
