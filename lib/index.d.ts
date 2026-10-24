import z from "@deepseek-ai/schemastery";
import { ImageAttachmentAccess } from "@deepseek-ai/dsh-llm";
import "@earendil-works/pi-ai";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { Context } from "@deepseek-ai/cordis";
import { AttachmentStore, ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
//#region src/usage.d.ts
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
/** One day of usage. */
interface UsageDay {
  /** ISO date (`YYYY-MM-DD`). */
  date: string;
  /** Requests recorded that day. */
  calls: number;
  /** Total tokens that day. */
  tokens: number;
  /** Credits charged that day. */
  credits: number;
}
/** What the overview renders. */
interface UsageSummary {
  /** The window, oldest first, dense (missing days are zero-filled). */
  days: readonly UsageDay[];
  calls: number;
  tokens: number;
  credits: number;
  /** Days with any recorded request. */
  activeDays: number;
  /** Hour of day (0-23) with the most tokens, when there is one. */
  peakHour?: number;
  /** Model id used by the most requests, when there is one. */
  topModel?: string;
  /** Whether any bucket was read at all. */
  empty: boolean;
}
//#endregion
//#region src/panel-client.d.ts
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
/** Where to reach the panel, and with which key. */
interface PanelEndpoint {
  /** Panel origin, e.g. `http://127.0.0.1:7863` (no trailing slash, no `/v1`). */
  baseUrl: string;
  /** Panel `api_key`; empty when the panel runs without auth. */
  apiKey: string;
}
/** Failure classes the surfaces distinguish. */
type PanelErrorKind = 'auth' | 'network' | 'http' | 'shape';
/** One diagnosable panel failure. */
declare class PanelError extends Error {
  readonly kind: PanelErrorKind;
  readonly status?: number | undefined;
  constructor(message: string, kind: PanelErrorKind, status?: number | undefined);
}
/** One pool account as the panel reports it. */
interface PanelAccount {
  uid: string;
  nickname: string;
  realm: string;
  credits?: number;
  creditsTotal?: number;
  creditsExpiring?: number;
  earliestExpiry?: string;
  disabled: boolean;
  disabledReason?: string;
  paused: boolean;
  cooling: boolean;
  coolingUntil?: string;
  coolingKind?: string;
  enterprise: boolean;
  tokenExpiresAt?: string;
  hasRefreshToken: boolean;
  checkinDone: boolean;
  successCount: number;
  errTotal: number;
  failStreak: number;
  inFlight: number;
  lastSuccess?: string;
  lastErr?: string;
  lastModel?: string;
  requestCount?: number;
  totalTokens?: number;
  lastLatencyMs?: number;
  rateLimitedModels: readonly {
    model: string;
    unlockAt?: string;
  }[];
}
/** Overview figures plus the pool listing. */
interface PanelOverview {
  version?: string;
  uptimeSec?: number;
  authRequired: boolean;
  redisMode?: string;
  total: number;
  healthy: number;
  cooling: number;
  disabled: number;
  paused: number;
  inFlightFull: boolean;
  accounts: readonly PanelAccount[];
  balanceRefreshSec?: number;
  balanceRefreshedAt?: string;
}
/** One model as the panel's live catalog reports it. */
interface PanelModel {
  id: string;
  name: string;
  description?: string;
  vendor?: string;
  credits?: string;
  contextLength: number;
  maxOutputTokens: number;
  supportedEfforts: readonly string[];
  defaultEffort?: string;
  canDisableThinking: boolean;
  supportsImages: boolean;
  supportsReasoning: boolean;
  onlyReasoning: boolean;
  tags: readonly string[];
}
/** A parsed panel configuration document; only the paths this plugin touches are typed. */
interface PanelConfigDocument {
  raw: Record<string, unknown>;
  hidden: readonly string[];
}
/** Outcome of an account add flow's poll. */
interface PanelLoginPoll {
  done: boolean;
  message?: string;
  uid?: string;
  nickname?: string;
}
/** Result of a panel write. */
interface PanelWriteResult {
  ok: boolean;
  message?: string;
  restartRequired?: readonly string[];
}
/** Redact token-shaped content before a message crosses to the browser. */
declare function safeMessage(error: unknown): string;
/** Normalize a user-supplied panel URL into an origin. */
declare function normalizePanelUrl(raw: string): string;
/** The panel admin client. */
declare class PanelClient {
  private readonly endpoint;
  constructor(endpoint: () => PanelEndpoint);
  /** Current origin. */
  baseUrl(): string;
  /** The OpenAI-compatible base URL the route points at. */
  v1BaseUrl(): string;
  /** Request one admin path and decode its JSON object body. */
  private request;
  /** The account pool overview. */
  overview(): Promise<PanelOverview>;
  /** The live model catalog (each entry's id is already realm-prefixed). */
  models(): Promise<PanelModel[]>;
  /** The panel configuration document, plus the hidden-model list it carries. */
  config(): Promise<PanelConfigDocument>;
  /** Save a whole configuration document (the panel validates and hot-applies it). */
  saveConfig(config: Record<string, unknown>): Promise<PanelWriteResult>;
  /** Replace the panel's hidden-model list, preserving every other field. */
  saveHidden(hidden: readonly string[]): Promise<PanelWriteResult>;
  /** Begin an OAuth account add; returns the URL the user opens. */
  loginStart(realm: 'cn' | 'global'): Promise<{
    url: string;
    state: string;
    realm: string;
  }>;
  /** Poll one in-flight add. */
  loginPoll(state: string): Promise<PanelLoginPoll>;
  /** Login regions the panel offers for the international realm. */
  regions(): Promise<readonly {
    code: string;
    name: string;
  }[]>;
  /** One per-account operation. */
  accountOp(uid: string, op: AccountOp): Promise<PanelWriteResult>;
  /** Bulk operation across every account. */
  bulkOp(op: BulkOp): Promise<PanelWriteResult>;
  /** Import accounts in the cockpit export shape (`uid`/`access_token`/`refresh_token`). */
  importAccounts(accounts: readonly Record<string, unknown>[]): Promise<PanelWriteResult & {
    imported?: number;
    skipped?: number;
    errors?: readonly string[];
  }>;
}
/** Per-account operations the panel exposes. */
type AccountOp = 'revive' | 'disable' | 'pause' | 'resume' | 'checkin' | 'balance' | 'remove';
/** Pool-wide operations the panel exposes. */
type BulkOp = 'checkin_all' | 'balance_all' | 'keepalive_all' | 'travel_all' | 'activity_all' | 'compensation_all';
//#endregion
//#region src/catalog.d.ts
/** Reasoning levels pi-ai can express, in display order. */
declare const THINKING_LEVELS: readonly ["off", "low", "medium", "high", "xhigh", "max"];
/** One reasoning level name. */
type ThinkingLevel = typeof THINKING_LEVELS[number];
/** Whether a value is a level this plugin can offer. */
declare function isThinkingLevel(value: unknown): value is ThinkingLevel;
/** The local document's per-model entry. */
interface ModelOverride {
  /** Whether the model appears in DSH's picker. Absent means enabled. */
  enabled?: boolean;
  /** The level this model should run at when a request names none. */
  effort?: ThinkingLevel;
  /**
   * The levels the picker may offer. Absent means "every level the panel
   * declares"; an empty list is treated as absent rather than as "none", since a
   * model with no selectable level cannot be pinned to one.
   */
  efforts?: readonly ThinkingLevel[];
}
/** One model after the override layer is applied. */
interface CatalogModel {
  id: string;
  name: string;
  description?: string;
  vendor?: string;
  credits?: string;
  contextLength: number;
  maxOutputTokens: number;
  /** Levels the panel declares for this model, plus `off` when it can disable thinking. */
  declaredEfforts: readonly ThinkingLevel[];
  /** Levels actually offered to the picker (the override's subset, or the declared set). */
  efforts: readonly ThinkingLevel[];
  /** Level used when a request does not name one. */
  defaultEffort?: ThinkingLevel;
  canDisableThinking: boolean;
  supportsImages: boolean;
  supportsReasoning: boolean;
  onlyReasoning: boolean;
  tags: readonly string[];
  /** Whether the picker lists it. */
  enabled: boolean;
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
declare function buildCatalog(models: readonly PanelModel[], overrides: Readonly<Record<string, ModelOverride>>): CatalogModel[];
/** Ids the user has hidden locally — what the picker filters out. */
declare function hiddenIds(catalog: readonly CatalogModel[]): string[];
/** Every id the picker should list. */
declare function visibleIds(catalog: readonly CatalogModel[]): string[];
/**
 * The panel `models.hidden` list this plugin should push, given a catalog.
 *
 * The panel's own hidden list is an *authoritative reject* at the gateway, so it
 * is derived from the local enabled set alone. The plugin keeps the union with
 * whatever the panel hid for its own reasons: this document is the one place
 * that might also carry an operator's hand-edit, and silently un-hiding a model
 * somebody else disabled is worse than a slightly stale entry.
 */
declare function panelHiddenList(catalog: readonly CatalogModel[], previous: readonly string[]): string[];
//#endregion
//#region src/overrides-store.d.ts
/** The overrides document, read and written through the shared atomic store. */
declare class ModelOverridesStore {
  private readonly path;
  constructor(path?: string);
  /** Every stored override, keyed by model id. */
  all(): Record<string, ModelOverride>;
  /** One model's override, when it has one. */
  get(id: string): ModelOverride | undefined;
  /**
   * Apply a patch to one model.
   *
   * `enabled: true`, `effort: undefined` and `efforts: []` all mean "back to the
   * panel's answer": the entry is pruned instead of stored, so the document only
   * ever holds facts that differ from the panel. That keeps a later panel change
   * (a new default level, a removed capability) visible instead of masked by a
   * stale local copy.
   */
  set(id: string, patch: {
    enabled?: boolean;
    effort?: ThinkingLevel | null;
    efforts?: readonly ThinkingLevel[];
  }): ModelOverride | undefined;
  /** Enable or hide every model the catalog currently lists. */
  setAll(catalog: readonly {
    id: string;
  }[], enabled: boolean): void;
  /** Replace the whole document (used by tests and by a reset action). */
  write(models: Record<string, ModelOverride>): void;
}
//#endregion
//#region src/settings-store.d.ts
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
/** The effective connection policy. */
interface ConnectionSettings {
  /** Panel origin, normalized (no trailing slash, no `/v1`). */
  panelUrl: string;
  /** Panel `api_key`; empty when the panel runs without auth. */
  apiKey: string;
  /** Poll interval in seconds (10–600). */
  refreshSeconds: number;
  /** Whether a locally hidden model is also hidden at the panel. */
  syncHiddenToPanel: boolean;
}
/** The defaults an install ships. */
declare const DEFAULT_CONNECTION: ConnectionSettings;
/** Clamp a poll interval into the range the surfaces tolerate. */
declare function clampRefreshSeconds(value: number): number;
/** Read/patch the connection document. */
declare class ConnectionStore {
  private readonly path;
  private readonly defaults;
  constructor(path?: string, defaults?: ConnectionSettings);
  /** The stored document layered over the install defaults. */
  current(): ConnectionSettings;
  /** Merge a patch into the stored document. */
  patch(patch: Partial<ConnectionSettings>): ConnectionSettings;
}
//#endregion
//#region src/supervisor.d.ts
/**
 * The process half: this plugin owns the `workbuddy2api` gateway instead of
 * asking the user to run it.
 *
 * "Owns" is deliberate and has three consequences:
 *
 * 1. **It finds the binary.** A configured path wins; otherwise the search walks
 *    the places a locally built gateway usually sits (`~/Downloads/…`, a
 *    `bin/` beside this plugin's data, `/usr/local/bin`, then `PATH`). The
 *    answer is cached until the next explicit refresh so a start attempt is not
 *    a filesystem crawl.
 * 2. **It writes the config.** A missing `config.json` is generated with a
 *    random API key, a loopback listen address, and `auth_dir`/`state_file`
 *    inside this plugin's data directory — so the gateway's state belongs to the
 *    plugin and no path leaks into the user's home by accident. An existing
 *    config is never rewritten: it is the user's file, and the panel hot-applies
 *    changes made through its own API.
 * 3. **It supervises.** The child's stdout/stderr are kept in a ring buffer the
 *    settings page can show, a crash restarts it with exponential backoff up to a
 *    limit, and a stop is always SIGTERM first with a SIGKILL deadline.
 *
 * The one case this file does NOT own is a gateway somebody else started: a
 * healthy `/healthz` with no child process means `external`. The rest of the
 * plugin treats that exactly like a managed one — the difference is only that
 * stopping it is refused, because killing a process this plugin did not spawn
 * would be a surprise, not a feature.
 *
 * @module dsh-workbuddy2api-gateway/supervisor
 */
/** How the gateway is running right now. */
type SupervisorState =
/** No child, and `/healthz` does not answer: nothing is serving this port. */
'stopped' |
/** A child was spawned and has not answered a health probe yet. */
'starting' |
/** A child this plugin spawned is answering. */
'running' |
/** A gateway this plugin did not spawn is answering on the port. */
'external' |
/** The last start or the last crash left nothing running. */
'failed';
/** One line of gateway output, as the settings page shows it. */
interface SupervisorLogLine {
  at: string;
  stream: 'stdout' | 'stderr' | 'plugin';
  text: string;
}
/** The process snapshot the status document carries. */
interface SupervisorStatus {
  state: SupervisorState;
  /** True only when this plugin spawned the running child. */
  managed: boolean;
  pid?: number;
  /** The resolved executable, when one was found. */
  binary?: string;
  /** Where the gateway's document lives. */
  configPath: string;
  /** The gateway's working directory (its `auths/` and `data/` live here). */
  workdir: string;
  /** The loopback port the health probe uses. */
  port: number;
  /** ISO time the current run began. */
  since?: string;
  /** How many times this plugin restarted the child after a crash. */
  restarts: number;
  /** The most recent exit, when there was one. */
  lastExit?: {
    code: number | null;
    signal: string | null;
    at: string;
  };
  /** Why the last start failed, when it did. */
  error?: string;
  /** Whether a crash should be followed by an automatic restart. */
  autoStart: boolean;
  /** The tail of the gateway's output, oldest first. */
  log: readonly SupervisorLogLine[];
}
/** What the supervisor reads from the plugin. */
interface SupervisorOptions {
  /** The user's configured executable path; an empty string means "discover". */
  binary(): string;
  /** The gateway's `config.json` path. */
  configPath(): string;
  /** The gateway's working directory. */
  workdir(): string;
  /** Where the gateway keeps its accounts; empty means the workdir default. */
  authDir?(): string;
  /** The loopback port to probe. */
  port(): number;
  /** Whether a crash restarts the child. */
  autoStart(): boolean;
  /** Restarts allowed in one run before the supervisor gives up. */
  restartLimit(): number;
  /** Ring-buffer depth for the visible log. */
  logLimit?: number;
  /** Where plugin-level events go (the host's logger). */
  log?(message: string, error?: unknown): void;
  /** Health probe deadline. */
  probeTimeoutMs?: number;
}
/**
 * Supervise one `workbuddy2api` gateway.
 *
 * Every method is safe to call at any time: the supervisor re-reads the
 * configured paths on each call, so a settings change lands without a restart of
 * the plugin.
 */
declare class PanelSupervisor {
  private readonly options;
  private child?;
  private stopping;
  private restartTimer?;
  private restarts;
  private since?;
  private lastExit?;
  private error?;
  private state;
  private readonly logLines;
  /** Cached executable, dropped whenever a start is asked for explicitly. */
  private resolvedBinary?;
  private disposed;
  constructor(options: SupervisorOptions);
  /** The ring buffer's depth. */
  private get limit();
  /** Append one line, dropping the oldest beyond the limit. */
  private note;
  /** The executable this plugin would run right now, or undefined. */
  resolveBinary(): string | undefined;
  /** Forget the cached executable (a settings change, or a retry after "not found"). */
  invalidateBinary(): void;
  /**
   * Ensure a usable `config.json`, generating one when it is missing.
   *
   * The generated document is minimal on purpose: every field it sets is one the
   * gateway needs to run at all (listen address, admin key, where accounts and
   * state live). Anything else — pool strategy, schedules, prompt rewriting — is
   * left to the gateway's own defaults, which is what its documentation calls a
   * recommended configuration.
   */
  ensureConfig(): {
    path: string;
    created: boolean;
    apiKey?: string;
  };
  /** The API key the gateway's `config.json` carries, when it is readable. */
  /**
   * Write a new api_key into the gateway config, keeping every other field.
   *
   * The settings page promises one key and the gateway honours exactly one: the
   * document in its own directory. A key stored only here would leave the gateway
   * answering 401 to its own supervisor (and the web panel locked out), so a
   * changed key is written there and the process is restarted to honour it.
   */
  updateConfigApiKey(key: string): boolean;
  apiKeyFromConfig(): string | undefined;
  /**
   * Probe `/healthz`; the gateway answers 503 when it has no account yet.
   *
   * A raw `http` request, not `fetch`: this is a loopback liveness check, and a
   * `fetch` would honour an ambient proxy — turning "nothing listens here" into
   * "the proxy answered 503", which is exactly the wrong answer at the wrong
   * time.
   */
  probe(): Promise<boolean>;
  /** Recompute the state without spawning anything. */
  refresh(): Promise<SupervisorStatus>;
  /** Start the gateway if it is not already up. */
  start(): Promise<SupervisorStatus>;
  /** Decide what follows one exit: a backed-off restart, or a resting failure. */
  private afterExit;
  /**
   * Stop the gateway.
   *
   * A child this plugin spawned gets SIGTERM, then SIGKILL after a grace period.
   * An external gateway is left alone — the status says so, and the page renders
   * that refusal as information rather than as a failed action.
   */
  stop(): Promise<SupervisorStatus>;
  /** Stop then start, keeping the restart counter. */
  restart(): Promise<SupervisorStatus>;
  /** The current snapshot. */
  status(): SupervisorStatus;
  /** Drop the child and every timer, without waiting for anything. */
  dispose(): void;
}
//#endregion
//#region src/service.d.ts
/** One account as the browser sees it. */
interface WebAccount {
  uid: string;
  nickname: string;
  realm: string;
  credits?: number;
  creditsTotal?: number;
  earliestExpiry?: string;
  status: 'active' | 'disabled' | 'paused' | 'cooling';
  coolingUntil?: string;
  disabledReason?: string;
  tokenExpiresAt?: string;
  hasRefreshToken: boolean;
  checkinDone: boolean;
  successCount: number;
  failStreak: number;
  lastSuccess?: string;
  lastModel?: string;
  requestCount?: number;
  totalTokens?: number;
  rateLimitedModels: number;
  enterprise: boolean;
}
/** One model as the browser sees it. */
interface WebModel {
  id: string;
  name: string;
  description?: string;
  vendor?: string;
  credits?: string;
  contextLength: number;
  maxOutputTokens: number;
  efforts: readonly string[];
  defaultEffort?: string;
  enabled: boolean;
  canDisableThinking: boolean;
  supportsImages: boolean;
  supportsReasoning: boolean;
  onlyReasoning: boolean;
  tags: readonly string[];
}
/** The account-add flow in flight, when there is one. */
interface WebLogin {
  state: string;
  url: string;
  realm: string;
  startedAt: string;
}
/** What one poll changed about the catalog. */
interface WebSync {
  lastSyncedAt?: string;
  added: readonly string[];
  removed: readonly string[];
  changed: readonly string[];
  /** Whether a new model joins the DSH picker without asking. */
  autoRegister: boolean;
}
/** Everything the browser surfaces render. */
interface WebStatus {
  ok: true;
  version: string;
  provider: {
    id: string;
    owned: boolean;
    conflict?: string;
  };
  connection: {
    panelUrl: string;
    hasApiKey: boolean;
    refreshSeconds: number;
    syncHiddenToPanel: boolean;
    autoRegister: boolean;
  };
  /** The supervised process. */
  gateway: SupervisorStatus;
  panel: {
    connected: boolean;
    version?: string;
    uptimeSec?: number;
    redisMode?: string;
    authRequired: boolean;
    error?: string;
  };
  sync: WebSync;
  /** The browser half's own report: absent until it runs. */
  client: WebClientProbe;
  /** The gateway's usage ledger, folded into one window. */
  usage: UsageSummary;
  counts: {
    total: number;
    healthy: number;
    cooling: number;
    disabled: number;
    paused: number;
    models: number;
    enabledModels: number;
    hiddenModels: number;
  };
  accounts: readonly WebAccount[];
  models: readonly WebModel[];
  updatedAt?: string;
  error?: string;
  login?: WebLogin;
}
/** Whether the browser half ever reached this host process. */
interface WebClientProbe {
  /** ISO time of the last hello the client half sent. */
  helloAt?: string;
  /** Whatever the browser reported about itself. */
  agent?: string;
}
/** One panel write's outcome, as the browser surfaces read it. */
interface ActionOutcome {
  ok: boolean;
  message?: string;
  status?: WebStatus;
}
/** Dependencies the service reads. */
interface WorkBuddy2ApiServiceOptions {
  version: string;
  providerId: string;
  providerOwned: boolean;
  conflictWith?: string;
  connection: ConnectionStore;
  overrides: ModelOverridesStore;
  client: PanelClient;
  supervisor: PanelSupervisor;
  cachePath?: string;
  warn?: (message: string, error?: unknown) => void;
  onChange?: () => void;
}
/**
 * The plugin's one mutable state holder.
 *
 * Reads are serialized: two surfaces polling at once share one panel request
 * instead of racing two, which matters because a write can land between them and
 * a racing read would publish the pre-write overview as if it were current.
 */
declare class WorkBuddy2ApiService {
  private readonly options;
  private snapshot;
  private catalog;
  private sync;
  private login?;
  private loginStartedAt?;
  private clientProbe;
  private usageCache?;
  private inFlight?;
  private disposed;
  constructor(options: WorkBuddy2ApiServiceOptions);
  /** The cache document this plugin writes. */
  private get cachePath();
  /** Load the last catalog so a cold boot has models before the first poll. */
  private restore;
  /** Persist the catalog for the next boot. */
  private persist;
  /** The merged catalog, for the route's descriptors. */
  catalogModels(): readonly CatalogModel[];
  /** The supervisor, for the routes that drive the process. */
  get supervisor(): PanelSupervisor;
  /** Read the gateway once and fold the answer into the snapshot. */
  refresh(): Promise<void>;
  /** The read itself, kept separate so refresh can serialize it. */
  private read;
  /** Diff the gateway's catalog against ours and publish the difference. */
  private merge;
  /**
   * Record that the browser half ran.
   *
   * The one fact a host process cannot otherwise see: whether the client bundle
   * was loaded and its apply executed. When the settings page is missing from the
   * navigation, this timestamp separates "never ran" from "ran and failed".
   */
  noteClientHello(agent?: string): void;
  /** Turn auto-registration on or off, and re-read so the catalog follows. */
  setAutoRegister(enabled: boolean): Promise<ActionOutcome>;
  /** The whole status document. */
  status(): WebStatus;
  /**
   * Make sure a caller that arrives early still sees data.
   *
   * The poller runs on a schedule, so the first surface to open can land between
   * two reads and stare at an empty document for a whole interval. This awaits
   * one read, but only briefly: a slow gateway costs a short wait, never a hang.
   */
  warm(withinMs?: number): Promise<void>;
  /** Re-read after a write so the answer carries the post-write world. */
  private settled;
  /** Save the connection document (address, key, cadence, sync policy). */
  saveConnection(patch: Partial<ConnectionSettings>): Promise<ActionOutcome>;
  /** Start the supervised gateway. */
  startGateway(): Promise<ActionOutcome>;
  /** Stop the supervised gateway (refused for one we did not spawn). */
  stopGateway(): Promise<ActionOutcome>;
  /** Restart the supervised gateway. */
  restartGateway(): Promise<ActionOutcome>;
  /** Probe the gateway without changing the process. */
  testConnection(): Promise<ActionOutcome>;
  /** Enable or disable one model in the picker, and/or pin its reasoning level. */
  setModel(patch: {
    id: string;
    enabled?: boolean;
    effort?: ThinkingLevel | null;
    efforts?: readonly ThinkingLevel[];
  }): Promise<ActionOutcome>;
  /** Enable or disable every model at once. */
  setAllModels(enabled: boolean): Promise<ActionOutcome>;
  /** Write the locally hidden models into the gateway's own hidden list. */
  syncHidden(): Promise<ActionOutcome>;
  /** Begin an account add; the gateway owns the OAuth flow. */
  loginStart(realm: 'cn' | 'global'): Promise<ActionOutcome>;
  /** Poll one in-flight add; a finished add becomes a real account. */
  loginPoll(state: string): Promise<ActionOutcome>;
  /** Forget the in-flight add. */
  loginCancel(): Promise<ActionOutcome>;
  /** Forget an add that has been pending far too long. */
  expireLogin(now?: number): boolean;
  /** One per-account operation. */
  accountOp(uid: string, op: AccountOp): Promise<ActionOutcome>;
  /** One pool-wide operation. */
  bulkOp(op: BulkOp): Promise<ActionOutcome>;
  /** Import accounts from the cockpit export shape. */
  importAccounts(payload: string): Promise<ActionOutcome>;
  /**
   * The usage window, re-read at most once a second.
   *
   * The ledger is rewritten on every request; reading it on each status call
   * would put a JSON parse on the polling path of every surface, and caching for
   * a second keeps the heat map live without making the page expensive.
   */
  usage(now?: number): UsageSummary;
  /** Whether the service was torn down (the host uses this to skip a late write). */
  get closed(): boolean;
  /** Stop every timer this service owns. */
  dispose(): void;
}
//#endregion
//#region src/adapter.d.ts
/** Provider route this bundle owns by default. */
declare const WORKBUDDY2API_PROVIDER = "workbuddy2api";
/** Constructor dependencies. */
interface WorkBuddy2ApiAdapterOptions {
  /** Provider route; defaults to {@link WORKBUDDY2API_PROVIDER}. */
  providerId?: string;
  /** Name the picker shows for the group. */
  displayName?: string;
  /** Live catalog read; called on every listing and resolution. */
  catalog: () => readonly CatalogModel[];
  /** The panel's `/v1` origin, re-read per request so a URL change applies. */
  v1BaseUrl: () => string;
  /** The panel key sent as `Authorization: Bearer`. */
  apiKey: () => string;
  /** Model ids the local overrides hide from the picker. */
  hidden: () => readonly string[];
  /**
   * The host's durable attachment service, read per request.
   *
   * pi-ai refuses to build a request that still carries an image when this
   * resolves to `undefined` (`UNSUPPORTED_CONTENT`: "pi-ai image input requires
   * the durable attachment service"), so a route that admits image input has to
   * forward the host's store instead of leaving it unset.
   */
  attachments?: () => AttachmentStore | undefined;
  /** Bridge one durable reference into the current tool execution world. */
  imageAccess?: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined;
}
/** What {@link createWorkBuddy2ApiAdapter} hands back. */
interface WorkBuddy2ApiAdapter {
  adapter: PiAiAdapter;
  /** Announce a catalog change so the pickers re-read their lists. */
  invalidate: () => void;
}
/**
 * Assemble the route.
 *
 * The provider's `getModels` and every descriptor's `baseUrl` are read live, so
 * a URL or key change reaches the next request without rebuilding anything. The
 * profile is constructed by hand because `dsh-llm-pi-ai`'s own `resolveProfiles`
 * is not part of its public export surface; every newly required field has to be
 * adopted here explicitly.
 */
declare function createWorkBuddy2ApiAdapter(options: WorkBuddy2ApiAdapterOptions): WorkBuddy2ApiAdapter;
//#endregion
//#region src/routes.d.ts
/** Status document path. */
declare const STATUS_PATH = "/plugins/workbuddy2api-gateway/status";
/** Action endpoint path. */
declare const ACTION_PATH = "/plugins/workbuddy2api-gateway/action";
/** Everything the page may ask the host to do. */
type GatewayAction = {
  action: 'refresh';
} | {
  action: 'test-connection';
} | {
  action: 'gateway-start';
} | {
  action: 'gateway-stop';
} | {
  action: 'gateway-restart';
} | {
  action: 'connection';
  panelUrl?: string;
  apiKey?: string;
  refreshSeconds?: number;
  syncHiddenToPanel?: boolean;
} | {
  action: 'auto-register';
  enabled: boolean;
} | {
  action: 'model';
  id: string;
  enabled?: boolean;
  effort?: ThinkingLevel | null;
  efforts?: readonly ThinkingLevel[];
} | {
  action: 'models-all';
  enabled: boolean;
} | {
  action: 'sync-hidden';
} | {
  action: 'login-start';
  realm: 'cn' | 'global';
} | {
  action: 'login-poll';
  state: string;
} | {
  action: 'login-cancel';
} | {
  action: 'account';
  uid: string;
  op: AccountOp;
} | {
  action: 'bulk';
  op: BulkOp;
} | {
  action: 'import';
  payload: string;
};
/** Parse and shape-check one action; unknown fields are ignored, not trusted. */
declare function parseAction(text: string): GatewayAction | undefined;
/** Execute one parsed action against the service. */
declare function runAction(service: WorkBuddy2ApiService, action: GatewayAction): Promise<unknown>;
//#endregion
//#region src/version.d.ts
/**
 * The build-stamped package version, injected by `tsdown` at build time.
 *
 * Read through this module rather than a literal so the status document, the
 * settings page's version chip, and `package.json` cannot drift apart: the define
 * map in `tsdown.config.ts` reads the same manifest field.
 *
 * @module dsh-workbuddy2api-gateway/version
 */
/** This build's version. */
declare const WORKBUDDY2API_GATEWAY_VERSION: string;
//#endregion
//#region src/paths.d.ts
/** This plugin's data directory. */
declare function pluginDataDir(): string;
/** The supervised gateway's working directory (its auths/ and data/ live here). */
declare function gatewayWorkdir(): string;
/** The gateway's config.json path. */
declare function gatewayConfigPath(): string;
//#endregion
//#region src/index.d.ts
/** Stable Cordis plugin name. */
declare const name = "llm-workbuddy2api-gateway";
/** The model registry required before the route can register. */
declare const inject: string[];
/**
 * Composition defaults.
 *
 * Everything here is a *default*: the settings page writes its own document for
 * the fields a user changes at runtime (address, key, cadence), and the process
 * fields below are what an install starts from. They are deliberately not marked
 * volatile — the page writes its own store, so a save cannot depend on the host's
 * settings write seam being present.
 */
declare const Config: z<Config>;
/** Parsed composition config. */
interface Config {
  providerId: string;
  displayName: string;
  binaryPath: string;
  port: number;
  autoStart: boolean;
  restartLimit: number;
  refreshSeconds: number;
  apiKey: string;
  authDir: string;
  autoRegister: boolean;
}
/** Wire the plugin into the host. */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { ACTION_PATH, type AccountOp, type ActionOutcome, type BulkOp, type CatalogModel, Config, type ConnectionSettings, ConnectionStore, DEFAULT_CONNECTION, type GatewayAction, type ModelOverride, ModelOverridesStore, type PanelAccount, PanelClient, PanelError, type PanelModel, type PanelOverview, PanelSupervisor, STATUS_PATH, type SupervisorLogLine, type SupervisorState, type SupervisorStatus, THINKING_LEVELS, type ThinkingLevel, WORKBUDDY2API_GATEWAY_VERSION, WORKBUDDY2API_PROVIDER, type WebAccount, type WebModel, type WebStatus, type WebSync, WorkBuddy2ApiService, apply, buildCatalog, clampRefreshSeconds, createWorkBuddy2ApiAdapter, gatewayConfigPath, gatewayWorkdir, hiddenIds, inject, isThinkingLevel, name, normalizePanelUrl, panelHiddenList, parseAction, pluginDataDir, runAction, safeMessage, visibleIds };