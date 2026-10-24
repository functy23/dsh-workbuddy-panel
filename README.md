# dsh-workbuddy-panel

把 [workbuddy2api](https://github.com/linguo2625469/workbuddy2api-panel) 网关**托管进 DSH**：插件自己发现并拉起上游进程，账号、模型目录、思考档位全部在 DSH 内管理 —— 不需要打开网关的面板网页。

![设置页 · 概览](docs/screenshots/overview.png)

## 它做了什么

- **托管进程**：找可执行文件 → 生成配置（随机 API key、loopback 监听）→ 启动 → 崩溃退避重启 → 展示日志。外部已启动的网关照常接管（识别为 `external`，只有"停止"会拒绝）。
- **模型自动发现**：每轮轮询把网关的模型目录与上一份做 diff（新增 / 移除 / 变更），新增模型自动进入 DSH 选择器，思考档位一并带入；读取失败保留上一份目录。
- **稳定排序**：网关的 `/panel/api/models` 是遍历 Go map 得到的，顺序每次可能不同；插件按 `id` 排序，列表不再跳动。
- **账号表格**：对齐面板账号页的列（身份 / 状态 / 积分 + 进度条 / 成功·连败 / 请求·Token / 操作），备注里带冷却原因、限流模型数、凭证到期。
- **登录流程**：列表底部"+ 添加账号"打开弹窗 —— 国内扫码（内置 QR 编码器，无第三方依赖）、国际打开浏览器授权、两域都支持粘贴令牌；账号落地后弹窗自动关闭。
- **思考档位**：模型行只读展示该模型**支持的全部档位**（如 `off / low / high / max`），不在插件里改档位。
- **仅显示已勾选**：模型页可按"仅已勾选"过滤，配合"全部启用 / 全部停用 / 同步隐藏到面板"。
- **输入框额度**：composer dock 显示账号池剩余积分，无框纯文本，与宿主的用量读数同排。
- **图片输入**：provider 接好了 durable attachment 钩子，带图对话不会报 `UNSUPPORTED_CONTENT`。

![设置页 · 模型](docs/screenshots/models.png)

![主界面 · 模型选择器](docs/screenshots/selector.png)

## 安装

    cd ~/.dsh/profiles/desktop
    pnpm add link:/path/to/dsh-workbuddy-panel

然后在 `package.json` 的 `dsh.profile.bundles` 里追加 `"dsh-workbuddy-panel"`，重启 DSH。

首次启动会在 `~/.dsh/workbuddy2api-gateway/gateway/` 生成网关配置与数据目录；已有账号目录可以通过 `authDir` 指过去。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `providerId` | `workbuddy2api` | 模型路由 id（选择器里的分组名） |
| `displayName` | `WorkBuddy2API` | 分组显示名 |
| `binaryPath` | `''` | 网关可执行文件；空 = 自动查找 |
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
| `src/adapter.ts` | pi-ai provider：指向网关 `/v1`，带 attachment 钩子 |
| `src/catalog.ts` | 目录合并 + 本地覆盖（显示/隐藏、档位）+ **按 id 排序** |
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

## License

MIT
