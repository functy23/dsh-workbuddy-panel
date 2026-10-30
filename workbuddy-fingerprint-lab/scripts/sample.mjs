import { buildWorkbuddyHeaders, PROFILES } from "../src/fingerprint.mjs";

function sample(profile, withQimei) {
  const headers = buildWorkbuddyHeaders({
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
  if (!withQimei) {
    delete headers["X-Device-Id-List"];
    delete headers["X-Agent-Runtime"];
    delete headers["X-Wb-Uid"];
  }
  return headers;
}

const out = {
  cn: { profile: PROFILES.cn, headers: sample(PROFILES.cn, true) },
  global: { profile: PROFILES.global, headers: sample(PROFILES.global, false) },
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  for (const [id, item] of Object.entries(out)) {
    console.log("## " + id + " (" + item.profile.label + ")");
    for (const [key, value] of Object.entries(item.headers)) {
      console.log(key + ": " + value);
    }
    console.log("");
  }
}
