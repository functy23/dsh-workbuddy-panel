import { C as serverRootDir, S as pluginDataDir, _ as gatewayConfigPath, a as serverManifest, c as GATEWAY_HOST_SERVICE, d as writeStoreDocument, f as isJsonObject, g as connectionSettingsPath, h as catalogCachePath, l as GATEWAY_HOST_SERVICE_VERSION, p as parseJsonObject, s as parseImport, u as readStoreDocument, v as gatewayUsagePath, x as modelOverridesPath, y as gatewayWorkdir } from "./server-release-BtUcVrvo.js";
import { randomBytes } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import { ReasoningEffortId, resolveImageAttachmentAccess, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { fileURLToPath } from "node:url";
//#region src/catalog.ts
/** Reasoning levels pi-ai can express, in display order. */
const THINKING_LEVELS = [
	"off",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
/** Whether a value is a level this plugin can offer. */
function isThinkingLevel(value) {
	return typeof value === "string" && THINKING_LEVELS.includes(value);
}
/**
* The region encoded in a gateway model id.
*
* `/v1/models` and `/panel/api/models` prefix every id with the realm that
* serves it (`cn:` or `global:`). A bare id is the CN realm: that is the
* gateway's own default and the historical shape before the prefix existed.
*/
function regionOfModel(id) {
	return id.startsWith("global:") ? "global" : "cn";
}
/** The declared level set of one panel row: its efforts, plus `off` when allowed. */
function declaredEffortsOf(model) {
	const declared = model.supportedEfforts.filter(isThinkingLevel);
	if (model.canDisableThinking && !declared.includes("off")) declared.unshift("off");
	return declared;
}
/** Pick the level a model should default to, from the override then the panel. */
function defaultEffortOf(override, offered, panelDefault) {
	if (override?.effort !== void 0 && offered.includes(override.effort)) return override.effort;
	if (panelDefault !== void 0 && offered.includes(panelDefault)) return panelDefault;
	return offered.find((level) => level !== "off");
}
/**
* Merge the panel catalog with the local override document.
*
* A model with no override is enabled and runs at the panel's own default, so a
* fresh install — and every model the panel adds later — needs no local entry to
* appear. An override naming a level the panel no longer declares is ignored
* rather than obeyed: the panel is the capability authority, and pinning a level
* a model cannot accept would fail every request.
*/
function buildCatalog(models, overrides) {
	return models.map((model) => {
		const override = overrides[model.id];
		const declared = declaredEffortsOf(model);
		const restricted = override?.efforts?.filter((level) => declared.includes(level)) ?? [];
		const offered = restricted.length > 0 ? restricted : declared;
		const defaultEffort = defaultEffortOf(override, offered, model.defaultEffort !== void 0 && isThinkingLevel(model.defaultEffort) ? model.defaultEffort : void 0);
		return {
			id: model.id,
			name: model.name,
			region: regionOfModel(model.id),
			...model.description === void 0 ? {} : { description: model.description },
			...model.vendor === void 0 ? {} : { vendor: model.vendor },
			...model.credits === void 0 ? {} : { credits: model.credits },
			contextLength: model.contextLength,
			maxOutputTokens: model.maxOutputTokens,
			declaredEfforts: declared,
			efforts: offered,
			...defaultEffort === void 0 ? {} : { defaultEffort },
			canDisableThinking: model.canDisableThinking,
			supportsImages: model.supportsImages,
			supportsReasoning: model.supportsReasoning,
			onlyReasoning: model.onlyReasoning,
			tags: model.tags,
			enabled: override?.enabled !== false
		};
	}).sort((left, right) => {
		const rank = regionRank(left.region) - regionRank(right.region);
		if (rank !== 0) return rank;
		return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
	});
}
/** Display order of the two realms: domestic first, international second. */
function regionRank(region) {
	return region === "cn" ? 0 : 1;
}
/** Ids the user has hidden locally — what the picker filters out. */
function hiddenIds(catalog) {
	return catalog.filter((model) => !model.enabled).map((model) => model.id);
}
/** Every id the picker should list. */
function visibleIds(catalog) {
	return catalog.filter((model) => model.enabled).map((model) => model.id);
}
/**
* The panel `models.hidden` list this plugin should push, given a catalog.
*
* The panel's own hidden list is an *authoritative reject* at the gateway, so it
* is derived from the local enabled set alone. The plugin keeps the union with
* whatever the panel hid for its own reasons: this document is the one place
* that might also carry an operator's hand-edit, and silently un-hiding a model
* somebody else disabled is worse than a slightly stale entry.
*/
function panelHiddenList(catalog, previous) {
	const local = new Set(hiddenIds(catalog));
	const kept = previous.filter((id) => !catalog.some((model) => model.id === id));
	return [.../* @__PURE__ */ new Set([...kept, ...local])].sort();
}
//#endregion
//#region src/overrides-store.ts
/**
* The local per-model override document: which models the user hid, and which
* reasoning level each one runs at.
*
* Small, synchronous, and defensive: a corrupt or version-mismatched file reads
* as "no overrides", which means every model the panel offers stays enabled and
* keeps the panel's default effort. That is the right failure direction — a
* broken preference file must not silently empty the user's model picker.
*
* @module dsh-workbuddy2api-connect/overrides-store
*/
/** Format version this build writes and accepts. */
const OVERRIDES_VERSION = 1;
/** Decode one override entry, dropping anything unusable. */
function decodeOverride(value) {
	if (!isJsonObject(value)) return void 0;
	const override = {};
	if (typeof value["enabled"] === "boolean") override.enabled = value["enabled"];
	if (isThinkingLevel(value["effort"])) override.effort = value["effort"];
	if (Array.isArray(value["efforts"])) {
		const efforts = value["efforts"].filter(isThinkingLevel);
		if (efforts.length > 0) override.efforts = efforts;
	}
	return Object.keys(override).length === 0 ? void 0 : override;
}
/** The overrides document, read and written through the shared atomic store. */
var ModelOverridesStore = class {
	path;
	constructor(path = modelOverridesPath()) {
		this.path = path;
	}
	/** Every stored override, keyed by model id. */
	all() {
		const models = readStoreDocument(this.path, OVERRIDES_VERSION, (document) => {
			if (!isJsonObject(document["models"])) return void 0;
			return document["models"];
		});
		if (models === void 0) return {};
		const decoded = {};
		for (const [id, value] of Object.entries(models)) {
			const override = decodeOverride(value);
			if (override !== void 0) decoded[id] = override;
		}
		return decoded;
	}
	/** One model's override, when it has one. */
	get(id) {
		return this.all()[id];
	}
	/**
	* Apply a patch to one model.
	*
	* `enabled: true`, `effort: undefined` and `efforts: []` all mean "back to the
	* panel's answer": the entry is pruned instead of stored, so the document only
	* ever holds facts that differ from the panel. That keeps a later panel change
	* (a new default level, a removed capability) visible instead of masked by a
	* stale local copy.
	*/
	set(id, patch) {
		const models = this.all();
		const next = { ...models[id] };
		if (patch.enabled !== void 0) {
			if (patch.enabled) delete next.enabled;
			else next.enabled = false;
		}
		if (patch.effort !== void 0) {
			if (patch.effort === null) delete next.effort;
			else next.effort = patch.effort;
		}
		if (patch.efforts !== void 0) {
			if (patch.efforts.length === 0) delete next.efforts;
			else next.efforts = patch.efforts;
		}
		if (Object.keys(next).length === 0) delete models[id];
		else models[id] = next;
		this.write(models);
		return Object.keys(next).length === 0 ? void 0 : next;
	}
	/** Enable or hide every model the catalog currently lists. */
	setAll(catalog, enabled) {
		const models = this.all();
		for (const model of catalog) {
			const next = { ...models[model.id] };
			if (enabled) delete next.enabled;
			else next.enabled = false;
			if (Object.keys(next).length === 0) delete models[model.id];
			else models[model.id] = next;
		}
		this.write(models);
	}
	/** Replace the whole document (used by tests and by a reset action). */
	write(models) {
		writeStoreDocument(this.path, {
			version: OVERRIDES_VERSION,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			models
		});
	}
};
//#endregion
//#region src/panel-client.ts
/**
* Typed client for a local `workbuddy2api-panel` (`/panel/api/*`).
*
* Everything the manager surface needs goes through here: the account pool
* overview, the live model catalog, the panel configuration document, the OAuth
* account-add flow, and the per-account operations. The panel is a Go process
* on loopback that speaks the same OpenAI-compatible wire as `/v1`; this module
* owns only its admin API.
*
* Two policies:
*
* - **Never throw on a shape surprise.** A panel behind an older revision, a
*   proxy that answered HTML, or a field that moved all degrade to an empty or
*   partial value plus a diagnosable message, because the surfaces that read
*   this are status pages — a strict decoder would turn "one field missing"
*   into "the whole plugin is down".
* - **Redact on the way out.** Error text can echo a URL with a query string;
*   `safeMessage` strips token-shaped material before it reaches the browser.
*
* @module dsh-workbuddy2api-connect/panel-client
*/
/** One diagnosable panel failure. */
var PanelError = class extends Error {
	kind;
	status;
	constructor(message, kind, status) {
		super(message);
		this.kind = kind;
		this.status = status;
		this.name = "PanelError";
	}
};
/** Largest body accepted from the panel; catalogs are large, nothing else is. */
const MAX_RESPONSE_BYTES = 4194304;
/** Default admin request timeout. */
const REQUEST_TIMEOUT_MS = 2e4;
/** The catalog endpoint queries the upstream and is allowed to take longer. */
const CATALOG_TIMEOUT_MS = 6e4;
/** Redact token-shaped content before a message crosses to the browser. */
function safeMessage(error) {
	return (error instanceof Error ? error.message : String(error)).replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted token]").replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, "$1[redacted]").slice(0, 400);
}
/** Normalize a user-supplied panel URL into an origin. */
function normalizePanelUrl(raw) {
	const trimmed = raw.trim();
	const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
	let parsed;
	try {
		parsed = new URL(withScheme);
	} catch {
		throw new PanelError(`面板地址无法解析：${raw}`, "shape");
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new PanelError("面板地址必须是 http 或 https", "shape");
	let pathname = parsed.pathname.replace(/\/+$/, "");
	pathname = pathname.replace(/\/(v1|panel)$/i, "");
	return `${parsed.protocol}//${parsed.host}${pathname}`;
}
/** Read a numeric field tolerantly. */
function num$1(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
/** Read a string field tolerantly. */
function str(value) {
	return typeof value === "string" && value !== "" ? value : void 0;
}
/** Read a boolean flag, defaulting to false. */
function flag(value) {
	return value === true;
}
/** Read a time-typed field, dropping Go's zero value. */
function timeField(value) {
	const text = str(value);
	if (text === void 0 || text.startsWith("0001-01-01")) return void 0;
	return text;
}
/** A string list; anything else is an empty list. */
function strList(value) {
	return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
/** Decode one account row. */
function parseAccount(value) {
	if (!isJsonObject(value)) return void 0;
	const uid = str(value["uid"]);
	if (uid === void 0) return void 0;
	const usage = isJsonObject(value["token_usage"]) ? value["token_usage"] : void 0;
	const rateLimited = Array.isArray(value["rate_limited_models"]) ? value["rate_limited_models"].flatMap((entry) => {
		if (!isJsonObject(entry)) return [];
		const model = str(entry["model"]);
		if (model === void 0) return [];
		const unlockAt = timeField(entry["unlock_at"]);
		return [unlockAt === void 0 ? { model } : {
			model,
			unlockAt
		}];
	}) : [];
	return {
		uid,
		nickname: str(value["nickname"]) ?? uid.slice(0, 8),
		realm: str(value["realm"]) ?? "cn",
		...num$1(value["credits"]) === void 0 ? {} : { credits: num$1(value["credits"]) },
		...num$1(value["credits_total"]) === void 0 ? {} : { creditsTotal: num$1(value["credits_total"]) },
		...num$1(value["credits_expiring"]) === void 0 ? {} : { creditsExpiring: num$1(value["credits_expiring"]) },
		...timeField(value["credits_earliest_expiry"]) === void 0 ? {} : { earliestExpiry: timeField(value["credits_earliest_expiry"]) },
		disabled: flag(value["disabled"]),
		...str(value["disabled_reason"]) === void 0 ? {} : { disabledReason: str(value["disabled_reason"]) },
		paused: flag(value["paused"]),
		cooling: flag(value["cooling"]),
		...timeField(value["until"]) === void 0 ? {} : { coolingUntil: timeField(value["until"]) },
		...str(value["cool_kind"]) === void 0 ? {} : { coolingKind: str(value["cool_kind"]) },
		enterprise: flag(value["enterprise"]),
		...timeField(value["token_expires_at"]) === void 0 ? {} : { tokenExpiresAt: timeField(value["token_expires_at"]) },
		hasRefreshToken: flag(value["has_refresh_token"]),
		checkinDone: flag(value["checkin_done"]),
		successCount: num$1(value["success_count"]) ?? 0,
		errTotal: num$1(value["err_total"]) ?? 0,
		failStreak: num$1(value["consecutive_fails"]) ?? 0,
		inFlight: num$1(value["in_flight"]) ?? 0,
		...timeField(value["last_success"]) === void 0 ? {} : { lastSuccess: timeField(value["last_success"]) },
		...timeField(value["last_err"]) === void 0 ? {} : { lastErr: timeField(value["last_err"]) },
		...usage === void 0 ? {} : {
			...str(usage["last_model"]) === void 0 ? {} : { lastModel: str(usage["last_model"]) },
			...num$1(usage["request_count"]) === void 0 ? {} : { requestCount: num$1(usage["request_count"]) },
			...num$1(usage["total_tokens"]) === void 0 ? {} : { totalTokens: num$1(usage["total_tokens"]) },
			...num$1(usage["last_latency_ms"]) === void 0 ? {} : { lastLatencyMs: num$1(usage["last_latency_ms"]) }
		},
		rateLimitedModels: rateLimited
	};
}
/** Decode one model row. */
function parseModel(value) {
	if (!isJsonObject(value)) return void 0;
	const id = str(value["id"]);
	if (id === void 0) return void 0;
	return {
		id,
		name: str(value["name"]) ?? id,
		...str(value["description"]) === void 0 ? {} : { description: str(value["description"]) },
		...str(value["vendor"]) === void 0 ? {} : { vendor: str(value["vendor"]) },
		...str(value["credits"]) === void 0 ? {} : { credits: str(value["credits"]) },
		contextLength: num$1(value["context_length"]) ?? 0,
		maxOutputTokens: num$1(value["max_output_tokens"]) ?? 0,
		supportedEfforts: strList(value["supported_efforts"]),
		...str(value["default_effort"]) === void 0 ? {} : { defaultEffort: str(value["default_effort"]) },
		canDisableThinking: flag(value["can_disable_thinking"]),
		supportsImages: flag(value["supports_images"]),
		supportsReasoning: flag(value["supports_reasoning"]),
		onlyReasoning: flag(value["only_reasoning"]),
		tags: strList(value["tags"])
	};
}
/** The panel admin client. */
var PanelClient = class {
	endpoint;
	constructor(endpoint) {
		this.endpoint = endpoint;
	}
	/** Current origin. */
	baseUrl() {
		return this.endpoint().baseUrl;
	}
	/** The OpenAI-compatible base URL the route points at. */
	v1BaseUrl() {
		return `${this.baseUrl()}/v1`;
	}
	/** Request one admin path and decode its JSON object body. */
	async request(path, init = {}) {
		const { baseUrl, apiKey } = this.endpoint();
		const url = `${baseUrl}/panel/api${path}`;
		const headers = { Accept: "application/json" };
		if (apiKey !== "") headers["Authorization"] = `Bearer ${apiKey}`;
		let body;
		if (init.form !== void 0) body = init.form;
		else if (init.body !== void 0) {
			headers["Content-Type"] = "application/json";
			body = JSON.stringify(init.body);
		}
		let response;
		try {
			response = await fetch(url, {
				method: init.method ?? (body === void 0 ? "GET" : "POST"),
				headers,
				...body === void 0 ? {} : { body },
				signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS)
			});
		} catch (error) {
			throw new PanelError(`无法连接面板 ${baseUrl}：${safeMessage(error)}`, "network");
		}
		const text = await response.text().catch(() => "");
		if (!response.ok) {
			const decoded = text === "" ? void 0 : (() => {
				try {
					return JSON.parse(text);
				} catch {
					return;
				}
			})();
			const detail = isJsonObject(decoded) ? str(decoded["error"]) ?? str(decoded["message"]) : void 0;
			const kind = response.status === 401 || response.status === 403 ? "auth" : "http";
			throw new PanelError(detail ?? `面板返回 HTTP ${response.status}${text === "" ? "" : `：${text.slice(0, 200)}`}`, kind, response.status);
		}
		if (text.length > MAX_RESPONSE_BYTES) throw new PanelError("面板响应体过大", "shape");
		if (text.trim() === "") return {};
		let parsed;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new PanelError("面板响应不是 JSON（地址是否指向了别的服务？）", "shape");
		}
		if (!isJsonObject(parsed)) throw new PanelError("面板响应不是 JSON 对象", "shape");
		return parsed;
	}
	/** The account pool overview. */
	async overview() {
		const body = await this.request("/overview", { timeoutMs: 3e3 });
		const accounts = Array.isArray(body["accounts"]) ? body["accounts"].flatMap((entry) => {
			const account = parseAccount(entry);
			return account === void 0 ? [] : [account];
		}) : [];
		return {
			...str(body["version"]) === void 0 ? {} : { version: str(body["version"]) },
			...num$1(body["uptime_sec"]) === void 0 ? {} : { uptimeSec: num$1(body["uptime_sec"]) },
			authRequired: flag(body["auth_required"]),
			...str(body["redis_mode"]) === void 0 ? {} : { redisMode: str(body["redis_mode"]) },
			total: num$1(body["total"]) ?? accounts.length,
			healthy: num$1(body["healthy"]) ?? 0,
			cooling: num$1(body["cooling"]) ?? 0,
			disabled: num$1(body["disabled"]) ?? 0,
			paused: num$1(body["paused"]) ?? 0,
			inFlightFull: flag(body["in_flight_full"]),
			accounts,
			...num$1(body["balance_refresh_sec"]) === void 0 ? {} : { balanceRefreshSec: num$1(body["balance_refresh_sec"]) },
			...timeField(body["balance_refreshed_at"]) === void 0 ? {} : { balanceRefreshedAt: timeField(body["balance_refreshed_at"]) }
		};
	}
	/** The live model catalog (each entry's id is already realm-prefixed). */
	async models() {
		const body = await this.request("/models", { timeoutMs: CATALOG_TIMEOUT_MS });
		if (!Array.isArray(body["models"])) throw new PanelError("面板模型列表格式不符", "shape");
		return body["models"].flatMap((entry) => {
			const model = parseModel(entry);
			return model === void 0 ? [] : [model];
		});
	}
	/** The panel configuration document, plus the hidden-model list it carries. */
	async config() {
		const body = await this.request("/config");
		const config = isJsonObject(body["config"]) ? body["config"] : void 0;
		if (config === void 0) throw new PanelError("面板配置格式不符", "shape");
		const models = isJsonObject(config["models"]) ? config["models"] : void 0;
		return {
			raw: config,
			hidden: models === void 0 ? [] : strList(models["hidden"])
		};
	}
	/** Save a whole configuration document (the panel validates and hot-applies it). */
	async saveConfig(config) {
		const body = await this.request("/config", {
			method: "POST",
			body: config
		});
		const restartRequired = strList(body["restart_required"]);
		return {
			ok: body["ok"] !== false,
			...restartRequired.length === 0 ? {} : { restartRequired }
		};
	}
	/** Replace the panel's hidden-model list, preserving every other field. */
	async saveHidden(hidden) {
		const document = await this.config();
		const models = isJsonObject(document.raw["models"]) ? { ...document.raw["models"] } : {};
		const next = {
			...document.raw,
			models: {
				...models,
				hidden: [...hidden]
			}
		};
		return this.saveConfig(next);
	}
	/** Begin an OAuth account add; returns the URL the user opens. */
	async loginStart(realm) {
		const body = await this.request("/login/start", {
			method: "POST",
			body: { realm }
		});
		const url = str(body["url"]);
		const state = str(body["state"]);
		if (url === void 0 || state === void 0) throw new PanelError("面板未返回登录地址", "shape");
		return {
			url,
			state,
			realm: str(body["realm"]) ?? realm
		};
	}
	/** Poll one in-flight add. */
	async loginPoll(state) {
		const body = await this.request(`/login/poll?state=${encodeURIComponent(state)}`);
		if (body["done"] === true) return {
			done: true,
			...str(body["uid"]) === void 0 ? {} : { uid: str(body["uid"]) },
			...str(body["nickname"]) === void 0 ? {} : { nickname: str(body["nickname"]) }
		};
		return {
			done: false,
			...str(body["message"]) === void 0 ? {} : { message: str(body["message"]) }
		};
	}
	/** Login regions the panel offers for the international realm. */
	async regions() {
		const body = await this.request("/login/regions");
		if (!Array.isArray(body["regions"])) return [];
		return body["regions"].flatMap((entry) => {
			if (!isJsonObject(entry)) return [];
			const code = str(entry["code"]);
			if (code === void 0) return [];
			return [{
				code,
				name: str(entry["name"]) ?? code
			}];
		});
	}
	/** One per-account operation. */
	async accountOp(uid, op) {
		const body = await this.request(`/accounts/${encodeURIComponent(uid)}/${op}`, { method: "POST" });
		return {
			ok: body["ok"] !== false,
			...str(body["message"]) === void 0 ? {} : { message: str(body["message"]) }
		};
	}
	/** Bulk operation across every account. */
	async bulkOp(op) {
		const body = await this.request(`/${op}`, { method: "POST" });
		return {
			ok: body["ok"] !== false,
			...str(body["message"]) === void 0 ? {} : { message: str(body["message"]) }
		};
	}
	/** Import accounts in the cockpit export shape (`uid`/`access_token`/`refresh_token`). */
	async importAccounts(accounts) {
		const form = new FormData();
		form.append("file", new Blob([JSON.stringify(accounts)], { type: "application/json" }), "accounts.json");
		const body = await this.request("/import/cockpit", {
			method: "POST",
			form,
			timeoutMs: 6e4
		});
		const errors = strList(body["errors"]);
		return {
			ok: body["ok"] !== false,
			...num$1(body["imported"]) === void 0 ? {} : { imported: num$1(body["imported"]) },
			...num$1(body["skipped"]) === void 0 ? {} : { skipped: num$1(body["skipped"]) },
			...errors.length === 0 ? {} : { errors }
		};
	}
};
//#endregion
//#region src/settings-store.ts
/**
* Connection settings written by the settings page: where the panel lives, the
* key to reach it, how often to re-read it, and whether a local hide is also
* pushed to the panel's own `models.hidden` list.
*
* Separate from the Cordis composition config on purpose. The composition fields
* are the *defaults* an install ships; this document is what the user changed,
* and it is read on every use so a save takes effect on the next poll rather
* than at the next restart — the same live-read policy the reference plugins use
* for their volatile fields, without needing the host's settings write seam.
*
* @module dsh-workbuddy2api-connect/settings-store
*/
/** Format version this build writes and accepts. */
const SETTINGS_VERSION = 1;
/** The defaults an install ships. */
const DEFAULT_CONNECTION = {
	panelUrl: "http://127.0.0.1:7863",
	apiKey: "",
	refreshSeconds: 30,
	syncHiddenToPanel: true
};
/** Clamp a poll interval into the range the surfaces tolerate. */
function clampRefreshSeconds(value) {
	if (!Number.isFinite(value)) return DEFAULT_CONNECTION.refreshSeconds;
	return Math.min(600, Math.max(10, Math.round(value)));
}
/** Read/patch the connection document. */
var ConnectionStore = class {
	path;
	defaults;
	constructor(path = connectionSettingsPath(), defaults = DEFAULT_CONNECTION) {
		this.path = path;
		this.defaults = defaults;
	}
	/** The stored document layered over the install defaults. */
	current() {
		const stored = readStoreDocument(this.path, SETTINGS_VERSION, (document) => ({
			panelUrl: typeof document["panelUrl"] === "string" ? document["panelUrl"] : void 0,
			apiKey: typeof document["apiKey"] === "string" ? document["apiKey"] : void 0,
			refreshSeconds: typeof document["refreshSeconds"] === "number" ? document["refreshSeconds"] : void 0,
			syncHiddenToPanel: typeof document["syncHiddenToPanel"] === "boolean" ? document["syncHiddenToPanel"] : void 0
		}));
		return {
			panelUrl: stored?.panelUrl !== void 0 && stored.panelUrl !== "" ? safeNormalize(stored.panelUrl) ?? this.defaults.panelUrl : this.defaults.panelUrl,
			apiKey: stored?.apiKey ?? this.defaults.apiKey,
			refreshSeconds: clampRefreshSeconds(stored?.refreshSeconds ?? this.defaults.refreshSeconds),
			syncHiddenToPanel: stored?.syncHiddenToPanel ?? this.defaults.syncHiddenToPanel
		};
	}
	/** Merge a patch into the stored document. */
	patch(patch) {
		const current = this.current();
		const next = {
			panelUrl: patch.panelUrl === void 0 ? current.panelUrl : safeNormalize(patch.panelUrl) ?? current.panelUrl,
			apiKey: patch.apiKey === void 0 ? current.apiKey : patch.apiKey.trim(),
			refreshSeconds: clampRefreshSeconds(patch.refreshSeconds ?? current.refreshSeconds),
			syncHiddenToPanel: patch.syncHiddenToPanel ?? current.syncHiddenToPanel
		};
		writeStoreDocument(this.path, {
			version: SETTINGS_VERSION,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			...next
		});
		return next;
	}
};
/** Normalize a panel URL, answering `undefined` instead of throwing. */
function safeNormalize(raw) {
	try {
		return normalizePanelUrl(raw);
	} catch {
		return;
	}
}
//#endregion
//#region src/adapter.ts
/**
* The `workbuddy2api` route: one pi-ai provider pointed at a local
* `workbuddy2api-panel`'s OpenAI-compatible `/v1` endpoint.
*
* The panel is a normal OpenAI-compatible gateway, so pi-ai's
* `openai-completions` protocol does the wire work — streaming, tool calls,
* usage. What this module adds is the two things a hand-managed gateway cannot
* state by itself:
*
* 1. **A live catalog.** The descriptors are rebuilt from the panel's model list
*    on every read, so a model the panel added (or a capability it changed)
*    appears without a restart.
* 2. **Local selection.** Hidden models are filtered from `listModels` only —
*    never from model *resolution* — so a session already using a model keeps
*    working after the user hides it, exactly like the reference provider.
*
* Reasoning levels ride the model descriptor's `thinkingLevelMap`, which is what
* makes the harness's own effort selector appear: the panel declares which levels
* a model accepts (`supported_efforts`) and whether thinking can be switched off,
* and the local override may narrow that set and choose the default.
*
* @module dsh-workbuddy2api-connect/adapter
*/
/** Provider route this bundle owns by default. */
const WORKBUDDY2API_PROVIDER = "workbuddy2api";
/** Provider idle ceiling while one stream read is outstanding. */
const WORKBUDDY2API_STREAM_IDLE_TIMEOUT_MS = 3e5;
/** No per-token pricing is knowable behind a subscription gateway; report zero. */
const NO_COST = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0
};
/**
* Inert pi-ai auth plane.
*
* The route authenticates with the panel's `api_key`, resolved per request from
* the plugin's connection document. pi-ai's own credential lifecycle and ambient
* discovery must never manufacture a second credential for it.
*/
const INERT_AUTH = {
	credentials: {
		async read() {},
		async list() {
			return [];
		},
		async modify() {
			throw new Error("dsh-workbuddy2api-connect: this route has no pi-ai credential lifecycle");
		},
		async delete() {}
	},
	authContext: {
		async env() {},
		async fileExists() {
			return false;
		}
	}
};
/** Human-readable label for one level. */
function levelLabel(level) {
	return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}
/**
* Whether an error is the adapter's "this route does not know the model" failure.
*
* Structural rather than `instanceof LlmError`: a profile can hold two copies of
* `dsh-llm`, and a class identity check would then miss the host's own error.
*/
function isUnknownModel(error) {
	return typeof error === "object" && error !== null && error.code === "UNKNOWN_MODEL";
}
/**
* Translate one model's offered levels into pi-ai's `thinkingLevelMap`.
*
* Every level is pinned explicitly — a supported one to its wire spelling, the
* rest to `null` — because `null` is what removes a level from the selector.
* A model with no offered level carries no `thinkingLevelMap` at all: pi-ai then
* reads a falsy `reasoning` as "off only", which is the honest description of a
* gateway model whose levels nobody declared.
*/
function thinkingFields(model) {
	const offered = new Set(model.efforts);
	if (!model.supportsReasoning || offered.size === 0) return { reasoning: false };
	return {
		reasoning: true,
		thinkingLevelMap: {
			off: offered.has("off") ? "off" : null,
			minimal: null,
			low: offered.has("low") ? "low" : null,
			medium: offered.has("medium") ? "medium" : null,
			high: offered.has("high") ? "high" : null,
			xhigh: offered.has("xhigh") ? "xhigh" : null,
			max: offered.has("max") ? "max" : null
		}
	};
}
/** The reasoning block one catalog row publishes, when it has selectable levels. */
function reasoningOf(model) {
	if (!model.supportsReasoning || model.efforts.length === 0) return void 0;
	return {
		efforts: model.efforts.map((level) => ({
			id: ReasoningEffortId(level),
			name: levelLabel(level)
		})),
		...model.defaultEffort === void 0 ? {} : { defaultEffort: ReasoningEffortId(model.defaultEffort) }
	};
}
/** Build one pi-ai model descriptor pointing at the panel. */
function toPiModel(model, baseUrl, providerId) {
	return {
		id: model.id,
		name: model.name,
		api: "openai-completions",
		provider: providerId,
		baseUrl,
		input: model.supportsImages ? ["text", "image"] : ["text"],
		...thinkingFields(model),
		cost: NO_COST,
		contextWindow: model.contextLength > 0 ? model.contextLength : 262144,
		maxTokens: model.maxOutputTokens > 0 ? model.maxOutputTokens : 32768,
		compat: { maxTokensField: "max_tokens" }
	};
}
/** Look one model up in a catalog snapshot. */
function findModel(catalog, id) {
	return catalog.find((entry) => entry.id === id);
}
/**
* The route's adapter: `PiAiAdapter` plus local catalog facts.
*
* Three overrides, each answering one question the base class cannot:
* `listModels` hides locally disabled models, `resolveModel` publishes the
* narrowed level set and the chosen default, and `stream` supplies that default
* when the caller names no effort (pi-ai otherwise sends none, and the panel
* would fall back to its own default rather than the user's choice).
*/
var PanelPiAiAdapter = class extends PiAiAdapter {
	options;
	constructor(options, adapterOptions) {
		super(adapterOptions);
		this.options = options;
	}
	/**
	* Hide locally disabled models and the other realm from the picker only.
	*
	* The domestic route's provider still carries every descriptor, so a session
	* pinned to it can resolve an international model from before the split; the
	* list is what makes the two picker groups disjoint.
	*/
	async listModels(provider) {
		const models = await super.listModels(provider);
		const hidden = new Set(this.options.hidden());
		const region = this.options.regionOfRoute(provider);
		return models.filter((model) => !hidden.has(model.id) && regionOfModel(model.id) === region);
	}
	/** Publish the effective level set and default for one model. */
	async resolveModel(provider, model, signal) {
		try {
			return this.decorate(await super.resolveModel(provider, model, signal), model);
		} catch (error) {
			const entry = findModel(this.options.catalog(), model);
			if (!isUnknownModel(error) || entry === void 0) throw error;
			this.options.invalidate?.();
			try {
				return this.decorate(await super.resolveModel(provider, model, signal), model);
			} catch {
				const reasoning = reasoningOf(entry);
				return {
					provider,
					id: entry.id,
					name: entry.name,
					...entry.description === void 0 ? {} : { description: entry.description },
					inputModalities: entry.supportsImages ? ["text", "image"] : ["text"],
					context: { contextWindow: entry.contextLength },
					...reasoning === void 0 ? {} : { reasoning }
				};
			}
		}
	}
	/**
	* Prepare one call, rebuilding the adapter snapshot once when the route has
	* not yet learned a model the catalog already serves.
	*
	* `prepareCall` is the path the session takes before a request; without this
	* retry a model added after registration stays unusable until the next full
	* adapter invalidation.
	*/
	async prepareCall(provider, model, signal) {
		try {
			return await super.prepareCall(provider, model, signal);
		} catch (error) {
			if (!isUnknownModel(error) || findModel(this.options.catalog(), model) === void 0) throw error;
			this.options.invalidate?.();
			return super.prepareCall(provider, model, signal);
		}
	}
	/** Stamp the user's default effort onto a request that names none. */
	stream(options) {
		try {
			if (options.reasoningEffort === void 0) {
				const entry = findModel(this.options.catalog(), options.model);
				const fallback = entry?.defaultEffort;
				if (entry !== void 0 && fallback !== void 0 && entry.efforts.includes(fallback)) return super.stream({
					...options,
					reasoningEffort: ReasoningEffortId(fallback)
				});
			}
			return super.stream(options);
		} catch (error) {
			if (!isUnknownModel(error) || findModel(this.options.catalog(), options.model) === void 0) throw error;
			this.options.invalidate?.();
			return super.stream(options);
		}
	}
	/** Attach the catalog's selectable levels to one resolved model. */
	decorate(resolved, model) {
		const entry = findModel(this.options.catalog(), model);
		const reasoning = entry === void 0 ? void 0 : reasoningOf(entry);
		return reasoning === void 0 ? resolved : {
			...resolved,
			reasoning
		};
	}
};
/**
* Assemble the route.
*
* The provider's `getModels` and every descriptor's `baseUrl` are read live, so
* a URL or key change reaches the next request without rebuilding anything. The
* profile is constructed by hand because `dsh-llm-pi-ai`'s own `resolveProfiles`
* is not part of its public export surface; every newly required field has to be
* adopted here explicitly.
*/
function createWorkBuddy2ApiAdapter(options) {
	const providerId = options.providerId ?? "workbuddy2api";
	const globalProviderId = options.globalProviderId ?? providerId + "-global";
	const baseName = options.displayName ?? "WorkBuddy2API";
	const cnDisplayName = baseName.endsWith(" · CN") || baseName.endsWith(" · Global") ? baseName : baseName + " · CN";
	const globalDisplayName = options.globalDisplayName ?? (cnDisplayName.endsWith(" · CN") ? cnDisplayName.slice(0, -5) + " · Global" : cnDisplayName + " · Global");
	const auth = { apiKey: {
		name: "workbuddy2api-panel key",
		async resolve({ credential }) {
			const apiKey = credential?.key;
			return apiKey === void 0 || apiKey.length === 0 ? void 0 : {
				auth: { apiKey },
				source: "workbuddy2api-panel"
			};
		}
	} };
	const modelsFor = (route, region) => {
		const baseUrl = options.v1BaseUrl();
		return options.catalog().filter((model) => region === void 0 || model.region === region).map((model) => toPiModel(model, baseUrl, route));
	};
	/**
	* One provider per realm.
	*
	* The domestic provider keeps every descriptor so a session that selected an
	* international model before the split still resolves on its original route;
	* `listModels` is what hides the other realm from that picker group.
	*/
	const makeProvider = (id, name, models) => {
		return {
			...createProvider({
				id,
				name,
				auth,
				models: models(),
				api: openAICompletionsApi()
			}),
			getModels: models,
			getAllModels: models
		};
	};
	const cnProvider = makeProvider(providerId, cnDisplayName, () => modelsFor(providerId));
	const globalProvider = makeProvider(globalProviderId, globalDisplayName, () => modelsFor(globalProviderId, "global"));
	const providers = [{
		id: providerId,
		displayName: cnDisplayName,
		region: "cn"
	}, {
		id: globalProviderId,
		displayName: globalDisplayName,
		region: "global"
	}];
	const regionByRoute = new Map(providers.map((provider) => [provider.id, provider.region]));
	const profileFor = (id, name, piProvider) => ({
		provider: id,
		displayName: name,
		streamIdleTimeoutMs: WORKBUDDY2API_STREAM_IDLE_TIMEOUT_MS,
		retryPolicy: resolveRetryPolicy(void 0, "dsh-workbuddy2api-connect retryPolicy"),
		configuredMaxTokens: /* @__PURE__ */ new Map(),
		modelErrors: /* @__PURE__ */ new Map(),
		maxRequestImageBytes: 20971520,
		requestImagePixelBudget: 4194304,
		requestImageMaxBytes: 1048576,
		piProvider
	});
	const buildProfiles = () => /* @__PURE__ */ new Map([[providerId, profileFor(providerId, cnDisplayName, cnProvider)], [globalProviderId, profileFor(globalProviderId, globalDisplayName, globalProvider)]]);
	let profiles = buildProfiles();
	/** Replace the profile map so `PiAiAdapter` rebuilds its `Models` snapshot. */
	const invalidate = () => {
		profiles = buildProfiles();
	};
	return {
		adapter: new PanelPiAiAdapter({
			catalog: options.catalog,
			hidden: options.hidden,
			regionOfRoute: (route) => regionByRoute.get(route) ?? "cn",
			invalidate
		}, {
			profiles: () => profiles,
			auth: INERT_AUTH,
			resolveApiKey: async () => options.apiKey(),
			resolveAttachments: options.attachments === void 0 ? void 0 : () => options.attachments?.(),
			resolveImageAccess: options.imageAccess === void 0 ? void 0 : (attachments, ref) => options.imageAccess?.(attachments, ref)
		}),
		providers,
		invalidate
	};
}
//#endregion
//#region src/usage.ts
/**
* Reading the gateway's own usage ledger.
*
* The gateway writes one bucket per (hour, realm, account, model) into
* `data/usage.json`; that file is the only place a token count and a credit
* charge exist side by side, which is exactly what the overview needs to offer
* "tokens or credits" as one switch over the same history.
*
* Two rules keep this honest:
*
* 1. **A missing or unreadable ledger is empty, not an error.** The file appears
*    on the gateway's first request and is rewritten constantly; a read that
*    races a write must not fail the whole status document.
* 2. **The series is dense.** Every day of the window is present, zero-filled,
*    because a heat map with holes draws a different story than a quiet week.
*
* @module dsh-workbuddy2api-gateway/usage
*/
/** A finite non-negative number, else zero. */
function num(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
/** The bucket's day, from its `h:YYYY-MM-DDTHH` slot. */
function dayOf(bucket) {
	const slot = bucket.s;
	if (typeof slot !== "string") return void 0;
	const date = slot.slice(2, 12);
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return void 0;
	const hour = Number.parseInt(slot.slice(13, 15), 10);
	return {
		date,
		hour: Number.isFinite(hour) ? hour : 0
	};
}
/** The empty answer a missing ledger gets. */
function emptySummary(today) {
	const days = [];
	const end = Date.parse(today + "T00:00:00Z");
	for (let offset = 209; offset >= 0; offset -= 1) {
		const date = (/* @__PURE__ */ new Date(end - offset * 864e5)).toISOString().slice(0, 10);
		days.push({
			date,
			calls: 0,
			tokens: 0,
			credits: 0
		});
	}
	return {
		days,
		calls: 0,
		tokens: 0,
		credits: 0,
		activeDays: 0,
		empty: true
	};
}
/**
* Read and aggregate the ledger.
*
* @param path - the gateway's `data/usage.json`.
* @param today - `YYYY-MM-DD` anchor for the window (injectable for tests).
*/
function readUsage(path, today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
	let parsed;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return emptySummary(today);
	}
	const buckets = parsed?.buckets;
	if (!Array.isArray(buckets) || buckets.length === 0) return emptySummary(today);
	const perDay = /* @__PURE__ */ new Map();
	const perHour = /* @__PURE__ */ new Map();
	const perModel = /* @__PURE__ */ new Map();
	let calls = 0;
	let tokens = 0;
	let credits = 0;
	for (const raw of buckets) {
		if (typeof raw !== "object" || raw === null) continue;
		const bucket = raw;
		const placed = dayOf(bucket);
		if (placed === void 0) continue;
		const bucketTokens = num(bucket.ct) || num(bucket.t);
		const bucketCalls = num(bucket.q);
		const bucketCredits = num(bucket.cr);
		calls += bucketCalls;
		tokens += bucketTokens;
		credits += bucketCredits;
		const day = perDay.get(placed.date) ?? {
			date: placed.date,
			calls: 0,
			tokens: 0,
			credits: 0
		};
		day.calls += bucketCalls;
		day.tokens += bucketTokens;
		day.credits += bucketCredits;
		perDay.set(placed.date, day);
		perHour.set(placed.hour, (perHour.get(placed.hour) ?? 0) + bucketTokens);
		if (typeof bucket.m === "string" && bucket.m !== "") perModel.set(bucket.m, (perModel.get(bucket.m) ?? 0) + bucketCalls);
	}
	const days = [];
	const end = Date.parse(today + "T00:00:00Z");
	for (let offset = 209; offset >= 0; offset -= 1) {
		const date = (/* @__PURE__ */ new Date(end - offset * 864e5)).toISOString().slice(0, 10);
		days.push(perDay.get(date) ?? {
			date,
			calls: 0,
			tokens: 0,
			credits: 0
		});
	}
	let peakHour;
	let peakTokens = 0;
	for (const [hour, hourTokens] of perHour) if (hourTokens > peakTokens) {
		peakTokens = hourTokens;
		peakHour = hour;
	}
	let topModel;
	let topCalls = 0;
	for (const [model, modelCalls] of perModel) if (modelCalls > topCalls) {
		topCalls = modelCalls;
		topModel = model;
	}
	return {
		days,
		calls,
		tokens,
		credits,
		activeDays: [...perDay.values()].filter((day) => day.calls > 0).length,
		...peakHour === void 0 ? {} : { peakHour },
		...topModel === void 0 ? {} : { topModel },
		empty: false
	};
}
//#endregion
//#region src/service.ts
/**
* The plugin's live state: the supervised gateway, the merged catalog, and the
* write actions the browser surfaces perform.
*
* One service owns every mutable fact — the host row's process snapshot, the
* panel's answer, the local override document — so the status document, the
* provider's catalog, and the panel sync can never disagree. Surfaces are pure
* projections of status().
*
* Two policies matter, because they are what makes this plugin different from a
* remote control:
*
* 1. The catalog is discovered, not configured. Every successful read diffed
*    against the previous catalog produces sync.added / sync.removed /
*    sync.changed, and any difference is announced through onChange so the
*    picker re-reads. A model that appears in the gateway shows up in DSH on the
*    next poll without a restart, a settings visit, or a click.
* 2. A failed read never empties the picker. The previous catalog stays, the
*    reason is recorded, and the gateway keeps serving the models it last saw.
*
* @module dsh-workbuddy2api-gateway/service
*/
/** Format version of the cached catalog document. */
const CACHE_VERSION = 2;
/** The realms the gateway serves, in the order the picker shows them. */
const REALMS = ["cn", "global"];
/**
* How many reads in a row may omit a realm before its models are dropped.
*
* The gateway answers /panel/api/models one realm at a time and silently leaves
* out a realm it could not read (no available account, upstream fetch empty).
* The answer is still 200 and still carries the other realm, so one read is not
* evidence that the missing realm's models are gone — three in a row is.
*/
const REALM_GAP_TOLERANCE = 3;
/** Map one panel account onto the browser projection. */
function webAccount(account) {
	const status = account.disabled ? "disabled" : account.cooling ? "cooling" : account.paused ? "paused" : "active";
	return {
		uid: account.uid,
		nickname: account.nickname,
		realm: account.realm,
		...account.credits === void 0 ? {} : { credits: account.credits },
		...account.creditsTotal === void 0 ? {} : { creditsTotal: account.creditsTotal },
		...account.earliestExpiry === void 0 ? {} : { earliestExpiry: account.earliestExpiry },
		status,
		...account.coolingUntil === void 0 ? {} : { coolingUntil: account.coolingUntil },
		...account.disabledReason === void 0 ? {} : { disabledReason: account.disabledReason },
		...account.tokenExpiresAt === void 0 ? {} : { tokenExpiresAt: account.tokenExpiresAt },
		hasRefreshToken: account.hasRefreshToken,
		checkinDone: account.checkinDone,
		successCount: account.successCount,
		failStreak: account.failStreak,
		...account.lastSuccess === void 0 ? {} : { lastSuccess: account.lastSuccess },
		...account.lastModel === void 0 ? {} : { lastModel: account.lastModel },
		...account.requestCount === void 0 ? {} : { requestCount: account.requestCount },
		...account.totalTokens === void 0 ? {} : { totalTokens: account.totalTokens },
		rateLimitedModels: account.rateLimitedModels.length,
		enterprise: account.enterprise
	};
}
/**
* One credential in the cockpit export shape the panel's import endpoint reads.
*
* Only the renewable credentials take this door; `expires_at` is milliseconds
* there (the export's own unit), while the credential carries seconds.
*/
function cockpitRecord(credential) {
	return {
		uid: credential.uid,
		nickname: credential.nickname,
		access_token: credential.accessToken,
		refresh_token: credential.refreshToken,
		expires_at: credential.expiresAt * 1e3,
		domain: credential.domain
	};
}
/** Map one merged model onto the browser projection. */
function webModel(model) {
	return {
		id: model.id,
		name: model.name,
		region: model.region,
		...model.description === void 0 ? {} : { description: model.description },
		...model.vendor === void 0 ? {} : { vendor: model.vendor },
		...model.credits === void 0 ? {} : { credits: model.credits },
		contextLength: model.contextLength,
		maxOutputTokens: model.maxOutputTokens,
		efforts: model.efforts,
		...model.defaultEffort === void 0 ? {} : { defaultEffort: model.defaultEffort },
		enabled: model.enabled,
		canDisableThinking: model.canDisableThinking,
		supportsImages: model.supportsImages,
		supportsReasoning: model.supportsReasoning,
		onlyReasoning: model.onlyReasoning,
		tags: model.tags
	};
}
/** A descriptor's stable identity, for change detection across polls. */
function fingerprint(model) {
	return [
		model.id,
		model.name,
		model.region,
		String(model.contextLength),
		String(model.maxOutputTokens),
		model.efforts.join(","),
		model.defaultEffort ?? "",
		model.supportsImages ? "i" : "",
		model.supportsReasoning ? "r" : "",
		model.canDisableThinking ? "d" : "",
		model.credits ?? ""
	].join("|");
}
/** Whether a process action reached a usable gateway. */
function gatewayActionOk(state) {
	return state === "running" || state === "starting" || state === "external";
}
/** A status document that never lies about a missing host row. */
function fallbackGatewayStatus(port) {
	return {
		state: "host-unavailable",
		managed: false,
		host: "unavailable",
		configPath: gatewayConfigPath(),
		workdir: gatewayWorkdir(),
		port,
		restarts: 0,
		autoStart: false,
		log: [],
		error: "the host gateway row is not loaded"
	};
}
/** The port the panel URL names, or the gateway default. */
function portFromPanelUrl(url) {
	try {
		const parsed = new URL(url);
		const port = Number(parsed.port);
		return Number.isInteger(port) && port > 0 ? port : 7863;
	} catch {
		return 7863;
	}
}
/** The pinned server shape when the host row is missing. */
/** Kernel state before the host row is loaded. */
function fallbackKernelUpdate() {
	return {
		cadence: "hourly",
		available: false,
		installing: false,
		error: "the host gateway row is not loaded"
	};
}
function fallbackServerStatus() {
	try {
		const manifest = serverManifest();
		return {
			platform: process.platform,
			arch: process.arch,
			supported: false,
			version: manifest.version,
			apiVersion: manifest.apiVersion,
			installed: false,
			sha256: "",
			size: 0,
			downloadSize: 0,
			releaseUrl: "",
			download: {
				state: "idle",
				received: 0,
				total: 0
			},
			error: "the host gateway row is not loaded"
		};
	} catch {
		return {
			platform: process.platform,
			arch: process.arch,
			supported: false,
			version: "unknown",
			apiVersion: 0,
			installed: false,
			sha256: "",
			size: 0,
			downloadSize: 0,
			releaseUrl: "",
			download: {
				state: "idle",
				received: 0,
				total: 0
			},
			error: "the host gateway row is not loaded"
		};
	}
}
/**
* The plugin's one mutable state holder.
*
* Reads are serialized: two surfaces polling at once share one panel request
* instead of racing two, which matters because a write can land between them and
* a racing read would publish the pre-write overview as if it were current.
*/
var WorkBuddy2ApiService = class {
	options;
	snapshot = { models: [] };
	catalog = [];
	sync;
	login;
	loginDone;
	loginStartedAt;
	clientProbe = {};
	usageCache;
	inFlight;
	/** Whether the last gateway read actually reached it. */
	lastReadOk = false;
	emptyModelReads = 0;
	/** Consecutive reads that omitted a realm, keyed by realm. */
	realmGaps = /* @__PURE__ */ new Map();
	disposed = false;
	/** Provider ownership, refreshed once the llm service resolves both routes. */
	routes;
	constructor(options) {
		this.options = options;
		this.sync = {
			added: [],
			removed: [],
			changed: [],
			autoRegister: true
		};
		this.routes = {
			cn: {
				id: options.providerId,
				owned: options.providerOwned,
				...options.conflictWith === void 0 ? {} : { conflict: options.conflictWith }
			},
			global: {
				id: options.globalProviderId ?? options.providerId + "-global",
				owned: options.globalProviderOwned ?? true,
				...options.globalConflictWith === void 0 ? {} : { conflict: options.globalConflictWith }
			}
		};
		this.restore();
	}
	/** Publish the routes the host actually allowed after adapter registration. */
	setProviderRoutes(cn, global) {
		this.routes = {
			cn,
			global
		};
	}
	/** The cache document this plugin writes. */
	get cachePath() {
		return this.options.cachePath ?? catalogCachePath();
	}
	/** Load the last catalog so a cold boot has models before the first poll. */
	restore() {
		const stored = readStoreDocument(this.cachePath, CACHE_VERSION, (document) => ({
			models: Array.isArray(document["models"]) ? document["models"] : void 0,
			updatedAt: typeof document["updatedAt"] === "string" ? document["updatedAt"] : void 0
		}));
		if (stored?.models === void 0) return;
		const catalog = stored.models.filter((entry) => typeof entry?.id === "string").map((entry) => ({
			...entry,
			region: entry.region === "global" ? "global" : regionOfModel(entry.id)
		}));
		if (catalog.length === 0) return;
		this.catalog = catalog;
		if (stored.updatedAt !== void 0) this.sync = {
			...this.sync,
			lastSyncedAt: stored.updatedAt
		};
	}
	/** Persist the catalog for the next boot. */
	persist() {
		writeStoreDocument(this.cachePath, {
			version: CACHE_VERSION,
			updatedAt: this.sync.lastSyncedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
			models: this.catalog
		});
	}
	/** The merged catalog, for the route's descriptors. */
	catalogModels() {
		return this.catalog;
	}
	/** The host row, resolved at call time so a reload cannot pin a dead one. */
	host() {
		return this.options.host();
	}
	/** Read the gateway once and fold the answer into the snapshot. */
	async refresh() {
		if (this.inFlight !== void 0) return this.inFlight;
		this.inFlight = this.read().finally(() => {
			this.inFlight = void 0;
		});
		return this.inFlight;
	}
	/** The read itself, kept separate so refresh can serialize it. */
	async read() {
		if (!this.options.connection.current().panelUrl) {
			this.lastReadOk = false;
			this.snapshot = {
				...this.snapshot,
				error: "no gateway address configured"
			};
			return;
		}
		const [overview, models] = await Promise.allSettled([this.options.client.overview(), this.options.client.models()]);
		if (overview.status === "fulfilled" && models.status === "fulfilled") {
			this.lastReadOk = true;
			this.snapshot = {
				overview: overview.value,
				models: models.value,
				at: (/* @__PURE__ */ new Date()).toISOString()
			};
			this.merge(models.value);
			return;
		}
		this.lastReadOk = false;
		const failed = overview.status === "rejected" ? overview : models;
		const reason = failed.status === "rejected" ? safeMessage(failed.reason) : "gateway read failed";
		this.snapshot = {
			...this.snapshot,
			error: reason
		};
		this.options.warn?.("workbuddy2api-gateway: gateway read failed", failed.status === "rejected" ? failed.reason : void 0);
	}
	/** Diff the gateway's catalog against ours and publish the difference. */
	merge(models) {
		if (models.length === 0 && this.catalog.length > 0 && (this.snapshot.overview?.total ?? 0) > 0) {
			this.emptyModelReads += 1;
			if (this.emptyModelReads < 3) {
				this.snapshot = {
					...this.snapshot,
					error: "gateway reported no models; keeping the previous catalog"
				};
				return;
			}
		} else if (models.length > 0) this.emptyModelReads = 0;
		const overrides = this.options.overrides.all();
		const previous = new Map(this.catalog.map((model) => [model.id, model]));
		const merged = buildCatalog(models, overrides);
		const missing = models.length === 0 ? [] : this.realmsMissingFrom(merged);
		const held = missing.filter((region) => {
			const streak = (this.realmGaps.get(region) ?? 0) + 1;
			this.realmGaps.set(region, streak);
			return streak <= REALM_GAP_TOLERANCE;
		});
		for (const region of REALMS) if (!missing.includes(region)) this.realmGaps.delete(region);
		const next = held.length === 0 ? merged : [...merged, ...this.catalog.filter((model) => held.includes(model.region))];
		if (held.length > 0) this.snapshot = {
			...this.snapshot,
			error: "gateway returned no " + held.join(" or ") + " models; keeping the previous list"
		};
		const added = [];
		const changed = [];
		const seen = /* @__PURE__ */ new Set();
		const adoptAll = this.sync.autoRegister || previous.size === 0;
		for (const model of next) {
			seen.add(model.id);
			const before = previous.get(model.id);
			if (before === void 0) {
				if (adoptAll) added.push(model.id);
				continue;
			}
			if (fingerprint(before) !== fingerprint(model)) changed.push(model.id);
		}
		const removed = [...previous.keys()].filter((id) => !seen.has(id));
		const announce = added.length > 0 || removed.length > 0 || changed.length > 0;
		this.catalog = adoptAll ? next : next.filter((model) => previous.has(model.id));
		this.sync = {
			lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
			added: added.slice(0, 20),
			removed: removed.slice(0, 20),
			changed: changed.slice(0, 20),
			autoRegister: this.sync.autoRegister
		};
		this.persist();
		if (announce) this.options.onChange?.();
	}
	/** Realms the previous catalog knew and this read did not mention at all. */
	realmsMissingFrom(merged) {
		return REALMS.filter((region) => this.catalog.some((model) => model.region === region) && !merged.some((model) => model.region === region));
	}
	/**
	* Record that the browser half ran.
	*
	* The one fact a host process cannot otherwise see: whether the client bundle
	* was loaded and its apply executed. When the settings page is missing from the
	* navigation, this timestamp separates "never ran" from "ran and failed".
	*/
	noteClientHello(agent) {
		this.clientProbe = {
			helloAt: (/* @__PURE__ */ new Date()).toISOString(),
			...agent === void 0 ? {} : { agent }
		};
	}
	/** Turn auto-registration on or off, and re-read so the catalog follows. */
	async setAutoRegister(enabled) {
		this.sync = {
			...this.sync,
			autoRegister: enabled
		};
		if (enabled) {
			this.catalog = [];
			this.persist();
		}
		this.options.onChange?.();
		await this.refresh().catch(() => {});
		return {
			ok: true,
			status: this.status()
		};
	}
	/** The whole status document. */
	status() {
		const connection = this.options.connection.current();
		const overview = this.snapshot.overview;
		const host = this.host();
		const gateway = host?.status() ?? fallbackGatewayStatus(portFromPanelUrl(connection.panelUrl));
		const server = host?.serverStatus() ?? fallbackServerStatus();
		const connected = (gateway.state === "running" || gateway.state === "external") && this.lastReadOk;
		const enabledModels = this.catalog.filter((model) => model.enabled).length;
		const counts = {
			total: overview?.total ?? 0,
			healthy: overview?.healthy ?? 0,
			cooling: overview?.cooling ?? 0,
			disabled: overview?.disabled ?? 0,
			paused: overview?.paused ?? 0,
			models: this.catalog.length,
			enabledModels,
			hiddenModels: this.catalog.length - enabledModels
		};
		return {
			ok: true,
			version: this.options.version,
			...this.options.piAiVersion === void 0 ? {} : { piAiVersion: this.options.piAiVersion },
			provider: {
				...this.routes.cn,
				global: { ...this.routes.global }
			},
			connection: {
				panelUrl: connection.panelUrl,
				hasApiKey: connection.apiKey !== "",
				refreshSeconds: connection.refreshSeconds,
				syncHiddenToPanel: connection.syncHiddenToPanel,
				autoRegister: this.sync.autoRegister
			},
			gateway,
			server,
			kernel: host?.kernelUpdate?.() ?? fallbackKernelUpdate(),
			panel: {
				connected,
				...connected && overview?.version !== void 0 ? { version: overview.version } : {},
				...connected && overview?.uptimeSec !== void 0 ? { uptimeSec: overview.uptimeSec } : {},
				...connected && overview?.redisMode !== void 0 ? { redisMode: overview.redisMode } : {},
				authRequired: overview?.authRequired ?? connection.apiKey !== "",
				...this.snapshot.error === void 0 ? {} : { error: this.snapshot.error }
			},
			sync: this.sync,
			client: this.clientProbe,
			usage: this.usage(),
			counts,
			accounts: (overview?.accounts ?? []).map(webAccount),
			models: this.catalog.map(webModel),
			...this.snapshot.at === void 0 ? {} : { updatedAt: this.snapshot.at },
			...this.snapshot.error === void 0 ? {} : { error: this.snapshot.error },
			...this.login === void 0 ? {} : { login: this.login },
			...this.loginDone === void 0 ? {} : { loginDone: this.loginDone }
		};
	}
	/**
	* Make sure a caller that arrives early still sees data.
	*
	* The poller runs on a schedule, so the first surface to open can land between
	* two reads and stare at an empty document for a whole interval. This awaits
	* one read, but only briefly: a slow gateway costs a short wait, never a hang.
	*/
	async warm(withinMs = 1500) {
		if (this.snapshot.at !== void 0 && Date.now() - Date.parse(this.snapshot.at) < 5e3) return;
		await Promise.race([this.refresh().catch(() => {}), new Promise((resolveWait) => {
			setTimeout(resolveWait, withinMs).unref?.();
		})]);
	}
	/** Re-read after a write so the answer carries the post-write world. */
	async settled(outcome) {
		await this.refresh().catch(() => {});
		return {
			...outcome,
			status: this.status()
		};
	}
	/** Save the connection document (address, key, cadence, sync policy). */
	async saveConnection(patch) {
		const host = this.host();
		const rotated = patch.apiKey !== void 0 && patch.apiKey !== "" && patch.apiKey !== host?.apiKeyFromConfig();
		this.options.connection.patch(patch);
		const written = rotated ? host?.updateConfigApiKey(patch.apiKey ?? "") ?? false : false;
		if (written) await host?.restart();
		this.options.onChange?.();
		return this.settled({
			ok: !rotated || written,
			message: rotated ? written ? "gateway api key updated; gateway restarted" : "could not write the gateway config" : "connection saved"
		});
	}
	/** Start the host-owned gateway. */
	async startGateway() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		const status = await host.start();
		await this.refresh().catch(() => {});
		return {
			ok: gatewayActionOk(status.state),
			...status.error === void 0 ? {} : { message: status.error },
			status: this.status()
		};
	}
	/** Stop the host-owned gateway (refused for one the row did not start). */
	async stopGateway() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		const status = await host.stop();
		await this.refresh().catch(() => {});
		return {
			ok: status.error === void 0,
			...status.error === void 0 ? {} : { message: status.error },
			status: this.status()
		};
	}
	/** Restart the host-owned gateway. */
	async restartGateway() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		const status = await host.restart();
		await this.refresh().catch(() => {});
		return {
			ok: gatewayActionOk(status.state),
			...status.error === void 0 ? {} : { message: status.error },
			status: this.status()
		};
	}
	/** Start the pinned server download; progress is read from status(). */
	async downloadServer() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		const server = await host.downloadServer();
		const message = server.download.error ?? server.error;
		return {
			ok: server.download.state !== "failed" && message === void 0,
			...message === void 0 ? {} : { message },
			status: this.status()
		};
	}
	/** Abort the in-flight server download. */
	async cancelServerDownload() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		host.cancelDownload();
		return {
			ok: true,
			message: "server download cancelled",
			status: this.status()
		};
	}
	/** Re-hash the installed server binary. */
	async verifyServer() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		const server = await host.verifyServer();
		return {
			ok: server.error === void 0,
			...server.error === void 0 ? {} : { message: server.error },
			status: this.status()
		};
	}
	/** Ask the release channel for a newer kernel. */
	async checkKernelUpdate() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		const kernel = await host.checkKernelUpdate();
		if (kernel.error !== void 0) return {
			ok: false,
			message: kernel.error,
			status: this.status()
		};
		return {
			ok: true,
			message: kernel.available ? "kernel " + String(kernel.latestVersion ?? "") + " is available" : "kernel is up to date",
			status: this.status()
		};
	}
	/** Install the version the last check discovered. */
	async installKernelUpdate() {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		const server = await host.installKernelUpdate();
		const message = server.download.error ?? server.error;
		return {
			ok: server.installed && message === void 0,
			...message === void 0 ? {} : { message },
			status: this.status()
		};
	}
	/** Persist the automatic check cadence. */
	setKernelCadence(cadence) {
		const host = this.host();
		if (host === void 0) return {
			ok: false,
			message: "the host gateway row is not loaded",
			status: this.status()
		};
		host.setKernelCadence(cadence);
		return {
			ok: true,
			message: "kernel update cadence saved",
			status: this.status()
		};
	}
	/** Probe the gateway without changing the process. */
	async testConnection() {
		try {
			const overview = await this.options.client.overview();
			this.lastReadOk = true;
			this.snapshot = {
				...this.snapshot,
				overview,
				at: (/* @__PURE__ */ new Date()).toISOString()
			};
			return this.settled({
				ok: true,
				message: "gateway answered with " + String(overview.total) + " accounts"
			});
		} catch (error) {
			this.lastReadOk = false;
			const message = error instanceof PanelError ? error.message : safeMessage(error);
			await this.refresh().catch(() => {});
			return {
				ok: false,
				message,
				status: this.status()
			};
		}
	}
	/** Enable or disable one model in the picker, and/or pin its reasoning level. */
	async setModel(patch) {
		this.options.overrides.set(patch.id, {
			...patch.enabled === void 0 ? {} : { enabled: patch.enabled },
			...patch.effort === void 0 ? {} : { effort: patch.effort },
			...patch.efforts === void 0 ? {} : { efforts: patch.efforts }
		});
		this.merge(this.snapshot.models);
		this.options.onChange?.();
		return {
			ok: true,
			status: this.status()
		};
	}
	/** Enable or disable every model, or one realm's models, at once. */
	async setAllModels(enabled, region) {
		const target = region === void 0 ? this.catalog : this.catalog.filter((model) => model.region === region);
		this.options.overrides.setAll(target, enabled);
		this.merge(this.snapshot.models);
		this.options.onChange?.();
		return {
			ok: true,
			status: this.status()
		};
	}
	/** Write the locally hidden models into the gateway's own hidden list. */
	async syncHidden() {
		try {
			const models = (await this.options.client.config()).raw["models"];
			const previous = [];
			if (typeof models === "object" && models !== null && !Array.isArray(models)) {
				const list = models["hidden"];
				if (Array.isArray(list)) {
					for (const entry of list) if (typeof entry === "string") previous.push(entry);
				}
			}
			const hidden = panelHiddenList(this.catalog, previous);
			await this.options.client.saveHidden(hidden);
			return this.settled({
				ok: true,
				message: "pushed " + String(hiddenIds(this.catalog).length) + " hidden models to the gateway"
			});
		} catch (error) {
			return {
				ok: false,
				message: safeMessage(error),
				status: this.status()
			};
		}
	}
	/** Begin an account add; the gateway owns the OAuth flow. */
	async loginStart(realm) {
		try {
			const started = await this.options.client.loginStart(realm);
			this.loginDone = void 0;
			this.login = {
				state: started.state,
				url: started.url,
				realm: started.realm,
				startedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			this.loginStartedAt = Date.now();
			return {
				ok: true,
				status: this.status()
			};
		} catch (error) {
			return {
				ok: false,
				message: safeMessage(error),
				status: this.status()
			};
		}
	}
	/** Poll one in-flight add; a finished add becomes a real account. */
	async loginPoll(state) {
		const current = this.login;
		if (current === void 0 || current.state !== state) return {
			ok: true,
			status: this.status()
		};
		try {
			const polled = await this.options.client.loginPoll(state);
			if (!polled.done) return {
				ok: true,
				status: this.status()
			};
			if (this.login?.state !== state) return {
				ok: true,
				status: this.status()
			};
			this.loginDone = {
				at: (/* @__PURE__ */ new Date()).toISOString(),
				realm: current.realm,
				...polled.uid === void 0 ? {} : { uid: polled.uid },
				...polled.nickname === void 0 ? {} : { nickname: polled.nickname }
			};
			this.login = void 0;
			this.loginStartedAt = void 0;
			await this.refresh().catch(() => {});
			return {
				ok: true,
				...polled.message === void 0 ? {} : { message: polled.message },
				status: this.status()
			};
		} catch (error) {
			return {
				ok: false,
				message: safeMessage(error),
				status: this.status()
			};
		}
	}
	/** Forget the in-flight add. */
	async loginCancel() {
		this.login = void 0;
		this.loginDone = void 0;
		this.loginStartedAt = void 0;
		return {
			ok: true,
			status: this.status()
		};
	}
	/** Forget an add that has been pending far too long. */
	expireLogin(now = Date.now()) {
		if (this.login === void 0 || this.loginStartedAt === void 0) return false;
		if (now - this.loginStartedAt < 6e5) return false;
		this.login = void 0;
		this.loginDone = void 0;
		this.loginStartedAt = void 0;
		return true;
	}
	/** One per-account operation. */
	async accountOp(uid, op) {
		try {
			await this.options.client.accountOp(uid, op);
			return this.settled({
				ok: true,
				message: op + " sent"
			});
		} catch (error) {
			return {
				ok: false,
				message: safeMessage(error),
				status: this.status()
			};
		}
	}
	/** One pool-wide operation. */
	async bulkOp(op) {
		try {
			await this.options.client.bulkOp(op);
			return this.settled({
				ok: true,
				message: op + " sent"
			});
		} catch (error) {
			return {
				ok: false,
				message: safeMessage(error),
				status: this.status()
			};
		}
	}
	/**
	* Import whatever the token field received.
	*
	* Two doors, chosen by what the credential can prove it has:
	*
	* - **A refresh token** → the panel's own import endpoint. That is the hot path:
	*   the account joins the pool without a restart, and the panel runs its
	*   check-in and balance probes on the way in.
	* - **An access token only** → the gateway's auths directory, then a restart.
	*   The panel endpoint refuses a credential it cannot renew (it skips any record
	*   without `refresh_token`), and faking one would hand the scheduler a value
	*   that answers 12153 on its first keepalive — three of those and the account is
	*   disabled. A file with an empty refresh token is honest: the pool shows
	*   `has_refresh_token: false` and the scheduler leaves it alone until the
	*   access token expires.
	*
	* Rejected inputs are reported one line each, with the reason the parser found —
	* a bare JWT is the normal case here, so "payload is not JSON" would be a lie.
	*/
	async importAccounts(payload) {
		const parsed = parseImport(payload);
		if (parsed.credentials.length === 0) {
			const reason = parsed.rejected[0]?.reason;
			return {
				ok: false,
				message: reason === void 0 ? "nothing to import: paste an access token or a cockpit export" : "nothing to import: " + reason,
				status: this.status()
			};
		}
		const notes = [];
		let ok = true;
		const renewable = parsed.credentials.filter((credential) => credential.refreshToken !== "");
		const tokenOnly = parsed.credentials.filter((credential) => credential.refreshToken === "");
		if (renewable.length > 0) try {
			const result = await this.options.client.importAccounts(renewable.map(cockpitRecord));
			notes.push("imported " + String(result.imported ?? 0) + ", skipped " + String(result.skipped ?? 0));
			if (result.ok === false) ok = false;
		} catch (error) {
			ok = false;
			notes.push(safeMessage(error));
		}
		if (tokenOnly.length > 0) {
			const host = this.host();
			if (host === void 0) {
				ok = false;
				notes.push("the host gateway row is not loaded, so a token-only credential cannot be written");
			} else if (host.serviceVersion < 3 || typeof host.importCredentials !== "function") {
				ok = false;
				notes.push("the host gateway row is older than this panel; reload the plugin to import a bare token");
			} else {
				const write = host.importCredentials(tokenOnly);
				if (write.errors.length > 0) {
					ok = false;
					notes.push(...write.errors);
				}
				if (write.written.length > 0) {
					if (host.status().managed) {
						const after = await host.restart();
						notes.push("saved " + String(write.written.length) + " token(s); gateway restarted to load them");
						if (after.error !== void 0) {
							ok = false;
							notes.push(after.error);
						}
					} else notes.push("saved " + String(write.written.length) + " token(s); this gateway was started outside the host row, restart it to load them");
				}
			}
		}
		for (const entry of parsed.rejected) notes.push(entry.input + "…: " + entry.reason);
		return this.settled({
			ok,
			message: notes.join("; ")
		});
	}
	/**
	* The usage window, re-read at most once a second.
	*
	* The ledger is rewritten on every request; reading it on each status call
	* would put a JSON parse on the polling path of every surface, and caching for
	* a second keeps the heat map live without making the page expensive.
	*/
	usage(now = Date.now()) {
		if (this.usageCache !== void 0 && now - this.usageCache.at < 1e3) return this.usageCache.summary;
		const summary = readUsage(gatewayUsagePath());
		this.usageCache = {
			at: now,
			summary
		};
		return summary;
	}
	/** Whether the service was torn down (the host uses this to skip a late write). */
	get closed() {
		return this.disposed;
	}
	/** Stop every timer this service owns. */
	dispose() {
		this.disposed = true;
	}
};
//#endregion
//#region src/loopback.ts
/**
* Loopback gates for the plugin's local HTTP surfaces.
*
* A DNS-rebinding page sends its own domain in `Host`, so requiring a loopback
* host drops those before routing. A browser sends `Origin`; non-browser
* clients (the plugin's own fetch) send none and pass.
*
* @module dsh-workbuddy2api-connect/loopback
*/
/** Loopback hostnames a local plugin surface may be addressed by. */
const LOOPBACK_HOSTS = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"localhost",
	"[::1]"
]);
/** Strip the optional `:port` from a Host header value, IPv6-bracket aware. */
function hostnameOfHost(host) {
	let hostname = host.trim().toLowerCase();
	if (hostname.startsWith("[")) {
		const end = hostname.indexOf("]");
		return end === -1 ? hostname : hostname.slice(0, end + 1);
	}
	const colon = hostname.lastIndexOf(":");
	if (colon !== -1 && !hostname.slice(0, colon).includes(":") && /^\d+$/.test(hostname.slice(colon + 1))) hostname = hostname.slice(0, colon);
	return hostname;
}
/** The request's Host header must name the loopback interface. */
function hostIsLoopback(host) {
	if (host === void 0 || host.trim() === "") return false;
	return LOOPBACK_HOSTS.has(hostnameOfHost(host));
}
/** A browser-sent Origin must be loopback; an absent Origin passes. */
function originIsLoopback(origin) {
	if (origin === void 0 || origin.trim() === "") return true;
	try {
		const { hostname } = new URL(origin);
		return LOOPBACK_HOSTS.has(hostname) || hostname === "::1";
	} catch {
		return false;
	}
}
//#endregion
//#region src/routes.ts
/** Status document path. */
const STATUS_PATH = "/plugins/workbuddy2api-gateway/status";
/** Browser-half liveness breadcrumb: proves the client bundle ran. */
const CLIENT_HELLO_PATH = "/plugins/workbuddy2api-gateway/client-hello";
/** Action endpoint path. */
const ACTION_PATH = "/plugins/workbuddy2api-gateway/action";
/** Largest action body accepted. */
const MAX_BODY_BYTES = 262144;
/** Per-account operations the browser may request. */
const ACCOUNT_OPS = [
	"revive",
	"disable",
	"pause",
	"resume",
	"checkin",
	"balance",
	"remove"
];
/** Pool-wide operations the browser may request. */
const BULK_OPS = [
	"checkin_all",
	"balance_all",
	"keepalive_all",
	"travel_all",
	"activity_all",
	"compensation_all"
];
/** Write one JSON response. */
function json(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(payload),
		"Cache-Control": "no-store"
	});
	res.end(payload);
}
/** Constant-time key comparison; a length mismatch is a failure, not a crash. */
function keyMatches(expected, presented) {
	if (presented === void 0 || presented.length !== expected.length) return false;
	let mismatch = 0;
	for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ (presented.charCodeAt(index) || 0);
	return mismatch === 0;
}
/** Read a request body under a hard ceiling. */
async function readBody(req, limit = MAX_BODY_BYTES) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		total += buffer.length;
		if (total > limit) return void 0;
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
/** A non-empty string field. */
function strField(value) {
	return typeof value === "string" && value !== "" ? value : void 0;
}
/** Parse a thinking-level patch: null clears, a level sets, anything else is absent. */
function effortField(value) {
	if (value === null) return null;
	return isThinkingLevel(value) ? value : void 0;
}
/** Parse a level list, dropping anything this build cannot express. */
function effortListField(value) {
	if (!Array.isArray(value)) return void 0;
	const levels = value.filter(isThinkingLevel);
	return levels.length === 0 ? void 0 : levels;
}
/** Parse and shape-check one action; unknown fields are ignored, not trusted. */
function parseAction(text) {
	const body = parseJsonObject(text);
	if (body === void 0) return void 0;
	switch (body["action"]) {
		case "refresh": return { action: "refresh" };
		case "test-connection": return { action: "test-connection" };
		case "gateway-start": return { action: "gateway-start" };
		case "gateway-stop": return { action: "gateway-stop" };
		case "gateway-restart": return { action: "gateway-restart" };
		case "server-download": return { action: "server-download" };
		case "server-cancel": return { action: "server-cancel" };
		case "server-verify": return { action: "server-verify" };
		case "connection": {
			const panelUrl = strField(body["panelUrl"]);
			const apiKey = strField(body["apiKey"]);
			const refreshSeconds = typeof body["refreshSeconds"] === "number" && Number.isFinite(body["refreshSeconds"]) ? body["refreshSeconds"] : void 0;
			const syncHiddenToPanel = typeof body["syncHiddenToPanel"] === "boolean" ? body["syncHiddenToPanel"] : void 0;
			return {
				action: "connection",
				...panelUrl === void 0 ? {} : { panelUrl },
				...apiKey === void 0 ? {} : { apiKey },
				...refreshSeconds === void 0 ? {} : { refreshSeconds },
				...syncHiddenToPanel === void 0 ? {} : { syncHiddenToPanel }
			};
		}
		case "auto-register": return typeof body["enabled"] === "boolean" ? {
			action: "auto-register",
			enabled: body["enabled"]
		} : void 0;
		case "model": {
			const id = strField(body["id"]);
			if (id === void 0) return void 0;
			const enabled = typeof body["enabled"] === "boolean" ? body["enabled"] : void 0;
			const effort = effortField(body["effort"]);
			const efforts = effortListField(body["efforts"]);
			return {
				action: "model",
				id,
				...enabled === void 0 ? {} : { enabled },
				...effort === void 0 ? {} : { effort },
				...efforts === void 0 ? {} : { efforts }
			};
		}
		case "models-all": {
			if (typeof body["enabled"] !== "boolean") return void 0;
			const region = body["region"] === "global" ? "global" : body["region"] === "cn" ? "cn" : void 0;
			return {
				action: "models-all",
				enabled: body["enabled"],
				...region === void 0 ? {} : { region }
			};
		}
		case "kernel-check": return { action: "kernel-check" };
		case "kernel-install": return { action: "kernel-install" };
		case "kernel-cadence": {
			const cadence = body["cadence"];
			return cadence === "hourly" || cadence === "never" ? {
				action: "kernel-cadence",
				cadence
			} : void 0;
		}
		case "sync-hidden": return { action: "sync-hidden" };
		case "login-start": {
			const realm = body["realm"] === "global" ? "global" : body["realm"] === "cn" ? "cn" : void 0;
			return realm === void 0 ? void 0 : {
				action: "login-start",
				realm
			};
		}
		case "login-poll": {
			const state = strField(body["state"]);
			return state === void 0 ? void 0 : {
				action: "login-poll",
				state
			};
		}
		case "login-cancel": return { action: "login-cancel" };
		case "account": {
			const uid = strField(body["uid"]);
			const op = body["op"];
			if (uid === void 0) return void 0;
			if (typeof op !== "string") return void 0;
			if (!ACCOUNT_OPS.includes(op)) return void 0;
			return {
				action: "account",
				uid,
				op
			};
		}
		case "bulk": {
			const op = body["op"];
			if (typeof op !== "string") return void 0;
			if (!BULK_OPS.includes(op)) return void 0;
			return {
				action: "bulk",
				op
			};
		}
		case "import": {
			const payload = strField(body["payload"]);
			return payload === void 0 ? void 0 : {
				action: "import",
				payload
			};
		}
		default: return;
	}
}
/** The status handler: a full read, refusing anything off-loopback. */
function statusHandler(options) {
	return async function handle(req, res) {
		if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers["origin"])) {
			json(res, 403, {
				ok: false,
				error: "loopback only"
			});
			return;
		}
		try {
			await options.service.warm();
			json(res, 200, {
				...options.service.status(),
				controlKey: options.controlKey
			});
		} catch (error) {
			json(res, 500, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	};
}
/** The action handler: loopback, control key, then the action itself. */
function actionHandler(options) {
	return async function handle(req, res) {
		if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers["origin"])) {
			json(res, 403, {
				ok: false,
				error: "loopback only"
			});
			return;
		}
		if (!keyMatches(options.controlKey, req.headers["x-dsh-plugin-key"])) {
			json(res, 403, {
				ok: false,
				error: "missing or wrong control key"
			});
			return;
		}
		if (req.method !== "POST") {
			json(res, 405, {
				ok: false,
				error: "POST only"
			});
			return;
		}
		const body = await readBody(req);
		if (body === void 0) {
			json(res, 413, {
				ok: false,
				error: "body too large"
			});
			return;
		}
		const action = parseAction(body);
		if (action === void 0) {
			json(res, 400, {
				ok: false,
				error: "unrecognised action"
			});
			return;
		}
		try {
			json(res, 200, await runAction(options.service, action));
		} catch (error) {
			json(res, 500, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	};
}
/** Execute one parsed action against the service. */
async function runAction(service, action) {
	switch (action.action) {
		case "refresh":
			await service.refresh();
			return {
				ok: true,
				status: service.status()
			};
		case "test-connection": return service.testConnection();
		case "gateway-start": return service.startGateway();
		case "gateway-stop": return service.stopGateway();
		case "gateway-restart": return service.restartGateway();
		case "server-download": return service.downloadServer();
		case "server-cancel": return service.cancelServerDownload();
		case "server-verify": return service.verifyServer();
		case "kernel-check": return service.checkKernelUpdate();
		case "kernel-install": return service.installKernelUpdate();
		case "kernel-cadence": return Promise.resolve(service.setKernelCadence(action.cadence));
		case "connection": return service.saveConnection({
			...action.panelUrl === void 0 ? {} : { panelUrl: action.panelUrl },
			...action.apiKey === void 0 ? {} : { apiKey: action.apiKey },
			...action.refreshSeconds === void 0 ? {} : { refreshSeconds: action.refreshSeconds },
			...action.syncHiddenToPanel === void 0 ? {} : { syncHiddenToPanel: action.syncHiddenToPanel }
		});
		case "auto-register": return service.setAutoRegister(action.enabled);
		case "model": return service.setModel({
			id: action.id,
			...action.enabled === void 0 ? {} : { enabled: action.enabled },
			...action.effort === void 0 ? {} : { effort: action.effort },
			...action.efforts === void 0 ? {} : { efforts: action.efforts }
		});
		case "models-all": return service.setAllModels(action.enabled, action.region);
		case "sync-hidden": return service.syncHidden();
		case "login-start": return service.loginStart(action.realm);
		case "login-poll": return service.loginPoll(action.state);
		case "login-cancel": return service.loginCancel();
		case "account": return service.accountOp(action.uid, action.op);
		case "bulk": return service.bulkOp(action.op);
		case "import": return service.importAccounts(action.payload);
	}
}
/**
* The hello handler.
*
* The browser half calls this once when its apply runs. A host process cannot
* observe the browser, so this is the only way the missing settings page can be
* split into "the module never ran" and "it ran and its registration failed".
*/
function clientHelloHandler(options) {
	return function handle(req, res) {
		if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers["origin"])) {
			json(res, 403, {
				ok: false,
				error: "loopback only"
			});
			return;
		}
		options.service.noteClientHello(typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : void 0);
		json(res, 200, { ok: true });
	};
}
/** Mount both routes on a webServer context. */
function registerGatewayRoutes(ctx, options) {
	ctx.effect(() => {
		const status = ctx.webServer.register({
			kind: "exact",
			path: STATUS_PATH,
			handler: statusHandler(options)
		});
		const action = ctx.webServer.register({
			kind: "exact",
			path: ACTION_PATH,
			handler: actionHandler(options)
		});
		const hello = ctx.webServer.register({
			kind: "exact",
			path: CLIENT_HELLO_PATH,
			handler: clientHelloHandler(options)
		});
		return () => {
			status();
			action();
			hello();
		};
	}, "dsh-workbuddy2api-gateway: web routes");
}
//#endregion
//#region src/version.ts
/** This build's version. */
const WORKBUDDY2API_GATEWAY_VERSION = "0.5.1";
//#endregion
//#region src/pi-ai-version.ts
/**
* Which `@earendil-works/pi-ai` this plugin actually loaded.
*
* Pi is a peer the host also uses, and a pnpm profile can expose more than one
* copy: with a `hoisted` linker, a peer-only plugin resolves the bare specifier
* to whatever a *different* plugin left at the profile root — which is how one
* machine ended up running 0.82.1 and dying with `PI_AI_ERROR` before any HTTP.
* This plugin therefore declares pi-ai as a real, exactly pinned dependency, so
* the copy it imports is its own and the version it gets is the version it was
* built against. This module publishes that fact at startup and in the status
* document, because it is the one thing a support report needs and the one the
* plugin cannot infer from its own version.
*
* @module dsh-workbuddy2api-gateway/pi-ai-version
*/
/** Package name, spelled once. */
const PI_AI = "@earendil-works/pi-ai";
/** Walk up from a module entry until the manifest of `name` is found. */
function manifestVersionOf(entry, name) {
	let dir = dirname(fileURLToPath(entry));
	for (let step = 0; step < 6; step += 1) {
		try {
			const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
			if (manifest.name === name && typeof manifest.version === "string") return manifest.version;
		} catch {}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
}
/** The pi-ai version this module resolves, or undefined when it cannot be read. */
function resolvedPiAiVersion() {
	let entry;
	try {
		entry = import.meta.resolve(PI_AI);
	} catch {
		return;
	}
	return manifestVersionOf(entry, PI_AI);
}
/**
* The pi-ai version the host's LLM layer resolves, best effort.
*
* `@deepseek-ai/dsh-llm-pi-ai` owns the `Models` collection this plugin's
* provider registers into, so its copy is the other half of the pair. A
* generation gap between the two is not fatal — providers cross that boundary as
* plain objects — but it is the first thing to look at when a request dies, so
* it is reported beside our own version rather than guessed at in a bug report.
*/
function hostPiAiVersion() {
	let entry;
	try {
		entry = import.meta.resolve("@deepseek-ai/dsh-llm-pi-ai");
	} catch {
		return;
	}
	let dir = dirname(fileURLToPath(entry));
	for (let step = 0; step < 6; step += 1) {
		try {
			const manifest = JSON.parse(readFileSync(join(dir, "node_modules", PI_AI, "package.json"), "utf8"));
			if (typeof manifest.version === "string") return manifest.version;
		} catch {}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
}
/** Compare two `major.minor.patch` versions; a prerelease tag compares as its base. */
function compareVersions(left, right) {
	const parse = (value) => (value.split("-")[0] ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0);
	const a = parse(left);
	const b = parse(right);
	for (let index = 0; index < 3; index += 1) {
		const diff = (a[index] ?? 0) - (b[index] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}
/** The generation pair a support report needs, for one log line. */
function piAiVersionSummary() {
	const loaded = resolvedPiAiVersion() ?? "unresolved";
	const host = hostPiAiVersion();
	return host === void 0 ? loaded : loaded + " (host " + host + ")";
}
/**
* One warning when the loaded pi-ai cannot carry this plugin, or undefined.
*
* A hard failure would take the settings page down with it — the page is how a
* user finds out what is wrong — so this reports instead of throwing, and names
* the fix rather than the symptom.
*/
function piAiVersionWarning() {
	const version = resolvedPiAiVersion();
	if (version === void 0) return "workbuddy2api-gateway: could not resolve @earendil-works/pi-ai; requests on this route will fail. It is a pinned dependency of this plugin - reinstall the plugin (pnpm install) and restart DSH.";
	if (compareVersions(version, "0.87.0") < 0) return "workbuddy2api-gateway: loaded @earendil-works/pi-ai " + version + ", but this plugin needs >=0.87.0. Copies below that have no system branch in estimateMessageTokens, so every request fails at PI_AI_ERROR. Resolution escaped to a hoisted profile-root copy: reinstall this plugin so its own pinned copy wins.";
	const host = hostPiAiVersion();
	if (host !== void 0 && host.split(".").slice(0, 2).join(".") !== version.split(".").slice(0, 2).join(".")) return "workbuddy2api-gateway: loaded @earendil-works/pi-ai " + version + ", host LLM layer resolves " + host + ". Providers cross that boundary as plain objects, so this usually works; check it first if a request fails.";
}
//#endregion
//#region src/index.ts
/**
* WorkBuddy2API Gateway for DeepSeek Harness.
*
* This is the panel half. The gateway process belongs to the host gateway row;
* this row only reads it and serves the model route. One mount does five things:
*
* 1. **Reads the host row.** The process, its config, and its server cache belong
*    to `workbuddy2api-gateway-host`; this row only reads `GatewayHost.status()`
*    and never imports `node:child_process`.
* 2. **Serves the route.** A pi-ai provider points at the gateway's own
*    OpenAI-compatible /v1, with the durable-attachment hooks wired so image
*    input works ({@link createWorkBuddy2ApiAdapter}).
* 3. **Discovers the catalog.** Every poll diffs the gateway's model list; a new
*    model joins the picker on its own, a changed descriptor is announced, and a
*    removed model stops being offered ({@link WorkBuddy2ApiService}).
* 4. **Owns the control plane.** Accounts, sign-in, check-in, balances and every
*    model toggle are driven through this plugin's own loopback routes. The
*    gateway's web panel is never needed, and never opened.
* 5. **Stays out of the way.** A gateway somebody else started is adopted as an
*    external instance: health, catalog, and management all work, and only
*    "stop" declines, because killing a process the host row did not spawn is a
*    surprise rather than a feature.
*
* @module dsh-workbuddy2api-gateway
*/
/** Stable Cordis plugin name. */
const name = "llm-workbuddy2api-gateway";
/** The model registry required before the route can register. */
const inject = ["llm"];
/**
* Composition defaults for the panel row.
*
* Process fields live in the host row (`workbuddy2api-gateway-host`) now. The
* four deprecated fields stay accepted so an existing profile patch does not
* fail schema validation; only `port` is still read, as the default loopback
* address before the host service answers.
*/
const Config = z.object({
	providerId: z.string().default(WORKBUDDY2API_PROVIDER),
	displayName: z.string().default("WorkBuddy2API"),
	/** Deprecated: the host row owns the port. Read only as the panel URL default. */
	port: z.natural().min(1).max(65535).default(7863),
	/** Deprecated: the host row owns auto-start. */
	autoStart: z.boolean().default(true),
	/** Deprecated: the host row owns the restart limit. */
	restartLimit: z.natural().default(5),
	/** Poll interval for the catalog, in seconds. */
	refreshSeconds: z.natural().min(10).max(600).default(15),
	/** Panel API key; empty means "use (or generate) the gateway config's key". */
	apiKey: z.string().default(""),
	/** Deprecated: the host row owns the accounts directory. */
	authDir: z.string().default(""),
	/** Whether a model the gateway announces joins the picker without asking. */
	autoRegister: z.boolean().default(true)
});
/** Poll floor for the catalog scheduler. */
const TICK_MS = 5e3;
/**
* Resolve which provider route this instance may own.
*
* A profile that still carries another adapter for the same id already owns it;
* registering it again would throw DUPLICATE_ADAPTER and take the route down.
* Rather than fail, this instance falls back to a suffixed route and says so in
* the status document, so the page can tell the user which group it is managing.
*/
function resolveRoute(llm, preferred) {
	const taken = new Set(llm.listProviders().map((provider) => provider.id));
	if (!taken.has(preferred)) return {
		id: preferred,
		owned: true
	};
	const fallback = preferred + "-gateway";
	return taken.has(fallback) ? {
		id: preferred + "-" + randomBytes(2).toString("hex"),
		owned: false,
		conflictWith: preferred
	} : {
		id: fallback,
		owned: false,
		conflictWith: preferred
	};
}
/**
* Resolve one durable image reference into the current tool execution world.
*
* The same bridge llm-pi-ai installs for its own routes: the attachment service
* knows the host path of the normalized copy, and the fs service maps that host
* path into the vocabulary tools can read. Both are read lazily, so a route
* registered before either service exists still upgrades.
*/
function imageAccessResolver(ctx) {
	return (attachments, ref) => resolveImageAttachmentAccess(attachments, (hostPath) => {
		const fs = ctx.get("fs");
		return typeof fs?.processPathFromHostPath === "function" ? fs.processPathFromHostPath(hostPath) : void 0;
	}, ref);
}
/** Wire the plugin into the host. */
function apply(ctx, config) {
	const log = ctx.logger;
	const controlKey = randomBytes(24).toString("hex");
	const connection = new ConnectionStore(void 0, {
		...DEFAULT_CONNECTION,
		panelUrl: "http://127.0.0.1:" + String(config.port),
		apiKey: config.apiKey,
		refreshSeconds: config.refreshSeconds
	});
	const overrides = new ModelOverridesStore();
	const host = () => ctx.get(GATEWAY_HOST_SERVICE);
	const client = new PanelClient(() => {
		const settings = connection.current();
		const port = host()?.status().port ?? config.port;
		const defaultUrl = "http://127.0.0.1:" + String(port);
		return {
			baseUrl: settings.panelUrl === DEFAULT_CONNECTION.panelUrl ? defaultUrl : settings.panelUrl,
			apiKey: settings.apiKey !== "" ? settings.apiKey : host()?.apiKeyFromConfig() ?? ""
		};
	});
	/** Route ownership, decided when the llm service is available. */
	let route = {
		id: config.providerId,
		owned: true
	};
	/** The international route, resolved beside the domestic one. */
	let globalRoute = {
		id: config.providerId + "-global",
		owned: true
	};
	/**
	* The adapter, once the llm service lets us build it.
	*
	* The service can discover a model before this is assigned; the optional
	* call keeps the catalog poller from depending on registration order.
	*/
	let adapterHandle;
	const piAiVersion = resolvedPiAiVersion();
	const piAiWarning = piAiVersionWarning();
	if (piAiWarning === void 0) log.info("workbuddy2api-gateway: pi-ai " + piAiVersionSummary());
	else log.warn(piAiWarning);
	const service = new WorkBuddy2ApiService({
		version: WORKBUDDY2API_GATEWAY_VERSION,
		...piAiVersion === void 0 ? {} : { piAiVersion },
		providerId: route.id,
		providerOwned: route.owned,
		...route.conflictWith === void 0 ? {} : { conflictWith: route.conflictWith },
		connection,
		overrides,
		client,
		host,
		warn: (message, error) => {
			log.warn(message, error);
		},
		onChange: () => {
			adapterHandle?.invalidate();
			try {
				ctx.emit("llm/adapters-updated");
			} catch (error) {
				log.warn("workbuddy2api-gateway: could not announce the catalog change", error);
			}
		}
	});
	service.refresh().catch((error) => {
		log.warn("workbuddy2api-gateway: first gateway read failed", error);
	});
	let lastRead = Date.now();
	const ticker = setInterval(() => {
		const settings = connection.current();
		if (Date.now() - lastRead < settings.refreshSeconds * 1e3) return;
		lastRead = Date.now();
		if (service.expireLogin()) service.status();
		service.refresh().catch((error) => {
			log.warn("workbuddy2api-gateway: gateway poll failed", error);
		});
	}, TICK_MS);
	ticker.unref?.();
	ctx.effect(() => () => {
		clearInterval(ticker);
		service.dispose();
	}, "dsh-workbuddy2api-gateway: poller");
	ctx.inject(["llm"], (llmCtx) => {
		const llm = llmCtx.llm;
		route = resolveRoute(llm, config.providerId);
		globalRoute = resolveRoute(llm, route.id + "-global");
		service.setProviderRoutes({
			id: route.id,
			owned: route.owned,
			...route.conflictWith === void 0 ? {} : { conflict: route.conflictWith }
		}, {
			id: globalRoute.id,
			owned: globalRoute.owned,
			...globalRoute.conflictWith === void 0 ? {} : { conflict: globalRoute.conflictWith }
		});
		if (!route.owned) log.warn("workbuddy2api-gateway: provider \"" + String(route.conflictWith) + "\" is already registered by another plugin; this instance serves \"" + route.id + "\" instead.");
		const adapter = createWorkBuddy2ApiAdapter({
			providerId: route.id,
			globalProviderId: globalRoute.id,
			displayName: config.displayName,
			catalog: () => service.catalogModels(),
			v1BaseUrl: () => client.v1BaseUrl(),
			apiKey: () => {
				const settings = connection.current();
				return settings.apiKey !== "" ? settings.apiKey : host()?.apiKeyFromConfig() ?? "";
			},
			hidden: () => service.catalogModels().filter((model) => !model.enabled).map((model) => model.id),
			attachments: () => ctx.get("attachments"),
			imageAccess: imageAccessResolver(ctx)
		});
		adapterHandle = adapter;
		try {
			const releaseDirectory = llm.registerConfigurableProviders(adapter.providers.map((provider) => ({
				provider: provider.id,
				displayName: provider.displayName,
				settingsNs: "llm-workbuddy2api-gateway",
				settingsPath: []
			})));
			const releaseAdapter = llm.registerAdapter(adapter.providers.map((provider) => provider.id), adapter.adapter);
			ctx.effect(() => () => {
				releaseDirectory();
				releaseAdapter();
			}, "dsh-workbuddy2api-gateway: provider registration");
			log.info("workbuddy2api-gateway: routes " + adapter.providers.map((provider) => provider.id).join(", ") + " registered (" + String(service.catalogModels().length) + " models)");
		} catch (error) {
			log.error("workbuddy2api-gateway: provider registration failed", error);
		}
	});
	ctx.inject(["webServer"], (webCtx) => {
		registerGatewayRoutes(webCtx, {
			service,
			controlKey
		});
	});
}
//#endregion
export { ACTION_PATH, Config, ConnectionStore, DEFAULT_CONNECTION, GATEWAY_HOST_SERVICE, GATEWAY_HOST_SERVICE_VERSION, ModelOverridesStore, PanelClient, PanelError, STATUS_PATH, THINKING_LEVELS, WORKBUDDY2API_GATEWAY_VERSION, WORKBUDDY2API_PROVIDER, WorkBuddy2ApiService, apply, buildCatalog, clampRefreshSeconds, createWorkBuddy2ApiAdapter, gatewayConfigPath, gatewayWorkdir, hiddenIds, inject, isThinkingLevel, name, normalizePanelUrl, panelHiddenList, parseAction, pluginDataDir, runAction, safeMessage, serverRootDir, visibleIds };
