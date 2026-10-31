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
/**
* The contract generation this panel understands.
*
* 3 adds {@link GatewayHost.importCredentials}: a token-only credential can only
* enter through the auths directory, so the panel needs a writer on the row that
* owns that directory.
*/
const GATEWAY_HOST_SERVICE_VERSION = 3;
//#endregion
//#region src/token-import.ts
/** Characters a uid may use. The gateway re-checks this before building a path. */
const UID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
/** A word that introduces a token rather than being one. */
const PREFIX_WORD = /^(?:bearer|access[_-]?token|token|authorization)$/iu;
/** A millisecond timestamp is larger than any sane second timestamp. */
const MILLISECOND_FLOOR = 0xe8d4a51000;
/** A non-empty trimmed string field, or undefined. */
function str(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim();
	return trimmed === "" ? void 0 : trimmed;
}
/** A finite number field, or undefined. */
function num(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** Whether a domain belongs to the international realm. */
function isGlobalDomain(domain) {
	const lowered = domain.trim().toLowerCase();
	return lowered === "workbuddy.ai" || lowered.endsWith(".workbuddy.ai");
}
/** Normalize an epoch value that may be seconds or milliseconds. */
function epochSeconds(value) {
	if (value === void 0 || value <= 0) return 0;
	return Math.floor(value >= MILLISECOND_FLOOR ? value / 1e3 : value);
}
/** Strip the punctuation a copy-paste tends to bring along. */
function unwrapToken(raw) {
	let text = raw.trim();
	while (text.length > 0) {
		const first = text[0];
		const last = text[text.length - 1];
		if (first === "\"" && last === "\"" || first === "'" && last === "'" || first === "`" && last === "`") {
			text = text.slice(1, -1).trim();
			continue;
		}
		break;
	}
	const prefixed = /^(?:bearer|access_token|accessToken|token)\s*[=:]\s*/iu.exec(text);
	if (prefixed !== null) text = text.slice(prefixed[0].length).trim();
	return text.replace(/[;,]+$/u, "").trim();
}
/**
* Decode a JWT payload without verifying it.
*
* Verification is the gateway's job — it is the only party that talks to the
* issuer. What the panel needs from the claims is display and routing only:
* which account this is, what to call it, and when it stops working.
*/
function decodeJwtClaims(token) {
	const segments = token.split(".");
	if (segments.length !== 3) return void 0;
	const payload = segments[1];
	if (payload === void 0 || payload === "") return void 0;
	let decoded;
	try {
		decoded = Buffer.from(payload, "base64url").toString("utf8");
	} catch {
		return;
	}
	let parsed;
	try {
		parsed = JSON.parse(decoded);
	} catch {
		return;
	}
	return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : void 0;
}
/** Realm and domain from an issuer URL (`https://www.codebuddy.cn/auth/realms/copilot`). */
function realmOfIssuer(issuer) {
	if (issuer === void 0) return {
		realm: "cn",
		domain: ""
	};
	let host = "";
	try {
		host = new URL(issuer).host.toLowerCase();
	} catch {
		return {
			realm: "cn",
			domain: ""
		};
	}
	return isGlobalDomain(host) ? {
		realm: "global",
		domain: host
	} : {
		realm: "cn",
		domain: ""
	};
}
/** Build a credential from a bare JWT, or say why it is not one. */
function credentialFromToken(raw) {
	const token = unwrapToken(raw);
	if (token === "") return "empty token";
	const claims = decodeJwtClaims(token);
	if (claims === void 0) return "not a JWT: expected three dot-separated segments whose middle one is JSON";
	const uid = str(claims["sub"]);
	if (uid === void 0) return "the token has no sub claim, so it does not name an account";
	if (!UID_PATTERN.test(uid)) return "the sub claim is not a usable uid";
	const issuer = realmOfIssuer(str(claims["iss"]));
	return {
		uid,
		nickname: str(claims["nickname"]) ?? str(claims["preferred_username"]) ?? str(claims["email"]) ?? uid.slice(0, 8),
		accessToken: token,
		refreshToken: "",
		expiresAt: epochSeconds(num(claims["exp"])),
		realm: issuer.realm,
		domain: issuer.domain
	};
}
/**
* The `auths/*.json` document for one credential.
*
* Exactly the shape the gateway itself writes after a refresh (`SaveAtomic`), so
* a generated file and a hand-edited one stay indistinguishable — including the
* empty `refreshToken` that tells the pool not to attempt a renewal.
*/
function authFileDocument(credential) {
	return {
		auth: {
			accessToken: credential.accessToken,
			refreshToken: credential.refreshToken,
			expiresAt: credential.expiresAt,
			domain: credential.domain,
			realm: credential.realm
		},
		account: {
			uid: credential.uid,
			enterpriseId: "",
			nickname: credential.nickname
		}
	};
}
/** Read one object in any of the accepted record shapes. */
function credentialFromObject(value) {
	const nestedAuth = value["auth"];
	const auth = typeof nestedAuth === "object" && nestedAuth !== null && !Array.isArray(nestedAuth) ? nestedAuth : value;
	const nestedAccount = value["account"];
	const account = typeof nestedAccount === "object" && nestedAccount !== null && !Array.isArray(nestedAccount) ? nestedAccount : value;
	const accessToken = str(auth["accessToken"]) ?? str(auth["access_token"]) ?? str(value["accessToken"]) ?? str(value["access_token"]) ?? str(value["token"]);
	if (accessToken === void 0) return "no access token in this object";
	const claims = decodeJwtClaims(unwrapToken(accessToken));
	const uid = str(account["uid"]) ?? str(value["uid"]) ?? (claims === void 0 ? void 0 : str(claims["sub"]));
	if (uid === void 0) return "no uid, and the access token carries no sub claim";
	if (!UID_PATTERN.test(uid)) return "uid may only use letters, digits, - and _";
	const domain = str(auth["domain"]) ?? str(value["domain"]) ?? "";
	const declaredRealm = str(auth["realm"]) ?? str(value["realm"]);
	const realm = declaredRealm === "global" || declaredRealm === "cn" ? declaredRealm : isGlobalDomain(domain) ? "global" : realmOfIssuer(claims === void 0 ? void 0 : str(claims["iss"])).realm;
	const claimExpiry = claims === void 0 ? void 0 : num(claims["exp"]);
	return {
		uid,
		nickname: str(account["nickname"]) ?? str(value["nickname"]) ?? (claims === void 0 ? void 0 : str(claims["nickname"]) ?? str(claims["preferred_username"])) ?? uid.slice(0, 8),
		accessToken: unwrapToken(accessToken),
		refreshToken: str(auth["refreshToken"]) ?? str(auth["refresh_token"]) ?? str(value["refresh_token"]) ?? "",
		expiresAt: epochSeconds(num(auth["expiresAt"]) ?? num(value["expires_at"]) ?? num(value["expiresAt"]) ?? claimExpiry),
		realm,
		domain: realm === "global" && domain === "" ? "www.workbuddy.ai" : domain
	};
}
/** Read a decoded JSON document in any accepted shape. */
function fromDocument(value, rejected) {
	if (typeof value === "string") {
		const credential = credentialFromToken(value);
		if (typeof credential === "string") rejected.push({
			input: value.slice(0, 24),
			reason: credential
		});
		else return [credential];
		return [];
	}
	if (Array.isArray(value)) return value.flatMap((entry) => {
		if (typeof entry === "string") {
			const credential = credentialFromToken(entry);
			if (typeof credential === "string") {
				rejected.push({
					input: entry.slice(0, 24),
					reason: credential
				});
				return [];
			}
			return [credential];
		}
		if (typeof entry !== "object" || entry === null) {
			rejected.push({
				input: JSON.stringify(entry)?.slice(0, 24) ?? "null",
				reason: "not a credential"
			});
			return [];
		}
		const credential = credentialFromObject(entry);
		if (typeof credential === "string") {
			rejected.push({
				input: JSON.stringify(entry).slice(0, 24),
				reason: credential
			});
			return [];
		}
		return [credential];
	});
	if (typeof value === "object" && value !== null) {
		const credential = credentialFromObject(value);
		if (typeof credential === "string") {
			rejected.push({
				input: JSON.stringify(value).slice(0, 24),
				reason: credential
			});
			return [];
		}
		return [credential];
	}
	rejected.push({
		input: String(value).slice(0, 24),
		reason: "not a credential"
	});
	return [];
}
/**
* Parse whatever the token field holds.
*
* JSON is tried first and only then the token list, because a cockpit export and
* a JWT are told apart by their first character, and a user pasting the wrong one
* of the two should get "the token has no sub claim", not "payload is not JSON".
*/
function parseImport(text) {
	const trimmed = text.trim();
	if (trimmed === "") return {
		credentials: [],
		rejected: []
	};
	const rejected = [];
	if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("\"")) try {
		return {
			credentials: fromDocument(JSON.parse(trimmed), rejected),
			rejected
		};
	} catch {}
	const credentials = [];
	for (const line of trimmed.split(/\r?\n/u)) {
		const withoutPrefix = unwrapToken(line);
		if (withoutPrefix === "") continue;
		for (const chunk of withoutPrefix.split(/[\s,]+/u)) {
			if (PREFIX_WORD.test(chunk)) continue;
			const credential = credentialFromToken(chunk);
			if (typeof credential === "string") rejected.push({
				input: chunk.slice(0, 24),
				reason: credential
			});
			else credentials.push(credential);
		}
	}
	return {
		credentials,
		rejected
	};
}
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
export { serverRootDir as C, pluginDataDir as S, gatewayConfigPath as _, serverManifest as a, kernelUpdateSettingsPath as b, GATEWAY_HOST_SERVICE as c, writeStoreDocument as d, isJsonObject as f, connectionSettingsPath as g, catalogCachePath as h, releaseAssetUrl as i, GATEWAY_HOST_SERVICE_VERSION as l, activeServerManifestPath as m, parseServerManifest as n, authFileDocument as o, parseJsonObject as p, platformKey as r, parseImport as s, assetForPlatform as t, readStoreDocument as u, gatewayUsagePath as v, modelOverridesPath as x, gatewayWorkdir as y };
