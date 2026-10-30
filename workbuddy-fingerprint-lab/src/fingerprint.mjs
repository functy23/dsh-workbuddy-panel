/**
 * WorkBuddy 请求头 / 设备指纹格式重建。
 *
 * 这些函数按客户端 CLI bundle 里的真实构造顺序重写：
 * - UserAgentHttpInterceptor.buildUserAgent
 * - runIdentityHeaders
 * - WorkbuddyAuthStateHeaderProvider.provide
 * - 模型调用 header 组装（X-Agent-* / X-Product / X-IDE-*）
 *
 * 只重建格式，不包含任何真实 token、cookie 或账号数据。
 */

export function buildUserAgent(input = {}) {
  const parts = [];
  if (input.baseUA) parts.push(input.baseUA);
  const product = input.applicationName || input.productName;
  if (product) parts.unshift(product + "/" + (input.productVersion || "unknown"));
  if (input.platform) parts.unshift(input.platform + "/" + (input.platformVersion || "unknown"));
  if (input.userAgentExtension) parts.push(input.userAgentExtension);
  return parts.join(" ");
}

export function buildUserinfo({ uid, enterpriseId, idSource, authMethod } = {}) {
  if (!uid || !(enterpriseId || idSource || authMethod)) return null;
  const payload = { uin: uid };
  if (enterpriseId) payload.owner_uin = enterpriseId;
  if (idSource) payload.id_source = idSource;
  if (authMethod) payload.token_source = authMethod;
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function buildIdentityHeaders(input = {}) {
  const headers = {};
  const { uid, enterpriseId, idSource, authMethod, departmentFullName } = input;
  if (uid) headers["X-User-Id"] = uid;
  if (enterpriseId) headers["X-Enterprise-Id"] = enterpriseId;
  if (authMethod) headers["X-Auth-Method"] = authMethod;
  if (idSource) headers["X-Id-Source"] = idSource;
  const userinfo = buildUserinfo(input);
  if (userinfo) headers["X-Userinfo"] = userinfo;
  if (departmentFullName) headers["X-Department-Info"] = departmentFullName;
  return headers;
}

export function buildAuthStateHeaders({ deviceToken, qimei36 } = {}) {
  // 真实代码里 X-Custom-Channel-Id 固定为 unknown；channelId 只用于 Turing SDK 初始化。
  const headers = { "X-Custom-Channel-Id": "unknown" };
  if (deviceToken) headers["X-Device-Token"] = deviceToken;
  if (qimei36) headers["X-Device-Id-List"] = JSON.stringify({ qimei36 });
  return headers;
}

export function normalizeAgentRuntime(value) {
  const allowed = ["local-agent", "cloud-agent", "agent-agent"];
  if (typeof value !== "string" || !value.trim()) return "other";
  const trimmed = value.trim();
  return allowed.includes(trimmed) ? trimmed : "other";
}

export function buildAgentHeaders(input = {}) {
  const headers = {};
  if (input.agentType) headers["X-Agent-Type"] = input.agentType;
  headers["X-Agent-Runtime"] = normalizeAgentRuntime(input.agentRuntime);
  if (input.agentPurpose) headers["X-Agent-Purpose"] = input.agentPurpose;
  if (input.agentIntent) headers["X-Agent-Intent"] = input.agentIntent;
  if (input.compaction) headers["X-Compaction"] = input.compaction;
  if (input.contextCompacted !== undefined) headers["X-Context-Compacted"] = String(input.contextCompacted);
  if (input.parentConversationId) headers["X-Parent-Conversation-ID"] = input.parentConversationId;
  return headers;
}

export function buildProductHeaders(input = {}) {
  const headers = {};
  if (input.deploymentType) headers["X-Product"] = input.deploymentType;
  if (input.productVersion) headers["X-Product-Version"] = input.productVersion;
  if (input.ideType) headers["X-IDE-Type"] = input.ideType;
  if (input.ideName) headers["X-IDE-Name"] = input.ideName;
  if (input.ideVersion) headers["X-IDE-Version"] = input.ideVersion;
  if (input.clientVersion) headers["X-Client-Version"] = input.clientVersion;
  if (input.modelId) headers["X-Model-ID"] = input.modelId;
  if (input.privateData) headers["X-Private-Data"] = "true";
  return headers;
}

export function buildTracingHeaders(input = {}) {
  const headers = {};
  for (const [key, header] of [
    ["traceId", "X-Trace-ID"],
    ["requestId", "X-Request-ID"],
    ["rootRequestId", "X-Root-Request-ID"],
    ["sessionId", "X-Session-ID"],
    ["conversationId", "X-Conversation-ID"],
    ["conversationRequestId", "X-Conversation-Request-ID"],
    ["conversationMessageId", "X-Conversation-Message-ID"],
  ]) {
    if (input[key]) headers[header] = input[key];
  }
  return headers;
}

export function buildAppServerHeaders(input = {}) {
  const headers = {};
  if (input.codeBuddyRequest) headers["X-CodeBuddy-Request"] = "1";
  if (input.runTimeoutMs) headers["X-Codebuddy-Run-Timeout"] = String(input.runTimeoutMs);
  return headers;
}

export function buildWorkbuddyHeaders(input = {}) {
  return {
    "User-Agent": buildUserAgent(input),
    ...buildIdentityHeaders(input),
    ...buildAuthStateHeaders(input),
    ...buildAgentHeaders(input),
    ...buildProductHeaders(input),
    ...buildTracingHeaders(input),
    ...buildAppServerHeaders(input),
  };
}

export const PROFILES = {
  cn: {
    label: "国服 WorkBuddy",
    platform: "WorkBuddy",
    platformVersion: "5.9.2",
    applicationName: "WorkBuddy",
    productName: "WorkBuddy",
    productVersion: "5.9.2",
    userAgentExtension: "CLI/2.165.0",
    baseUA: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36",
    deploymentType: "SaaS",
    ideType: "WorkBuddy",
    ideName: "WorkBuddy",
    ideVersion: "5.9.2",
    clientVersion: "5.9.2",
    channelId: 109144,
  },
  global: {
    label: "国际服 WorkBuddy AI",
    platform: "workbuddy-ai",
    platformVersion: "5.8.4",
    applicationName: "workbuddy-ai",
    productName: "WorkBuddy AI",
    productVersion: "5.8.4",
    userAgentExtension: "CLI/2.161.0",
    baseUA: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.7204.251 Electron/37.10.3 Safari/537.36",
    deploymentType: "SaaS",
    ideType: "WorkBuddy",
    ideName: "WorkBuddy",
    ideVersion: "5.8.4",
    clientVersion: "5.8.4",
    channelId: 400111,
  },
};
