/**
 * The plugin's two local HTTP surfaces: a read-only status document and a
 * key-guarded action endpoint.
 *
 * Both are loopback-only. The status document is a plain read (the settings page
 * and the sidebar card poll it every few seconds), while every write — starting
 * the gateway, hiding a model, adding an account — goes through the action
 * endpoint, which additionally requires the per-process control key the status
 * document hands out. Loopback alone is not authentication: any local page can
 * send Host: 127.0.0.1.
 *
 * @module dsh-workbuddy2api-gateway/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { parseJsonObject } from './json-value.ts'
import { hostIsLoopback, originIsLoopback } from './loopback.ts'
import { isThinkingLevel } from './catalog.ts'
import type { ThinkingLevel } from './catalog.ts'
import type { WorkBuddy2ApiService } from './service.ts'
import type { AccountOp, BulkOp } from './panel-client.ts'
import type { Context } from '@deepseek-ai/cordis'

/** Status document path. */
export const STATUS_PATH = '/plugins/workbuddy2api-gateway/status'

/** Browser-half liveness breadcrumb: proves the client bundle ran. */
export const CLIENT_HELLO_PATH = '/plugins/workbuddy2api-gateway/client-hello'

/** Action endpoint path. */
export const ACTION_PATH = '/plugins/workbuddy2api-gateway/action'

/** Largest action body accepted. */
const MAX_BODY_BYTES = 256 * 1024

/** Per-account operations the browser may request. */
const ACCOUNT_OPS: readonly AccountOp[] = ['revive', 'disable', 'pause', 'resume', 'checkin', 'balance', 'remove']

/** Pool-wide operations the browser may request. */
const BULK_OPS: readonly BulkOp[] = [
  'checkin_all',
  'balance_all',
  'keepalive_all',
  'travel_all',
  'activity_all',
  'compensation_all',
]

/** Everything the page may ask the host to do. */
export type GatewayAction =
  | { action: 'refresh' }
  | { action: 'test-connection' }
  | { action: 'gateway-start' }
  | { action: 'gateway-stop' }
  | { action: 'gateway-restart' }
  | { action: 'connection', panelUrl?: string, apiKey?: string, refreshSeconds?: number, syncHiddenToPanel?: boolean }
  | { action: 'auto-register', enabled: boolean }
  | { action: 'model', id: string, enabled?: boolean, effort?: ThinkingLevel | null, efforts?: readonly ThinkingLevel[] }
  | { action: 'models-all', enabled: boolean }
  | { action: 'sync-hidden' }
  | { action: 'login-start', realm: 'cn' | 'global' }
  | { action: 'login-poll', state: string }
  | { action: 'login-cancel' }
  | { action: 'account', uid: string, op: AccountOp }
  | { action: 'bulk', op: BulkOp }
  | { action: 'import', payload: string }

/** Write one JSON response. */
function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/** Constant-time key comparison; a length mismatch is a failure, not a crash. */
export function keyMatches(expected: string, presented: string | undefined): boolean {
  if (presented === undefined || presented.length !== expected.length) return false
  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ (presented.charCodeAt(index) || 0)
  }
  return mismatch === 0
}

/** Read a request body under a hard ceiling. */
async function readBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<string | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += buffer.length
    if (total > limit) return undefined
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** A non-empty string field. */
function strField(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Parse a thinking-level patch: null clears, a level sets, anything else is absent. */
function effortField(value: unknown): ThinkingLevel | null | undefined {
  if (value === null) return null
  return isThinkingLevel(value) ? value : undefined
}

/** Parse a level list, dropping anything this build cannot express. */
function effortListField(value: unknown): readonly ThinkingLevel[] | undefined {
  if (!Array.isArray(value)) return undefined
  const levels = value.filter(isThinkingLevel)
  return levels.length === 0 ? undefined : levels
}

/** Parse and shape-check one action; unknown fields are ignored, not trusted. */
export function parseAction(text: string): GatewayAction | undefined {
  const body = parseJsonObject(text)
  if (body === undefined) return undefined
  switch (body['action']) {
    case 'refresh': return { action: 'refresh' }
    case 'test-connection': return { action: 'test-connection' }
    case 'gateway-start': return { action: 'gateway-start' }
    case 'gateway-stop': return { action: 'gateway-stop' }
    case 'gateway-restart': return { action: 'gateway-restart' }
    case 'connection': {
      const panelUrl = strField(body['panelUrl'])
      const apiKey = strField(body['apiKey'])
      const refreshSeconds = typeof body['refreshSeconds'] === 'number' && Number.isFinite(body['refreshSeconds'])
        ? body['refreshSeconds']
        : undefined
      const syncHiddenToPanel = typeof body['syncHiddenToPanel'] === 'boolean' ? body['syncHiddenToPanel'] : undefined
      return {
        action: 'connection',
        ...panelUrl === undefined ? {} : { panelUrl },
        ...apiKey === undefined ? {} : { apiKey },
        ...refreshSeconds === undefined ? {} : { refreshSeconds },
        ...syncHiddenToPanel === undefined ? {} : { syncHiddenToPanel },
      }
    }
    case 'auto-register':
      return typeof body['enabled'] === 'boolean' ? { action: 'auto-register', enabled: body['enabled'] } : undefined
    case 'model': {
      const id = strField(body['id'])
      if (id === undefined) return undefined
      const enabled = typeof body['enabled'] === 'boolean' ? body['enabled'] : undefined
      const effort = effortField(body['effort'])
      const efforts = effortListField(body['efforts'])
      return {
        action: 'model',
        id,
        ...enabled === undefined ? {} : { enabled },
        ...effort === undefined ? {} : { effort },
        ...efforts === undefined ? {} : { efforts },
      }
    }
    case 'models-all':
      return typeof body['enabled'] === 'boolean' ? { action: 'models-all', enabled: body['enabled'] } : undefined
    case 'sync-hidden': return { action: 'sync-hidden' }
    case 'login-start': {
      const realm = body['realm'] === 'global' ? 'global' : body['realm'] === 'cn' ? 'cn' : undefined
      return realm === undefined ? undefined : { action: 'login-start', realm }
    }
    case 'login-poll': {
      const state = strField(body['state'])
      return state === undefined ? undefined : { action: 'login-poll', state }
    }
    case 'login-cancel': return { action: 'login-cancel' }
    case 'account': {
      const uid = strField(body['uid'])
      const op = body['op']
      if (uid === undefined) return undefined
      if (typeof op !== 'string') return undefined
      if (!(ACCOUNT_OPS as readonly string[]).includes(op)) return undefined
      return { action: 'account', uid, op: op as AccountOp }
    }
    case 'bulk': {
      const op = body['op']
      if (typeof op !== 'string') return undefined
      if (!(BULK_OPS as readonly string[]).includes(op)) return undefined
      return { action: 'bulk', op: op as BulkOp }
    }
    case 'import': {
      const payload = strField(body['payload'])
      return payload === undefined ? undefined : { action: 'import', payload }
    }
    default: return undefined
  }
}

/** What the two handlers need from the plugin. */
export interface GatewayRouteOptions {
  service: WorkBuddy2ApiService
  /** Per-process key an action must present. */
  controlKey: string
}

/** The status handler: a full read, refusing anything off-loopback. */
export function statusHandler(options: GatewayRouteOptions) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers['origin'] as string | undefined)) {
      json(res, 403, { ok: false, error: 'loopback only' })
      return
    }
    try {
      await options.service.warm()
      json(res, 200, { ...options.service.status(), controlKey: options.controlKey })
    } catch (error: unknown) {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/** The action handler: loopback, control key, then the action itself. */
export function actionHandler(options: GatewayRouteOptions) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers['origin'] as string | undefined)) {
      json(res, 403, { ok: false, error: 'loopback only' })
      return
    }
    if (!keyMatches(options.controlKey, req.headers['x-dsh-plugin-key'] as string | undefined)) {
      json(res, 403, { ok: false, error: 'missing or wrong control key' })
      return
    }
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'POST only' })
      return
    }
    const body = await readBody(req)
    if (body === undefined) {
      json(res, 413, { ok: false, error: 'body too large' })
      return
    }
    const action = parseAction(body)
    if (action === undefined) {
      json(res, 400, { ok: false, error: 'unrecognised action' })
      return
    }
    try {
      json(res, 200, await runAction(options.service, action))
    } catch (error: unknown) {
      json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/** Execute one parsed action against the service. */
export async function runAction(service: WorkBuddy2ApiService, action: GatewayAction): Promise<unknown> {
  switch (action.action) {
    case 'refresh':
      await service.refresh()
      return { ok: true, status: service.status() }
    case 'test-connection':
      return service.testConnection()
    case 'gateway-start':
      return service.startGateway()
    case 'gateway-stop':
      return service.stopGateway()
    case 'gateway-restart':
      return service.restartGateway()
    case 'connection':
      return service.saveConnection({
        ...action.panelUrl === undefined ? {} : { panelUrl: action.panelUrl },
        ...action.apiKey === undefined ? {} : { apiKey: action.apiKey },
        ...action.refreshSeconds === undefined ? {} : { refreshSeconds: action.refreshSeconds },
        ...action.syncHiddenToPanel === undefined ? {} : { syncHiddenToPanel: action.syncHiddenToPanel },
      })
    case 'auto-register':
      return service.setAutoRegister(action.enabled)
    case 'model':
      return service.setModel({
        id: action.id,
        ...action.enabled === undefined ? {} : { enabled: action.enabled },
        ...action.effort === undefined ? {} : { effort: action.effort },
        ...action.efforts === undefined ? {} : { efforts: action.efforts },
      })
    case 'models-all':
      return service.setAllModels(action.enabled)
    case 'sync-hidden':
      return service.syncHidden()
    case 'login-start':
      return service.loginStart(action.realm)
    case 'login-poll':
      return service.loginPoll(action.state)
    case 'login-cancel':
      return service.loginCancel()
    case 'account':
      return service.accountOp(action.uid, action.op)
    case 'bulk':
      return service.bulkOp(action.op)
    case 'import':
      return service.importAccounts(action.payload)
  }
}

/**
 * The hello handler.
 *
 * The browser half calls this once when its apply runs. A host process cannot
 * observe the browser, so this is the only way the missing settings page can be
 * split into "the module never ran" and "it ran and its registration failed".
 */
export function clientHelloHandler(options: GatewayRouteOptions) {
  return function handle(req: IncomingMessage, res: ServerResponse): void {
    if (!hostIsLoopback(req.headers.host) || !originIsLoopback(req.headers['origin'] as string | undefined)) {
      json(res, 403, { ok: false, error: 'loopback only' })
      return
    }
    options.service.noteClientHello(typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined)
    json(res, 200, { ok: true })
  }
}

/** Mount both routes on a webServer context. */
export function registerGatewayRoutes(ctx: Context, options: GatewayRouteOptions): void {
  ctx.effect(() => {
    const status = ctx.webServer.register({
      kind: 'exact',
      path: STATUS_PATH,
      handler: statusHandler(options),
    })
    const action = ctx.webServer.register({
      kind: 'exact',
      path: ACTION_PATH,
      handler: actionHandler(options),
    })
    const hello = ctx.webServer.register({
      kind: 'exact',
      path: CLIENT_HELLO_PATH,
      handler: clientHelloHandler(options),
    })
    return () => {
      status()
      action()
      hello()
    }
  }, 'dsh-workbuddy2api-gateway: web routes')
}
