# WorkBuddy 5.8.3 出站指纹对照表

> 用途：本文件是 `internal/upstream/headers.go` 的事实来源。任何出站头的新增/删除
> 都必须先在本表登记，并在 `internal/upstream/fingerprint_test.go` 的基线里同步——
> 那两个白名单用例会**双向**断言（必须有 / 必须没有 / 集合相等），改代码不改基线
> 会直接测试失败。
>
> 证据：`/Applications/WorkBuddy.app/Contents/Resources/app.asar` 解包
> （`main/server.js`、`cli/dist/codebuddy-lite-wb.mjs`、`cli/product.json`）+
> 本机运行日志（`~/.workbuddy/logs/main.log`、`renderer.log`）+
> `~/.workbuddy/sessions/*.json`。

## 0. 版本基线

| 项 | 值 | 来源 |
|---|---|---|
| 客户端版本 | `5.8.3` | `asar/package.json` `version` |
| Electron | `37.10.3` | `renderer.log` UA |
| Chromium | `138.0.7204.251` | 同上 |
| 内置 CLI | `2.161.0` | `~/.workbuddy/sessions/*.json` `version` |
| endpoint | `https://www.workbuddy.cn` | `cli/product.json` `endpoint` |
| deploymentType | `SaaS` | 同上（→ `X-Product`） |
| 登录 platform | `workbuddy` | `product.json authentication.attributes.platform` |
| 登录 prefixPath | `/plugin` | 同上 |

## 1. 主进程 API 请求（chat / billing / refresh / 模型目录）

```
POST /v2/chat/completions HTTP/1.1
Host: www.workbuddy.cn
Accept: application/json
Accept-Encoding: identity
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
User-Agent: WorkBuddy/5.8.3 WorkBuddy/5.8.3 CLI/2.161.0
X-Agent-Intent: craft
X-Agent-Type: cli
X-Auth-Method: plugin
X-CodeBuddy-Request: 1
X-Domain: www.workbuddy.cn
X-IDE-Name: WorkBuddy
X-IDE-Type: WorkBuddy
X-IDE-Version: 5.8.3
X-Product: SaaS
X-Request-ID: <32hex>
X-User-Id: <UID>
X-Userinfo: base64({"uin":"<UID>","token_source":"plugin"})
b3: <32hex>-<16hex>-1
traceparent: 00-<32hex>-<16hex>-01
X-B3-Sampled: 1
X-B3-SpanId: <16hex>
X-B3-TraceId: <32hex>
X-Trace-ID: <32hex>
```

**仅 chat/模型请求额外带**（billing 不带——官方 billing 抓包无这两个头）：

```
X-Agent-Purpose: person_agent     # 个人版；企业号 conversation
X-Private-Data: false
X-Conversation-ID: <UUID v4>      # 官方是带横线 UUID，不是 32hex
X-Conversation-Request-ID: <32hex>
X-Conversation-Message-ID: <32hex>
X-Root-Request-ID: <32hex>
```

**企业号额外**：`X-Enterprise-Id` + `X-Tenant-Id`（同值）。

## 2. Web 形态端点（`x-client-platform: web`）

官方由**渲染进程**（Electron 页面）发出，UA 是浏览器形态：

```
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
            (KHTML, like Gecko) WorkBuddy/5.8.3 Chrome/138.0.7204.251
            Electron/37.10.3 Safari/537.36
Accept: application/json, text/plain, */*
Accept-Language: zh-CN
Origin: https://www.workbuddy.cn
Referer: https://www.workbuddy.cn/profile/growth-center
x-client-platform: web
```

其余身份/归属/链路族与主进程一致。适用：领奖（`/activity/growth/tasks/<code>/claim`）、
账号资料（`/console/account`）、Web 行为上报（`/v2/report`）。

## 3. 登录态请求（auth/state、auth/token）

无身份，四个 `X-No-*` 显式声明：

```
X-No-Authorization: true
X-No-User-Id: true
X-No-Enterprise-Id: true
X-No-Department-Info: true
```

## 4. 官方**不发**的头（发出去就是指纹）

| 头 | 说明 |
|---|---|
| `X-Requested-With` | 浏览器 XHR 标记；Node fetch/axios 不产生 |
| `X-Machine-ID` / `X-Session-ID` | 5.8.3 客户端不存在这两个头（早期实现自造） |
| `Origin` / `Referer` | 仅渲染进程的 Web 形态端点带 |
| `Accept-Language` | 同上（Chromium 自动行为） |
| `X-B3-ParentSpanId` | 只有主进程 VLM 代理链路带，业务请求不带 |
| `X-Refresh-Token` | 只在 `/v2/plugin/auth/token/refresh` 上 |

## 5. 请求体里的品牌痕迹（同样是指纹）

| 位置 | 旧值 | 现值 | 原因 |
|---|---|---|---|
| `prompt_cache_key` | `wb2a-<uid8>-<hex>` | 32 位 hex | 旧值在**每个请求体**上盖"workbuddy2api + uid 前 8 位"戳，并泄露账号标识 |
| 会话/事件 ID | `wb2api-conv-<ns>` / `wb2api-night-<ns>` | UUID v4 / 32 hex | 事件落到上游行为库，品牌前缀等于自曝 |
| 小程序事件 requestId | `wb2api-<uuid>` | 32 hex | 同上 |

## 6. 变更历史

| 时间 | 变更 |
|---|---|
| 2026-10-23 | 首次建立本表。对齐 5.8.3：补 `X-Auth-Method`/`X-Userinfo`/`X-Agent-Intent`/`X-Agent-Type`/`X-Private-Data`/`Accept-Encoding`；修正 `X-Product`（WorkBuddy→SaaS）；移除 `X-Machine-ID`/`X-Session-ID`/`X-Requested-With`/公共层 Origin·Referer·Accept-Language；会话 ID 改 UUID；补 401 refresh 重放；cache key 去品牌化 |

## 7. 两条构造点（易误判点）

官方有**两条**代码路径都会打到 `/v2/chat/completions`，头族不同。把其中一条当成
"唯一构造点"是最常见的误判来源。

| 维度 | **文本会话**（cli/dist 的 ModelProvider）| **skills VLM 代理**（main/server.js）|
|---|---|---|
| 触发场景 | 桌面端 agent 对话（默认） | 视觉技能转发（本地路由 `/skills/vlm/chat`）|
| 构造函数 | `buildConversationHeaders` + `ProviderHttpHeaders` + 身份拦截器 | `buildVlmGatewayHeaders` + `applyGatewayHeaders` + `applyTraceHeaders` |
| `X-Agent-Type` | ✅ `cli` | ❌ |
| `X-Agent-Purpose` | `person_agent`（个人）/ `conversation`（企业） | 固定 `conversation` |
| `X-Private-Data` | `false`（模型优化默认开） | `true` |
| `X-Userinfo` / `X-Auth-Method` | ✅ | ❌ |
| `X-Root-Request-ID` | ✅ = Conversation-Request-ID | ❌ |
| `x-requested-with` | ❌ | ✅ `XMLHttpRequest` |
| `acp-connection-id` | ❌ | ✅ 每会话一个 UUID |
| `b3` | 三段（OTel 根 span） | 四段 + `X-B3-ParentSpanId` |
| `User-Agent` | `WorkBuddy/<v> WorkBuddy/<v> CLI/<cli>` | 同（写死 `WorkBuddy`） |

网关默认走**文本会话**形态（`upstream.chat_fingerprint` 缺省 = `cli`）；
`vlm` 仅供对照/排障（旧配置里的 `desktop` 是它的别名）。

判定依据不是猜的：报告 §4.1 的真实请求样（`X-Agent-Type: cli` /
`X-Agent-Purpose: person_agent` / `X-Private-Data: false` / 三段 b3）与
`buildConversationHeaders` 的输出逐条吻合；`applyGatewayHeaders` 只在
`VlmUpstream.send` 里被调用一次（全 asar 仅 2 处出现：定义 + 该调用）。


## 8. 头族分层（实现模型，2026-10-24 收敛）

出站请求按**发出者**分三档，各档只带该发出者真会发的头。混层就会产生
"官方从不在该端点发送的头"这类指纹。

| 档位 | 适用端点 | 头族 |
|---|---|---|
| **主进程基线**（`CommonHeaders`） | 签到 / 余额 / 成长 / 上报 / 模型目录 / 企业额度 | `Accept`、`Content-Type`(有 body)、`User-Agent`、`X-Product: SaaS`、`X-User-Id`、`X-Enterprise-Id`/`X-Tenant-Id`、`X-Domain`、`Authorization`、`X-Request-ID`、`traceparent`/`b3`/`X-B3-*`/`X-Trace-ID` |
| **CLI 文本会话**（`ChatHeaders` / `SearchHeaders` / `RefreshHeaders`） | `/v2/chat/completions`、`/agenttool/v1/search`、`/v2/plugin/auth/token/refresh` | 基线 + `Accept-Encoding: identity` + `X-Auth-Method` + `X-Userinfo` + `X-IDE-*` + `X-Agent-Intent/Type/Purpose` + `X-Private-Data` + `X-CodeBuddy-Request` + 会话族（`X-Conversation-*`/`X-Root-Request-ID`） |
| **渲染进程 Web**（`WebHeaders`） | 领奖 / 账号资料 / Web 行为上报（`x-client-platform: web`） | 基线 + CLI 身份两头 + 浏览器 UA + `Origin`/`Referer` + `Accept-Language` + `x-client-platform: web` |

证据：`main/*.js`（account.js 等）里 `X-Userinfo` / `X-Auth-Method` / `X-Agent-Type` /
`X-IDE-Type` **各出现 0 次**；`cli/dist/codebuddy-lite-wb.mjs` 里前三者是
`runIdentityHeaders()` + `buildConversationHeaders()` 的固定产物；
报告 §1.3 的签到抓样与 §4.1 的 chat 抓样分别是这两档的实证。

### X-Device-Token 是签到专属

`main/account.js` 的 `CloudAccountRepo.postCheckin()` 调 `getCheckinRequestHeaders()`
取 TuringShield token；余额/成长/上报/模型请求都**不**带它。故网关只在
`DailyCheckin` 注入（`billingJSONOpt` 的请求头钩子），其余路径一律不发。

