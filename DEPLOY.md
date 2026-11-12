# 部署指南 — 访客协议 VISITOR PROTOCOL

## 已部署（2026-11-08）

- **线上地址**：https://yumoii789.github.io/endfield-captcha/ （仓库 `yumoii789/endfield-captcha`，公开，Pages source = `main` / 根目录）
- **入口行为**：`/` → `index.html` meta 刷新 → `terminal.html`；`/hub.html` 为九关卡片总览；`/admin.html` 后台（admin / 123456，需先过人机验证）。
- **线上验收（真实 CDP 点击，11/11 PASS）**：根路径跳转 https 正常 · 终端注册建档（localStorage 在 https 下可用）· hub 九张卡片 · hub→iframe 内游戏加载 · **线上真实通关**（灯光矩阵 `pz-solved stars=3 moves=2`）· hub 写回统计 `pass:true` · game9 独立直开 · admin 人机验证解锁 · 登录进入控制台（六菜单，标题切换正确）· 登出后提示为 `msg hint`（提示样式，非错误）。
- **注意**：本机网络的 git 智能 HTTP 端点不可达（`Recv failure: Connection was reset`，重试 4 次均失败），故线上内容经 **GitHub Git Data API** 上传。
- **远端历史已与本地完全对齐**：以 `rebuild_history.mjs` 逐条重放本地提交（保留作者、提交时间与消息），重建后**每个提交的 SHA 与本地逐一相同**——git 内容寻址使然。因此不再需要 `--force`；日后在任何能连通 `github.com:443` 的网络下正常 `git push` 即可。
- **重放的两个坑（都已实测）**：① 脚本靠进程 cwd 调 `git`，必须在仓库目录内执行（`cd endfield-captcha && node …/rebuild_history.mjs`），否则报 `not a git repository`；② 若报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`（网络侧证书链偶发不完整），改用 `node --use-system-ca …/rebuild_history.mjs` 走系统根证书即可。
- **重放的第三个坑（2026-11-09 首记 · 2026-11-10 查明机制）**：本机 hosts 里有一段由 **Steam++（Watt Toolkit）的「网络加速」**写入的重定向块（文件里有 `# Steam++ Start` / `# Steam++ End` 标记，共 50 条），把 `github.com`、`api.github.com`、`github.io`、`raw.githubusercontent.com`、`objects.githubusercontent.com`、`avatars*.githubusercontent.com`、`gist.github.com`、`pages.github.com`，以及 Steam 系列、`img.youtube.com`、`huggingface.co`、`hub.docker.com`、`greasyfork.org` 指向 `127.0.0.1`。**这是加速器的实现方式，不是谁设的屏蔽**：随后由 Watt Toolkit 自己在 `127.0.0.1:443`（及 80）起本地代理来接这些域名并转发。所以**只要它没在跑，这些域名就一律变成 `ECONNREFUSED 127.0.0.1:443`**——原先那句「本机是经本地代理出网的，代理一旦挂掉就推不上去」**是对的**（"代理" = Watt Toolkit 的本地加速器）；也正因如此，系统里 `ProxyEnable=0`、无 `*_proxy` 变量、7890 无监听，全都是正常的。
- 为什么有的域名还活着：hosts 是**精确匹配**。`codeload.github.com` 不在那段里（→ 301 可达）；`yumoii789.github.io` 是 `github.io` 的子域、不匹配（→ 200 可达）。所以**线上站点看着正常、只是推不上去**。
- 证据链（可复跑）：① `curl -v https://github.com 2>&1 | grep Trying` → `Trying 127.0.0.1:443` → 拒绝，`git ls-remote` 29ms 同样失败；② `nslookup github.com` 直查 DNS 得真 IP `20.205.243.166`（**nslookup 不读 hosts**，两者不一致正是 hosts 重定向的特征）；③ `curl --resolve github.com:443:20.205.243.166 https://github.com` → **200**，证明链路本身通畅；④ hosts 首尾的 `# Steam++ Start` / `# Steam++ End` 标记 + 条目集合（Steam、YouTube 缩略图、huggingface、GitHub 全家、hub.docker.com、greasyfork）共同指明出处。
- 三种解法：① **启动 Watt Toolkit 并开启网络加速**（恢复原设计，最省事；它是 GUI 程序，需机主操作）；② 从 hosts 删掉 `# Steam++ Start…End` 整段（需管理员，恢复直连；已实测直连真 IP 可达）；③ 只在本 session 内绕过——起一个仅监听本机的隧道把这两个域名钉到真实 IP，再 `git -c http.proxy=… push`（不改 hosts、不动系统设置，用完即关）。
- 判定方法：`curl -m 12 -o /dev/null -w "%{http_code}" https://api.github.com`（000 即不通），再用 `curl -v … | grep Trying` 区分「hosts 重定向且加速器没跑」与「真实网络故障」。本地提交照常做，连通后用同一条重放命令补推即可（幂等、SHA 稳定，不会分叉）。
- **2026-11-10 实测补记（真因比上面再细一层，也是本次成功推送的配方）**：
  ① `Steam++.Accelerator.exe` 监听 `0.0.0.0:80/443`；它自己在跑、但上游不通时会直接返回 **502**（实测 `curl https://github.com` → 502，而非 refused）。
  ② 这台网络下 **`github.com` 本身不可达**：即使绕过 hosts、把连接钉到它的真实 IP（`20.205.243.166`），也在 TLS 前被 `ECONNRESET`/`ETIMEDOUT`；而 **`api.github.com` 可达**（同一隧道下稳定 200）。所以 **`git push`（走 github.com）在本机不要指望**——这条正是本文件开头「git 智能 HTTP 端点不可达，故改用 Git Data API」的真正原因，与 hosts 无关。
  ③ 本次成功推送的组合（可复用）：一个仅监听本机的 CONNECT 隧道把 `api.github.com` 钉到真实 IP，然后
     `HTTPS_PROXY=http://127.0.0.1:8443 NODE_USE_ENV_PROXY=1 node --use-system-ca _verify/endfield-captcha/rebuild_history.mjs`（**cwd 必须在仓库目录内**）。结果：`main -> 09d67e5a`、远端 HEAD 与本地逐字符相同。
  ④ 若 Steam++ 正在正常加速，它自己就会接这些域名，此时无需隧道——但 `github.com` 不可达这一点不变，仍走重放脚本。
- **2026-11-11 补充（解析这一环）**：隧道靠「解析真实 IP」绕过 hosts，而 **`nslookup` 不再可靠**——本机装有 Cloudflare WARP，它一连接就接管系统解析器（DNS 显示为 `connectivity-check.warp-svc @ 127.0.2.2`），
  于是 `nslookup api.github.com` 也照答 hosts 里的 `127.0.0.1`。**改用 DoH**：`curl -s -H "accept: application/dns-json" "https://doh.pub/dns-query?type=A&name=api.github.com"`（备用 `https://dns.alidns.com/resolve?type=A&name=…`），两者都返回真 IP `20.205.243.168`。
  隧道已改成 DoH + 重试，并在解析失败时**显式退出**——否则它会变成一个"在监听但拒绝一切"的静默坏隧道（本轮真踩了）。
- **杀进程要按 PID**：`pkill -f pin_tunnel.mjs` 在本机**杀不掉**它（MSYS pkill 对 Windows 进程不可靠，Edge 同理）。要 `netstat -ano | grep :8443` 取 PID，再 `taskkill //F //PID <pid>`。
- 相关脚本（位于 `_verify/endfield-captcha/`，不随仓库发布）：`rebuild_history.mjs`（逐条重放全部提交，幂等且 SHA 稳定，**推荐**）、`push_via_api.mjs`（首次铺设）、`sync_via_api.mjs`（快照式同步，会产生新 SHA）。

## GitHub Pages（推荐）

1. 在仓库根目录（或子目录）放入本套件全部文件，**不要**上传 `_gt_srv.js`（本地测试服务器，部署不需要）。
2. `index.html` 已自带 meta 刷新跳转到 `terminal.html`，GitHub Pages 的静态托管直接生效，无需额外配置。
3. 仓库 Settings → Pages → Source 选择分支 + 根目录（若套件在子目录，Path 填该子目录）。
4. 等待 1–2 分钟构建完成，访问 `https://<用户名>.github.io/<仓库名>/`。

### 一条命令向导（推荐）

本套件本地已是完整 git 仓库（`main` 分支；文件清单见 `git ls-files`——2026-11-10 实测 **28 个 tracked 文件**。**此处原写「21 个文件」，早已过期，故改为不写死数字**，与 `docs/conventions.md` §八「别让硬数字过期」同一条纪律）。在 **Git Bash** 中运行：

```bash
bash /d/mo/dshweb/deploy-wizard.sh
```

向导分 4 阶段自动完成：网页建空仓库（附地址）→ `remote add` + `push`（首次弹 GitHub 授权，点一次 Authorize）→ 指路开启 Pages → 打开站点复验。中断可重跑，已记住仓库地址。

### 部署后复验清单（必做）

> **自动化复验（推荐先跑这个再看下面的手工清单）**：`bash _verify/endfield-captcha/accept.sh` —— 19 组检查（文档真实性 / 语法 / 终端两分支 / 改名 / hub 进度与失败分支、命中区 / 九关自检与导出 / LEVELS_META / 两方向 90 组合可达性 / 线上九卡 / 音效与静音门 / 输入框字号 / 长按选择 / 键盘遮挡 / 桌面视口 1920×1080 / 极窄 280×653 与宽矮 1280×600 / admin 六个写面），基础设施不可用时会自动重启 Edge 与本地 8099 并重试一次；全绿约 15 分钟。详见 `docs/conventions.md` §八。
- [x] 首页 `/` 或 `/index.html` 跳转到验证终端
  —— 线上实测（`rootredir.mjs`）：`/` → `/endfield-captcha/terminal.html`（标题「访客协议 VISITOR PROTOCOL · 人机验证终端」）；`/index.html` 同样跳转。均为 https。
- [x] 终端注册 → 匹配 → 随机打开一个游戏 → 通关 → 回到身份验证成功
  —— **已用真实触摸在线上跑通 3 次**（`termjourney.mjs`，`?debug=1` 仅加速打字）：
  - V-40057 game5 **V5**：12 次触摸通关，`matchlog {game:"lights",id:"V-40057-lv5",lv:5}`、`stats {stars:3,moves:12,pass:true}`
  - V-40057 game5 **V4**：7 次触摸通关，`stats {stars:3,moves:7,pass:true}`
  - V-40059 game7 **V4**：32 次触摸通关，`stats {game:"nonogram",stars:3,moves:32,pass:true}`
  
  说明：终端在 `settleResult` 收到真实 `pz-solved` 后调用 `logStats` 写入 `pass:true`，随后打印「通关成功 / 用户通关数据 / 身份验证成功」并跳转 `hub.html`（正因立即跳转，探针难以在其前抓到那段可见文字；功能性完成由 `pass:true` 与 `lv` 正确性证明）。
- [x] `hub.html` 9 张设备卡片全部可点击
  —— **线上 9/9 逐张真点**（`hubcards.mjs`）：每张卡点开后，用**该关自己的游戏状态信号**确认已就绪，而非只看 DOM 存在：
  `V-40053 pz.tiles` · `V-40054 pz.pieces` · `V-40055 pz.sol` · `V-40056 bestSteps+cur+49 个 .spot` · `V-40057 pz.sol` · `V-40058 pz.secret` · `V-40059 pz.answer` · `V-40060 pz.targetCount` · `V-40061 pz.ref+board`。
  注：hub 传的是 `?direct=1&lv=N`（hub.html:134）；game3 的 `?direct=1` 语义是"延时后自动点人机验证框"（game3-gems.html:784），故其就绪信号是 `bestSteps/cur` 而非 `pz`。
- [x] `admin.html` admin/123456 登录 → 六个菜单切换正常
  —— **线上 6/6**（`adminmenus.mjs`）：人机验证勾选 → 真实键入 admin/123456 → 登录键由 disabled 变可用 → 进入控制台（`who=admin`），六个菜单逐个点击后 `#pgTitle` 与菜单名一致：状态 / 难度 / 关卡管理 / 帐户 / 统计 / 高级。
  注：**每次点击前必须重取坐标**——首轮未重取时后 3 个菜单点不动（表现为 3/6），实为坐标过期/落在视口外，非产品缺陷。
- [x] 浏览器地址栏为 https（localStorage 在 http 下会被部分浏览器拒绝）
  —— 线上所有被验收页面 `location.protocol` 均为 `https:`；并在 https 下实测 `localStorage.setItem/getItem` 可读写（`OK:1`）。

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
