/**
 * The dashboard: a sidebar footer card that summarises the gateway, and the
 * centre-column panel it selects.
 *
 * Both read the shared store, so the card's lines are the same facts the panel's
 * lists carry. The card is the gateway's status light as much as its launcher: a
 * stopped process, an external one, and a running one are three different states
 * and the card says which, because "no accounts" and "no process" are different
 * problems with different fixes.
 *
 * @module dsh-workbuddy2api-gateway/client/panel-view
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { PanelStore } from './store.ts'
import type { Translate } from './copy.ts'
import type { StatusDocument } from './status-document.ts'
import type { WebAccount, WebModel } from '../service.ts'
import type { SupervisorState } from '../supervisor.ts'
import { Badge, Ring, SettingRow, StatTile, StatusDot } from './ui-rows.tsx'
import { ActionButton } from './ui-button.tsx'

/** What the dashboard slots inject. */
export interface PanelInjected {
  t: Translate
  store: PanelStore
  open: () => void
  close: () => void
  /** Set by the sidebar shell: false while the column is a 56px rail. */
  wide?: boolean
}

/** The gateway's state as words. */
export function gatewayStateText(state: SupervisorState, t: Translate): string {
  if (state === 'running') return t('gatewayStateRunning')
  if (state === 'starting') return t('gatewayStateStarting')
  if (state === 'external') return t('gatewayStateExternal')
  if (state === 'failed') return t('gatewayStateFailed')
  return t('gatewayStateStopped')
}

/** The gateway's state as a tone. */
export function gatewayTone(state: SupervisorState): 'ok' | 'warn' | 'error' | 'off' {
  if (state === 'running') return 'ok'
  if (state === 'starting' || state === 'external') return 'warn'
  if (state === 'failed') return 'error'
  return 'off'
}

/** Share of the pool that can serve a request right now. */
function ringPercent(document: StatusDocument): number {
  const total = document.counts.total
  if (total === 0) return 0
  return ((total - document.counts.cooling - document.counts.disabled - document.counts.paused) / total) * 100
}

/** One account's status as words. */
function accountStateText(account: WebAccount, t: Translate): string {
  if (account.status === 'active') return t('accountStatusActive')
  if (account.status === 'cooling') return t('accountStatusCooling')
  if (account.status === 'disabled') return t('accountStatusDisabled')
  return t('accountStatusPaused')
}

/** One account's status as a tone. */
function accountTone(account: WebAccount): 'ok' | 'warn' | 'error' | 'off' {
  if (account.status === 'active') return 'ok'
  if (account.status === 'cooling') return 'warn'
  if (account.status === 'disabled') return 'error'
  return 'off'
}

/** Group a count into the compact form the tiles use. */
function figure(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
}

/** Read the store, starting and stopping the shared poll with the mount. */
function useDocument(store: PanelStore) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    store.start()
    return () => {
      store.stop()
    }
  }, [store])
  return snapshot
}

/**
 * The sidebar footer card.
 *
 * The gateway state leads: a card that said "2/2 accounts" while the process is
 * stopped would describe a pool nobody can reach.
 */
export function WorkBuddy2ApiFooterEntry(props: PanelInjected): ReactElement | null {
  const { t, store, open } = props
  const snapshot = useDocument(store)
  const document = snapshot.document
  if (document === undefined) return null

  const state = document.gateway.state
  const tone = gatewayTone(state)
  const label = t('panelCardTitle')
  const percent = ringPercent(document)
  const warn = state === 'failed' || document.counts.cooling > 0

  if (props.wide === false) {
    return (
      <button type="button" className="wb2-railButton" aria-label={label} title={label} onClick={() => { open() }}>
        <Ring percent={percent} warn={warn} size={18} />
      </button>
    )
  }

  return (
    <button
      type="button"
      className="wb2-foot"
      aria-label={label}
      title={label}
      onClick={() => { open() }}
      onDoubleClick={() => { void store.act({ action: 'refresh' }) }}
    >
      <span className="wb2-footTop">
        <span className="wb2-footName">{t('panelCardTitle')}</span>
        <span className="wb2-spacer" />
        <Ring percent={percent} warn={warn} size={14} />
      </span>
      <span className="wb2-footRow">
        <span className="wb2-footHead">
          <span className="wb2-footLabel">{t('gatewayTitle')}</span>
          <span className="wb2-footAmount">{gatewayStateText(state, t)}</span>
        </span>
      </span>
      <span className="wb2-footRow">
        <span className="wb2-footHead">
          <span className="wb2-footLabel">{t('panelAccountsTitle')}</span>
          <span className="wb2-footAmount">
            {state === 'stopped' || state === 'failed'
              ? t('panelGatewayDown')
              : t('panelCardAccounts', document.counts.healthy, document.counts.total)}
          </span>
        </span>
      </span>
      <span className="wb2-footRow">
        <span className="wb2-footHead">
          <span className="wb2-footLabel">{t('panelModelsTitle')}</span>
          <span className="wb2-footAmount">
            {t('panelCardModels', document.counts.enabledModels, document.counts.models)}
          </span>
        </span>
      </span>
    </button>
  )
}

/** One account on the dashboard: identity, state, and its figures. */
export function AccountCard({ account, t, footer }: {
  account: WebAccount
  t: Translate
  /** Actions rendered under the figures (the account page's button row). */
  footer?: ReactNode
}): ReactNode {
  const tone = accountTone(account)
  const name = account.nickname === '' ? account.uid : account.nickname
  return (
    <section className="wb2-card" aria-label={name}>
      <div className="wb2-cardHead">
        <span className="wb2-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <span className="wb2-cardIdentity">
          <span className="wb2-cardTitle">{name}</span>
        </span>
        <span className="wb2-spacer" />
        <StatusDot tone={tone} title={accountStateText(account, t)} />
        <Badge tone={tone === 'ok' ? 'ok' : tone === 'error' ? 'error' : tone === 'warn' ? 'warn' : 'muted'}>
          {accountStateText(account, t)}
        </Badge>
        <Badge tone="muted">{account.realm === 'global' ? t('accountRealmGlobal') : t('accountRealmCn')}</Badge>
        {account.checkinDone ? null : <Badge tone="warn">{t('accountNoCheckin')}</Badge>}
        {account.rateLimitedModels === 0 ? null : <Badge tone="warn">{t('accountRateLimited', account.rateLimitedModels)}</Badge>}
      </div>
      {account.disabledReason === undefined ? null : <p className="wb2-noticeHint">{account.disabledReason}</p>}
      <div className="wb2-tiles">
        <StatTile
          label={t('creditsLabel')}
          value={account.credits === undefined ? '—' : figure(account.credits)}
          sub={account.creditsTotal === undefined ? undefined : t('creditsTotal', figure(account.creditsTotal))}
        />
        <StatTile label={t('accountSuccessLabel')} value={String(account.successCount)} />
        <StatTile label={t('accountFailsLabel')} value={String(account.failStreak)} />
      </div>
      {footer}
    </section>
  )
}

/** One model row on the dashboard. */
function ModelLine({ model, t }: { model: WebModel; t: Translate }): ReactNode {
  return (
    <SettingRow
      className={model.enabled ? undefined : 'wb2-rowDimmed'}
      title={(
        <>
          {model.name}
          {model.supportsImages ? <Badge tone="muted">{t('modelVision')}</Badge> : null}
          {model.enabled ? null : <Badge tone="warn">{t('panelHidden')}</Badge>}
        </>
      )}
      description={(
        <>
          <span className="wb2-mono">{model.id}</span>
          {' · '}
          {t('modelContext', model.contextLength)}
          {' · '}
          {t('modelOutput', model.maxOutputTokens)}
        </>
      )}
      control={model.defaultEffort === undefined ? undefined : <Badge tone="muted">{model.defaultEffort}</Badge>}
    />
  )
}

/**
 * The centre-column dashboard.
 *
 * It covers the Conversation while open, so it carries its own way back — and,
 * because the process is the plugin's own, the three controls that matter here
 * (start, restart, stop) sit in its header rather than one page away.
 */
export function WorkBuddy2ApiPanel(props: PanelInjected): ReactElement {
  const { t, store, close } = props
  const snapshot = useDocument(store)
  const document = snapshot.document
  const gateway = document?.gateway
  const percent = document === undefined ? 0 : ringPercent(document)
  const tone = gateway === undefined ? 'off' : gatewayTone(gateway.state)
  const busy = snapshot.pending !== undefined

  return (
    <div className="wb2-main">
      <div className="wb2-mainInner">
        <header className="wb2-header">
          <Ring percent={percent} warn={tone === 'error' || tone === 'warn'} size={20} />
          <span className="wb2-headerText">
            <h2 className="wb2-titleLg">{t('panelTitle')}</h2>
            <p className="wb2-subtitle">{t('panelSubtitle')}</p>
          </span>
          <span className="wb2-spacer" />
          {gateway === undefined || gateway.state === 'running' || gateway.state === 'external'
            ? null
            : (
              <ActionButton
                label={t('gatewayStart')}
                tone="primary"
                disabled={busy}
                onClick={() => { void store.act({ action: 'gateway-start' }, 'gateway-start') }}
              />
            )}
          <ActionButton
            label={t('gatewayRestart')}
            disabled={busy}
            onClick={() => { void store.act({ action: 'gateway-restart' }, 'gateway-restart') }}
          />
          <ActionButton label={t('panelRefresh')} disabled={busy} onClick={() => { void store.act({ action: 'refresh' }) }} />
          <ActionButton label={t('panelClose')} onClick={close} />
        </header>

        {document === undefined ? (
          <p className="wb2-hint">{snapshot.error === undefined ? t('refreshing') : t('errorPrefix') + snapshot.error}</p>
        ) : (
          <>
            {snapshot.error === undefined ? null : (
              <div className="wb2-notice wb2-noticeError" role="status">
                <p className="wb2-noticeTitle">{t('errorPrefix')}</p>
                <p className="wb2-noticeHint">{snapshot.error}</p>
              </div>
            )}

            <SettingRow
              title={(
                <>
                  <StatusDot tone={tone} title={gatewayStateText(document.gateway.state, t)} />
                  {t('gatewayTitle')}
                  <Badge tone={tone === 'ok' ? 'ok' : tone === 'error' ? 'error' : tone === 'warn' ? 'warn' : 'muted'}>
                    {gatewayStateText(document.gateway.state, t)}
                  </Badge>
                  {document.gateway.pid === undefined ? null : <Badge tone="muted">{t('gatewayPid', document.gateway.pid)}</Badge>}
                </>
              )}
              description={(
                <>
                  {document.gateway.binary === undefined ? t('gatewayBinary') : <span className="wb2-mono">{document.gateway.binary}</span>}
                  {document.gateway.restarts === 0 ? null : ' · ' + t('gatewayRestarts', document.gateway.restarts)}
                </>
              )}
              control={document.gateway.managed
                ? (
                  <ActionButton
                    label={t('gatewayStop')}
                    tone="danger"
                    disabled={busy}
                    onClick={() => { void store.act({ action: 'gateway-stop' }, 'gateway-stop') }}
                  />
                )
                : undefined}
            />

            <div className="wb2-tiles">
              <StatTile label={t('overviewAccounts')} value={String(document.counts.total)} />
              <StatTile label={t('overviewHealthy')} value={String(document.counts.healthy)} />
              <StatTile
                label={t('overviewModels')}
                value={t('overviewModelsValue', document.counts.enabledModels, document.counts.models)}
              />
              <StatTile
                label={t('syncTitle')}
                value={document.sync.added.length === 0 && document.sync.changed.length === 0
                  ? t('syncNone')
                  : t('syncAdded', document.sync.added.length)}
              />
            </div>

            <h3 className="wb2-groupTitle">{t('panelAccountsTitle')}</h3>
            {document.accounts.length === 0
              ? <p className="wb2-hint">{t('panelNoAccounts')}</p>
              : document.accounts.map(account => <AccountCard key={account.uid} account={account} t={t} />)}

            <h3 className="wb2-groupTitle">{t('panelModelsTitle')}</h3>
            {document.models.length === 0
              ? <p className="wb2-hint">{t('panelNoModels')}</p>
              : (
                <div className="wb2-rows">
                  {document.models.map(model => <ModelLine key={model.id} model={model} t={t} />)}
                </div>
              )}
          </>
        )}
      </div>
    </div>
  )
}
