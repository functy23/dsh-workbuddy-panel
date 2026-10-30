import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { openAsar } from "./lib/asar.mjs";
import { expandHome, parseArgs, ensureDir } from "./lib/util.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const args = parseArgs(process.argv.slice(2));
const targetsFile = path.join(projectRoot, "data", "targets.json");
const targets = JSON.parse(fs.readFileSync(targetsFile, "utf8"));
const workRoot = path.join(projectRoot, ".work");

function plistInfo(appPath) {
  const plist = path.join(appPath, "Contents", "Info.plist");
  if (!fs.existsSync(plist)) return {};
  try {
    const raw = execFileSync("plutil", ["-convert", "json", "-o", "-", plist], { encoding: "utf8" });
    const parsed = JSON.parse(raw);
    return {
      bundleId: parsed.CFBundleIdentifier,
      version: parsed.CFBundleShortVersionString,
      build: parsed.CFBundleVersion,
      displayName: parsed.CFBundleDisplayName || parsed.CFBundleName,
    };
  } catch {
    return {};
  }
}

function asarPackage(asar) {
  const raw = asar.read("/package.json");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw.replace(/^\0+/u, ""));
    return { name: parsed.name, version: parsed.version, productName: parsed.productName };
  } catch {
    return {};
  }
}

export function extractRealm(realm, options = {}) {
  const appPath = expandHome(options.app || realm.app);
  const asarPath = path.join(appPath, "Contents", "Resources", "app.asar");
  const unpackedDir = path.join(appPath, targets.unpackedRelative);
  if (!fs.existsSync(asarPath)) {
    return { id: realm.id, label: realm.label, app: appPath, available: false, error: "app.asar not found" };
  }
  const stat = fs.statSync(asarPath);
  const outDir = path.join(workRoot, realm.id, "asar");
  const metaFile = path.join(workRoot, realm.id, "meta.json");
  let cached = null;
  if (fs.existsSync(metaFile)) {
    try { cached = JSON.parse(fs.readFileSync(metaFile, "utf8")); } catch { cached = null; }
  }
  const cacheHit = cached && cached.asarSize === stat.size && cached.asarMtimeMs === stat.mtimeMs && fs.existsSync(outDir);
  const asar = openAsar(asarPath, unpackedDir);
  const pkg = asarPackage(asar);
  let extracted = 0;
  if (!cacheHit || options.force) {
    fs.rmSync(outDir, { recursive: true, force: true });
    ensureDir(outDir);
    extracted = asar.extract([".js", ".mjs", ".cjs", ".json"], outDir);
  }
  asar.close();
  const info = plistInfo(appPath);
  const meta = {
    id: realm.id,
    label: realm.label,
    app: appPath,
    available: true,
    asar: asarPath,
    asarSize: stat.size,
    asarMtimeMs: stat.mtimeMs,
    unpacked: unpackedDir,
    extracted,
    cacheHit: Boolean(cacheHit),
    package: pkg,
    info,
    configDir: expandHome(realm.configDir),
    expectedProduct: realm.expectedProduct,
    extractedAt: new Date().toISOString(),
  };
  ensureDir(path.dirname(metaFile));
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + "\n");
  return meta;
}

export function loadTargets(options = {}) {
  return targets.realms.map((realm) => ({
    ...realm,
    app: options[realm.id + "App"] || realm.app,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const realms = loadTargets({ cnApp: args["cn-app"], globalApp: args["global-app"] });
  for (const realm of realms) {
    const meta = extractRealm(realm, { force: Boolean(args.force) });
    console.log(JSON.stringify(meta, null, 2));
  }
}
