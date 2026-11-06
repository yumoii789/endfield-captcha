# 部署指南 — 访客协议 VISITOR PROTOCOL

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
- [ ] 终端注册 → 匹配 → 随机打开一个游戏 → 通关 → 回到身份验证成功
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
