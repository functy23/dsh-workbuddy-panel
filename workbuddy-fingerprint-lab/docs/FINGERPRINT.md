# 请求头与设备指纹链路

本文只记录**格式与调用链**，不含任何真实 token、cookie、账号或设备原值。

## 1. 一次模型请求的头是从哪来的

客户端 CLI bundle 里至少有四层注入，按请求生命周期大致是：

1. **UA 合并**：`UserAgentHttpInterceptor.initialize()` 拦截每个请求，调用 `buildUserAgent()`。
2. **身份头**：`runIdentityHeaders()` 从当前 run 的 `auth` / `account` 生成 `X-User-Id`、`X-Enterprise-Id`、`X-Auth-Method`、`X-Id-Source`、`X-Userinfo`。
3. **设备头**：`WorkbuddyAuthStateHeaderProvider.provide()` 生成 `X-Device-Token`、`X-Custom-Channel-Id`、`X-Device-Id-List`。
4. **模型调用头**：`X-Agent-*`、`X-Product*`、`X-IDE-*`、`X-Trace-ID`、`X-Request-ID`、`X-Conversation-*` 等由模型调用层组装。

## 2. UA 合并算法

源码位置：CLI bundle 的 `UserAgentHttpInterceptor.buildUserAgent`。

```js
async buildUserAgent(base = "") {
  const parts = base ? [base] : [];
  const info = await clientInfoProvider.get() || {};
  const product = info.applicationName || info.productName;
  if (product) parts.unshift(product + "/" + (info.productVersion || "unknown"));
  if (info.platform) parts.unshift(info.platform + "/" + (info.platformVersion || "unknown"));
  if (info.userAgentExtension) parts.push(info.userAgentExtension);
  return parts.join(" ");
}
```

所以格式是：

```
<platform>/<platformVersion> <applicationName|productName>/<productVersion> <baseUA> <userAgentExtension>
```

国服 `applicationName` 与 `productName` 都是 `WorkBuddy`，于是出现两个 `WorkBuddy/5.9.2`；国际服 `applicationName` 是 `workbuddy-ai`，出现两个 `workbuddy-ai/5.8.4`。早期请求在 client info 就绪前只有 platform 段 + `CLI/<ver>`。

## 3. X-Userinfo

源码位置：CLI bundle 的 `runIdentityHeaders`。

```js
const payload = { uin: account.uid };
if (account.enterpriseId) payload.owner_uin = account.enterpriseId;
if (account.idSource) payload.id_source = account.idSource;
if (auth.method) payload.token_source = auth.method;
headers["X-Userinfo"] = Buffer.from(JSON.stringify(payload)).toString("base64");
```

触发条件：`uid` 存在，且 `enterpriseId` / `idSource` / `authMethod` 至少有一个。

## 4. 设备指纹

### 4.1 machine-id

`buildWorkbuddyClientInfoEnv()` 把 `CLIENT_INFO_MACHINE_ID` 注入 CLI 子进程；值来自 `machineIdSync()`：

| 平台 | 来源 |
| --- | --- |
| macOS | `ioreg -rd1 -c IOPlatformExpertDevice` 里的 `IOPlatformUUID` |
| Windows | 注册表 `HKLM\SOFTWARE\Microsoft\Cryptography` 的 `MachineGuid`，失败再试 `wmic csproduct get UUID` |
| Linux | `/var/lib/dbus/machine-id` |
| 兜底 | `crypto.randomUUID()` |

### 4.2 QIMEI36

`qimei-detector` 的逻辑：

1. 读缓存 `~/.workbuddy/qimei-cache.json`（国际服是 `~/.workbuddy-ai/`）。
2. 缓存没有时，spawn `qimei-helper.js`，把 `WORKBUDDY_QIMEI_APP_KEY` 传进去。
3. helper 加载 `@tencent/qimei-node`（mac/win 分支），调用 `getQimei36()`。
4. 结果写回缓存，并通过 IPC/环境变量推给 daemon。

appKey 来源：远程产品配置 `config.qimei36AppKey[platform]`。国服缓存里有 `darwin`/`win32` 两个 key；国际服缓存里没有这个字段，helper 返回 `appKey missing`。

### 4.3 Turing device token

`turing-sdk` 用产品配置里的 `config.turingSdk.channelId` 初始化，后台刷新 device token；`WorkbuddyAuthStateHeaderProvider` 通过 `authService.getTuringDeviceToken()` 取值，有值才写 `X-Device-Token`。

### 4.4 设备头组装

```js
const headers = { "X-Custom-Channel-Id": "unknown" };
if (deviceToken) headers["X-Device-Token"] = deviceToken;
if (qimei36) headers["X-Device-Id-List"] = JSON.stringify({ qimei36 });
```

注意 `X-Custom-Channel-Id` 固定是 `unknown`；`channelId` 只用于 Turing SDK，不写进这个头。

## 5. 国服 / 国际服差异

| 项 | 国服 | 国际服 |
| --- | --- | --- |
| 桌面版本 | 5.9.2 | 5.8.4 |
| CLI | 2.165.0 | 2.161.0 |
| applicationName | WorkBuddy | workbuddy-ai |
| endpoint | workbuddy.cn | workbuddy.ai |
| QIMEI appKey | 有 | 无 |
| QIMEI 运行时 | 成功 | `appKey missing` |
| X-Device-Id-List | 会发 | 通常不发 |
| Turing channelId | 109144 | 400111 |
| X-Agent-Runtime | 有 | 无（2.161.0 未引入） |
| X-Wb-Uid | 有 | 无 |

## 6. 怎么自己核对

```bash
node scripts/run.mjs
node scripts/sample.mjs
```

报告里的“运行时日志证据”直接引用 `logs/main.log` 的 `CloudProductManager` 请求头日志；静态构造器哈希在“关键构造器”表里。
