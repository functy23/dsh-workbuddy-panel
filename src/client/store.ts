/**
 * One shared snapshot for every surface of the plugin.
 *
 * The sidebar card, the dashboard, and the settings page all read this store, so
 * a single poll feeds all of them and they cannot disagree about what the panel
 * said. It is deliberately React-free: components subscribe through
 * `useSyncExternalStore`, and the Node tests drive it without a DOM.
 *
 * Writes are optimistic only in the sense that they *report* — the snapshot is
 * replaced by the one the action returns (the host re-reads the panel after
 * every write), so a surface never shows a toggle state the panel did not
 * accept.
 *
 * @module dsh-workbuddy2api-connect/client/store
 */

import { postAction, readStatusDocument } from './status-document.ts'
import type { ActionResponse, ClientAction, StatusDocument } from './status-document.ts'

/** A short-lived line the page shows after a write. */
export interface StoreMessage {
  kind: 'ok' | 'error' | 'notice'
  text: string
}

/** The whole browser-side state. */
export interface StoreSnapshot {
  document?: StatusDocument
  /** Why the last read failed, when it did. */
  error?: string
  /** Whether a read is in flight and nothing has been read yet. */
  loading: boolean
  /** The action currently in flight, as `action` or `action:id`. */
  pending?: string
  message?: StoreMessage
}

/** Poll cadence while a surface is mounted; the host refreshes its own copy. */
const POLL_MS = 5_000

/** Faster cadence while a server download is in flight. */
const POLL_FAST_MS = 1_000

/** The shared store. */
export class PanelStore {
  private listeners = new Set<() => void>()
  private snapshot: StoreSnapshot = { loading: true }
  private timer?: ReturnType<typeof setInterval>
  private refs = 0
  private inFlight?: Promise<void>
  private pollMs = POLL_MS

  /** Subscribe; returns the disposer React's `useSyncExternalStore` wants. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** The current snapshot (stable between changes). */
  getSnapshot = (): StoreSnapshot => this.snapshot

  /** Apply a patch and notify every surface. */
  private set(patch: Partial<StoreSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  /** Replace the document from a read or an action's reply. */
  private adopt(document: StatusDocument | undefined): void {
    if (document === undefined) return
    this.set({
      document,
      loading: false,
      error: undefined,
    })
    const next = document.server.download.state === 'downloading' ? POLL_FAST_MS : POLL_MS
    if (next !== this.pollMs) {
      this.pollMs = next
      if (this.timer !== undefined) this.schedule()
    }
  }

  /** Re-arm the interval at the current cadence. */
  private schedule(): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = setInterval(() => {
      void this.refresh()
    }, this.pollMs)
  }

  /** Read the status document. Concurrent calls share one request. */
  async refresh(): Promise<void> {
    if (this.inFlight !== undefined) return this.inFlight
    this.inFlight = (async () => {
      const read = await readStatusDocument()
      if (read.state === 'read') {
        this.adopt(read.document)
        return
      }
      this.set({
        loading: false,
        error: read.state === 'refused'
          ? 'status route refused the request'
          : 'status document unavailable',
      })
    })().finally(() => {
      this.inFlight = undefined
    })
    return this.inFlight
  }

  /**
   * Send one write and fold its answer into the snapshot.
   *
   * The answer is returned as well: a dialog that must decide whether to close
   * itself cannot read that off the snapshot, which the next poll overwrites.
   */
  async act(action: ClientAction, pendingKey?: string): Promise<ActionResponse | undefined> {
    const document = this.snapshot.document
    if (document === undefined) return undefined
    this.set({ pending: pendingKey ?? action.action, message: undefined })
    const response = await postAction(action, document.controlKey)
    // The reply carries the host's post-write document when it has one; adopting
    // it is what makes a toggle land in the same frame as the click.
    if (response.status !== undefined) this.adopt({ ...document, ...response.status, controlKey: document.controlKey })
    this.set({
      pending: undefined,
      message: {
        kind: response.ok ? (action.action === 'test-connection' || action.action === 'refresh' ? 'notice' : 'ok') : 'error',
        text: response.message ?? (response.ok ? '' : 'request failed'),
      },
    })
    return response
  }

  /** Drop the message line (the page calls this after a timeout). */
  dismissMessage(): void {
    if (this.snapshot.message === undefined) return
    this.set({ message: undefined })
  }

  /** Start polling; idempotent, reference-counted by mounted surfaces. */
  start(): void {
    this.refs += 1
    if (this.timer === undefined) {
      void this.refresh()
      this.schedule()
    }
  }

  /** Stop polling once the last surface unmounts. */
  stop(): void {
    this.refs = Math.max(0, this.refs - 1)
    if (this.refs > 0) return
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }
}

/** The one store every surface shares. */
export const panelStore = new PanelStore()
