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
window.parent.postMessage({type:'pz-solved', device, game, lv, stars, moves, secs}, '*');
// 失败
window.parent.postMessage({type:'pz-failed', device, lv, moves}, '*');
```

注意：仅当 `window.parent !== window`（即被 iframe 嵌入）时才发送；顶层直接打开时不发。

## 三、URL 钩子语义

| 钩子 | 含义 |
|---|---|
| `?direct=1` | 跳过登记/验证，自动进入关卡 |
| `?lv=1..5` | **难度档位**（九关统一语义） |
| `?stage=N` | 关卡号（仅 game3 使用，优先于 `?lv`） |
| `?fast=1` | 跳过动画/加速（自动化测试必带） |
| `?selftest=1` | 运行页面自带自检，结果打到 console |
| `?seed=N` | 复现同一题面 |
| `?reset=1` | 清空本页存档 |
| `?export=1` | 导出关卡 JSON 到 console |
| `?debug=1` | 调试输出（terminal 下同时使打字机瞬时完成） |
| `?wait=N` | 仅 terminal：结果等待超时（毫秒，默认 600000） |

> 历史坑：game3 原先把 `?lv=` 当关卡号，导致 terminal 流程里难度档位失效（永远 V1）。已统一，见 docs/difficulty-axis.md。

## 四、localStorage 键

| 键 | 用途 | 写入方 |
|---|---|---|
| `endland-user` | 访客档案 | terminal / 各关登记 |
| `endland-stats` | 通关统计流水 | hub / terminal |
| `endland-matchlog` | 匹配记录 | terminal |
| `endland-hub-progress` | 各设备进度与星级 | hub |
| `endland-levels-*` | 各关自定义关卡队列 | 各关 |
| `endland-mute` | **九关共享静音**（`'on'`=静音；缺省/其他=有声） | 各关 btnMute |

## 五、音效约定

九关各自内置 WebAudio 合成音效（`tone()` + `chime()`，无资源文件），并通过各自的 `#btnMute` 切换 `muted` 标志。
自 2026-11 起：静音选择**持久化到 `endland-mute`**，在一关静音后打开其他关会自动继承；**默认仍为有声**（不改变既有观感）。

> 禁止再加"父页音效层"：曾给 hub/terminal 加过 iframe 点击音与结算音，与关卡内建音效叠成双响、并形成第二套互不相通的静音，已撤回。
