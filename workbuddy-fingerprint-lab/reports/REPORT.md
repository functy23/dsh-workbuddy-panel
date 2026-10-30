# WorkBuddy 国服 / 国际服请求头与设备指纹对比

> 自动生成，勿手改。生成时间：2026-10-29T18:09:08.001Z

## 目标

| 维度 | 国服 | 国际服 |
| --- | --- | --- |
| 应用 | 国服 WorkBuddy | 国际服 WorkBuddy AI |
| Bundle | com.tencent.workbuddy.mac | com.workbuddy.workbuddy-ai |
| 桌面版本 | 5.9.2 | 5.8.4 |
| CLI 版本 | 2.165.0 | 2.161.0 |
| 产品名 | WorkBuddy | WorkBuddy AI |
| Endpoint | https://www.workbuddy.cn | https://www.workbuddy.ai |
| isOversea | false | true |

## 结论

- 请求头常量：核心契约 29 项中，两侧都存在 27 项，仅国服 2 项，仅国际服 0 项，缺失 0 项。
- 关键构造器：20 个中 17 个两侧逐字节相同或同构，3 个仅国服，0 个不同。
- 伪装格式层面：国服与国际服使用同一套核心 header 常量（除版本漂移的 `X-Agent-Runtime` / `X-Wb-Uid`）、同一套 UA 合并算法、同一套 `X-Userinfo` 编码、同一套设备头注入顺序；差异主要来自产品配置与 CLI 版本，而不是产品分支逻辑。
- 设备指纹层面：machine-id 取 OS UUID 的逻辑相同；QIMEI36 的 SDK 与 helper 相同，但国服产品配置带 `qimei36AppKey`，国际服缓存配置没有该键，因此国际服通常不会发出 `X-Device-Id-List`；Turing 设备令牌的 `channelId` 国服为 109144、国际服为 400111。
- 运行时日志进一步确认：国服 QIMEI 成功 15 次（cache hit 14），国际服 0 次成功、`appKey missing` 9 次。
- 版本漂移：国服 CLI 2.165.0 比国际服 2.161.0 多出 `X-Agent-Runtime` 常量、`X-Wb-Uid` 头，以及 `resolveAgentRuntime` / `resolveRequestScene` / `applyPrivateDataHeaderPolicy` 三个构造器。这些属于客户端版本差异，不是产品开关。

## 核心请求头矩阵

| Header | 组 | 国服 | 国际服 | 语义 |
| --- | --- | --- | --- | --- |
| `User-Agent` | ua | ✓ | ✓ | platform/version + product/version + 原始 UA + CLI/version，由 UserAgentHttpInterceptor 合并 |
| `X-User-Id` | identity | ✓ | ✓ | 账号 uid；runIdentityHeaders 条件写入 |
| `X-Enterprise-Id` | identity | ✓ | ✓ | 企业 id；有值才写 |
| `X-Auth-Method` | identity | ✓ | ✓ | 认证方式；有值才写 |
| `X-Id-Source` | identity | ✓ | ✓ | 身份来源；有值才写 |
| `X-Userinfo` | identity | ✓ | ✓ | base64(JSON{uin,owner_uin,id_source,token_source})；仅在 uid 且至少一个附加字段时写 |
| `X-Department-Info` | identity | ✓ | ✓ | 部门全名；有值才写 |
| `X-Tenant-Id` | identity | ✓ | ✓ | 租户 id |
| `X-Domain` | identity | ✓ | ✓ | 域名/租户域 |
| `X-Device-Token` | device | ✓ | ✓ | Turing SDK 设备令牌；WorkbuddyAuthStateHeaderProvider 注入 |
| `X-Custom-Channel-Id` | device | ✓ | ✓ | 固定值 unknown（代码常量 fe） |
| `X-Device-Id-List` | device | ✓ | ✓ | JSON {"qimei36":"..."}；qimei36 不可用时省略 |
| `X-Machine-Id` | device | ✓ | ✓ | CLIENT_INFO_MACHINE_ID / OS 机器 UUID |
| `X-Device-Id` | device | ✓ | ✓ | CLI 侧设备 id |
| `X-Agent-Type` | agent | ✓ | ✓ | main/team/subagent/compaction/auxiliary |
| `X-Agent-Runtime` | agent | ✓ | — | local-agent/cloud-agent/agent-agent，未知回落 other |
| `X-Agent-Purpose` | agent | ✓ | ✓ | conversation；个人 agent 角色分支为 person_agent |
| `X-Agent-Intent` | agent | ✓ | ✓ | 请求场景，baggage x-agent-intent，回落 craft |
| `X-Product` | product | ✓ | ✓ | 部署类型（deploymentType） |
| `X-Product-Version` | product | ✓ | ✓ | 产品版本 |
| `X-Product-Code` | product | ✓ | ✓ | 固定 workbuddy |
| `X-IDE-Type` | product | ✓ | ✓ | IDE 类型，桌面端为 WorkBuddy |
| `X-IDE-Name` | product | ✓ | ✓ | IDE 名称，桌面端为 WorkBuddy |
| `X-IDE-Version` | product | ✓ | ✓ | IDE 版本 |
| `X-Client-Version` | product | ✓ | ✓ | 客户端版本（skill 推荐等接口） |
| `X-Model-ID` | product | ✓ | ✓ | 模型 id |
| `X-Private-Data` | product | ✓ | ✓ | 个人账号且非企业/跳过场景时写 true |
| `X-CodeBuddy-Request` | appserver | ✓ | ✓ | 内部 app-server 安全标记，固定 1 |
| `X-Wb-Uid` | misc | ✓ | — | WorkBuddy uid 冗余头 |

## 历史讨论头核对

| Header | 国服 | 国际服 | 说明 |
| --- | --- | --- | --- |
| `X-Client-Platform` | — | — | 5.9.2 / 5.8.4 的 main 与 CLI 中未发现同名头；客户端版本走 X-Client-Version |
| `X-Shadow` | — | — | 未发现同名请求头；源码命中均为 CSS box-shadow |
| `X-Client-Version` | ✓ | ✓ | 存在，但只用于 skill 推荐等少数接口 |

## 请求头真实格式样例

按重建的构造器生成，占位符替代真实账号/设备值；用于直接对比字段名与拼接顺序。

| Header | 国服样例 | 国际服样例 |
| --- | --- | --- |
| `User-Agent` | `WorkBuddy/5.9.2 WorkBuddy/5.9.2 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36 CLI/2.165.0` | `workbuddy-ai/5.8.4 workbuddy-ai/5.8.4 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36 CLI/2.161.0` |
| `X-Userinfo` | `eyJ1aW4iOiJVSURfUExBQ0VIT0xERVIiLCJvd25lcl91aW4iOiJFTlRfUExBQ0VIT0xERVIiLCJpZF9zb3VyY2UiOiJpZHAiLCJ0b2tlbl9zb3VyY2UiOiJvYXV0aCJ9` | `eyJ1aW4iOiJVSURfUExBQ0VIT0xERVIiLCJvd25lcl91aW4iOiJFTlRfUExBQ0VIT0xERVIiLCJpZF9zb3VyY2UiOiJpZHAiLCJ0b2tlbl9zb3VyY2UiOiJvYXV0aCJ9` |
| `X-Device-Token` | `DEVICE_TOKEN_PLACEHOLDER` | `DEVICE_TOKEN_PLACEHOLDER` |
| `X-Custom-Channel-Id` | `unknown` | `unknown` |
| `X-Device-Id-List` | `{"qimei36":"QIMEI36_PLACEHOLDER"}` | `（不发）` |
| `X-Agent-Type` | `main` | `main` |
| `X-Agent-Runtime` | `local-agent` | `（不发）` |
| `X-Agent-Purpose` | `conversation` | `conversation` |
| `X-Product` | `SaaS` | `SaaS` |
| `X-IDE-Type` | `WorkBuddy` | `WorkBuddy` |
| `X-IDE-Version` | `5.9.2` | `5.8.4` |
| `X-CodeBuddy-Request` | `1` | `1` |

> `X-Userinfo` 解码后：`{"uin":"UID_PLACEHOLDER","owner_uin":"ENT_PLACEHOLDER","id_source":"idp","token_source":"oauth"}`
> 国服 `applicationName` 与 `productName` 都是 `WorkBuddy`，所以 UA 前缀会出现两次；国际服 `applicationName` 是 `workbuddy-ai`，运行时日志确认 UA 前缀是 `workbuddy-ai/5.8.4`。

## 运行时日志证据

来自 `~/.workbuddy/logs/main.log` / `~/.workbuddy-ai/logs/main.log` 的 CloudProductManager 请求头日志（含升级前旧版本记录）：

| 客户端 | 观测到的 User-Agent | 次数 |
| --- | --- | --- |
| 国服 WorkBuddy | `WorkBuddy/5.8.3 WorkBuddy/5.8.3 CLI/2.161.0` | 17 |
| 国服 WorkBuddy | `WorkBuddy/5.8.3 CLI/2.161.0` | 10 |
| 国服 WorkBuddy | `WorkBuddy/5.9.2 WorkBuddy/5.9.2 CLI/2.165.0` | 6 |
| 国服 WorkBuddy | `WorkBuddy/5.9.2 CLI/2.165.0` | 3 |
| 国际服 WorkBuddy AI | `workbuddy-ai/5.8.4 workbuddy-ai/5.8.4 CLI/2.161.0` | 30 |
| 国际服 WorkBuddy AI | `WorkBuddy/5.8.4 CLI/2.161.0` | 4 |

> 同一客户端会因启动阶段不同出现“带产品段 / 不带产品段”两种 UA；早期请求可能只有 platform 段 + CLI 扩展。

## 关键构造器

| 构造器 | 国服证据 | 国际服证据 | 判定 |
| --- | --- | --- | --- |
| `ua.buildUserAgent` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@8882003` (b2397bdf1f) | `unpacked:cli/dist/codebuddy-lite-wb.mjs@8610978` (b2397bdf1f) | 逐字节相同 |
| `ua.sanitizeSegment` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@8881213` (501df07088) | `unpacked:cli/dist/codebuddy-lite-wb.mjs@8610188` (501df07088) | 逐字节相同 |
| `ua.asciiProductSegment` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@8881315` (4b6f0b3048) | `unpacked:cli/dist/codebuddy-lite-wb.mjs@8610290` (4b6f0b3048) | 逐字节相同 |
| `identity.runIdentityHeaders` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@1584827` (14355ba0df) | `unpacked:cli/dist/codebuddy-lite-wb.mjs@1301185` (14355ba0df) | 逐字节相同 |
| `agent.resolveModelCallAgentType` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@7331438` (0b3c57ee60) | `unpacked:cli/dist/codebuddy-lite-wb.mjs@7205525` (0b3c57ee60) | 逐字节相同 |
| `agent.resolveAgentRuntime` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@6986577` (7815793fde) | — | 仅国服 |
| `agent.resolveRequestScene` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@6987234` (7bea436e03) | — | 仅国服 |
| `privacy.applyPrivateDataHeaderPolicy` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@3802072` (cec7f4b9f4) | — | 仅国服 |
| `authState.provide` | `asar:main/module.app-server.js@1810` (b78bc48125) | `asar:main/module.app-server.js@1146` (620e6d529f) | 同构（仅压缩变量名不同） |
| `clientInfo.getCachedBaseEnv` | `asar:main/client-info-env.js@59264` (ba0ad3f58a) | `asar:main/sidecar-manager.js@60653` (5ceddecca2) | 同构（仅压缩变量名不同） |
| `clientInfo.buildEnv` | `asar:main/client-info-env.js@58928` (44136fa355) | `asar:main/sidecar-manager.js@60317` (44136fa355) | 逐字节相同 |
| `machine.machineIdSync` | `unpacked:cli/dist/codebuddy-lite-wb.mjs@3460556` (f2dd6ae779) | `unpacked:cli/dist/codebuddy-lite-wb.mjs@3439725` (b53a2e4e88) | 同构（仅压缩变量名不同） |
| `machine.osxUuid` | `asar:main/client-info-env.js@58067` (b173dded3a) | `asar:main/sidecar-manager.js@59450` (56412bf2c6) | 同构（仅压缩变量名不同） |
| `machine.winUuid` | `asar:main/client-info-env.js@58315` (e5d4e13a8f) | `asar:main/sidecar-manager.js@59698` (055b75fe57) | 同构（仅压缩变量名不同） |
| `machine.linuxUuid` | `asar:main/client-info-env.js@57757` (d621599506) | `asar:main/sidecar-manager.js@59140` (dfd8706a72) | 同构（仅压缩变量名不同） |
| `qimei.resolveAppKey` | `asar:main/qimei-detector.js@2488` (7e15c6fb26) | `asar:main/netdrive-env-route.js@5638` (1b433194c2) | 同构（仅压缩变量名不同） |
| `qimei.helperRunner` | `asar:main/qimei-detector.js@1354` (79813e1334) | `asar:main/netdrive-env-route.js@4499` (03678ddd81) | 同构（仅压缩变量名不同） |
| `appServer.securityHeader` | `asar:main/server.js@2902405` (44136fa355) | `asar:main/server.js@2817949` (44136fa355) | 逐字节相同 |
| `appServer.replayHeaders` | `asar:main/server.js@3209150` (3cc23b26fc) | `asar:main/server.js@3119312` (9c953f6d62) | 同构（仅压缩变量名不同） |
| `turing.deviceTokenForRequest` | `asar:main/turing-sdk.js@3308` (fe613382cb) | `asar:main/main-bootstrap.js@423325` (fe613382cb) | 逐字节相同 |

## 设备指纹链路

| 组件 | 国服 | 国际服 | 判定 |
| --- | --- | --- | --- |
| machine-id 来源 | unpacked:cli/dist/codebuddy-lite-wb.mjs | unpacked:cli/dist/codebuddy-lite-wb.mjs | 同构（仅压缩变量名不同） |
| 本机 device-id 文件 | 存在 | 存在 | 相同 |
| QIMEI SDK | @tencent/qimei-node@1.2.2 | @tencent/qimei-node@1.2.2 | 相同 |
| QIMEI appKey | {"darwin":"0MAC070JLSCWV1CM","win32":"0WIN070JLSH64IEE"} | — | 仅国服 |
| QIMEI 本机缓存 | 有 qimei36 | 无 | 不同 |
| QIMEI 运行时 | success 15 / cache hit 14 / miss 1 | success 0 / cache hit 0 / appKey missing 9 | 国服成功、国际服无 appKey |
| Turing channelId | 109144 | 400111 | 不同 |
| X-Device-Token 注入点 | 有 | 有 | 两侧同一 provider |
| X-Device-Id-List 发送条件 | 有 appKey，qimei36 可用时发送 | 无 appKey，不发送 | 常量两侧都有，运行时取决于 qimei36 |

## 配置差异

| 配置 | 国服 | 国际服 |
| --- | --- | --- |
| productName | WorkBuddy | WorkBuddy AI |
| endpoint | https://www.workbuddy.cn | https://www.workbuddy.ai |
| isOversea | false | true |
| qimei36AppKey | {"darwin":"0MAC070JLSCWV1CM","win32":"0WIN070JLSH64IEE"} | — |
| turingSdk | {"channelId":109144} | {"channelId":400111} |
| customUserDataDir | — | .workbuddy-ai |
| skillSecurityAppKey | 有 | 有 |
| 产品 endpoint | https://www.workbuddy.cn | https://www.workbuddy.ai |

## 其余核心/非核心 header

契约之外扫描到的 header（已排除 AWS/Stainless/B3 等 SDK 噪声）：

`X-High`、`X-AICC-Mode`、`X-AICC-Endpoint`、`X-API-Key`、`X-WorkBuddy-MCP-Context`、`X-User-Ticket`、`X-Sandbox-Type`、`X-Single-Sandbox-Cluster`、`X-WorkBuddy-User-POI`、`X-Device-Token-Error`、`X-Access-Token`、`X-ID`、`X-Aicc-Endpoint`

## 证据索引

### 国服 WorkBuddy

- app: `/Applications/WorkBuddy.app`
- asar: `/Applications/WorkBuddy.app/Contents/Resources/app.asar` (181957326 bytes)
- unpacked: `/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked`
- CLI bundle: `cli/dist/codebuddy-lite-wb.mjs`
- QIMEI: `{"name":"@tencent/qimei-node","version":"1.2.2"}`
- 扫描文件数: 410

### 国际服 WorkBuddy AI

- app: `/Applications/WorkBuddy AI.app`
- asar: `/Applications/WorkBuddy AI.app/Contents/Resources/app.asar` (96355508 bytes)
- unpacked: `/Applications/WorkBuddy AI.app/Contents/Resources/app.asar.unpacked`
- CLI bundle: `cli/dist/codebuddy-lite-wb.mjs`
- QIMEI: `{"name":"@tencent/qimei-node","version":"1.2.2"}`
- 扫描文件数: 252

## 复现

```bash
cd workbuddy-fingerprint-lab
node scripts/run.mjs        # 解包 + 扫描 + 生成报告
node scripts/run.mjs --force
node --test                 # 格式单测
```

只做静态分析：读取已安装 app.asar / app.asar.unpacked / 本地产品配置缓存，不发起网络请求，不执行客户端代码。
