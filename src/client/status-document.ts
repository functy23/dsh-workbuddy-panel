/**
 * Reading the plugin's own status document and posting actions to it.
 *
 * The browser half never talks to the gateway directly: the API key stays in the
 * host, and every read and write goes through the plugin's loopback routes. This
 * module owns the two request shapes and the one piece of validation the surfaces
 * rely on (a document is usable only when it carries a control key and arrays
 * where arrays belong).
 *
 * @module dsh-workbuddy2api-gateway/client/status-document
 */

import type { WebStatus } from '../service.ts'
import type { AccountOp, BulkOp } from '../panel-client.ts'
import type { ThinkingLevel } from '../catalog.ts'

/** Status route path (mirrors the host constant). */
export const STATUS_PATH = '/plugins/workbuddy2api-gateway/status'

/** Action route path (mirrors the host constant). */
export const ACTION_PATH = '/plugins/workbuddy2api-gateway/action'

/** The status document plus the key that authorizes writes. */
export interface StatusDocument extends WebStatus {
  controlKey: string
  error?: string
}

/** Three-state read: a usable document, a refused answer, or garbage. */
export type StatusRead =
  | { state: 'read', document: StatusDocument }
  | { state: 'refused' }
  | { state: 'unreadable' }

/** Every action the page may send. */
export type ClientAction =
  | { action: 'refresh' }
  | { action: 'test-connection' }
  | { action: 'gateway-start' }
  | { action: 'gateway-stop' }
  | { action: 'gateway-restart' }
  | { action: 'connection', panelUrl?: string, apiKey?: string, refreshSeconds?: number, syncHiddenToPanel?: boolean }
  | { action: 'auto-register', enabled: boolean }
  | { action: 'model', id: string, enabled?: boolean, effort?: ThinkingLevel | null }
  | { action: 'models-all', enabled: boolean }
  | { action: 'sync-hidden' }
  | { action: 'login-start', realm: 'cn' | 'global' }
  | { action: 'login-poll', state: string }
  | { action: 'login-cancel' }
  | { action: 'account', uid: string, op: AccountOp }
  | { action: 'bulk', op: BulkOp }
  | { action: 'import', payload: string }

/** One action response. */
export interface ActionResponse {
  ok: boolean
  message?: string
  url?: string
  state?: string
  imported?: number
  skipped?: number
  status?: WebStatus
}

/** Shape-check a decoded status document. */
export function validStatus(value: unknown): value is StatusDocument {
  if (typeof value !== 'object' || value === null) return false
  const document = value as Record<string, unknown>
  return document['ok'] === true
    && typeof document['controlKey'] === 'string'
    && document['controlKey'].length > 0
    && Array.isArray(document['models'])
    && Array.isArray(document['accounts'])
    && typeof document['connection'] === 'object'
    && typeof document['counts'] === 'object'
    && typeof document['gateway'] === 'object'
}

/** Read the status document. Never throws. */
export async function readStatusDocument(): Promise<StatusRead> {
  let response: Response
  try {
    response = await fetch(STATUS_PATH, { headers: { Accept: 'application/json' } })
  } catch {
    return { state: 'unreadable' }
  }
  if (!response.ok) return { state: 'refused' }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { state: 'unreadable' }
  }
  return validStatus(body) ? { state: 'read', document: body } : { state: 'unreadable' }
}

/** Post one action with the control key. Never throws. */
export async function postAction(action: ClientAction, controlKey: string): Promise<ActionResponse> {
  try {
    const response = await fetch(ACTION_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-dsh-plugin-key': controlKey,
      },
      body: JSON.stringify(action),
    })
    const body = await response.json().catch(() => undefined)
    if (typeof body !== 'object' || body === null) {
      return { ok: false, message: 'HTTP ' + String(response.status) }
    }
    const record = body as Record<string, unknown>
    return {
      ok: record['ok'] === true,
      ...typeof record['message'] === 'string' ? { message: record['message'] } : {},
      ...typeof record['error'] === 'string' ? { message: record['error'] } : {},
      ...typeof record['url'] === 'string' ? { url: record['url'] } : {},
      ...typeof record['state'] === 'string' ? { state: record['state'] } : {},
      ...typeof record['imported'] === 'number' ? { imported: record['imported'] } : {},
      ...typeof record['skipped'] === 'number' ? { skipped: record['skipped'] } : {},
      ...typeof record['status'] === 'object' && record['status'] !== null
        ? { status: record['status'] as WebStatus }
        : {},
    }
  } catch (error: unknown) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
