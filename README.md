# 《访客协议》VISITOR PROTOCOL

> 人机验证主题解谜合集 · 粉丝练习作品
> 灵感来源：《明日方舟：终末地》风格解谜 + 计客 GiiKER 实体益智玩具玩法，全部玩法为再创作，不含任何官方素材。
> 无网络请求、零依赖、零构建 —— 每个页面都是单文件原生 HTML/CSS/JS。

## 在线试玩

**https://yumoii789.github.io/endfield-captcha/** —— 打开即进入终端身份验证（用户界面）；`hub.html` 是九关设备总览页。

## 快速开始

```bash
cd endfield-captcha
node _gt_srv.js
# 打开 http://127.0.0.1:8099/  ← 根路径自动跳转终端身份验证（用户界面）
# 自由闯关中心：http://127.0.0.1:8099/hub.html · 管理后台：http://127.0.0.1:8099/admin.html
```

**必须通过 http 访问**（仓库自带 `_gt_srv.js` 静态服务器，仅监听本地）。
直接双击以 `file://` 打开时，浏览器会把每个页面视为隔离源，localStorage 互不相通，
游戏成绩无法汇入管理后台，终端与合集页的跨页状态也会失效。

## 两个入口（双版本）

| 入口 | 文件 | 形态 |
| --- | --- | --- |
| 版本 A · 游戏合集 | `hub.html` | 9 台「设备」卡片，自选游戏与难度 |
| 版本 B · 验证终端 | `terminal.html` | 人机验证叙事：随机抽题，通关即"验证通过" |

## 九个游戏

| 文件 | 代号 | 名称 | 星级 | 玩法 |
| --- | --- | --- | --- | --- |
| `game1-circuit.html` | V-40053 | 源石电路维修 | ★★★ | 旋转管路模块，接通 PWR→OUT |
| `puzzle2.html`（+ `puzzle2-core.js`） | V-40054 | 方块拼装作业 | ★★☆ | 方块拼装，填满目标区域 |
| `game3-gems.html` | V-40056 | 宝石神偷 | ★★★★ | 拾取/回避规划，路线取宝 |
| `game4-camping.html` | V-40055 | 露营达人 | ★☆☆ | 营地布置满足全部约束 |
| `game5-lights.html` | V-40057 | 灯光矩阵校验 | ★★★ | 点击翻转十字区域，点亮全部灯组 |
| `game6-code.html` | V-40058 | 口令破译 | ★★★ | 按金点/银点反馈还原损坏口令 |
| `game7-nonogram.html` | V-40059 | 图形校验 | ★★★★ | 按行列校验码涂黑格位重建影像 |
| `game8-targets.html` | V-40060 | 目标点选 | ★★☆ | 点选画面中全部合规异常信号源 |
| `game9-slide.html` | V-40061 | 滑块还原 | ★★★ | 把错位的影像碎片滑回原位 |

## 难度体系 V1–V5

- 每局在 **V1–V5** 五档中选择（V1 最易、V5 最难）；版本 B 终端按概率自动抽档。
  > 注：档位**没有全局统一的别名**——每关各有一套档位名（如 game5 为 教学/入门/常规/进阶/极限，game7 为 教学档/入门档/常规档/进阶档/极限档）。
- 生成器为**种子化随机**并内置可解性校验：出题即验证，拒绝无解/退化题面。
- 通关按实际难度记分、计时、计星，写入统计与匹配日志。
- 星级按**各关自有判据 + 失误门控**评定（3★ 需同时满足效率判据与 `失误<=MCAP[档位]`），九关判据与实测见 `docs/star-rubric.md`。

## URL 参数（已按页面核实）

| 参数 | 含义 | 适用页面 |
| --- | --- | --- |
| `?debug=1` | 调试模式（辅助信息/快捷操作） | 全部游戏 + 终端 |
| `?selftest=1` | 页面加载后跑内置自测，结果打印到控制台 | 全部页面（含 hub、admin） |
| `?direct=1` | 跳过引导直达题目 | 九关全部 |
| `?lv=N` | 指定初始难度 V·N | 九关全部 |
| `?seed=N` | 指定随机种子（复现题面） | 八关（宝石神偷未实现种子注入） |
| `?stage=N` | 直接进入指定关卡 | 宝石神偷 |
| `?export=1` | 导出关卡配置 JSON | 九关全部 |
| `?reset=1` | 清空本机数据 | 终端 |
| `?pause=1` | 自测时暂停在登录门禁 | 管理后台 |

2026-11-09 已按实际实现逐项核对，上表与 docs/conventions.md 的钩子表一致。
（旧版此行曾写「灯光矩阵暂未内置 `?direct` / `?export` / `?selftest`」——与上表和实测都不符：game5 三条都已内置，其 `?export` 的接线缺口也已在本轮修好，见 `docs/realplay.md` §十四。）

## 管理后台 `admin.html`

- 初始帐号 **admin / 123456**，登录后可在「帐户」中修改（本机 localStorage 存储）。
- 六大菜单：状态 PG-01 / 难度 PG-02 / 关卡管理 PG-03 / 帐户 PG-04 / 统计 PG-05 / 高级 PG-06。
- 难度页为双层概率体系：**全局五档概率（Σ=100% 合法校验）+ 各游戏关卡级覆盖**
  （覆盖只需填权重，匹配时按 × P_游戏(d) × P_关卡(d) 归一化）。
- 统计页：今日/本周/本月/本年/全部五个时间窗，KPI、每日曲线、游戏/星级/难度三维分布图，支持导出。
- 高级页：设置验证完成后跳转地址。
- 全部数据仅存本机 localStorage，无任何网络请求；所有读写均包裹 try/catch，异常不阻断页面。

## 数据与隐私

- 所有存储 key 以 `endland-` 前缀（用户/配置/统计/匹配日志/凭据/各游戏关卡），本地留存。
- 页面零外链、零字体下载、零 CDN —— 断网可用。 **（2026-11-10 复验并收严取证：把检查从 `link/script/img` 扩到「任意属性 `="http…"` + CSS `url(http…)` + `@import`」，全仓仍为 0；所有 CSS `url()` 只有内联 SVG 片段引用 `url(#…)`。）**

## 文档索引（`docs/`）

维护与验收文档；改代码时同步更新（尤其 `file:line` 引用——在文件前部插入行会把后面的引用推后）。

| 文档 | 内容 |
|---|---|
| `conventions.md` | 跨页约定：设备编号、父页消息契约（含 `mistakes` 字段）、URL 钩子、localStorage 键、全局静音 |
| `star-rubric.md` | 星级判据台账：九关各自判据 + 失误门控（`MCAP=[2,2,1,1,0]`）+ 实测证据 |
| `difficulty-axis.md` | 难度轴语义（`?lv=` 与 game3 `?stage=` 的统一口径） |
| `level-spec.md` | 关卡规格、关卡 JSON 格式、管理后台接口预留 |
| `layout-viewport.md` | 视口适配台账：手机竖屏/横屏扫描、入口页、puzzle2 与 game5 的缺陷与修复 |
| `realplay.md` | 真实通关回归台账：九关定位方式、触摸路径、手机通关矩阵、自检回归、踩坑记录 |
| `dom-consistency.md` | 渲染↔状态一致性审计（零知识 oracle：增量 DOM vs 整体重绘） |
| `worldbible.md` | 世界观设定（校验设备、第 39 号事故等） |
| `new-puzzles-proposal.md` | 新玩法提案 |
| `realdevice-checklist.md` | 真机点检清单：只有实机能判的项（手感/帧率/发热/系统级行为）+ 期望值表 + 记录模板 |

## 目录结构

```
endfield-captcha/
├─ index.html            根入口 · 自动跳转终端（GitHub Pages 友好）
├─ game1-circuit.html    游戏 V1 源石电路维修
├─ puzzle2.html          游戏 V2 方块拼装作业
├─ puzzle2-core.js       V2 核心逻辑（生成/校验）
├─ game3-gems.html       游戏 V3 宝石神偷
├─ game4-camping.html    游戏 V4 露营达人
├─ game5-lights.html     游戏 V5 灯光矩阵校验
├─ game6-code.html       游戏 V6 口令破译
├─ game7-nonogram.html   游戏 V7 图形校验
├─ game8-targets.html    游戏 V8 目标点选
├─ game9-slide.html      游戏 V9 滑块还原
├─ hub.html              版本 A 合集入口
├─ terminal.html         版本 B 验证终端
├─ admin.html            管理后台
├─ _gt_srv.js            本地静态服务器（node _gt_srv.js，端口 8099）
└─ docs/                 维护与验收文档 10 篇（见上方「文档索引」）
```

## 部署（GitHub Pages）

- 仓库根目录即站点根：Settings → Pages → Source 选 `main` 分支 `/ (root)`。
- 站点地址形如 `https://<用户名>.github.io/<仓库名>/`：打开根路径时 `index.html`
  经 meta refresh 跳转到 `terminal.html`；全部页面间链接均为相对路径，子路径部署无需改动。
- localStorage 在同一 https 源下与本地 http 表现一致，成绩统计照常汇入管理后台。
- InfinityFree 等免费 PHP 主机会注入第三方脚本破坏零网络请求隐私设计，不推荐。
- `_gt_srv.js` 仅供本地开发使用，无需部署。

## 免责声明

本项目为**粉丝练习作品**：玩法与文案为原创再创作，与鹰角网络 / Hypergryph（《明日方舟：终末地》）及计客 GiiKER 无任何关联，未使用其任何美术、音频或文本素材，亦无任何网络服务。
