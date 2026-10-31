/**
 * The composer's account chip: which pool account a turn is spent from, and how
 * much that account has left.
 *
 * The plugin registers two providers — the domestic route and the global route
 * — and their credits are not interchangeable. The chip therefore reads the
 * session's current model selection, picks the matching realm, and speaks only
 * about that realm's accounts. A model under another provider renders nothing: a
 * WorkBuddy figure attached to a turn that cannot spend it is worse than no
 * figure at all.
 *
 * **Which account?** The gateway picks an account per request (the pool's
 * strategy is a weighted rotation), and it does not report a per-session
 * binding, so there is no single "the" account to read. The chip shows the
 * strongest evidence available: the usable account of that realm that served
 * the most recent request (`lastSuccess`). When nothing has been served yet, a
 * realm with exactly one usable account is still unambiguous; several are not,
 * and then the chip falls back to the pool label with the realm's total.
 *
 * It renders nothing when there is nothing to say: no gateway connection, no
 * matching accounts, or no credit figure at all. An annotation must never be a
 * requirement, and an empty "0" reads as a spent pool rather than as an unknown
 * one.
 *
 * @module dsh-workbuddy2api-gateway/client/credit-badge
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { isThinkingLevel } from '../catalog.ts'
import type { WebAccount } from '../service.ts'
import { postAction } from './status-document.ts'
import type { PanelStore } from './store.ts'
import type { Translate } from './copy.ts'

/** What the composer's account chip injects. */
export interface CreditBadgeProps {
  t: Translate
  store: PanelStore
  /** The session's shared model-selection store. */
  directory: ModelDirectory['store']
}

/** Compact a credit figure: 4160 → 4,160. */
function grouped(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

/** Local `MM-DD HH:mm` for one ISO timestamp, or '' when unreadable. */
function shortMoment(value: string): string {
  const at = new Date(value)
  if (!Number.isFinite(at.getTime())) return ''
  const pad = (part: number): string => String(part).padStart(2, '0')
  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** `0001-01-01T00:00:00Z` is the gateway's "never", not a timestamp. */
function isNever(value: string | undefined): boolean {
  return value === undefined || value.length === 0 || value.startsWith('0001-')
}

/**
 * The account a turn on this realm would most plausibly be spent from.
 *
 * @param pool - the accounts of one realm.
 */
function speakingAccount(pool: readonly WebAccount[]): WebAccount | undefined {
  const usable = pool.filter(account => account.status === 'active')
  const served = usable
    .filter(account => !isNever(account.lastSuccess))
    .sort((left, right) => Date.parse(right.lastSuccess ?? '') - Date.parse(left.lastSuccess ?? ''))
  if (served.length > 0) return served[0]
  return usable.length === 1 ? usable[0] : undefined
}

/**
 * Render the selected realm's remaining credit, or nothing.
 *
 * The poll starts with the mount and stops with it, exactly like the settings
 * page's: the badge is a second reader of the same store, not a second poller.
 */
export function WorkBuddy2ApiCreditBadge({ t, store, directory }: CreditBadgeProps): ReactElement | null {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const subscribeDirectory = useCallback((listener: () => void) => directory.subscribe(listener), [directory])
  const readDirectory = useCallback(() => directory.getSnapshot(), [directory])
  const selection = useSyncExternalStore(subscribeDirectory, readDirectory, readDirectory).current
  useEffect(() => {
    store.start()
    return () => {
      store.stop()
    }
  }, [store])

  // DSH keeps the reasoning level in the session selection, but a model switch
  // rebuilds that selection from the model's default. Persist the level the user
  // actually picked for this model, so coming back finds it again.
  const persistedEfforts = useRef(new Map<string, string>())
  useEffect(() => {
    const currentSelection = selection
    const currentDocument = snapshot.document
    if (currentSelection === null || currentDocument === undefined) return
    if (!isThinkingLevel(currentSelection.reasoningEffort)) return
    const provider = currentSelection.provider
    const globalId = currentDocument.provider.global?.id
    if (provider !== currentDocument.provider.id && provider !== globalId) return
    const model = currentDocument.models.find(entry => entry.id === currentSelection.model)
    // Only a level that differs from the model's current default is a user
    // choice worth persisting; writing every default would mask later panel
    // changes for no reason.
    if (model === undefined || model.defaultEffort === currentSelection.reasoningEffort) return
    const modelKey = provider + '|' + currentSelection.model
    const key = modelKey + '|' + currentSelection.reasoningEffort
    if (persistedEfforts.current.get(modelKey) === key) return
    persistedEfforts.current.set(modelKey, key)
    void postAction({
      action: 'model',
      id: currentSelection.model,
      effort: currentSelection.reasoningEffort,
    }, currentDocument.controlKey).then(response => {
      // A transient failure can be retried on the next selection change.
      if (!response.ok && persistedEfforts.current.get(modelKey) === key) {
        persistedEfforts.current.delete(modelKey)
      }
    })
  }, [selection, snapshot.document])

  const document = snapshot.document
  if (document === undefined || !document.panel.connected || document.accounts.length === 0) return null
  if (selection === null) return null
  const realm = selection.provider === document.provider.global.id
    ? 'global'
    : selection.provider === document.provider.id
      ? 'cn'
      : undefined
  if (realm === undefined) return null
  const pool = document.accounts.filter(account =>
    (account.realm === 'global' ? 'global' : 'cn') === realm)
  const known = pool.filter(account => account.credits !== undefined)
  if (known.length === 0) return null
  const total = known.reduce((sum, account) => sum + (account.credits ?? 0), 0)
  const creditsWord = t('creditsLabel')
  const scopeLabel = realm === 'global' ? t('realmGlobalShort') : t('creditsRealmCn')
  const statusText = (status: WebAccount['status']): string => (
    status === 'cooling'
      ? t('accountStatusCooling')
      : status === 'paused'
        ? t('accountStatusPaused')
        : status === 'disabled'
          ? t('accountStatusDisabled')
          : t('accountStatusActive'))
  const nameOf = (account: WebAccount): string => (
    account.nickname === '' ? account.uid.slice(0, 8) : account.nickname)
  const creditsOf = (account: WebAccount): string => (
    account.credits === undefined ? '—' : grouped(account.credits) + ' ' + creditsWord)
  const current = speakingAccount(pool)
  const shown = current?.credits ?? total
  const who = current === undefined ? t('panelAccountsTitle') : nameOf(current)
  const label = realm === 'global' ? t('creditsLeftGlobal') : t('creditsLeftCn')

  // The chip is one line; the pool behind it is a tooltip, so the figure stays
  // readable in a 32px row without hiding what it is made of.
  const lines = [t('creditsLeftHint'), t('creditChipCurrent', who, scopeLabel)]
  if (current?.credits !== undefined) {
    lines.push(current.creditsTotal === undefined
      ? t('creditChipRemaining', grouped(current.credits), creditsWord)
      : t('creditChipRemainingTotal', grouped(current.credits), grouped(current.creditsTotal), creditsWord))
  }
  if (current !== undefined && !isNever(current.lastSuccess)) {
    const moment = shortMoment(current.lastSuccess ?? '')
    if (moment !== '') {
      lines.push(t('creditChipLast', moment, current.lastModel === undefined ? '' : ' · ' + current.lastModel))
    }
  }
  lines.push('', t('creditChipPool', scopeLabel, String(known.length), grouped(total), creditsWord))
  for (const account of pool.slice(0, 6)) {
    lines.push('· ' + nameOf(account) + ' — ' + creditsOf(account) + ' · ' + statusText(account.status))
  }
  if (pool.length > 6) lines.push(t('creditChipMore', String(pool.length)))
  lines.push('', t('creditChipPoolNote'))

  return (
    <span className="cs-creditBadge" title={lines.join('\n')}>
      <b>{who}</b>
      {' · '}
      {label}
      {' '}
      <b>{grouped(shown)}</b>
    </span>
  )
}
