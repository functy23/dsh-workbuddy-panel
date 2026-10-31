<p align="center">
  <img src="https://raw.githubusercontent.com/functy23/dsh-workbuddy-panel/main/docs/icon-badge.svg" width="96" height="96" alt="dsh-workbuddy-panel">
</p>

<h1 align="center">dsh-workbuddy-panel</h1>

<p align="center"><b>WorkBuddy2API × DeepSeek Harness</b></p>

把 [workbuddy2api](https://github.com/linguo2625469/workbuddy2api-panel) 网关接进 DSH 的模型选择器：面板与内核分离，网关本体按 `server.json` 单独下载、校验后由宿主 `ctx.subprocess` 托管；账号池、模型目录、思考档位与额度都在 DSH 设置页里管理，不用再打开网关的网页面板。内核基于 workbuddy2api-panel 构建，出站指纹对齐官方 WorkBuddy Desktop **5.9.3（国服）/ WorkBuddy AI 5.9.4（国际服）**。

## 特点

**面板 · DSH 集成**

- **面板 / 内核分离**：面板包约 0.1MB，只带 UI、目录、路由、pi-ai provider 和 `server.json` 清单，不含网关二进制；网关本体是独立的 GitHub Release 资产（gzip ≈4MB，安装 ≈10MB），按清单里的 SHA-256 校验后落盘。
- **内核独立更新**：设置页「网关进程 → 内核更新」每小时（或手动）检查，点「安装内核」即下载、校验、落盘，下次启动接管，**不必等面板发版**。
- **渠道是一份固定 URL 的静态清单**（对齐 Sparkle appcast 的做法，不列 GitHub API）：
  `https://github.com/functy23/dsh-workbuddy-panel/releases/download/server-channel/server.json`。
  检查更新只发一个 GET，不碰 `api.github.com`，所以不会被匿名配额（60 次/小时/IP）打成 403；发新内核时 `gh release upload server-channel dist/server.json --clobber` 覆盖同一个 URL 即可。自建镜像可用 host row 的 `manifestUrl` 指向自己的清单。
- **宿主托管进程**：host gateway row 通过 `ctx.subprocess` 启动 / 停止 / 重启，崩溃退避重启、日志可见；面板行重载不影响网关，外部已启动的网关照常接管（停止需回原启动处）。
- **模型目录自动发现**：轮询时与上一份 diff（新增 / 移除 / 变更），新模型自动进入选择器，思考档位一并带入；读取失败保留上一份目录。
- **国内 / 国际双分组**：按 `cn:` / `global:` 前缀拆成 `WorkBuddy2API · CN` 与 `WorkBuddy2API · Global` 两个 provider，各自只列本域模型，模型名不带前缀。
- **稳定排序**：网关目录来自 Go map 遍历，插件按域、再按 `id` 排序，列表不跳动。
- **账号池**：身份 / 状态 / 积分进度 / 成功·连败 / 请求·Token / 操作；备注里带冷却原因、限流模型数与凭证到期。
- **登录**：国内扫码（内置 QR 编码器，无第三方依赖）、国际浏览器授权、两域粘贴令牌或账号 JSON；账号落地后弹窗自动关闭。
- **令牌导入两条门**：带 `refresh_token` 的账号走面板 `import/cockpit` 热加载，签到 / 余额一并跑；只有 access token 的裸 JWT 写进网关 `auths/workbuddy-<uid>.json`（`refresh_token` 留空）后自动重启网关加载——面板 API 会拒收无法续期的凭证，伪造一个 refresh_token 只会在首次保活时撞 12153 被禁号。裸令牌按 `sub` / `nickname` / `exp` / `iss` 解析，国内域不写 `domain`（回落 endpoint 主机名），国际域写 `www.workbuddy.ai`。
- **模型页**：思考档位只读展示，支持「仅已勾选」过滤、全部启用 / 停用、同步隐藏到面板。
- **用量与额度**：概览页请求数 / Token / 剩余积分 / 活跃天数 / 高峰时段 / 最常用模型与热力图；composer 按当前模型所属域显示账号池总积分。
- **图片输入**：provider 接了 durable attachment 钩子，带图对话不会报 `UNSUPPORTED_CONTENT`。

**内核 · 本仓库对上游的改动**

以下改动来自本仓库对上游快照的本地修改；服务端 Release 由这棵树构建。

- **UA / 版本更新（按 realm 分叉）**：国服 `WorkBuddy/5.9.3 WorkBuddy/5.9.3 CLI/2.165.0`，国际服 `workbuddy-ai/5.9.4 workbuddy-ai/5.9.4 CLI/2.165.0`；`X-IDE-Version` 与渲染进程 UA（`WorkBuddy/<v>` / `WorkBuddyAI/<v> workbuddy-ai/<v>`）同源；`upstream.client_version` / `cli_version` / `ua_client_name` 可覆盖。
- **设备指纹**：`/v2/report` 的 `reportDelay` 恒 0；`machineId` 改为 UUID 形态（大写、带横线，同一账号稳定）；`sessionId` 进程级随机；OS / CPU / 内存用真机样本缺省值且可配；`commit` / `releaseDate` 对齐 5.9.2 包内 product.json（官方未改）；`qimei36` 可注入，缺省**不发**。
- **Chat 头族**：`X-Agent-Type: main`、`X-Agent-Runtime: other`、`X-Agent-Purpose: conversation`、`X-Private-Data` 按个人 / 企业号取值、`Accept` 用 axios 默认串；去掉 `Accept-Encoding: identity` 与 `X-CodeBuddy-Request`。
- **身份族**：补 `X-Id-Source` / `X-Department-Info` / `X-Userinfo.id_source`，只在 CLI 链路发。
- **模型目录端点**：`/console/` 补 `X-Requested-With` 与浏览器 `Accept`，对齐主进程里唯一显式设置这两头的调用。
- **请求体去品牌化**：`prompt_cache_key` 改 32 位 hex，不再带 `wb2a-<uid8>` 前缀。
- **三档头族分层**：主进程基线 / CLI 文本会话 / 渲染进程 Web，各端点只带该发出者真会发的头；`X-Device-Token` 仅签到注入。

**内核 · 继承自上游**：账号池轮转、熔断与冷却、会话粘性、签到 / 活跃 / 旅行 / 保活、成长任务、`/v1` OpenAI 兼容、SSE 流式、搜索端点、系统提示词体系、请求体指纹清洗。

## 展示图

<p align="center">
  <img src="https://raw.githubusercontent.com/functy23/dsh-workbuddy-panel/main/docs/screenshots/overview.png" alt="设置页 · 概览" width="860"><br>
  <sub>设置页 · 概览：用量、额度与热力图</sub>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/functy23/dsh-workbuddy-panel/main/docs/screenshots/models.png" alt="设置页 · 模型" width="860"><br>
  <sub>设置页 · 模型：开关、思考档位与计费倍率</sub>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/functy23/dsh-workbuddy-panel/main/docs/screenshots/selector.png" alt="主界面 · 模型选择器" width="860"><br>
  <sub>主界面 · 模型选择器：WorkBuddy2API 分组</sub>
</p>

## DSH 版本支持

当前组合：面板 **0.5.0** · 内核 **1.14.0-panel** · Node `^22.19.0 || >=24`。支持 DSH `0.1.7-alpha.1` 起（宿主包 peer 范围 `^0.1.7-alpha.1 || ^0.2.0-rc.1`）。

| DSH | 宿主自带 pi-ai | 本插件 pi-ai |
|---|---|---|
| `0.1.7-alpha.1` / `0.2.0-rc.1` | `^0.85.1` | `0.87.1` |
| `0.2.0-rc.2` | `^0.87.1` | `0.87.1` |
| `0.2.1-rc.2` / `0.2.1-rc.3` | `^1.1.0` | `0.87.1` |

插件**自带并钉死** `@earendil-works/pi-ai@0.87.1`，不声明 peer。原因：profile 的 `nodeLinker: hoisted` + `autoInstallPeers: false` 会让 peer-only 解析到别的插件留在根目录的旧副本；`0.82.1` 的 `estimateMessageTokens` 没有 `system` 分支，请求会在发出前以 `PI_AI_ERROR` 崩掉。最低可运行代际是 `0.87.0`（`MIN_PI_AI_VERSION`），不是钉的版本。

跨代仍可用：provider 以纯对象跨过 `dsh-llm-pi-ai` 的边界，只按 `id` / `stream` / `getModels` 调用，没有 `instanceof`。设置页版本徽章显示插件实际加载的 pi-ai 版本，启动日志同时打印宿主那份（`pi-ai 0.87.1 (host 0.87.1)`）；代际不一致会给出 warn。

## 安装

    dsh plugin --profile web add dsh-workbuddy-panel

重启 DSH 后，设置里出现 **WorkBuddy2API**，模型选择器里出现 `WorkBuddy2API · CN` 与 `WorkBuddy2API · Global`。

- **桌面应用**：在 Settings → Plugins 里安装；那个 profile 归应用的插件管理器管，运行中的 CLI 改不动它。换 profile：`dsh plugin --profile <profile> add dsh-workbuddy-panel`。
- **首次启动**：在 `~/.dsh/workbuddy2api-gateway/gateway/` 生成配置与数据目录；打开设置页「网关进程 → 服务端」点「下载服务端」，校验后落盘。默认监听 `127.0.0.1:7863`。
- **离线安装**：从 [Releases](https://github.com/functy23/dsh-workbuddy-panel/releases) 下载对应平台的 `.gz`，解压到 `~/.dsh/workbuddy2api-gateway/server/<version>/<platform>/workbuddy2api`，再点「重新校验」。
- **平台**：`darwin-arm64` / `darwin-x64` / `linux-x64` / `linux-arm64` / `win32-x64`；其他平台会显示「当前平台没有构建」，不会静默失败。

## 开发

    pnpm install
    pnpm run check       # build + typecheck + test，提交前必须全绿

    pnpm run build       # tsdown：ESM host（index + gateway）+ CJS client
    pnpm run typecheck   # tsconfig.json + tsconfig.client.json
    pnpm run test        # vitest

    pnpm run server:manifest       # 用 bin/workbuddy2api 生成 server.json
    pnpm run server:install-local  # 填充本地服务端缓存

- 目录地图、硬性约定与发版流程见 [AGENTS.md](https://github.com/functy23/dsh-workbuddy-panel/blob/main/AGENTS.md)。
- `upstream/` 是只读快照；`bin/workbuddy2api` 只用于本地生成 manifest / 填充缓存，不进 npm 包。
- 服务端版本只在 `server.json`；面板版本只在 `package.json`，由 tsdown 注入设置页的版本徽章。

---

<sub>MIT License · 网关上游 [workbuddy2api-panel](https://github.com/linguo2625469/workbuddy2api-panel)（fork 自 [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api)）· UI 参考 dsh-workbuddy-connect-functy 与 dsh-claude-style</sub>

<sub>上游仓库已停止维护，并禁止未授权的反代 / 转卖；使用前请自行确认所在环境的条款。</sub>
