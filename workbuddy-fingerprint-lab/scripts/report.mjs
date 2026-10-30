import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, ensureDir } from "./lib/util.mjs";
import { buildWorkbuddyHeaders, PROFILES } from "../src/fingerprint.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const args = parseArgs(process.argv.slice(2));
const inventoryPath = path.join(projectRoot, "out", "inventory.json");
const contractPath = path.join(projectRoot, "data", "header-contract.json");
const reportsDir = path.join(projectRoot, "reports");

if (!fs.existsSync(inventoryPath)) {
  console.error("missing out/inventory.json; run node scripts/scan.mjs first");
  process.exit(1);
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const cn = inventory.realms.cn;
const gl = inventory.realms.global;

function cell(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function presence(realm, header) {
  if (!realm || realm.available === false) return { present: false, count: 0, sources: [] };
  if (header === "User-Agent") {
    const builder = realm.builders?.["ua.buildUserAgent"];
    return { present: Boolean(builder), count: builder ? 1 : 0, sources: builder ? [builder.file] : [] };
  }
  const direct = realm.headers?.[header];
  const constant = realm.constants?.[header];
  const sources = [];
  if (direct) for (const item of direct.sources) sources.push(item.file);
  if (constant) for (const item of constant) sources.push(item.file);
  const unique = [...new Set(sources)];
  return { present: Boolean(direct || constant), count: unique.length, sources: unique };
}

function builderVerdict(a, b) {
  if (!a && !b) return "missing";
  if (!a) return "only-global";
  if (!b) return "only-cn";
  if (a.hash === b.hash) return "identical";
  if (a.shapeHash === b.shapeHash && a.literalsHash === b.literalsHash) return "same-logic";
  if (a.literalsHash === b.literalsHash) return "same-literals";
  return "different";
}

const VERDICT_LABEL = {
  identical: "逐字节相同",
  "same-logic": "同构（仅压缩变量名不同）",
  "same-literals": "字面量相同、结构不同",
  different: "不同",
  "only-cn": "仅国服",
  "only-global": "仅国际服",
  missing: "两侧都未找到",
};

const headers = contract.headers;
const core = headers.filter((item) => item.core);
const extras = [];
for (const name of new Set([...Object.keys(cn.headers || {}), ...Object.keys(gl.headers || {})])) {
  if (headers.some((item) => item.name.toLowerCase() === name.toLowerCase())) continue;
  if (cn.headers?.[name]?.noise && gl.headers?.[name]?.noise) continue;
  extras.push(name);
}

const builderIds = [
  "ua.buildUserAgent",
  "ua.sanitizeSegment",
  "ua.asciiProductSegment",
  "identity.runIdentityHeaders",
  "agent.resolveModelCallAgentType",
  "agent.resolveAgentRuntime",
  "agent.resolveRequestScene",
  "privacy.applyPrivateDataHeaderPolicy",
  "authState.provide",
  "clientInfo.getCachedBaseEnv",
  "clientInfo.buildEnv",
  "machine.machineIdSync",
  "machine.osxUuid",
  "machine.winUuid",
  "machine.linuxUuid",
  "qimei.resolveAppKey",
  "qimei.helperRunner",
  "appServer.securityHeader",
  "appServer.replayHeaders",
  "turing.deviceTokenForRequest",
];

function builderRow(id) {
  const a = cn.builders?.[id];
  const b = gl.builders?.[id];
  return { id, a, b, verdict: builderVerdict(a, b) };
}

const builderRows = builderIds.map(builderRow);
const sameBuilders = builderRows.filter((row) => row.verdict === "identical" || row.verdict === "same-logic").length;
const diffBuilders = builderRows.filter((row) => row.verdict === "different").length;
const onlyCnBuilders = builderRows.filter((row) => row.verdict === "only-cn").length;

function headerCounts() {
  let both = 0;
  let cnOnly = 0;
  let glOnly = 0;
  let missing = 0;
  for (const item of core) {
    const a = presence(cn, item.name).present;
    const b = presence(gl, item.name).present;
    if (a && b) both += 1;
    else if (a) cnOnly += 1;
    else if (b) glOnly += 1;
    else missing += 1;
  }
  return { both, cnOnly, glOnly, missing };
}
const counts = headerCounts();

function qimeiKey(realm) {
  const value = realm.runtime?.qimei36AppKey;
  if (!value) return null;
  if (typeof value === "string") return value;
  return value;
}

function deviceFileEqual(name) {
  const a = cn.deviceFiles?.[name];
  const b = gl.deviceFiles?.[name];
  if (!a?.present || !b?.present) return "一侧缺失";
  return a.sha256 === b.sha256 ? "相同" : "不同";
}

const lines = [];
lines.push("# WorkBuddy 国服 / 国际服请求头与设备指纹对比", "");
lines.push("> 自动生成，勿手改。生成时间：" + inventory.generatedAt, "");
lines.push("## 目标", "");
lines.push("| 维度 | 国服 | 国际服 |");
lines.push("| --- | --- | --- |");
lines.push("| 应用 | " + cell(cn.label) + " | " + cell(gl.label) + " |");
lines.push("| Bundle | " + cell(cn.info?.bundleId) + " | " + cell(gl.info?.bundleId) + " |");
lines.push("| 桌面版本 | " + cell(cn.info?.version) + " | " + cell(gl.info?.version) + " |");
lines.push("| CLI 版本 | " + cell(cn.product?.cliVersion) + " | " + cell(gl.product?.cliVersion) + " |");
lines.push("| 产品名 | " + cell(cn.product?.productName) + " | " + cell(gl.product?.productName) + " |");
lines.push("| Endpoint | " + cell(cn.product?.endpoint) + " | " + cell(gl.product?.endpoint) + " |");
lines.push("| isOversea | " + cell(cn.product?.isOversea ?? false) + " | " + cell(gl.product?.isOversea ?? false) + " |");
lines.push("");
lines.push("## 结论", "");
lines.push("- 请求头常量：核心契约 " + core.length + " 项中，两侧都存在 " + counts.both + " 项，仅国服 " + counts.cnOnly + " 项，仅国际服 " + counts.glOnly + " 项，缺失 " + counts.missing + " 项。");
lines.push("- 关键构造器：" + builderRows.length + " 个中 " + sameBuilders + " 个两侧逐字节相同或同构，" + onlyCnBuilders + " 个仅国服，" + diffBuilders + " 个不同。");
lines.push("- 伪装格式层面：国服与国际服使用同一套核心 header 常量（除版本漂移的 `X-Agent-Runtime` / `X-Wb-Uid`）、同一套 UA 合并算法、同一套 `X-Userinfo` 编码、同一套设备头注入顺序；差异主要来自产品配置与 CLI 版本，而不是产品分支逻辑。");
lines.push("- 设备指纹层面：machine-id 取 OS UUID 的逻辑相同；QIMEI36 的 SDK 与 helper 相同，但国服产品配置带 `qimei36AppKey`，国际服缓存配置没有该键，因此国际服通常不会发出 `X-Device-Id-List`；Turing 设备令牌的 `channelId` 国服为 109144、国际服为 400111。");
lines.push("- 运行时日志进一步确认：国服 QIMEI 成功 " + (cn.runtimeLogs?.qimei?.success ?? 0) + " 次（cache hit " + (cn.runtimeLogs?.qimei?.cacheHit ?? 0) + "），国际服 0 次成功、`appKey missing` " + (gl.runtimeLogs?.qimei?.appKeyMissing ?? 0) + " 次。");
lines.push("- 版本漂移：国服 CLI 2.165.0 比国际服 2.161.0 多出 `X-Agent-Runtime` 常量、`X-Wb-Uid` 头，以及 `resolveAgentRuntime` / `resolveRequestScene` / `applyPrivateDataHeaderPolicy` 三个构造器。这些属于客户端版本差异，不是产品开关。");
lines.push("");
lines.push("## 核心请求头矩阵", "");
lines.push("| Header | 组 | 国服 | 国际服 | 语义 |");
lines.push("| --- | --- | --- | --- | --- |");
for (const item of core) {
  const a = presence(cn, item.name);
  const b = presence(gl, item.name);
  lines.push("| `" + item.name + "` | " + item.group + " | " + (a.present ? "✓" : "—") + " | " + (b.present ? "✓" : "—") + " | " + cell(item.semantics) + " |");
}
lines.push("");
lines.push("## 历史讨论头核对", "");
lines.push("| Header | 国服 | 国际服 | 说明 |");
lines.push("| --- | --- | --- | --- |");
for (const [name, note] of [
  ["X-Client-Platform", "5.9.2 / 5.8.4 的 main 与 CLI 中未发现同名头；客户端版本走 X-Client-Version"],
  ["X-Shadow", "未发现同名请求头；源码命中均为 CSS box-shadow"],
  ["X-Client-Version", "存在，但只用于 skill 推荐等少数接口"],
]) {
  const a = presence(cn, name);
  const b = presence(gl, name);
  lines.push("| `" + name + "` | " + (a.present ? "✓" : "—") + " | " + (b.present ? "✓" : "—") + " | " + cell(note) + " |");
}
lines.push("");
lines.push("## 请求头真实格式样例", "");
lines.push("按重建的构造器生成，占位符替代真实账号/设备值；用于直接对比字段名与拼接顺序。", "");
function sampleHeaders(profile, withQimei) {
  return buildWorkbuddyHeaders({
    ...profile,
    uid: "UID_PLACEHOLDER",
    enterpriseId: "ENT_PLACEHOLDER",
    idSource: "idp",
    authMethod: "oauth",
    deviceToken: "DEVICE_TOKEN_PLACEHOLDER",
    qimei36: withQimei ? "QIMEI36_PLACEHOLDER" : undefined,
    agentType: "main",
    agentRuntime: "local-agent",
    agentPurpose: "conversation",
    agentIntent: "craft",
    traceId: "TRACE_ID",
    requestId: "REQUEST_ID",
    conversationId: "CONVERSATION_ID",
    codeBuddyRequest: true,
  });
}
const cnSample = sampleHeaders(PROFILES.cn, true);
const glSample = sampleHeaders(PROFILES.global, false);
delete glSample["X-Agent-Runtime"];
delete glSample["X-Wb-Uid"];
const sampleKeys = ["User-Agent", "X-Userinfo", "X-Device-Token", "X-Custom-Channel-Id", "X-Device-Id-List", "X-Agent-Type", "X-Agent-Runtime", "X-Agent-Purpose", "X-Product", "X-IDE-Type", "X-IDE-Version", "X-CodeBuddy-Request"];
lines.push("| Header | 国服样例 | 国际服样例 |");
lines.push("| --- | --- | --- |");
for (const key of sampleKeys) {
  lines.push("| `" + key + "` | `" + cell(cnSample[key] ?? "（不发）") + "` | `" + cell(glSample[key] ?? "（不发）") + "` |");
}
lines.push("");
lines.push("> `X-Userinfo` 解码后：`" + Buffer.from(cnSample["X-Userinfo"], "base64").toString("utf8") + "`");
lines.push("> 国服 `applicationName` 与 `productName` 都是 `WorkBuddy`，所以 UA 前缀会出现两次；国际服 `applicationName` 是 `workbuddy-ai`，运行时日志确认 UA 前缀是 `workbuddy-ai/5.8.4`。");
lines.push("");
lines.push("## 运行时日志证据", "");
lines.push("来自 `~/.workbuddy/logs/main.log` / `~/.workbuddy-ai/logs/main.log` 的 CloudProductManager 请求头日志（含升级前旧版本记录）：", "");
lines.push("| 客户端 | 观测到的 User-Agent | 次数 |");
lines.push("| --- | --- | --- |");
for (const realm of [cn, gl]) {
  for (const item of realm.runtimeLogs?.userAgents || []) {
    lines.push("| " + realm.label + " | `" + cell(item.value) + "` | " + item.count + " |");
  }
}
lines.push("");
lines.push("> 同一客户端会因启动阶段不同出现“带产品段 / 不带产品段”两种 UA；早期请求可能只有 platform 段 + CLI 扩展。", "");
lines.push("## 关键构造器", "");
lines.push("| 构造器 | 国服证据 | 国际服证据 | 判定 |");
lines.push("| --- | --- | --- | --- |");
for (const row of builderRows) {
  const a = row.a ? "`" + row.a.file + "@" + row.a.offset + "` (" + row.a.hash.slice(0, 10) + ")" : "—";
  const b = row.b ? "`" + row.b.file + "@" + row.b.offset + "` (" + row.b.hash.slice(0, 10) + ")" : "—";
  lines.push("| `" + row.id + "` | " + a + " | " + b + " | " + VERDICT_LABEL[row.verdict] + " |");
}
lines.push("");
lines.push("## 设备指纹链路", "");
lines.push("| 组件 | 国服 | 国际服 | 判定 |");
lines.push("| --- | --- | --- | --- |");
lines.push("| machine-id 来源 | " + cell(cn.builders?.["machine.machineIdSync"]?.file || "未找到") + " | " + cell(gl.builders?.["machine.machineIdSync"]?.file || "未找到") + " | " + VERDICT_LABEL[builderVerdict(cn.builders?.["machine.machineIdSync"], gl.builders?.["machine.machineIdSync"])] + " |");
lines.push("| 本机 device-id 文件 | " + (cn.deviceFiles?.["device-id"]?.present ? "存在" : "缺失") + " | " + (gl.deviceFiles?.["device-id"]?.present ? "存在" : "缺失") + " | " + deviceFileEqual("device-id") + " |");
lines.push("| QIMEI SDK | " + cell(cn.unpackedInventory?.qimeiPackage?.name + "@" + cn.unpackedInventory?.qimeiPackage?.version) + " | " + cell(gl.unpackedInventory?.qimeiPackage?.name + "@" + gl.unpackedInventory?.qimeiPackage?.version) + " | " + (cn.unpackedInventory?.qimeiPackage?.version === gl.unpackedInventory?.qimeiPackage?.version ? "相同" : "不同") + " |");
lines.push("| QIMEI appKey | " + cell(qimeiKey(cn) ? JSON.stringify(qimeiKey(cn)) : "—") + " | " + cell(qimeiKey(gl) ? JSON.stringify(qimeiKey(gl)) : "—") + " | " + (qimeiKey(cn) && qimeiKey(gl) ? "都有" : qimeiKey(cn) ? "仅国服" : qimeiKey(gl) ? "仅国际服" : "都缺失") + " |");
lines.push("| QIMEI 本机缓存 | " + (cn.deviceFiles?.["qimei-cache.json"]?.qimei36Present ? "有 qimei36" : "无") + " | " + (gl.deviceFiles?.["qimei-cache.json"]?.qimei36Present ? "有 qimei36" : "无") + " | " + (cn.deviceFiles?.["qimei-cache.json"]?.qimei36Present === gl.deviceFiles?.["qimei-cache.json"]?.qimei36Present ? "一致" : "不同") + " |");
lines.push("| QIMEI 运行时 | success " + (cn.runtimeLogs?.qimei?.success ?? 0) + " / cache hit " + (cn.runtimeLogs?.qimei?.cacheHit ?? 0) + " / miss " + (cn.runtimeLogs?.qimei?.cacheMiss ?? 0) + " | success " + (gl.runtimeLogs?.qimei?.success ?? 0) + " / cache hit " + (gl.runtimeLogs?.qimei?.cacheHit ?? 0) + " / appKey missing " + (gl.runtimeLogs?.qimei?.appKeyMissing ?? 0) + " | " + ((cn.runtimeLogs?.qimei?.success ?? 0) > 0 && (gl.runtimeLogs?.qimei?.success ?? 0) === 0 ? "国服成功、国际服无 appKey" : "见日志计数") + " |");
lines.push("| Turing channelId | " + cell(cn.runtime?.turingSdk?.channelId) + " | " + cell(gl.runtime?.turingSdk?.channelId) + " | " + (cn.runtime?.turingSdk?.channelId === gl.runtime?.turingSdk?.channelId ? "相同" : "不同") + " |");
lines.push("| X-Device-Token 注入点 | " + (presence(cn, "X-Device-Token").present ? "有" : "无") + " | " + (presence(gl, "X-Device-Token").present ? "有" : "无") + " | 两侧同一 provider |");
lines.push("| X-Device-Id-List 发送条件 | " + (qimeiKey(cn) ? "有 appKey，qimei36 可用时发送" : "无 appKey，不发送") + " | " + (qimeiKey(gl) ? "有 appKey，qimei36 可用时发送" : "无 appKey，不发送") + " | 常量两侧都有，运行时取决于 qimei36 |");
lines.push("");
lines.push("## 配置差异", "");
lines.push("| 配置 | 国服 | 国际服 |");
lines.push("| --- | --- | --- |");
lines.push("| productName | " + cell(cn.runtime?.productName || cn.product?.productName) + " | " + cell(gl.runtime?.productName || gl.product?.productName) + " |");
lines.push("| endpoint | " + cell(cn.runtime?.endpoint || cn.product?.endpoint) + " | " + cell(gl.runtime?.endpoint || gl.product?.endpoint) + " |");
lines.push("| isOversea | " + cell(cn.runtime?.isOversea ?? cn.product?.isOversea ?? false) + " | " + cell(gl.runtime?.isOversea ?? gl.product?.isOversea ?? false) + " |");
lines.push("| qimei36AppKey | " + cell(qimeiKey(cn) ? JSON.stringify(qimeiKey(cn)) : "—") + " | " + cell(qimeiKey(gl) ? JSON.stringify(qimeiKey(gl)) : "—") + " |");
lines.push("| turingSdk | " + cell(JSON.stringify(cn.runtime?.turingSdk)) + " | " + cell(JSON.stringify(gl.runtime?.turingSdk)) + " |");
lines.push("| customUserDataDir | " + cell(cn.runtime?.customUserDataDir) + " | " + cell(gl.runtime?.customUserDataDir) + " |");
lines.push("| skillSecurityAppKey | " + cell(cn.runtime?.skillSecurityAppKey ? "有" : "无") + " | " + cell(gl.runtime?.skillSecurityAppKey ? "有" : "无") + " |");
lines.push("| 产品 endpoint | " + cell(cn.product?.endpoint) + " | " + cell(gl.product?.endpoint) + " |");
lines.push("");
lines.push("## 其余核心/非核心 header", "");
lines.push("契约之外扫描到的 header（已排除 AWS/Stainless/B3 等 SDK 噪声）：", "");
lines.push(extras.length ? extras.map((name) => "`" + name + "`").join("、") : "无");
lines.push("");
lines.push("## 证据索引", "");
for (const realm of [cn, gl]) {
  lines.push("### " + realm.label, "");
  lines.push("- app: `" + realm.app + "`");
  lines.push("- asar: `" + realm.asar + "` (" + realm.asarSize + " bytes)");
  lines.push("- unpacked: `" + realm.unpacked + "`");
  lines.push("- CLI bundle: `" + (realm.unpackedInventory?.cliDist?.[0]?.path || "cli/dist/codebuddy-lite-wb.mjs") + "`");
  lines.push("- QIMEI: `" + JSON.stringify(realm.unpackedInventory?.qimeiPackage) + "`");
  lines.push("- 扫描文件数: " + realm.filesScanned);
  lines.push("");
}
lines.push("## 复现", "");
lines.push("```bash");
lines.push("cd workbuddy-fingerprint-lab");
lines.push("node scripts/run.mjs        # 解包 + 扫描 + 生成报告");
lines.push("node scripts/run.mjs --force");
lines.push("node --test                 # 格式单测");
lines.push("```");
lines.push("");
lines.push("只做静态分析：读取已安装 app.asar / app.asar.unpacked / 本地产品配置缓存，不发起网络请求，不执行客户端代码。");
lines.push("");

ensureDir(reportsDir);
const markdown = lines.join("\n");
fs.writeFileSync(path.join(reportsDir, "REPORT.md"), markdown);
fs.writeFileSync(path.join(projectRoot, "out", "report.json"), JSON.stringify({
  generatedAt: inventory.generatedAt,
  counts,
  builders: builderRows.map((row) => ({ id: row.id, verdict: row.verdict, cn: row.a?.hash, gl: row.b?.hash })),
  extras,
}, null, 2) + "\n");
console.log("wrote", path.join(reportsDir, "REPORT.md"));
