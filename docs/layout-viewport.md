# 视口适配台账（实测）

> 起因：在 hub 内嵌（iframe）与矮视口下发现棋盘可能被裁切。全部数据为实测（先静音再测量）。
> 必读要求遵守：公共场所禁止外放 ⇒ 所有测量脚本第一步都把页面置为静音。

## 一、手机竖屏 390×844 —— 九关全部无裁切

| 关卡 | 棋盘 top–bottom | 超出视口 | 整页可滚 |
|---|---|---|---|
| game1-circuit | 289–614 | 0 | 否 |
| puzzle2 | 233–479 | 0 | 否 |
| game3-gems | 346–670 | 0 | 否 |
| game4-camping | 329–661 | 0 | 否 |
| game5-lights | 394–726（棋盘 333×333） | 0 | 否（已修；修复前页高 902） |
| game6-code | 无网格 | 0 | 否 |
| game7-nonogram | 318–624 | 0 | 否 |
| game8-targets | 无网格 | 0 | 否 |
| game9-slide | 389–713 | 0 | 否（mask overflow:auto） |

结论：**手机竖屏不需要任何内滚**。

## 二、矮视口（1280×700 ⇒ hub 内 iframe 高 613）—— 两关曾裁切

| 关卡 | 改前裁切 | 改后裁切 | 说明 |
|---|---|---|---|
| game1/2/3/4/6/7/8 | 0 | 0 | 未动 |
| game5-lights | 174px | **117px** | 本行是 **1280 宽 × 700 高**的桌面窄高窗口（hub iframe 613）。手机竖屏已 0 内滚（见 §五）。此配置仍可整页滚动（滚轮后底行入可见区且 `elementFromPoint` 命中 iframe） |
| game9-slide | 68px | **20px** | 基本消除；mask 为 `overflow:auto` 可滚 20px |

## 三、改动（两行，纯阈值/新增，宽视口零影响）

- `game5-lights.html:86`：`@media (max-height:560px)` → `max-height:700px`
  —— 原来作者已写矮视口规则，但 hub 内 iframe 常见高度 600–700 **刚好在阈值之上**，规则从未触发。
- `game9-slide.html`：新增 `@media (max-height:700px){.board{width:min(84vw,56vh)}}`
  —— 与 game5 同型（宽度驱动的正方形棋盘），此前没有矮视口分支。

未动 game6/game7 的同类 560px 阈值：实测它们在 613 高下裁切为 0，无证据支持改动。

### 本轮新增：game5 手机竖屏自适应（两条媒体查询，宽视口零影响）

- `@media (max-width:700px) and (max-height:900px)`：`body{height:100dvh}`、`.wrap{height:100%}`、`.panel` 转 flex 列、`.boardbox{flex:1 1 auto;min-height:0;container-type:size}`、`.board{width:min(100%,100cqh);height:auto;aspect-ratio:1}`，并压缩 `.tip/.param/.foot/.hintbar` 内边距 —— 让棋盘吃掉剩余高度，且用**容器单位取短边**保证棋盘恒为正方形。
- `@media (max-width:700px) and (max-height:700px)`：`.tip{max-height:3.4em;overflow:auto}`、隐藏 `.head p` —— 极短屏优先保证"棋盘 + 操作"落在首屏。
- 旧规则 `@media (max-height:700px){.board{width:min(84vw,56vh)}}` **保留**（横屏等窄高组合仍由它兜底）。

## 四、已知限制（未修，记录在案）

- ~~**game5 在矮视口下仍需内滚 117px**~~ → **手机竖屏已修**（§五）。仅剩：**1280 宽 × 700 高**（hub iframe 613）的桌面窄高窗口仍 117px 内滚——新规则按 `max-width:700px` 限定在手机竖屏，以免改变宽屏观感（宽视口棋盘仍是 400×400）。若要一并覆盖，把两条查询的宽度条件去掉即可，属观感取向。
- 所有内嵌游戏的滚动都发生在**子页内部**，玩家滚轮/触摸作用在 iframe 上即可，不需退出弹窗。
## 五、手机竖屏修复复验（game5-lights）

| 视口 | 棋盘 | 单元 | 纵向内滚 | 横向内滚 | 棋盘完整可见 | 真实点击通关 |
|---|---|---|---|---|---|---|
| 390×844（基准） | 333×333（正方） | 58×58 | **0px**（原 58px） | 0px | 是 | **10 步 ✔** `solved=true` 印章完整、通关后仍 0 内滚 |
| 360×640（苛刻） | 259×259（正方） | 43×43 | **0px**（原 271px） | 0px | 是 | — |
| 1280×900（桌面） | 400×400 | 72×72 | 23px（**与本轮改动前一致，未回归**） | 0px | 是 | 原探针 `clear_g5.mjs` 走 hub 真实入口：2 击通关、`{lv:1,stars:3}`、stats ts=2026-11-07T07:52:18.107Z |

复现：`node shortfit2.mjs game5-lights.html 390 844`、`node g5parts.mjs 390 844`、`node g5check.mjs 390 844`、`node g5win.mjs 390 844`（全部先静音；前置 `node _gt_srv.js` + 9222 的 Edge）。
