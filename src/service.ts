/**
 * The plugin's live state: the supervised gateway, the merged catalog, and the
 * write actions the browser surfaces perform.
 *
 * One service owns every mutable fact — the supervisor's process state, the
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

import { catalogCachePath, gatewayUsagePath } from './paths.ts'
import { readUsage } from './usage.ts'
import type { UsageSummary } from './usage.ts'
import { readStoreDocument, writeStoreDocument } from './store-file.ts'
import { buildCatalog, hiddenIds, panelHiddenList, isThinkingLevel } from './catalog.ts'
import type { CatalogModel, ModelOverride, ThinkingLevel } from './catalog.ts'
import type { ModelOverridesStore } from './overrides-store.ts'
import type { ConnectionSettings, ConnectionStore } from './settings-store.ts'
import { PanelClient, PanelError, safeMessage } from './panel-client.ts'
import type { AccountOp, BulkOp, PanelAccount, PanelModel, PanelOverview } from './panel-client.ts'
import type { PanelSupervisor, SupervisorStatus } from './supervisor.ts'

/** Format version of the cached catalog document. */
const CACHE_VERSION = 2

/** One account as the browser sees it. */
export interface WebAccount {
  uid: string
  nickname: string
  realm: string
  credits?: number
  creditsTotal?: number
  earliestExpiry?: string
  status: 'active' | 'disabled' | 'paused' | 'cooling'
  coolingUntil?: string
  disabledReason?: string
  tokenExpiresAt?: string
  hasRefreshToken: boolean
  checkinDone: boolean
  successCount: number
  failStreak: number
  lastSuccess?: string
  lastModel?: string
  requestCount?: number
  totalTokens?: number
  rateLimitedModels: number
  enterprise: boolean
}

/** One model as the browser sees it. */
export interface WebModel {
  id: string
  name: string
  description?: string
  vendor?: string
  credits?: string
  contextLength: number
  maxOutputTokens: number
  efforts: readonly string[]
  defaultEffort?: string
  enabled: boolean
  canDisableThinking: boolean
  supportsImages: boolean
  supportsReasoning: boolean
  onlyReasoning: boolean
  tags: readonly string[]
}

/** The account-add flow in flight, when there is one. */
export interface WebLogin {
  state: string
  url: string
  realm: string
  startedAt: string
}

/** What one poll changed about the catalog. */
export interface WebSync {
  lastSyncedAt?: string
  added: readonly string[]
  removed: readonly string[]
  changed: readonly string[]
  /** Whether a new model joins the DSH picker without asking. */
  autoRegister: boolean
}

/** Everything the browser surfaces render. */
export interface WebStatus {
  ok: true
  version: string
  provider: { id: string, owned: boolean, conflict?: string }
  connection: {
    panelUrl: string
    hasApiKey: boolean
    refreshSeconds: number
    syncHiddenToPanel: boolean
    autoRegister: boolean
  }
  /** The supervised process. */
  gateway: SupervisorStatus
  panel: {
    connected: boolean
    version?: string
    uptimeSec?: number
    redisMode?: string
    authRequired: boolean
    error?: string
  }
  sync: WebSync
  /** The browser half's own report: absent until it runs. */
  client: WebClientProbe
  /** The gateway's usage ledger, folded into one window. */
  usage: UsageSummary
  counts: {
    total: number
    healthy: number
    cooling: number
    disabled: number
    paused: number
    models: number
    enabledModels: number
    hiddenModels: number
  }
  accounts: readonly WebAccount[]
  models: readonly WebModel[]
  updatedAt?: string
  error?: string
  login?: WebLogin
}

/** Whether the browser half ever reached this host process. */
export interface WebClientProbe {
  /** ISO time of the last hello the client half sent. */
  helloAt?: string
  /** Whatever the browser reported about itself. */
  agent?: string
}

/** One panel write's outcome, as the browser surfaces read it. */
export interface ActionOutcome {
  ok: boolean
  message?: string
  status?: WebStatus
}

/** Dependencies the service reads. */
export interface WorkBuddy2ApiServiceOptions {
  version: string
  providerId: string
  providerOwned: boolean
  conflictWith?: string
  connection: ConnectionStore
  overrides: ModelOverridesStore
  client: PanelClient
  supervisor: PanelSupervisor
  cachePath?: string
  warn?: (message: string, error?: unknown) => void
  onChange?: () => void
}

/** Map one panel account onto the browser projection. */
export function webAccount(account: PanelAccount): WebAccount {
  const status = account.disabled
    ? 'disabled'
    : account.cooling
      ? 'cooling'
      : account.paused
        ? 'paused'
        : 'active'
  return {
    uid: account.uid,
    nickname: account.nickname,
    realm: account.realm,
    ...account.credits === undefined ? {} : { credits: account.credits },
    ...account.creditsTotal === undefined ? {} : { creditsTotal: account.creditsTotal },
    ...account.earliestExpiry === undefined ? {} : { earliestExpiry: account.earliestExpiry },
    status,
    ...account.coolingUntil === undefined ? {} : { coolingUntil: account.coolingUntil },
    ...account.disabledReason === undefined ? {} : { disabledReason: account.disabledReason },
    ...account.tokenExpiresAt === undefined ? {} : { tokenExpiresAt: account.tokenExpiresAt },
    hasRefreshToken: account.hasRefreshToken,
    checkinDone: account.checkinDone,
    successCount: account.successCount,
    failStreak: account.failStreak,
    ...account.lastSuccess === undefined ? {} : { lastSuccess: account.lastSuccess },
    ...account.lastModel === undefined ? {} : { lastModel: account.lastModel },
    ...account.requestCount === undefined ? {} : { requestCount: account.requestCount },
    ...account.totalTokens === undefined ? {} : { totalTokens: account.totalTokens },
    rateLimitedModels: account.rateLimitedModels.length,
    enterprise: account.enterprise,
  }
}

/** Map one merged model onto the browser projection. */
export function webModel(model: CatalogModel): WebModel {
  return {
    id: model.id,
    name: model.name,
    ...model.description === undefined ? {} : { description: model.description },
    ...model.vendor === undefined ? {} : { vendor: model.vendor },
    ...model.credits === undefined ? {} : { credits: model.credits },
    contextLength: model.contextLength,
    maxOutputTokens: model.maxOutputTokens,
    efforts: model.efforts,
    ...model.defaultEffort === undefined ? {} : { defaultEffort: model.defaultEffort },
    enabled: model.enabled,
    canDisableThinking: model.canDisableThinking,
    supportsImages: model.supportsImages,
    supportsReasoning: model.supportsReasoning,
    onlyReasoning: model.onlyReasoning,
    tags: model.tags,
  }
}

/** A descriptor's stable identity, for change detection across polls. */
function fingerprint(model: CatalogModel): string {
  return [
    model.id,
    model.name,
    String(model.contextLength),
    String(model.maxOutputTokens),
    model.efforts.join(','),
    model.defaultEffort ?? '',
    model.supportsImages ? 'i' : '',
    model.supportsReasoning ? 'r' : '',
    model.canDisableThinking ? 'd' : '',
    model.credits ?? '',
  ].join('|')
}

/** What one read saw. */
interface GatewaySnapshot {
  overview?: PanelOverview
  models: readonly PanelModel[]
  error?: string
  at?: string
}

/**
 * The plugin's one mutable state holder.
 *
 * Reads are serialized: two surfaces polling at once share one panel request
 * instead of racing two, which matters because a write can land between them and
 * a racing read would publish the pre-write overview as if it were current.
 */
export class WorkBuddy2ApiService {
  private snapshot: GatewaySnapshot = { models: [] }
  private catalog: readonly CatalogModel[] = []
  private sync: WebSync
  private login?: WebLogin
  private loginStartedAt?: number
  private clientProbe: WebClientProbe = {}
  private usageCache?: { at: number, summary: UsageSummary }
  private inFlight?: Promise<void>
  private disposed = false

  constructor(private readonly options: WorkBuddy2ApiServiceOptions) {
    this.sync = { added: [], removed: [], changed: [], autoRegister: true }
    this.restore()
  }

  /** The cache document this plugin writes. */
  private get cachePath(): string {
    return this.options.cachePath ?? catalogCachePath()
  }

  /** Load the last catalog so a cold boot has models before the first poll. */
  private restore(): void {
    const stored = readStoreDocument(this.cachePath, CACHE_VERSION, document => ({
      models: Array.isArray(document['models']) ? document['models'] as CatalogModel[] : undefined,
      updatedAt: typeof document['updatedAt'] === 'string' ? document['updatedAt'] : undefined,
    }))
    if (stored?.models === undefined) return
    const catalog = stored.models.filter(entry => typeof entry?.id === 'string')
    if (catalog.length === 0) return
    this.catalog = catalog
    if (stored.updatedAt !== undefined) this.sync = { ...this.sync, lastSyncedAt: stored.updatedAt }
  }

  /** Persist the catalog for the next boot. */
  private persist(): void {
    writeStoreDocument(this.cachePath, {
      version: CACHE_VERSION,
      updatedAt: this.sync.lastSyncedAt ?? new Date().toISOString(),
      models: this.catalog,
    })
  }

  /** The merged catalog, for the route's descriptors. */
  catalogModels(): readonly CatalogModel[] {
    return this.catalog
  }

  /** The supervisor, for the routes that drive the process. */
  get supervisor(): PanelSupervisor {
    return this.options.supervisor
  }

  /** Read the gateway once and fold the answer into the snapshot. */
  async refresh(): Promise<void> {
    if (this.inFlight !== undefined) return this.inFlight
    this.inFlight = this.read().finally(() => {
      this.inFlight = undefined
    })
    return this.inFlight
  }

  /** The read itself, kept separate so refresh can serialize it. */
  private async read(): Promise<void> {
    const connection = this.options.connection.current()
    if (!connection.panelUrl) {
      this.snapshot = { ...this.snapshot, error: 'no gateway address configured' }
      return
    }
    const [overview, models] = await Promise.allSettled([
      this.options.client.overview(),
      this.options.client.models(),
    ])
    if (overview.status === 'fulfilled' && models.status === 'fulfilled') {
      this.snapshot = {
        overview: overview.value,
        models: models.value,
        at: new Date().toISOString(),
      }
      this.merge(models.value)
      return
    }
    const failed = overview.status === 'rejected' ? overview : models
    const reason = failed.status === 'rejected' ? safeMessage(failed.reason) : 'gateway read failed'
    this.snapshot = { ...this.snapshot, error: reason }
    this.options.warn?.(
      'workbuddy2api-gateway: gateway read failed',
      failed.status === 'rejected' ? failed.reason : undefined,
    )
    // Keep the previous catalog: a gateway that is restarting must not empty the
    // picker, and the model list is the one thing a running session depends on.
  }

  /** Diff the gateway's catalog against ours and publish the difference. */
  private merge(models: readonly PanelModel[]): void {
    const overrides = this.options.overrides.all()
    const previous = new Map(this.catalog.map(model => [model.id, model]))
    const merged = buildCatalog(models, overrides)
    const added: string[] = []
    const changed: string[] = []
    const seen = new Set<string>()
    const adoptAll = this.sync.autoRegister || previous.size === 0
    for (const model of merged) {
      seen.add(model.id)
      const before = previous.get(model.id)
      if (before === undefined) {
        if (adoptAll) added.push(model.id)
        continue
      }
      if (fingerprint(before) !== fingerprint(model)) changed.push(model.id)
    }
    const removed = [...previous.keys()].filter(id => !seen.has(id))
    const announce = added.length > 0 || removed.length > 0 || changed.length > 0
    // autoRegister off means: keep what the picker already knows, and refuse to
    // grow it without a human click. Removals still apply — a model the gateway
    // stopped answering cannot be sent to it.
    this.catalog = adoptAll ? merged : merged.filter(model => previous.has(model.id))
    this.sync = {
      lastSyncedAt: new Date().toISOString(),
      added: added.slice(0, 20),
      removed: removed.slice(0, 20),
      changed: changed.slice(0, 20),
      autoRegister: this.sync.autoRegister,
    }
    this.persist()
    if (announce) this.options.onChange?.()
  }

  /**
   * Record that the browser half ran.
   *
   * The one fact a host process cannot otherwise see: whether the client bundle
   * was loaded and its apply executed. When the settings page is missing from the
   * navigation, this timestamp separates "never ran" from "ran and failed".
   */
  noteClientHello(agent?: string): void {
    this.clientProbe = {
      helloAt: new Date().toISOString(),
      ...agent === undefined ? {} : { agent },
    }
  }

  /** Turn auto-registration on or off, and re-read so the catalog follows. */
  async setAutoRegister(enabled: boolean): Promise<ActionOutcome> {
    this.sync = { ...this.sync, autoRegister: enabled }
    if (enabled) {
      // Adopt everything the gateway currently answers on the next read.
      this.catalog = []
      this.persist()
    }
    this.options.onChange?.()
    await this.refresh().catch(() => {})
    return { ok: true, status: this.status() }
  }

  /** The whole status document. */
  status(): WebStatus {
    const connection = this.options.connection.current()
    const overview = this.snapshot.overview
    const gateway = this.options.supervisor.status()
    const enabledModels = this.catalog.filter(model => model.enabled).length
    const counts = {
      total: overview?.total ?? 0,
      healthy: overview?.healthy ?? 0,
      cooling: overview?.cooling ?? 0,
      disabled: overview?.disabled ?? 0,
      paused: overview?.paused ?? 0,
      models: this.catalog.length,
      enabledModels,
      hiddenModels: this.catalog.length - enabledModels,
    }
    return {
      ok: true,
      version: this.options.version,
      provider: {
        id: this.options.providerId,
        owned: this.options.providerOwned,
        ...this.options.conflictWith === undefined ? {} : { conflict: this.options.conflictWith },
      },
      connection: {
        panelUrl: connection.panelUrl,
        hasApiKey: connection.apiKey !== '',
        refreshSeconds: connection.refreshSeconds,
        syncHiddenToPanel: connection.syncHiddenToPanel,
        autoRegister: this.sync.autoRegister,
      },
      gateway,
      panel: {
        // "Connected" is the panel's own answer, not the process state: a gateway
        // that runs but refuses the key is up and unusable, and the page has to
        // say which of the two it is.
        connected: overview !== undefined,
        ...overview?.version === undefined ? {} : { version: overview.version },
        ...overview?.uptimeSec === undefined ? {} : { uptimeSec: overview.uptimeSec },
        ...overview?.redisMode === undefined ? {} : { redisMode: overview.redisMode },
        authRequired: overview?.authRequired ?? connection.apiKey !== '',
        ...this.snapshot.error === undefined ? {} : { error: this.snapshot.error },
      },
      sync: this.sync,
      client: this.clientProbe,
      usage: this.usage(),
      counts,
      accounts: (overview?.accounts ?? []).map(webAccount),
      models: this.catalog.map(webModel),
      ...this.snapshot.at === undefined ? {} : { updatedAt: this.snapshot.at },
      ...this.snapshot.error === undefined ? {} : { error: this.snapshot.error },
      ...this.login === undefined ? {} : { login: this.login },
    }
  }

  /**
   * Make sure a caller that arrives early still sees data.
   *
   * The poller runs on a schedule, so the first surface to open can land between
   * two reads and stare at an empty document for a whole interval. This awaits
   * one read, but only briefly: a slow gateway costs a short wait, never a hang.
   */
  async warm(withinMs = 1_500): Promise<void> {
    if (this.snapshot.at !== undefined && Date.now() - Date.parse(this.snapshot.at) < 5_000) return
    await Promise.race([
      this.refresh().catch(() => {}),
      new Promise<void>(resolveWait => { setTimeout(resolveWait, withinMs).unref?.() }),
    ])
  }

  /** Re-read after a write so the answer carries the post-write world. */
  private async settled(outcome: { ok: boolean, message?: string }): Promise<ActionOutcome> {
    await this.refresh().catch(() => {})
    return { ...outcome, status: this.status() }
  }

  /** Save the connection document (address, key, cadence, sync policy). */
  async saveConnection(patch: Partial<ConnectionSettings>): Promise<ActionOutcome> {
    const rotated = patch.apiKey !== undefined && patch.apiKey !== ''
      && patch.apiKey !== this.options.supervisor.apiKeyFromConfig()
    this.options.connection.patch(patch)
    this.options.supervisor.invalidateBinary()
    // One key means the gateway's own document: a key living only here would leave
    // the gateway refusing its supervisor and the web panel locked out.
    const written = rotated && this.options.supervisor.updateConfigApiKey(patch.apiKey ?? '')
    if (written) await this.options.supervisor.restart()
    this.options.onChange?.()
    return this.settled({
      ok: !rotated || written,
      message: rotated
        ? written ? 'gateway api key updated; gateway restarted' : 'could not write the gateway config'
        : 'connection saved',
    })
  }

  /** Start the supervised gateway. */
  async startGateway(): Promise<ActionOutcome> {
    const status = await this.options.supervisor.start()
    await this.refresh().catch(() => {})
    return {
      ok: status.state !== 'failed',
      ...status.error === undefined ? {} : { message: status.error },
      status: this.status(),
    }
  }

  /** Stop the supervised gateway (refused for one we did not spawn). */
  async stopGateway(): Promise<ActionOutcome> {
    const status = await this.options.supervisor.stop()
    await this.refresh().catch(() => {})
    return {
      ok: status.error === undefined,
      ...status.error === undefined ? {} : { message: status.error },
      status: this.status(),
    }
  }

  /** Restart the supervised gateway. */
  async restartGateway(): Promise<ActionOutcome> {
    const status = await this.options.supervisor.restart()
    await this.refresh().catch(() => {})
    return {
      ok: status.state !== 'failed',
      ...status.error === undefined ? {} : { message: status.error },
      status: this.status(),
    }
  }

  /** Probe the gateway without changing the process. */
  async testConnection(): Promise<ActionOutcome> {
    try {
      const overview = await this.options.client.overview()
      this.snapshot = { ...this.snapshot, overview, at: new Date().toISOString() }
      return this.settled({ ok: true, message: 'gateway answered with ' + String(overview.total) + ' accounts' })
    } catch (error: unknown) {
      const message = error instanceof PanelError ? error.message : safeMessage(error)
      await this.refresh().catch(() => {})
      return { ok: false, message, status: this.status() }
    }
  }

  /** Enable or disable one model in the picker, and/or pin its reasoning level. */
  async setModel(patch: {
    id: string
    enabled?: boolean
    effort?: ThinkingLevel | null
    efforts?: readonly ThinkingLevel[]
  }): Promise<ActionOutcome> {
    this.options.overrides.set(patch.id, {
      ...patch.enabled === undefined ? {} : { enabled: patch.enabled },
      ...patch.effort === undefined ? {} : { effort: patch.effort },
      ...patch.efforts === undefined ? {} : { efforts: patch.efforts },
    })
    this.merge(this.snapshot.models)
    this.options.onChange?.()
    return { ok: true, status: this.status() }
  }

  /** Enable or disable every model at once. */
  async setAllModels(enabled: boolean): Promise<ActionOutcome> {
    this.options.overrides.setAll(this.catalog, enabled)
    this.merge(this.snapshot.models)
    this.options.onChange?.()
    return { ok: true, status: this.status() }
  }

  /** Write the locally hidden models into the gateway's own hidden list. */
  async syncHidden(): Promise<ActionOutcome> {
    try {
      // The gateway's own hidden list is the base: it may carry entries another
      // client wrote, and this action pushes ours on top instead of replacing
      // somebody else's decision.
      const config = await this.options.client.config()
      const models = config.raw['models']
      const previous: string[] = []
      if (typeof models === 'object' && models !== null && !Array.isArray(models)) {
        const list = (models as Record<string, unknown>)['hidden']
        if (Array.isArray(list)) {
          for (const entry of list) if (typeof entry === 'string') previous.push(entry)
        }
      }
      const hidden = panelHiddenList(this.catalog, previous)
      await this.options.client.saveHidden(hidden)
      return this.settled({
        ok: true,
        message: 'pushed ' + String(hiddenIds(this.catalog).length) + ' hidden models to the gateway',
      })
    } catch (error: unknown) {
      return { ok: false, message: safeMessage(error), status: this.status() }
    }
  }

  /** Begin an account add; the gateway owns the OAuth flow. */
  async loginStart(realm: 'cn' | 'global'): Promise<ActionOutcome> {
    try {
      const started = await this.options.client.loginStart(realm)
      this.login = {
        state: started.state,
        url: started.url,
        realm: started.realm,
        startedAt: new Date().toISOString(),
      }
      this.loginStartedAt = Date.now()
      return { ok: true, status: this.status() }
    } catch (error: unknown) {
      return { ok: false, message: safeMessage(error), status: this.status() }
    }
  }

  /** Poll one in-flight add; a finished add becomes a real account. */
  async loginPoll(state: string): Promise<ActionOutcome> {
    try {
      const polled = await this.options.client.loginPoll(state)
      // A pending add keeps the waiting state: the page renders it from `login`,
      // not from a missing account.
      if (!polled.done) return { ok: true, status: this.status() }
      this.login = undefined
      this.loginStartedAt = undefined
      await this.refresh().catch(() => {})
      return {
        ok: true,
        ...polled.message === undefined ? {} : { message: polled.message },
        status: this.status(),
      }
    } catch (error: unknown) {
      return { ok: false, message: safeMessage(error), status: this.status() }
    }
  }

  /** Forget the in-flight add. */
  async loginCancel(): Promise<ActionOutcome> {
    this.login = undefined
    this.loginStartedAt = undefined
    return { ok: true, status: this.status() }
  }

  /** Forget an add that has been pending far too long. */
  expireLogin(now = Date.now()): boolean {
    if (this.login === undefined || this.loginStartedAt === undefined) return false
    if (now - this.loginStartedAt < 10 * 60_000) return false
    this.login = undefined
    this.loginStartedAt = undefined
    return true
  }

  /** One per-account operation. */
  async accountOp(uid: string, op: AccountOp): Promise<ActionOutcome> {
    try {
      await this.options.client.accountOp(uid, op)
      return this.settled({ ok: true, message: op + ' sent' })
    } catch (error: unknown) {
      return { ok: false, message: safeMessage(error), status: this.status() }
    }
  }

  /** One pool-wide operation. */
  async bulkOp(op: BulkOp): Promise<ActionOutcome> {
    try {
      await this.options.client.bulkOp(op)
      return this.settled({ ok: true, message: op + ' sent' })
    } catch (error: unknown) {
      return { ok: false, message: safeMessage(error), status: this.status() }
    }
  }

  /** Import accounts from the cockpit export shape. */
  async importAccounts(payload: string): Promise<ActionOutcome> {
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      return { ok: false, message: 'payload is not JSON', status: this.status() }
    }
    const list = Array.isArray(parsed) ? parsed : [parsed]
    const accounts = list.filter((entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry))
    if (accounts.length === 0) {
      return { ok: false, message: 'no account objects found', status: this.status() }
    }
    try {
      const result = await this.options.client.importAccounts(accounts)
      return this.settled({
        ok: true,
        message: 'imported ' + String(result.imported ?? 0) + ', skipped ' + String(result.skipped ?? 0),
      })
    } catch (error: unknown) {
      return { ok: false, message: safeMessage(error), status: this.status() }
    }
  }

  /**
   * The usage window, re-read at most once a second.
   *
   * The ledger is rewritten on every request; reading it on each status call
   * would put a JSON parse on the polling path of every surface, and caching for
   * a second keeps the heat map live without making the page expensive.
   */
  usage(now = Date.now()): UsageSummary {
    if (this.usageCache !== undefined && now - this.usageCache.at < 1_000) return this.usageCache.summary
    const summary = readUsage(gatewayUsagePath())
    this.usageCache = { at: now, summary }
    return summary
  }

  /** Whether the service was torn down (the host uses this to skip a late write). */
  get closed(): boolean {
    return this.disposed
  }

  /** Stop every timer this service owns. */
  dispose(): void {
    this.disposed = true
  }
}

export { isThinkingLevel }
