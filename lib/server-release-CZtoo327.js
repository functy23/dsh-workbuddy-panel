import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
//#region src/paths.ts
/**
* Where this plugin keeps its documents.
*
* Everything lives in one directory under the harness home ($DSH_HOME, else
* ~/.dsh) so a user can inspect or delete the plugin's state without hunting
* through the profile tree. The gateway's own working directory sits INSIDE that
* directory: the host row's managed process keeps its auths/ and data/ there,
* which is what makes the whole integration self-contained — removing the
* plugin's directory removes the gateway's state with it.
*
* @module dsh-workbuddy2api-gateway/paths
*/
/** The harness home directory ($DSH_HOME, else ~/.dsh). */
function dshHome() {
	const configured = process.env["DSH_HOME"];
	return configured !== void 0 && configured.trim() !== "" ? configured : join(homedir(), ".dsh");
}
/** This plugin's data directory. */
function pluginDataDir() {
	return join(dshHome(), "workbuddy2api-gateway");
}
/** The supervised gateway's working directory (its auths/ and data/ live here). */
function gatewayWorkdir() {
	return join(pluginDataDir(), "gateway");
}
/** The gateway's config.json path. */
/**
* The verified server cache.
*
* The gateway binary is NOT shipped in this package. It lives here, under a
* version/platform directory, after its SHA-256 matched the pinned
* `server.json`. The host row is the only writer; the panel reads status.
*/
function serverRootDir() {
	return join(pluginDataDir(), "server");
}
function gatewayConfigPath() {
	return join(gatewayWorkdir(), "config.json");
}
/**
* The manifest the cache is currently pinned to.
*
* Starts absent (the packaged `server.json` wins). A kernel installed from the
* release channel writes its manifest here, so a restart keeps serving the
* version the user chose instead of silently falling back to the packaged pin.
*/
function activeServerManifestPath() {
	return join(serverRootDir(), "manifest.json");
}
/** Kernel update cadence + last check time, written by the settings page. */
function kernelUpdateSettingsPath() {
	return join(pluginDataDir(), "kernel-update.json");
}
/** The gateway's own usage ledger (one bucket per hour, realm, account, model). */
function gatewayUsagePath() {
	return join(gatewayWorkdir(), "data", "usage.json");
}
/** Local per-model overrides (enabled flags, effort choices). */
function modelOverridesPath() {
	return join(pluginDataDir(), "model-overrides.json");
}
/** Connection settings written by the settings page. */
function connectionSettingsPath() {
	return join(pluginDataDir(), "connection.json");
}
/** Saved copy of the last successful catalog, for offline starts. */
function catalogCachePath() {
	return join(pluginDataDir(), "catalog.json");
}
//#endregion
//#region src/json-value.ts
/**
* The one JSON shape predicate the whole plugin shares.
*
* Every route, store and panel decoder reads fields off parsed text, and every
* one of them has to answer the same question first: is this a plain object?
* `null` and arrays are valid JSON documents and both reach a `doc['field']`
* read as a TypeError or a silent `undefined`.
*
* @module dsh-workbuddy2api-connect/json-value
*/
/** Whether a decoded value is a plain JSON object (arrays and null excluded). */
function isJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Parse JSON text into a plain object, or `undefined` when it is anything else. */
function parseJsonObject(text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		return;
	}
	return isJsonObject(parsed) ? parsed : void 0;
}
//#endregion
//#region src/store-file.ts
/**
* Atomic JSON store I/O shared by every plugin-owned document.
*
* Reads degrade to `undefined` on any defect (absent, unreadable, not JSON,
* wrong format version) because every caller reacts the same way: fall back to
* what it can serve without the file.
*
* Writes replace the document in one atomic step: a per-write random temp name
* opened exclusively (so two processes cannot truncate each other), mode 0600
* on the fresh inode, and a rename that stays on one filesystem.
*
* @module dsh-workbuddy2api-connect/store-file
*/
/** Read a version-matched store document and pick the caller's value out of it. */
function readStoreDocument(path, version, pick) {
	if (!existsSync(path)) return void 0;
	try {
		const document = parseJsonObject(readFileSync(path, "utf8"));
		if (document === void 0 || document["version"] !== version) return void 0;
		return pick(document);
	} catch {
		return;
	}
}
/** Replace a store document atomically. */
function writeStoreDocument(path, document) {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = resolve(`${path}.${randomBytes(6).toString("hex")}.tmp`);
	writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, {
		mode: 384,
		flag: "wx"
	});
	renameSync(temporary, path);
}
//#endregion
//#region src/gateway-contract.ts
/** The Cordis service name the host row registers. */
const GATEWAY_HOST_SERVICE = "workbuddy2apiGateway";
/** The contract generation this panel understands. */
const GATEWAY_HOST_SERVICE_VERSION = 2;
//#endregion
//#region src/server-release.ts
/**
* The one server release this panel pins.
*
* `server.json` lives at the package root and travels with the panel. It names
* the exact gateway build, the asset for each platform, and the SHA-256 of the
* decompressed binary. A remote manifest is never trusted: GitHub only serves
* bytes, and a mirror that changes them fails the local check.
*
* @module dsh-workbuddy-panel/server-release
*/
/** Node platform/arch pair as the manifest spells it. */
function platformKey(platform = process.platform, arch = process.arch) {
	const normalizedArch = arch === "x64" ? "x64" : arch;
	return platform + "-" + normalizedArch;
}
/** Read and validate the packaged manifest once. */
let cached;
function serverManifest() {
	if (cached !== void 0) return cached;
	const text = readFileSync(new URL("../server.json", import.meta.url), "utf8");
	cached = parseServerManifest(JSON.parse(text));
	return cached;
}
/** Validate a manifest document; exported so the release script can reuse it. */
function parseServerManifest(value) {
	if (!isRecord(value)) throw new Error("server.json: expected an object");
	if (value["schemaVersion"] !== 1) throw new Error("server.json: unsupported schemaVersion");
	const version = nonEmptyString(value["version"], "version");
	const apiVersion = positiveInteger(value["apiVersion"], "apiVersion");
	const minPanel = nonEmptyString(value["minPanel"], "minPanel");
	const releaseTag = nonEmptyString(value["releaseTag"], "releaseTag");
	const releaseBaseUrl = nonEmptyString(value["releaseBaseUrl"], "releaseBaseUrl");
	if (!/^https:\/\//u.test(releaseBaseUrl)) throw new Error("server.json: releaseBaseUrl must be HTTPS");
	const assets = value["assets"];
	if (!isRecord(assets)) throw new Error("server.json: assets must be an object");
	const parsed = {};
	for (const [key, entry] of Object.entries(assets)) {
		if (!isRecord(entry)) throw new Error("server.json: asset " + key + " must be an object");
		const asset = nonEmptyString(entry["asset"], key + ".asset");
		const sha256 = nonEmptyString(entry["sha256"], key + ".sha256").toLowerCase();
		if (!/^[0-9a-f]{64}$/u.test(sha256)) throw new Error("server.json: " + key + ".sha256 must be 64 hex characters");
		parsed[key] = {
			asset,
			sha256,
			size: positiveInteger(entry["size"], key + ".size"),
			downloadSize: positiveInteger(entry["downloadSize"], key + ".downloadSize")
		};
	}
	if (Object.keys(parsed).length === 0) throw new Error("server.json: at least one asset is required");
	return {
		schemaVersion: 1,
		version,
		apiVersion,
		minPanel,
		releaseTag,
		releaseBaseUrl,
		assets: parsed
	};
}
/** The asset for one platform, when the release has one. */
function assetForPlatform(manifest, platform = process.platform, arch = process.arch) {
	return manifest.assets[platformKey(platform, arch)];
}
/** The GitHub Release asset URL for one manifest entry. */
function releaseAssetUrl(manifest, asset, baseUrl = manifest.releaseBaseUrl) {
	return baseUrl.replace(/\/+$/u, "") + "/" + manifest.releaseTag + "/" + asset.asset;
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value, field) {
	if (typeof value !== "string" || value.trim() === "") throw new Error("server.json: " + field + " must be a non-empty string");
	return value;
}
function positiveInteger(value, field) {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("server.json: " + field + " must be a positive integer");
	return value;
}
//#endregion
export { gatewayWorkdir as _, serverManifest as a, pluginDataDir as b, readStoreDocument as c, parseJsonObject as d, activeServerManifestPath as f, gatewayUsagePath as g, gatewayConfigPath as h, releaseAssetUrl as i, writeStoreDocument as l, connectionSettingsPath as m, parseServerManifest as n, GATEWAY_HOST_SERVICE as o, catalogCachePath as p, platformKey as r, GATEWAY_HOST_SERVICE_VERSION as s, assetForPlatform as t, isJsonObject as u, kernelUpdateSettingsPath as v, serverRootDir as x, modelOverridesPath as y };
