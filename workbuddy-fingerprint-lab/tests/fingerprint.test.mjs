import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUserAgent,
  buildUserinfo,
  buildIdentityHeaders,
  buildAuthStateHeaders,
  normalizeAgentRuntime,
  buildWorkbuddyHeaders,
  PROFILES,
} from "../src/fingerprint.mjs";

test("UA 合并顺序：platform/product/baseUA/extension", () => {
  const ua = buildUserAgent({
    platform: "WorkBuddy",
    platformVersion: "5.9.2",
    productName: "WorkBuddy",
    productVersion: "5.9.2",
    baseUA: "Mozilla/5.0 Test",
    userAgentExtension: "CLI/2.165.0",
  });
  assert.equal(ua, "WorkBuddy/5.9.2 WorkBuddy/5.9.2 Mozilla/5.0 Test CLI/2.165.0");
});

test("UA 缺失版本回落 unknown", () => {
  const ua = buildUserAgent({ platform: "WorkBuddy", productName: "WorkBuddy AI" });
  assert.equal(ua, "WorkBuddy/unknown WorkBuddy AI/unknown");
});

test("X-Userinfo 是 base64 JSON，字段顺序 uin/owner_uin/id_source/token_source", () => {
  const value = buildUserinfo({ uid: "u1", enterpriseId: "e1", idSource: "idp", authMethod: "oauth" });
  const decoded = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  assert.deepEqual(decoded, { uin: "u1", owner_uin: "e1", id_source: "idp", token_source: "oauth" });
  assert.equal(value, Buffer.from(JSON.stringify(decoded)).toString("base64"));
});

test("X-Userinfo 只在 uid + 至少一个附加字段时生成", () => {
  assert.equal(buildUserinfo({ uid: "u1" }), null);
  assert.equal(buildUserinfo({ enterpriseId: "e1" }), null);
  assert.ok(buildUserinfo({ uid: "u1", authMethod: "oauth" }));
});

test("身份头条件写入", () => {
  const headers = buildIdentityHeaders({ uid: "u1", enterpriseId: "e1", authMethod: "oauth", idSource: "idp", departmentFullName: "Dept" });
  assert.equal(headers["X-User-Id"], "u1");
  assert.equal(headers["X-Enterprise-Id"], "e1");
  assert.equal(headers["X-Auth-Method"], "oauth");
  assert.equal(headers["X-Id-Source"], "idp");
  assert.equal(headers["X-Department-Info"], "Dept");
  assert.ok(headers["X-Userinfo"]);
});

test("设备头：channelId 固定 unknown，qimei36 缺失则不发 X-Device-Id-List", () => {
  const withQimei = buildAuthStateHeaders({ deviceToken: "dt", qimei36: "q36" });
  assert.equal(withQimei["X-Custom-Channel-Id"], "unknown");
  assert.equal(withQimei["X-Device-Token"], "dt");
  assert.equal(withQimei["X-Device-Id-List"], JSON.stringify({ qimei36: "q36" }));
  const withoutQimei = buildAuthStateHeaders({ deviceToken: "dt" });
  assert.equal(withoutQimei["X-Device-Id-List"], undefined);
  assert.equal(buildAuthStateHeaders({ deviceToken: "dt", channelId: 109144 })["X-Custom-Channel-Id"], "unknown");
});

test("X-Agent-Runtime 只接受三个值，其余回落 other", () => {
  assert.equal(normalizeAgentRuntime("local-agent"), "local-agent");
  assert.equal(normalizeAgentRuntime("cloud-agent"), "cloud-agent");
  assert.equal(normalizeAgentRuntime("agent-agent"), "agent-agent");
  assert.equal(normalizeAgentRuntime("cli"), "other");
  assert.equal(normalizeAgentRuntime(""), "other");
});

test("完整 header 组装包含 UA、身份、设备、agent、产品、链路", () => {
  const headers = buildWorkbuddyHeaders({
    ...PROFILES.cn,
    uid: "u1",
    authMethod: "oauth",
    deviceToken: "dt",
    qimei36: "q36",
    agentType: "main",
    agentRuntime: "local-agent",
    agentPurpose: "conversation",
    agentIntent: "craft",
    traceId: "t1",
    requestId: "r1",
    conversationId: "c1",
    codeBuddyRequest: true,
  });
  assert.match(headers["User-Agent"], /^WorkBuddy\/5\.9\.2 WorkBuddy\/5\.9\.2 /);
  assert.match(headers["User-Agent"], / CLI\/2\.165\.0$/);
  assert.equal(headers["X-Userinfo"], Buffer.from(JSON.stringify({ uin: "u1", token_source: "oauth" })).toString("base64"));
  assert.equal(headers["X-Device-Token"], "dt");
  assert.equal(headers["X-Device-Id-List"], JSON.stringify({ qimei36: "q36" }));
  assert.equal(headers["X-Agent-Runtime"], "local-agent");
  assert.equal(headers["X-Agent-Purpose"], "conversation");
  assert.equal(headers["X-Product"], "SaaS");
  assert.equal(headers["X-CodeBuddy-Request"], "1");
});
