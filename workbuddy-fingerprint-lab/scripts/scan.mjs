import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractRealm, loadTargets } from "./extract.mjs";
import {
  parseArgs,
  ensureDir,
  walkFiles,
  sha256,
  normalizeWhitespace,
  lineAt,
  extractFunction,
  shapeOf,
  literalsOf,
  rel,
} from "./lib/util.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const args = parseArgs(process.argv.slice(2));
const workRoot = path.join(projectRoot, ".work");
const outDir = path.join(projectRoot, "out");

const NOISE_PREFIXES = [
  "X-Amz-", "X-Stainless-", "X-B3-", "X-Forwarded-", "X-Content-Type-",
  "X-Frame-", "X-XSS-", "X-DNS-", "X-Download-", "X-Permitted-",
  "X-Powered-By", "X-Accel-", "X-Proxy-Error", "X-Goog-", "X-Lark-",
  "X-Claude-", "X-OpenAI-", "X-A2A-", "X-Tps-", "X-Req-Id",
  "X-Adapter-Test", "X-Client-Test", "X-Test-Header", "X-Empty-Body",
  "X-Cos-", "X-ISO-", "X-WeCom-", "X-Oneid-", "X-User-Ticket", "X-DailyQuota-",
  "X-AICC-", "X-Aicc-", "X-Cell-", "X-Username", "X-XSRF-TOKEN", "X-API-KEY",
  "X-Request-Id", "X-User-ID", "X-Service-Id", "X-Instance-Id", "X-Project-Id",
  "X-Application-Id", "X-Moderation-",
];

const SPECS = [
  { id: "ua.buildUserAgent", group: "ua", marker: /async buildUserAgent\(/ },
  { id: "ua.sanitizeSegment", group: "ua", marker: /function sanitizeUserAgentSegment\(/ },
  { id: "ua.asciiProductSegment", group: "ua", marker: /function buildAsciiSafeProductSegment\(/ },
  { id: "identity.runIdentityHeaders", group: "identity", marker: /function runIdentityHeaders\(\)/ },
  { id: "agent.resolveModelCallAgentType", group: "agent", marker: /function resolveModelCallAgentType\(/ },
  { id: "agent.resolveAgentRuntime", group: "agent", marker: /function resolveAgentRuntime\(/ },
  { id: "agent.resolveRequestScene", group: "agent", marker: /function resolveRequestScene\(/ },
  { id: "privacy.applyPrivateDataHeaderPolicy", group: "product", marker: /applyPrivateDataHeaderPolicy\(/ },
  { id: "authState.provide", group: "device", marker: /WorkbuddyAuthStateHeaderProvider=class\{/, method: /async provide\(\)\{/ },
  { id: "clientInfo.getCachedBaseEnv", group: "device", marker: /function getCachedBaseEnv\(/ },
  { id: "clientInfo.buildEnv", group: "device", marker: /function buildWorkbuddyClientInfoEnv\(/ },
  { id: "machine.machineIdSync", group: "device", marker: /function machineIdSync\(\)/ },
  { id: "machine.osxUuid", group: "device", marker: /function osxUuid\(\)/ },
  { id: "machine.winUuid", group: "device", marker: /function winUuid\(\)/ },
  { id: "machine.linuxUuid", group: "device", marker: /function linuxUuid\(\)/ },
  { id: "qimei.resolveAppKey", group: "device", marker: /function resolveAppKey\(\)/ },
  { id: "qimei.helperRunner", group: "device", marker: /function defaultHelperRunner\(/ },
  { id: "appServer.securityHeader", group: "appserver", marker: /function applyWorkbuddyAppServerSecurityHeader\(/ },
  { id: "appServer.replayHeaders", group: "appserver", marker: /function buildSessionReplayRequestHeaders\(/ },
  { id: "turing.deviceTokenForRequest", group: "device", marker: /getDeviceTokenForRequest\(\)\{/ },
];

function isNoise(header) {
  return NOISE_PREFIXES.some((prefix) => header.startsWith(prefix));
}

function priorityOf(file) {
  const p = file.replace(/\\/g, "/");
  if (p.endsWith("cli/dist/codebuddy-lite-wb.mjs")) return 0;
  if (p.endsWith("main/server.js")) return 1;
  if (p.endsWith("main/module.app-server.js")) return 2;
  if (p.endsWith("main/main-bootstrap.js")) return 3;
  if (p.endsWith("main/client-info-env.js")) return 4;
  if (p.endsWith("main/sidecar-manager.js")) return 4;
  if (p.endsWith("main/netdrive-env-route.js")) return 4;
  if (p.endsWith("main/qimei-detector.js")) return 5;
  if (p.endsWith("main/turing-sdk.js")) return 6;
  if (p.includes("/main/")) return 10;
  if (p.includes("/preload/")) return 20;
  if (p.includes("/renderer/")) return 30;
  if (p.includes("/node_modules/")) return 40;
  return 15;
}

function labelFile(meta, file) {
  const asarDir = path.join(workRoot, meta.id, "asar");
  if (file.startsWith(asarDir)) return "asar:" + rel(asarDir, file);
  if (file.startsWith(meta.unpacked)) return "unpacked:" + rel(meta.unpacked, file);
  return "file:" + file;
}

function scanHeaders(texts) {
  const byHeader = new Map();
  const headerRe = new RegExp("[\"\x27\x60](X-[A-Za-z0-9-]{2,80})[\"\x27\x60]", "g");
  for (const [file, text] of texts) {
    let match;
    while ((match = headerRe.exec(text))) {
      const header = match[1];
      const list = byHeader.get(header) || [];
      if (list.some((item) => item.file === file)) continue;
      list.push({
        file,
        offset: match.index,
        context: text.slice(Math.max(0, match.index - 80), match.index + 120).replace(/\s+/g, " "),
        noise: isNoise(header),
      });
      byHeader.set(header, list);
    }
  }
  return byHeader;
}

function scanConstants(texts) {
  const byValue = new Map();
  const assignmentRe = /([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:\x22(X-[A-Za-z0-9-]+)\x22|\x27(X-[A-Za-z0-9-]+)\x27|\x60(X-[A-Za-z0-9-]+)\x60)/g;
  for (const [file, text] of texts) {
    let match;
    while ((match = assignmentRe.exec(text))) {
      const name = match[1];
      const header = match[2] || match[3] || match[4];
      if (!header || isNoise(header)) continue;
      const list = byValue.get(header) || [];
      if (!list.some((item) => item.name === name && item.file === file)) {
        list.push({ name, file, offset: match.index });
      }
      byValue.set(header, list);
    }
  }
  return byValue;
}

function scanBuilders(texts) {
  const out = {};
  for (const spec of SPECS) {
    let found = null;
    let hits = 0;
    for (const [file, text] of texts) {
      const result = extractFunction(text, spec.marker, { method: spec.method });
      if (!result) continue;
      hits += 1;
      if (found) continue;
      const normalized = normalizeWhitespace(result.body);
      const shape = shapeOf(result.body);
      const literals = literalsOf(result.body);
      found = {
        id: spec.id,
        group: spec.group,
        file,
        offset: result.offset,
        line: lineAt(text, result.offset),
        length: result.body.length,
        hash: sha256(normalized),
        shapeHash: sha256(shape),
        literalsHash: sha256(literals.join("\n")),
        literals,
        excerpt: result.body.slice(0, 320).replace(/\s+/g, " "),
      };
    }
    if (found) {
      found.hits = hits;
      out[spec.id] = found;
    }
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\0+/u, ""));
  } catch {
    return null;
  }
}

function pickProduct(meta) {
  const unpacked = meta.unpacked;
  const product = readJson(path.join(unpacked, "cli", "product.json"));
  const cliPkg = readJson(path.join(unpacked, "cli", "package.json"));
  const fields = {};
  if (product) {
    for (const key of ["productName", "applicationName", "platform", "deploymentType", "endpoint", "isOversea", "commit", "date", "genieVersion", "installChannel"]) {
      if (key in product) fields[key] = product[key];
    }
    fields.configKeys = Object.keys(product.config || {});
  }
  if (cliPkg) {
    fields.cliPackage = cliPkg.name;
    fields.cliVersion = cliPkg.version && cliPkg.version !== "0.0.0" ? cliPkg.version : cliPkg.publishConfig?.customPackage?.version;
    fields.cliPublishedPackage = cliPkg.publishConfig?.customPackage?.name;
  }
  return fields;
}

function pickRuntime(meta) {
  const dir = path.join(meta.configDir, "cache");
  if (!fs.existsSync(dir)) return { available: false };
  const names = fs.readdirSync(dir).filter((name) => name.startsWith("acc-product-config-v3"));
  const candidates = names.map((name) => {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    return { file, name, mtimeMs: stat.mtimeMs, data: readJson(file) };
  }).filter((item) => item.data);
  if (!candidates.length) return { available: false };
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const withQimei = candidates.find((item) => item.data?.config?.qimei36AppKey);
  const chosen = withQimei || candidates[0];
  const data = chosen.data;
  const config = data.config || {};
  return {
    available: true,
    file: chosen.file,
    productName: data.productName,
    endpoint: data.endpoint,
    isOversea: data.isOversea,
    qimei36AppKey: config.qimei36AppKey || null,
    turingSdk: config.turingSdk || null,
    customUserDataDir: config.customUserDataDir || null,
    skillSecurityAppKey: config.skillSecurityAppKey || null,
    threatDatabaseUrl: config.threatDatabaseUrl || null,
    configKeys: Object.keys(config),
  };
}

function readDeviceFiles(meta) {
  const out = {};
  for (const name of ["device-id", "device-id.machine", "qimei-cache.json"]) {
    const file = path.join(meta.configDir, name);
    if (!fs.existsSync(file)) {
      out[name] = { present: false };
      continue;
    }
    const raw = fs.readFileSync(file);
    const text = raw.toString("utf8").trim();
    const item = { present: true, sha256: sha256(raw), length: text.length };
    if (name === "qimei-cache.json") {
      try {
        const parsed = JSON.parse(text);
        item.qimei36Present = Boolean(parsed?.qimei36);
        item.qimei36Length = typeof parsed?.qimei36 === "string" ? parsed.qimei36.length : 0;
      } catch {
        item.qimei36Present = false;
      }
    }
    out[name] = item;
  }
  return out;
}

function scanRuntimeLogs(meta) {
  const files = [path.join(meta.configDir, "logs", "main.log")].filter((file) => fs.existsSync(file));
  const userAgents = new Map();
  const products = new Map();
  const qimei = { success: 0, cacheHit: 0, cacheMiss: 0, appKeyMissing: 0, helperUnavailable: 0 };
  const count = (text, needle) => text.split(needle).length - 1;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const uaRe = /user-agent\\":\\"([^"\\]+)/g;
    let match;
    while ((match = uaRe.exec(text))) {
      const value = match[1];
      userAgents.set(value, (userAgents.get(value) || 0) + 1);
    }
    const productRe = /x-product\\":\\"([^"\\]+)/g;
    while ((match = productRe.exec(text))) {
      products.set(match[1], (products.get(match[1]) || 0) + 1);
    }
    qimei.success += count(text, "getQimei36 success");
    qimei.cacheHit += count(text, "qimei36 from cache: hit");
    qimei.cacheMiss += count(text, "qimei36 from cache: miss");
    qimei.appKeyMissing += count(text, "appKey missing");
    qimei.helperUnavailable += count(text, "qimei helper unavailable");
  }
  return {
    files: files.map((file) => rel(meta.configDir, file)),
    userAgents: [...userAgents].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    products: [...products].map(([value, count]) => ({ value, count })),
    qimei,
  };
}

function unpackedInventory(meta) {
  const mainFiles = walkFiles(path.join(meta.unpacked, "main"), [".js", ".mjs", ".cjs"]);
  const cliDist = walkFiles(path.join(meta.unpacked, "cli", "dist"), [".js", ".mjs"]);
  const qimeiPkg = readJson(path.join(meta.unpacked, "node_modules", "@tencent", "qimei-node", "package.json"));
  const qimeiNative = walkFiles(path.join(meta.unpacked, "node_modules", "@tencent", "qimei-node"), [".node", ".dll", ".dylib", ".so"]);
  const turing = walkFiles(path.join(meta.app, "Contents", "Resources", "TuringShield.bundle"), [".plist", ".json", ".dylib", ".framework"]);
  return {
    mainFiles: mainFiles.map((file) => rel(meta.unpacked, file)),
    cliDist: cliDist.map((file) => ({ path: rel(meta.unpacked, file), bytes: fs.statSync(file).size })),
    qimeiPackage: qimeiPkg ? { name: qimeiPkg.name, version: qimeiPkg.version } : null,
    qimeiNative: qimeiNative.map((file) => rel(meta.unpacked, file)),
    turingAssets: turing.map((file) => rel(path.join(meta.app, "Contents", "Resources"), file)),
  };
}

export function scanRealm(realm, options = {}) {
  const meta = extractRealm(realm, { force: options.force });
  if (!meta.available) return { ...meta, headers: {}, constants: {}, builders: {} };
  const asarDir = path.join(workRoot, realm.id, "asar");
  const asarFiles = walkFiles(asarDir, [".js", ".mjs", ".cjs"]);
  const unpackedFiles = [
    ...walkFiles(path.join(meta.unpacked, "main"), [".js", ".mjs", ".cjs"]),
    ...walkFiles(path.join(meta.unpacked, "cli", "dist"), [".js", ".mjs"]),
  ];
  const files = [...new Set([...asarFiles, ...unpackedFiles])].sort((a, b) => priorityOf(a) - priorityOf(b));
  const relevant = files.filter((file) => priorityOf(file) <= 20);
  console.error("[" + realm.id + "] reading " + relevant.length + " files");
  const texts = new Map(relevant.map((file) => [file, fs.readFileSync(file, "utf8")]));
  console.error("[" + realm.id + "] scanning headers");
  const headersRaw = scanHeaders(texts);
  console.error("[" + realm.id + "] scanning constants");
  const constantsRaw = scanConstants(texts);
  console.error("[" + realm.id + "] scanning builders");
  const builders = scanBuilders(texts);
  console.error("[" + realm.id + "] done builders");

  const headers = {};
  for (const [header, list] of headersRaw) {
    headers[header] = {
      noise: isNoise(header),
      sources: list.map((item) => ({ file: labelFile(meta, item.file), offset: item.offset, context: item.context })),
    };
  }
  const constants = {};
  for (const [header, list] of constantsRaw) {
    constants[header] = list.map((item) => ({ name: item.name, file: labelFile(meta, item.file), offset: item.offset }));
  }
  for (const builder of Object.values(builders)) {
    builder.file = labelFile(meta, builder.file);
  }
  return {
    ...meta,
    filesScanned: relevant.length,
    product: pickProduct(meta),
    runtime: pickRuntime(meta),
    deviceFiles: readDeviceFiles(meta),
    runtimeLogs: scanRuntimeLogs(meta),
    unpackedInventory: unpackedInventory(meta),
    headers,
    constants,
    builders,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const realms = loadTargets({ cnApp: args["cn-app"], globalApp: args["global-app"] });
  const inventory = { generatedAt: new Date().toISOString(), realms: {} };
  for (const realm of realms) {
    inventory.realms[realm.id] = scanRealm(realm, { force: Boolean(args.force) });
  }
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, "inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
  console.log("wrote", path.join(outDir, "inventory.json"));
}
