# WorkBuddy 国服 / 国际服客户端逆向对比

对已安装的 **国服 WorkBuddy** 与 **国际服 WorkBuddy AI** 做静态逆向，回答一个问题：

> 两个客户端在请求头格式、设备指纹生成、伪装链路上，是同一套东西吗？

结论：**代码同源，格式相同；差异集中在产品配置和 CLI 版本。** 详见 [reports/REPORT.md](reports/REPORT.md) 与 [docs/FINGERPRINT.md](docs/FINGERPRINT.md)。

## 目标

| | 国服 | 国际服 |
| --- | --- | --- |
| App | `/Applications/WorkBuddy.app` | `/Applications/WorkBuddy AI.app` |
| Bundle | `com.tencent.workbuddy.mac` | `com.workbuddy.workbuddy-ai` |
| 桌面版本 | 5.9.2 | 5.8.4 |
| CLI | `@genie/agent-cli` 2.165.0 | `@codebuddy-code` 2.161.0 |
| Endpoint | `https://www.workbuddy.cn` | `https://www.workbuddy.ai` |

## 快速开始

```bash
cd workbuddy-fingerprint-lab
node scripts/run.mjs        # 解包 + 扫描 + 生成报告
node scripts/run.mjs --force
node scripts/sample.mjs     # 直接打印两侧重建后的 header 样例
node --test                 # 格式单测
```

默认读 macOS 的 `/Applications`；换路径：

```bash
node scripts/run.mjs \
  --cn-app "/path/to/WorkBuddy.app" \
  --global-app "/path/to/WorkBuddy AI.app"
```

## 产物

| 路径 | 内容 |
| --- | --- |
| `.work/<realm>/asar/` | 从 `app.asar` 解出的 JS/JSON（可重建，已 gitignore） |
| `out/inventory.json` | 两侧 header 常量、构造器哈希、配置、设备文件指纹 |
| `out/report.json` | 报告用的精简对比数据 |
| `reports/REPORT.md` | 人读报告（提交进仓库） |

## 它到底扫了什么

1. **asar 解包**：纯 Node 读取 asar header，只解 `.js/.mjs/.cjs/.json`，不执行客户端代码。
2. **header 常量**：扫描 `main/`、`preload/`、`cli/dist/`，抓 `X-*` 字符串和 `NAME="X-..."` 赋值。
3. **关键构造器**：按 marker 定位并做花括号配对，提取真实函数体：
   - `UserAgentHttpInterceptor.buildUserAgent`
   - `runIdentityHeaders`（X-Userinfo / X-User-Id / X-Enterprise-Id / X-Auth-Method / X-Id-Source）
   - `WorkbuddyAuthStateHeaderProvider.provide`（X-Device-Token / X-Custom-Channel-Id / X-Device-Id-List）
   - `machineIdSync` / `osxUuid` / `winUuid` / `linuxUuid`
   - QIMEI `resolveAppKey` / `defaultHelperRunner`
   - `applyWorkbuddyAppServerSecurityHeader` / `buildSessionReplayRequestHeaders`
   - Turing `getDeviceTokenForRequest`
4. **同构判定**：对函数体做三种签名——
   - `hash`：去空白后的 SHA-256（逐字节）
   - `shapeHash`：字符串/数字/标识符归一后的结构签名
   - `literalsHash`：字符串字面量集合（模板插值归一为 `${}`）
   逐字节相同 → 同构 → 字面量相同 → 不同。
5. **配置**：读 `cli/product.json`、`cli/package.json`、本地 `acc-product-config-v3*.json`，只取产品名/endpoint/`qimei36AppKey`/`turingSdk.channelId` 等字段。
6. **本机指纹文件**：`device-id`、`device-id.machine`、`qimei-cache.json` 只记录是否存在、长度、SHA-256，不把原值写进报告。
7. **运行时日志**：读 `logs/main.log` 里的 `CloudProductManager` 请求头日志，核对静态重建的 UA 是否与实际一致。

## 关键发现

- **请求头格式同源**：UA 合并、`X-Userinfo` 的 base64 JSON、身份头条件写入、设备头注入顺序，两侧逐字节相同或仅压缩变量名不同。
- **设备指纹的代码同源**：machine-id 都是 OS UUID（macOS `IOPlatformUUID` / Windows `MachineGuid` / Linux `dbus machine-id`）；QIMEI SDK 都是 `@tencent/qimei-node@1.2.2`；Turing device token 的 provider 相同。
- **运行时指纹不同**：
  - 国服产品配置带 `qimei36AppKey`，会生成 QIMEI36，从而发 `X-Device-Id-List`；
  - 国际服缓存配置没有该键，QIMEI helper 返回 `appKey missing`，通常不发 `X-Device-Id-List`；
  - Turing `channelId` 国服 109144、国际服 400111。
- **版本漂移**：国服 CLI 2.165.0 有 `X-Agent-Runtime` 常量，国际服 2.161.0 没有；`X-Wb-Uid` 也只在国服出现。
- **运行时 UA 证据**：国服日志出现 `WorkBuddy/5.9.2 WorkBuddy/5.9.2 CLI/2.165.0`，国际服出现 `workbuddy-ai/5.8.4 workbuddy-ai/5.8.4 CLI/2.161.0`；早期请求会缺少产品段，只有 `WorkBuddy/5.x.x CLI/...`。

## 代码地图

```
workbuddy-fingerprint-lab/
├── data/
│   ├── targets.json          # 两侧 app 路径 / bundle / 配置目录
│   └── header-contract.json  # 伪装相关 header 契约（名称、分组、语义）
├── scripts/
│   ├── lib/asar.mjs          # asar 读取 / 解包
│   ├── lib/util.mjs          # 花括号配对、结构签名、字面量提取
│   ├── extract.mjs           # 解包到 .work/
│   ├── scan.mjs              # 扫描 + 生成 out/inventory.json
│   ├── report.mjs            # 生成 reports/REPORT.md
│   ├── sample.mjs            # 打印两侧重建后的 header 样例
│   └── run.mjs               # scan + report
├── src/fingerprint.mjs       # 按真实算法重建 header / 指纹格式
└── tests/fingerprint.test.mjs
```

## 边界

- 只做静态分析：不启动客户端、不发起网络请求、不注入进程。
- 只读本地配置缓存；本机标识只输出哈希，不输出原值。
- 报告里的版本、endpoint、channelId 来自当前安装包与本地缓存；换版本后重跑即可。
