# 部署指南 — 访客协议 VISITOR PROTOCOL

## 已部署（2026-11-08）

- **线上地址**：https://yumoii789.github.io/endfield-captcha/ （仓库 `yumoii789/endfield-captcha`，公开，Pages source = `main` / 根目录）
- **入口行为**：`/` → `index.html` meta 刷新 → `terminal.html`；`/hub.html` 为九关卡片总览；`/admin.html` 后台（admin / 123456，需先过人机验证）。
- **线上验收（真实 CDP 点击，11/11 PASS）**：根路径跳转 https 正常 · 终端注册建档（localStorage 在 https 下可用）· hub 九张卡片 · hub→iframe 内游戏加载 · **线上真实通关**（灯光矩阵 `pz-solved stars=3 moves=2`）· hub 写回统计 `pass:true` · game9 独立直开 · admin 人机验证解锁 · 登录进入控制台（六菜单，标题切换正确）· 登出后提示为 `msg hint`（提示样式，非错误）。
- **注意**：本机网络的 git 智能 HTTP 端点不可达（`Recv failure: Connection was reset`，重试 4 次均失败），故线上内容经 **GitHub Git Data API** 上传。
- **远端历史已与本地完全对齐**：以 `rebuild_history.mjs` 逐条重放本地 40 次提交（保留作者、提交时间与消息），重建后**每个提交的 SHA 与本地逐一相同**（`c98f48ed` … `2f2f7be8`）——git 内容寻址使然。因此不再需要 `--force`；日后在任何能连通 `github.com:443` 的网络下正常 `git push` 即可。
- 相关脚本（位于 `_verify/endfield-captcha/`，不随仓库发布）：`rebuild_history.mjs`（逐条重放全部提交，幂等且 SHA 稳定，**推荐**）、`push_via_api.mjs`（首次铺设）、`sync_via_api.mjs`（快照式同步，会产生新 SHA）。

## GitHub Pages（推荐）

1. 在仓库根目录（或子目录）放入本套件全部文件，**不要**上传 `_gt_srv.js`（本地测试服务器，部署不需要）。
2. `index.html` 已自带 meta 刷新跳转到 `terminal.html`，GitHub Pages 的静态托管直接生效，无需额外配置。
3. 仓库 Settings → Pages → Source 选择分支 + 根目录（若套件在子目录，Path 填该子目录）。
4. 等待 1–2 分钟构建完成，访问 `https://<用户名>.github.io/<仓库名>/`。

### 一条命令向导（推荐）

本套件本地已是完整 git 仓库（21 个文件已提交，`main` 分支）。在 **Git Bash** 中运行：

```bash
bash /d/mo/dshweb/deploy-wizard.sh
```

向导分 4 阶段自动完成：网页建空仓库（附地址）→ `remote add` + `push`（首次弹 GitHub 授权，点一次 Authorize）→ 指路开启 Pages → 打开站点复验。中断可重跑，已记住仓库地址。

### 部署后复验清单（必做）
- [ ] 首页 `/` 或 `/index.html` 跳转到验证终端
- [x] 终端注册 → 匹配 → 随机打开一个游戏 → 通关 → 回到身份验证成功
  —— **已用真实触摸在线上跑通 3 次**（`termjourney.mjs`，`?debug=1` 仅加速打字）：
  - V-40057 game5 **V5**：12 次触摸通关，`matchlog {game:"lights",id:"V-40057-lv5",lv:5}`、`stats {stars:3,moves:12,pass:true}`
  - V-40057 game5 **V4**：7 次触摸通关，`stats {stars:3,moves:7,pass:true}`
  - V-40059 game7 **V4**：32 次触摸通关，`stats {game:"nonogram",stars:3,moves:32,pass:true}`
  
  说明：终端在 `settleResult` 收到真实 `pz-solved` 后调用 `logStats` 写入 `pass:true`，随后打印「通关成功 / 用户通关数据 / 身份验证成功」并跳转 `hub.html`（正因立即跳转，探针难以在其前抓到那段可见文字；功能性完成由 `pass:true` 与 `lv` 正确性证明）。
- [ ] `hub.html` 9 张设备卡片全部可点击
- [ ] `admin.html` admin/123456 登录 → 六个菜单切换正常
- [ ] 浏览器地址栏为 https（localStorage 在 http 下会被部分浏览器拒绝）

## 备选：Cloudflare Pages / Netlify
- 直接拖拽 `endfield-captcha` 文件夹到 Dashboard 的部署入口即可，同样跳过 `_gt_srv.js`。
- 两者均默认 https，localStorage 无障碍。

## 本地试玩
```bash
node _gt_srv.js
# 访问 http://127.0.0.1:8099/ （会 302 到 terminal.html）
```

## 已核实的适配事实（2026-11-06）
- 全套件页面资产 0 个绝对 URL、0 个根相对路径（src="/"、href="/"、fetch("/") 均无命中），任意子路径部署均可运行。
- localStorage 键均为 `endland-*` 前缀，无跨站冲突风险。
- 唯一绝对路径存在于 `_gt_srv.js`（本地服务器脚本），不属于部署资产。
