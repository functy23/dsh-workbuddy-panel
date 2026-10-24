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

import { connectionSettingsPath } from './paths.ts'
import { readStoreDocument, writeStoreDocument } from './store-file.ts'
import { normalizePanelUrl } from './panel-client.ts'

/** Format version this build writes and accepts. */
const SETTINGS_VERSION = 1

/** The effective connection policy. */
export interface ConnectionSettings {
  /** Panel origin, normalized (no trailing slash, no `/v1`). */
  panelUrl: string
  /** Panel `api_key`; empty when the panel runs without auth. */
  apiKey: string
  /** Poll interval in seconds (10–600). */
  refreshSeconds: number
  /** Whether a locally hidden model is also hidden at the panel. */
  syncHiddenToPanel: boolean
}

/** The defaults an install ships. */
export const DEFAULT_CONNECTION: ConnectionSettings = {
  panelUrl: 'http://127.0.0.1:7863',
  apiKey: '',
  refreshSeconds: 30,
  syncHiddenToPanel: true,
}

/** Clamp a poll interval into the range the surfaces tolerate. */
export function clampRefreshSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONNECTION.refreshSeconds
  return Math.min(600, Math.max(10, Math.round(value)))
}

/** Read/patch the connection document. */
export class ConnectionStore {
  constructor(
    private readonly path: string = connectionSettingsPath(),
    private readonly defaults: ConnectionSettings = DEFAULT_CONNECTION,
  ) {}

  /** The stored document layered over the install defaults. */
  current(): ConnectionSettings {
    const stored = readStoreDocument(this.path, SETTINGS_VERSION, document => ({
      panelUrl: typeof document['panelUrl'] === 'string' ? document['panelUrl'] : undefined,
      apiKey: typeof document['apiKey'] === 'string' ? document['apiKey'] : undefined,
      refreshSeconds: typeof document['refreshSeconds'] === 'number' ? document['refreshSeconds'] : undefined,
      syncHiddenToPanel: typeof document['syncHiddenToPanel'] === 'boolean' ? document['syncHiddenToPanel'] : undefined,
    }))
    const panelUrl = stored?.panelUrl !== undefined && stored.panelUrl !== ''
      ? safeNormalize(stored.panelUrl) ?? this.defaults.panelUrl
      : this.defaults.panelUrl
    return {
      panelUrl,
      apiKey: stored?.apiKey ?? this.defaults.apiKey,
      refreshSeconds: clampRefreshSeconds(stored?.refreshSeconds ?? this.defaults.refreshSeconds),
      syncHiddenToPanel: stored?.syncHiddenToPanel ?? this.defaults.syncHiddenToPanel,
    }
  }

  /** Merge a patch into the stored document. */
  patch(patch: Partial<ConnectionSettings>): ConnectionSettings {
    const current = this.current()
    const next: ConnectionSettings = {
      panelUrl: patch.panelUrl === undefined ? current.panelUrl : safeNormalize(patch.panelUrl) ?? current.panelUrl,
      apiKey: patch.apiKey === undefined ? current.apiKey : patch.apiKey.trim(),
      refreshSeconds: clampRefreshSeconds(patch.refreshSeconds ?? current.refreshSeconds),
      syncHiddenToPanel: patch.syncHiddenToPanel ?? current.syncHiddenToPanel,
    }
    writeStoreDocument(this.path, { version: SETTINGS_VERSION, updatedAt: new Date().toISOString(), ...next })
    return next
  }
}

/** Normalize a panel URL, answering `undefined` instead of throwing. */
function safeNormalize(raw: string): string | undefined {
  try {
    return normalizePanelUrl(raw)
  } catch {
    return undefined
  }
}
