/**
 * The composer's credit badge: what the pool has left, in the row DSH already
 * fills with what a turn costs.
 *
 * This is the seat the sidebar card used to occupy, moved to where the number is
 * actually spent from. It states one figure — the sum across every account — and
 * nothing else: the per-account breakdown lives on the settings page, one click
 * away, and a badge that expanded into a table would be a page pretending to be
 * a chip.
 *
 * It renders nothing when there is nothing to say: no gateway connection, no
 * accounts, or no credit figure at all. An annotation must never be a
 * requirement, and an empty "0" reads as a spent pool rather than as an unknown
 * one.
 *
 * @module dsh-workbuddy2api-gateway/client/credit-badge
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { PanelStore } from './store.ts'
import type { Translate } from './copy.ts'

/** What the composer dock injects. */
export interface CreditBadgeProps {
  t: Translate
  store: PanelStore
}

/** Compact a credit figure: 4160 → 4,160. */
function grouped(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

/**
 * Render the pool's remaining credit, or nothing.
 *
 * The poll starts with the mount and stops with it, exactly like the settings
 * page's: the badge is a second reader of the same store, not a second poller.
 */
export function WorkBuddy2ApiCreditBadge({ t, store }: CreditBadgeProps): ReactElement | null {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    store.start()
    return () => {
      store.stop()
    }
  }, [store])

  const document = snapshot.document
  if (document === undefined || !document.panel.connected || document.accounts.length === 0) return null
  const known = document.accounts.filter(account => account.credits !== undefined)
  if (known.length === 0) return null
  const total = known.reduce((sum, account) => sum + (account.credits ?? 0), 0)

  return (
    <span className="cs-creditBadge" title={t('creditsLeftHint')}>
      {t('creditsLeftLabel')}
      <b>{grouped(total)}</b>
    </span>
  )
}
