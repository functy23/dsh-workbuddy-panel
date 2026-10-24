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

import { isJsonObject } from './json-value.ts'

/** Where to reach the panel, and with which key. */
export interface PanelEndpoint {
  /** Panel origin, e.g. `http://127.0.0.1:7863` (no trailing slash, no `/v1`). */
  baseUrl: string
  /** Panel `api_key`; empty when the panel runs without auth. */
  apiKey: string
}

/** Failure classes the surfaces distinguish. */
export type PanelErrorKind = 'auth' | 'network' | 'http' | 'shape'

/** One diagnosable panel failure. */
export class PanelError extends Error {
  constructor(
    message: string,
    readonly kind: PanelErrorKind,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'PanelError'
  }
}

/** One pool account as the panel reports it. */
export interface PanelAccount {
  uid: string
  nickname: string
  realm: string
  credits?: number
  creditsTotal?: number
  creditsExpiring?: number
  earliestExpiry?: string
  disabled: boolean
  disabledReason?: string
  paused: boolean
  cooling: boolean
  coolingUntil?: string
  coolingKind?: string
  enterprise: boolean
  tokenExpiresAt?: string
  hasRefreshToken: boolean
  checkinDone: boolean
  successCount: number
  errTotal: number
  failStreak: number
  inFlight: number
  lastSuccess?: string
  lastErr?: string
  lastModel?: string
  requestCount?: number
  totalTokens?: number
  lastLatencyMs?: number
  rateLimitedModels: readonly { model: string, unlockAt?: string }[]
}

/** Overview figures plus the pool listing. */
export interface PanelOverview {
  version?: string
  uptimeSec?: number
  authRequired: boolean
  redisMode?: string
  total: number
  healthy: number
  cooling: number
  disabled: number
  paused: number
  inFlightFull: boolean
  accounts: readonly PanelAccount[]
  balanceRefreshSec?: number
  balanceRefreshedAt?: string
}

/** One model as the panel's live catalog reports it. */
export interface PanelModel {
  id: string
  name: string
  description?: string
  vendor?: string
  credits?: string
  contextLength: number
  maxOutputTokens: number
  supportedEfforts: readonly string[]
  defaultEffort?: string
  canDisableThinking: boolean
  supportsImages: boolean
  supportsReasoning: boolean
  onlyReasoning: boolean
  tags: readonly string[]
}

/** A parsed panel configuration document; only the paths this plugin touches are typed. */
export interface PanelConfigDocument {
  raw: Record<string, unknown>
  hidden: readonly string[]
}

/** Outcome of an account add flow's poll. */
export interface PanelLoginPoll {
  done: boolean
  message?: string
  uid?: string
  nickname?: string
}

/** Result of a panel write. */
export interface PanelWriteResult {
  ok: boolean
  message?: string
  restartRequired?: readonly string[]
}

/** Largest body accepted from the panel; catalogs are large, nothing else is. */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

/** Default admin request timeout. */
const REQUEST_TIMEOUT_MS = 20_000

/** The catalog endpoint queries the upstream and is allowed to take longer. */
const CATALOG_TIMEOUT_MS = 60_000

/** Redact token-shaped content before a message crosses to the browser. */
export function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, '[redacted token]')
    .replace(/(\b(?:code|token|refresh_token|access_token)=)[^&\s]+/giu, '$1[redacted]')
    .slice(0, 400)
}

/** Normalize a user-supplied panel URL into an origin. */
export function normalizePanelUrl(raw: string): string {
  const trimmed = raw.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new PanelError(`面板地址无法解析：${raw}`, 'shape')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new PanelError('面板地址必须是 http 或 https', 'shape')
  }
  // Accept a pasted "`.../v1`" or "`.../panel`" too: both are URLs a user copies
  // out of the panel, and neither is the admin origin.
  let pathname = parsed.pathname.replace(/\/+$/, '')
  pathname = pathname.replace(/\/(v1|panel)$/i, '')
  return `${parsed.protocol}//${parsed.host}${pathname}`
}

/** Read a numeric field tolerantly. */
function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Read a string field tolerantly. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Read a boolean flag, defaulting to false. */
function flag(value: unknown): boolean {
  return value === true
}

/** Read a time-typed field, dropping Go's zero value. */
function timeField(value: unknown): string | undefined {
  const text = str(value)
  if (text === undefined || text.startsWith('0001-01-01')) return undefined
  return text
}

/** A string list; anything else is an empty list. */
function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Decode one account row. */
export function parseAccount(value: unknown): PanelAccount | undefined {
  if (!isJsonObject(value)) return undefined
  const uid = str(value['uid'])
  if (uid === undefined) return undefined
  const usage = isJsonObject(value['token_usage']) ? value['token_usage'] : undefined
  const rateLimited = Array.isArray(value['rate_limited_models'])
    ? value['rate_limited_models'].flatMap((entry) => {
      if (!isJsonObject(entry)) return []
      const model = str(entry['model'])
      if (model === undefined) return []
      const unlockAt = timeField(entry['unlock_at'])
      return [unlockAt === undefined ? { model } : { model, unlockAt }]
    })
    : []
  return {
    uid,
    nickname: str(value['nickname']) ?? uid.slice(0, 8),
    realm: str(value['realm']) ?? 'cn',
    ...num(value['credits']) === undefined ? {} : { credits: num(value['credits']) },
    ...num(value['credits_total']) === undefined ? {} : { creditsTotal: num(value['credits_total']) },
    ...num(value['credits_expiring']) === undefined ? {} : { creditsExpiring: num(value['credits_expiring']) },
    ...timeField(value['credits_earliest_expiry']) === undefined
      ? {}
      : { earliestExpiry: timeField(value['credits_earliest_expiry']) },
    disabled: flag(value['disabled']),
    ...str(value['disabled_reason']) === undefined ? {} : { disabledReason: str(value['disabled_reason']) },
    paused: flag(value['paused']),
    cooling: flag(value['cooling']),
    ...timeField(value['until']) === undefined ? {} : { coolingUntil: timeField(value['until']) },
    ...str(value['cool_kind']) === undefined ? {} : { coolingKind: str(value['cool_kind']) },
    enterprise: flag(value['enterprise']),
    ...timeField(value['token_expires_at']) === undefined
      ? {}
      : { tokenExpiresAt: timeField(value['token_expires_at']) },
    hasRefreshToken: flag(value['has_refresh_token']),
    checkinDone: flag(value['checkin_done']),
    successCount: num(value['success_count']) ?? 0,
    errTotal: num(value['err_total']) ?? 0,
    failStreak: num(value['consecutive_fails']) ?? 0,
    inFlight: num(value['in_flight']) ?? 0,
    ...timeField(value['last_success']) === undefined ? {} : { lastSuccess: timeField(value['last_success']) },
    ...timeField(value['last_err']) === undefined ? {} : { lastErr: timeField(value['last_err']) },
    ...usage === undefined ? {} : {
      ...str(usage['last_model']) === undefined ? {} : { lastModel: str(usage['last_model']) },
      ...num(usage['request_count']) === undefined ? {} : { requestCount: num(usage['request_count']) },
      ...num(usage['total_tokens']) === undefined ? {} : { totalTokens: num(usage['total_tokens']) },
      ...num(usage['last_latency_ms']) === undefined ? {} : { lastLatencyMs: num(usage['last_latency_ms']) },
    },
    rateLimitedModels: rateLimited,
  }
}

/** Decode one model row. */
export function parseModel(value: unknown): PanelModel | undefined {
  if (!isJsonObject(value)) return undefined
  const id = str(value['id'])
  if (id === undefined) return undefined
  return {
    id,
    name: str(value['name']) ?? id,
    ...str(value['description']) === undefined ? {} : { description: str(value['description']) },
    ...str(value['vendor']) === undefined ? {} : { vendor: str(value['vendor']) },
    ...str(value['credits']) === undefined ? {} : { credits: str(value['credits']) },
    contextLength: num(value['context_length']) ?? 0,
    maxOutputTokens: num(value['max_output_tokens']) ?? 0,
    supportedEfforts: strList(value['supported_efforts']),
    ...str(value['default_effort']) === undefined ? {} : { defaultEffort: str(value['default_effort']) },
    canDisableThinking: flag(value['can_disable_thinking']),
    supportsImages: flag(value['supports_images']),
    supportsReasoning: flag(value['supports_reasoning']),
    onlyReasoning: flag(value['only_reasoning']),
    tags: strList(value['tags']),
  }
}

/** The panel admin client. */
export class PanelClient {
  constructor(private readonly endpoint: () => PanelEndpoint) {}

  /** Current origin. */
  baseUrl(): string {
    return this.endpoint().baseUrl
  }

  /** The OpenAI-compatible base URL the route points at. */
  v1BaseUrl(): string {
    return `${this.baseUrl()}/v1`
  }

  /** Request one admin path and decode its JSON object body. */
  private async request(
    path: string,
    init: { method?: string, body?: unknown, timeoutMs?: number, form?: FormData } = {},
  ): Promise<Record<string, unknown>> {
    const { baseUrl, apiKey } = this.endpoint()
    const url = `${baseUrl}/panel/api${path}`
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey !== '') headers['Authorization'] = `Bearer ${apiKey}`
    let body: BodyInit | undefined
    if (init.form !== undefined) {
      body = init.form
    } else if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(init.body)
    }
    let response: Response
    try {
      response = await fetch(url, {
        method: init.method ?? (body === undefined ? 'GET' : 'POST'),
        headers,
        ...body === undefined ? {} : { body },
        signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
      })
    } catch (error: unknown) {
      throw new PanelError(`无法连接面板 ${baseUrl}：${safeMessage(error)}`, 'network')
    }
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      const decoded = text === '' ? undefined : (() => {
        try {
          return JSON.parse(text) as unknown
        } catch {
          return undefined
        }
      })()
      const detail = isJsonObject(decoded)
        ? str(decoded['error']) ?? str(decoded['message'])
        : undefined
      const kind: PanelErrorKind = response.status === 401 || response.status === 403 ? 'auth' : 'http'
      throw new PanelError(
        detail ?? `面板返回 HTTP ${response.status}${text === '' ? '' : `：${text.slice(0, 200)}`}`,
        kind,
        response.status,
      )
    }
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new PanelError('面板响应体过大', 'shape')
    }
    if (text.trim() === '') return {}
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new PanelError('面板响应不是 JSON（地址是否指向了别的服务？）', 'shape')
    }
    if (!isJsonObject(parsed)) throw new PanelError('面板响应不是 JSON 对象', 'shape')
    return parsed
  }

  /** The account pool overview. */
  async overview(): Promise<PanelOverview> {
    const body = await this.request('/overview', { timeoutMs: 3_000 })
    const accounts = Array.isArray(body['accounts'])
      ? body['accounts'].flatMap(entry => {
        const account = parseAccount(entry)
        return account === undefined ? [] : [account]
      })
      : []
    return {
      ...str(body['version']) === undefined ? {} : { version: str(body['version']) },
      ...num(body['uptime_sec']) === undefined ? {} : { uptimeSec: num(body['uptime_sec']) },
      authRequired: flag(body['auth_required']),
      ...str(body['redis_mode']) === undefined ? {} : { redisMode: str(body['redis_mode']) },
      total: num(body['total']) ?? accounts.length,
      healthy: num(body['healthy']) ?? 0,
      cooling: num(body['cooling']) ?? 0,
      disabled: num(body['disabled']) ?? 0,
      paused: num(body['paused']) ?? 0,
      inFlightFull: flag(body['in_flight_full']),
      accounts,
      ...num(body['balance_refresh_sec']) === undefined
        ? {}
        : { balanceRefreshSec: num(body['balance_refresh_sec']) },
      ...timeField(body['balance_refreshed_at']) === undefined
        ? {}
        : { balanceRefreshedAt: timeField(body['balance_refreshed_at']) },
    }
  }

  /** The live model catalog (each entry's id is already realm-prefixed). */
  async models(): Promise<PanelModel[]> {
    const body = await this.request('/models', { timeoutMs: CATALOG_TIMEOUT_MS })
    if (!Array.isArray(body['models'])) throw new PanelError('面板模型列表格式不符', 'shape')
    return body['models'].flatMap(entry => {
      const model = parseModel(entry)
      return model === undefined ? [] : [model]
    })
  }

  /** The panel configuration document, plus the hidden-model list it carries. */
  async config(): Promise<PanelConfigDocument> {
    const body = await this.request('/config')
    const config = isJsonObject(body['config']) ? body['config'] : undefined
    if (config === undefined) throw new PanelError('面板配置格式不符', 'shape')
    const models = isJsonObject(config['models']) ? config['models'] : undefined
    return { raw: config, hidden: models === undefined ? [] : strList(models['hidden']) }
  }

  /** Save a whole configuration document (the panel validates and hot-applies it). */
  async saveConfig(config: Record<string, unknown>): Promise<PanelWriteResult> {
    const body = await this.request('/config', { method: 'POST', body: config })
    const restartRequired = strList(body['restart_required'])
    return {
      ok: body['ok'] !== false,
      ...restartRequired.length === 0 ? {} : { restartRequired },
    }
  }

  /** Replace the panel's hidden-model list, preserving every other field. */
  async saveHidden(hidden: readonly string[]): Promise<PanelWriteResult> {
    const document = await this.config()
    const models = isJsonObject(document.raw['models']) ? { ...document.raw['models'] } : {}
    const next = { ...document.raw, models: { ...models, hidden: [...hidden] } }
    return this.saveConfig(next)
  }

  /** Begin an OAuth account add; returns the URL the user opens. */
  async loginStart(realm: 'cn' | 'global'): Promise<{ url: string, state: string, realm: string }> {
    const body = await this.request('/login/start', { method: 'POST', body: { realm } })
    const url = str(body['url'])
    const state = str(body['state'])
    if (url === undefined || state === undefined) throw new PanelError('面板未返回登录地址', 'shape')
    return { url, state, realm: str(body['realm']) ?? realm }
  }

  /** Poll one in-flight add. */
  async loginPoll(state: string): Promise<PanelLoginPoll> {
    const body = await this.request(`/login/poll?state=${encodeURIComponent(state)}`)
    if (body['done'] === true) {
      return {
        done: true,
        ...str(body['uid']) === undefined ? {} : { uid: str(body['uid']) },
        ...str(body['nickname']) === undefined ? {} : { nickname: str(body['nickname']) },
      }
    }
    return { done: false, ...str(body['message']) === undefined ? {} : { message: str(body['message']) } }
  }

  /** Login regions the panel offers for the international realm. */
  async regions(): Promise<readonly { code: string, name: string }[]> {
    const body = await this.request('/login/regions')
    if (!Array.isArray(body['regions'])) return []
    return body['regions'].flatMap(entry => {
      if (!isJsonObject(entry)) return []
      const code = str(entry['code'])
      if (code === undefined) return []
      return [{ code, name: str(entry['name']) ?? code }]
    })
  }

  /** One per-account operation. */
  async accountOp(uid: string, op: AccountOp): Promise<PanelWriteResult> {
    const body = await this.request(`/accounts/${encodeURIComponent(uid)}/${op}`, { method: 'POST' })
    return {
      ok: body['ok'] !== false,
      ...str(body['message']) === undefined ? {} : { message: str(body['message']) },
    }
  }

  /** Bulk operation across every account. */
  async bulkOp(op: BulkOp): Promise<PanelWriteResult> {
    const body = await this.request(`/${op}`, { method: 'POST' })
    return {
      ok: body['ok'] !== false,
      ...str(body['message']) === undefined ? {} : { message: str(body['message']) },
    }
  }

  /** Import accounts in the cockpit export shape (`uid`/`access_token`/`refresh_token`). */
  async importAccounts(accounts: readonly Record<string, unknown>[]): Promise<PanelWriteResult & {
    imported?: number
    skipped?: number
    errors?: readonly string[]
  }> {
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(accounts)], { type: 'application/json' }), 'accounts.json')
    const body = await this.request('/import/cockpit', { method: 'POST', form, timeoutMs: 60_000 })
    const errors = strList(body['errors'])
    return {
      ok: body['ok'] !== false,
      ...num(body['imported']) === undefined ? {} : { imported: num(body['imported']) },
      ...num(body['skipped']) === undefined ? {} : { skipped: num(body['skipped']) },
      ...errors.length === 0 ? {} : { errors },
    }
  }
}

/** Per-account operations the panel exposes. */
export type AccountOp = 'revive' | 'disable' | 'pause' | 'resume' | 'checkin' | 'balance' | 'remove'

/** Pool-wide operations the panel exposes. */
export type BulkOp = 'checkin_all' | 'balance_all' | 'keepalive_all' | 'travel_all' | 'activity_all' | 'compensation_all'
