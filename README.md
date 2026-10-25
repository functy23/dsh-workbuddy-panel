<p align="center">
  <img src="docs/icon-badge.svg" width="88" height="88" alt="dsh-workbuddy-panel">
</p>

<h1 align="center">dsh-workbuddy-panel</h1>

<p align="center">把 <a href="https://github.com/linguo2625469/workbuddy2api-panel">workbuddy2api</a> 网关 <b>托管进 DSH</b>：插件自己发现并拉起上游进程，账号、模型目录、思考档位全部在 DSH 内管理 —— 不需要打开网关的面板网页。</p>

![设置页 · 概览](docs/screenshots/overview.png)

## 它做了什么

- **托管进程**：只运行随包发布的 `bin/workbuddy2api`（不做 PATH 或目录探测）→ 生成完整配置（面板默认 + 随机 API key、loopback 监听）→ 启动 → 崩溃退避重启 → 展示日志。外部已启动的网关照常接管（识别为 `external`，只有"停止"会拒绝）。
- **模型自动发现**：每轮轮询把网关的模型目录与上一份做 diff（新增 / 移除 / 变更），新增模型自动进入 DSH 选择器，思考档位一并带入；读取失败保留上一份目录。
- **国内 / 国际双分组**：网关把两个域的模型放在同一个目录里，id 分别带 `cn:` / `global:` 前缀。插件按前缀拆成两个 provider：选择器里是 **`WorkBuddy2API · CN`** 与 **`WorkBuddy2API · Global`** 两个分组，各自只列本域模型，模型名不带前缀。设置页「模型」里用「国内版 / 国际版」切换 Tab 查看和管理，全部启用 / 停用也只作用于当前 Tab 的域。
- **稳定排序**：网关的 `/panel/api/models` 是遍历 Go map 得到的，顺序每次可能不同；插件先按域、再按 `id` 排序，列表不再跳动。
- **账号表格**：对齐面板账号页的列（身份 / 状态 / 积分 + 进度条 / 成功·连败 / 请求·Token / 操作），备注里带冷却原因、限流模型数、凭证到期。
- **登录流程**：列表底部"+ 添加账号"打开弹窗 —— 国内扫码（内置 QR 编码器，无第三方依赖）、国际打开浏览器授权、两域都支持粘贴令牌；账号落地后弹窗自动关闭。
- **思考档位**：模型行只读展示该模型**支持的全部档位**（如 `off / low / high / max`），不在插件里改档位。
- **仅显示已勾选**：模型页可按"仅已勾选"过滤，配合"全部启用 / 全部停用 / 同步隐藏到面板"。
- **输入框额度**：composer dock 显示账号池剩余积分，无框纯文本，与宿主的用量读数同排。
- **图片输入**：provider 接好了 durable attachment 钩子，带图对话不会报 `UNSUPPORTED_CONTENT`。

![设置页 · 模型](docs/screenshots/models.png)

![主界面 · 模型选择器](docs/screenshots/selector.png)

## 安装

    dsh plugin --profile web add dsh-workbuddy-panel

重启 DSH 后，设置里出现 **WorkBuddy2API**，模型选择器里出现 `workbuddy2api` 分组。

换个 profile 名就把 `web` 换成那个名字：`dsh plugin --profile <profile> add dsh-workbuddy-panel`。
**官方 DSH 桌面应用请在应用内的 Settings → Plugins 安装**：那个 profile 归应用的插件管理器管，运行中的 CLI 改不动它。

首次启动会在 `~/.dsh/workbuddy2api-gateway/gateway/` 生成网关配置与数据目录，然后拉起随包发布的 `bin/workbuddy2api`（默认监听 `127.0.0.1:7863`）。已有面板安装的配置会被继承，只需把 `authDir` 指向它已有的账号目录。

## 版本兼容

`0.3.1` 起，插件**自带并钉死** `@earendil-works/pi-ai`（`dependencies`，精确版本 `0.87.1`），不再声明 peer、也不再向宿主借那一份。

原因是一次真实事故：peer-only + profile 的 `nodeLinker: hoisted` + `autoInstallPeers: false` 三者叠加时，插件没有自己的副本，裸说明符会解析到**别的插件留在 profile 根目录**的旧版 `0.82.1`。那一代的 `estimateMessageTokens` 没有 `system` 分支，宿主一旦下发 system 消息，请求在发出任何 HTTP 之前就以 `PI_AI_ERROR` 崩掉。把 pi-ai 变成真实依赖后，pnpm 必须给插件自己一条依赖边：根上版本冲突时嵌套一份，不冲突时共用同一份——两种布局插件拿到的都是自己钉的那一代。

| DSH | 宿主自带 pi-ai（`dsh-llm-pi-ai` 的依赖） | 本插件自带 pi-ai |
|---|---|---|
| `0.1.7-alpha.1` / `0.2.0-rc.1` | `^0.85.1` | `0.87.1` |
| `0.2.0-rc.2` | `^0.87.1` | `0.87.1` |
| `0.2.1-rc.2` / `0.2.1-rc.3` | `^1.1.0` | `0.87.1` |

代价说清楚：插件侧不再随宿主升级 Pi，钉的是**一个已知能跑的代际**。跨代混合仍然会发生（插件 0.87.1 对上宿主 1.x），之所以能跑，是因为 provider 以**纯对象**跨过 `dsh-llm-pi-ai` 的边界——`Models.setProvider` 只按 `id` 存、按 `stream` / `streamSimple` / `getModels` 调用，没有 `instanceof`；插件也只使用 `createProvider` / `openAICompletionsApi` 与 Model 描述字段，并对 `getAllModels` 这类 1.x 才有的成员做了条件处理。

要换代际就改一处：`package.json` 的 `dependencies` 里那个精确版本 → `pnpm install` → `pnpm run check` → 发版。`src/pi-ai-version.ts` 的 `MIN_PI_AI_VERSION` 是**最低可运行代际**（`0.87.0`），不是钉的版本，不要跟着乱动。

设置页概览的版本徽章显示**本插件实际加载到的 pi-ai 版本**；启动日志同时打印宿主那一份（`pi-ai 0.87.1 (host 0.87.1)`）。两者代际不一致、或插件这份低于最低代际时，日志会给出点名到具体原因的 warn，排查版本漂移先看这两处。

如果看到 `pi-ai provider "workbuddy2api" has no configured model ...`：这是目录快照比网关慢一拍（新模型刚出现、或网关启动时短暂返回空目录），`0.3.1` 起会在目录变化时重建适配器快照、对空目录保留上一份，并对单次未知模型做一次目录兜底；升级后仍复现时，把设置页「模型」里的目录和网关日志一起发出来。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `providerId` | `workbuddy2api` | 模型路由 id（选择器里的分组名） |
| `displayName` | `WorkBuddy2API` | 分组显示名 |
| `port` | `7863` | 网关监听端口 / 健康探测端口 |
| `autoStart` | `true` | 随插件启动，崩溃后退避重启 |
| `restartLimit` | `5` | 一轮运行内允许的重启次数 |
| `refreshSeconds` | `15` | 目录轮询间隔 |
| `apiKey` | `''` | 网关密钥；空 = 用（或生成）网关 config.json 里的 key |
| `authDir` | `''` | 账号目录；空 = `<workdir>/auths` |
| `autoRegister` | `true` | 新模型自动进入选择器 |

**密钥只有一个**：在设置页改密钥时，插件会把它写进网关的 `config.json` 并重启网关，避免"插件连不上、面板网页也进不去"。

## 架构

| 文件 | 职责 |
|---|---|
| `src/supervisor.ts` | 二进制发现、config 生成、spawn、SIGTERM/SIGKILL、退避重启、日志环、`/healthz` 探测 |
| `src/service.ts` | 状态聚合：网关读取、目录 diff、账号操作、登录流程、用量缓存 |
| `src/routes.ts` | 两个 loopback 路由：`status`（只读，带 controlKey）与 `action`（controlKey 保护） |
| `src/adapter.ts` | pi-ai provider：国内 / 国际两条路由指向同一网关 `/v1`，带 attachment 钩子 |
| `src/catalog.ts` | 目录合并 + 本地覆盖（显示/隐藏、档位）+ 域识别 + **按域、再按 id 排序** |
| `src/usage.ts` | 读网关用量账本，按天聚合出热力图窗口、高峰时段、最常用模型 |
| `src/client/*` | DSH 原生 UI：设置页四分区、账号表格、添加账号弹窗、用量卡、composer 额度 |

## 开发

    pnpm install
    pnpm run build       # tsdown：ESM host + CJS client
    pnpm run typecheck   # tsconfig.json + tsconfig.client.json
    pnpm run test        # vitest：supervisor / service / client-render

## 已知边界

- 路由前缀仍是 `/plugins/workbuddy2api-gateway/*`（改名只动了包名与显示名，避免已有安装的链接与缓存失效）。
- 设置左侧导航的图标由宿主的 `navIcon(id)` 白名单决定，插件没有 icon 位；本插件给那一行打 `data-wb2a-nav` 标记后用遮罩画出自己的图形。
- 网关的登录、签到、限流策略属于网关本身，插件只驱动、不重写。

## 鸣谢

- **[workbuddy2api-panel](https://github.com/linguo2625469/workbuddy2api-panel)**（[Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api) 的 fork）— 本项目托管的网关本体。账号池轮转、熔断与冷却、会话粘性、签到 / 活跃 / 旅行 / 保活、OAuth 登录、OpenAI 兼容层全部来自它。MIT 许可，版权归 Sliverkiss 与 linguo2625469 所有。
- 本仓库在 upstream/workbuddy2api-panel/ 保存的是**本机工作树的源码快照**：它就是 `bin/workbuddy2api` 的编译来源，包含本地对上游的全部修改（复制时有 47 个文件与上游最后一次提交不同），因此"插件跑的那份二进制"和"仓库里那棵源码树"是对得上的，可以直接核对插件调用的 HTTP 契约。Git 历史未包含，见 `upstream/workbuddy2api-panel/BUILD-NOTES.md`。npm 发布包**只带二进制** `bin/workbuddy2api`，不含源码；插件本身不链接上游代码，只通过 HTTP API 读写账号与模型。默认配置模板取自该安装的 `config.json`（见 `src/default-config.ts`），字段结构归上游。
- 上游仓库目前带有**停止维护声明**，并禁止未授权的反代 / 转卖；使用前请自行确认所在环境的条款。
- UI 与交互参考了插件 [dsh-workbuddy-connect-functy](https://github.com/functy23) 的实现（账号行、添加账号弹窗、composer 额度徽章）；视觉语言参考插件 **dsh-claude-style**（Claude Style 主题插件）的设计。

## License

MIT
