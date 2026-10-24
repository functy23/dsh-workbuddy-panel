/**
 * The plugin's settings page: the gateway process, its accounts, its models, and
 * the connection that ties the three together.
 *
 * Every figure comes from the shared store, which reads the host's status
 * document; every write goes back through that store to the host, which re-reads
 * the gateway before answering. The page therefore never invents state: a toggle
 * shows the gateway's answer, not the click.
 *
 * The process tab is what makes this plugin more than a remote control. It shows
 * what was spawned, where its config and working directory are, how many times it
 * was restarted, and the tail of its output — so "the gateway is down" is a fact
 * with a log line next to it rather than a guess.
 *
 * @module dsh-workbuddy2api-gateway/client/SettingsPage
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { PanelStore } from './store.ts'
import type { StatusDocument } from './status-document.ts'
import type { Translate } from './copy.ts'
import { formatTokens } from './copy.ts'
import type { WebAccount, WebModel } from '../service.ts'
import type { ThinkingLevel } from '../catalog.ts'
import { AccountCard, gatewayStateText, gatewayTone } from './panel-view.tsx'
import { UsageCard } from './usage-card.tsx'
import { AddAccountDialog } from './add-account.tsx'
import { GatewayGlyph } from './glyph.tsx'
import {
  Badge,
  SegmentedField,
  SettingRow,
  SettingsGroup,
  StatTile,
  StatusDot,
  ToggleField,
} from './ui-rows.tsx'
import { ActionButton } from './ui-button.tsx'

/** What the settings slot injects. */
export interface SettingsPageProps {
  t: Translate
  store: PanelStore
  /** Tab to open first; the host omits it, previews use it to render one page. */
  initialTab?: Tab
}

/** The four tabs. */
type Tab = 'overview' | 'accounts' | 'models' | 'gateway'

/** Tab order: what the animation compares to decide the slide direction. */
const TABS: readonly Tab[] = ['overview', 'accounts', 'models', 'gateway']

/** Relative time for the "updated" line, in the compact form the card uses. */
function relativeTime(iso: string): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return iso
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return String(seconds) + 's'
  if (seconds < 3600) return String(Math.round(seconds / 60)) + 'm'
  return String(Math.round(seconds / 3600)) + 'h'
}

/** Status tone for one account. */
function accountTone(account: WebAccount): 'ok' | 'warn' | 'error' | 'off' {
  if (account.status === 'active') return 'ok'
  if (account.status === 'cooling') return 'warn'
  if (account.status === 'disabled') return 'error'
  return 'off'
}

/** One account's status as words. */
function accountStateText(account: WebAccount, t: Translate): string {
  if (account.status === 'active') return t('accountStatusActive')
  if (account.status === 'cooling') return t('accountStatusCooling')
  if (account.status === 'disabled') return t('accountStatusDisabled')
  return t('accountStatusPaused')
}

/** The page. */
export function WorkBuddy2ApiSettingsPage(props: SettingsPageProps): ReactElement {
  const { t, store } = props
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'overview')
  /** The page that is on its way out, with the direction it leaves in. */
  const [leaving, setLeaving] = useState<{ tab: Tab, direction: 'forward' | 'back' } | undefined>(undefined)
  // Which way the body slides in: a tab to the right of the previous one enters
  // from the right. A ref keeps the value describing the CHANGE, not the state.
  const lastTabIndex = useRef(0)
  const tabIndex = TABS.indexOf(tab)
  const direction = tabIndex < lastTabIndex.current ? 'back' : 'forward'
  useEffect(() => {
    lastTabIndex.current = tabIndex
  }, [tabIndex])
  const document = snapshot.document

  useEffect(() => {
    store.start()
    return () => {
      store.stop()
    }
  }, [store])

  // Messages are transient: the line stays long enough to read, then yields to
  // whatever the next action says.
  useEffect(() => {
    if (snapshot.message === undefined) return
    const timer = setTimeout(() => {
      store.dismissMessage()
    }, 8_000)
    return () => {
      clearTimeout(timer)
    }
  }, [snapshot.message, store])

  // A tab change plays two animations: the outgoing page runs the .12s exit while
  // the incoming one runs the .25s entry. The outgoing copy is dropped after the
  // exit has finished, so nothing accumulates.
  const switchTab = useCallback((next: Tab) => {
    if (next === tab) return
    const nextIndex = TABS.indexOf(next)
    setLeaving({ tab, direction: nextIndex < tabIndex ? 'back' : 'forward' })
    setTab(next)
    const timer = setTimeout(() => { setLeaving(undefined) }, 140)
    timer.unref?.()
  }, [tab, tabIndex])

  const refresh = useCallback(() => {
    void store.act({ action: 'refresh' })
  }, [store])

  if (document === undefined) {
    return (
      <section className="wb2-section cs-page">
        <h2 className="wb2-titleLg">{t('title')}</h2>
        <p className="wb2-subtitle">{t('intro')}</p>
        <p className={snapshot.error === undefined ? 'wb2-hint' : 'wb2-rowError'}>
          {snapshot.error === undefined ? t('refreshing') : t('errorPrefix') + ' ' + snapshot.error}
        </p>
      </section>
    )
  }

  /** The body of one tab, shared by the entering and the leaving copy. */
  const renderTab = (which: Tab): ReactNode => {
    if (which === 'overview') {
      return <OverviewTab t={t} store={store} document={document} pending={snapshot.pending} refresh={refresh} />
    }
    if (which === 'accounts') {
      return <AccountsTab t={t} store={store} document={document} pending={snapshot.pending} />
    }
    if (which === 'models') {
      return <ModelsTab t={t} store={store} document={document} pending={snapshot.pending} />
    }
    return (
      <>
        <GatewayTab t={t} store={store} document={document} pending={snapshot.pending} />
        <ConnectionTab t={t} store={store} document={document} pending={snapshot.pending} />
      </>
    )
  }

  const tone = gatewayTone(document.gateway.state)
  return (
    <section className="wb2-section cs-page">
      <header className="wb2-header">
        <span className="wb2-headerText">
          <h2 className="wb2-titleLg cs-titleRow"><GatewayGlyph />{t('title')}</h2>
          <p className="wb2-subtitle">{t('intro')}</p>
        </span>
        <span className="wb2-spacer" />
        <ActionButton label={snapshot.pending === 'refresh' ? t('refreshing') : t('refresh')} onClick={refresh} />
      </header>

      <div className="wb2-inlineActions">
        <Badge tone={tone === 'ok' ? 'ok' : tone === 'error' ? 'error' : tone === 'warn' ? 'warn' : 'muted'}>
          {gatewayStateText(document.gateway.state, t)}
        </Badge>
        <Badge tone={document.panel.connected ? 'ok' : 'error'}>
          {document.panel.connected ? t('connected') : t('disconnected')}
        </Badge>
        {document.panel.version === undefined ? null : <Badge tone="muted">{t('panelVersion', document.panel.version)}</Badge>}
        <Badge tone={document.provider.owned ? 'muted' : 'warn'}>
          {document.provider.owned ? t('routeOwned', document.provider.id) : t('routeFallback', document.provider.id)}
        </Badge>
        <Badge tone="muted">{t('versionLine', document.version)}</Badge>
        <span className="wb2-hint">
          {document.updatedAt === undefined ? t('neverUpdated') : t('lastUpdated', relativeTime(document.updatedAt))}
        </span>
      </div>

      <SegmentedField
        label={t('title')}
        className="cs-segFull"
        value={tab}
        onChange={(value) => { switchTab(value as Tab) }}
        options={[
          { value: 'overview', label: t('tabOverview') },
          { value: 'accounts', label: t('tabAccounts') },
          { value: 'models', label: t('tabModels') },
          { value: 'gateway', label: t('gatewayTitle') },
        ]}
      />

      {snapshot.message === undefined || snapshot.message.text === ''
        ? null
        : (
          <p className={snapshot.message.kind === 'error' ? 'wb2-rowError' : 'wb2-hint'}>
            {snapshot.message.text}
          </p>
        )}

      <div className="cs-page">
        {leaving === undefined ? null : (
          <div className="cs-pageBody" key={'leave-' + leaving.tab} data-leave={leaving.direction}>
            {renderTab(leaving.tab)}
          </div>
        )}
        <div className="cs-pageBody" key={tab} data-enter={direction}>
          {renderTab(tab)}
        </div>
      </div>
    </section>
  )
}

/**
 * The overview: what the pool holds, in the same rhythm the dashboard uses.
 *
 * This is the page a user actually lands on, so it answers three questions in
 * order — how big is the pool, who is in it, and what can I do about it. Each
 * account keeps the card shape the dashboard already uses (avatar, state
 * capsules, three figures), which is what makes the two surfaces read as one
 * product rather than two pages over the same data.
 */
function OverviewTab(props: {
  t: Translate
  store: PanelStore
  document: StatusDocument
  pending?: string
  refresh: () => void
}): ReactElement {
  const { t, store, document, pending, refresh } = props
  const busy = pending !== undefined
  const credits = document.accounts.reduce((total, account) => total + (account.credits ?? 0), 0)
  const withCredits = document.accounts.filter(account => account.credits !== undefined).length
  return (
    <>
      <UsageCard
        t={t}
        usage={document.usage}
        creditsLeft={document.accounts.reduce((total, account) => total + (account.credits ?? 0), 0)}
      />

      <SettingsGroup title={t('quickTitle')} description={t('quickDesc')}>
        <SettingRow
          title={t('refresh')}
          control={<ActionButton label={busy ? t('refreshing') : t('refresh')} disabled={busy} onClick={refresh} />}
        />
        <SettingRow
          title={t('checkinAll')}
          control={(
            <ActionButton
              label={t('checkinAll')}
              disabled={busy || document.counts.total === 0}
              onClick={() => { void store.act({ action: 'bulk', op: 'checkin_all' }) }}
            />
          )}
        />
        <SettingRow
          title={t('balanceAll')}
          control={(
            <ActionButton
              label={t('balanceAll')}
              disabled={busy || document.counts.total === 0}
              onClick={() => { void store.act({ action: 'bulk', op: 'balance_all' }) }}
            />
          )}
        />
        <SettingRow
          title={t('syncHidden')}
          description={t('syncHiddenHint')}
          control={(
            <ActionButton
              label={t('syncHidden')}
              disabled={busy || document.counts.hiddenModels === 0}
              onClick={() => { void store.act({ action: 'sync-hidden' }) }}
            />
          )}
        />
        <SettingRow
          title={t('autoRegister')}
          titleFor="wb2-overview-auto-register"
          description={t('autoRegisterHint')}
          control={(
            <ToggleField
              id="wb2-overview-auto-register"
              label={t('autoRegister')}
              checked={document.sync.autoRegister}
              disabled={busy}
              onChange={(checked) => { void store.act({ action: 'auto-register', enabled: checked }, 'auto-register') }}
            />
          )}
        />
      </SettingsGroup>
    </>
  )
}

/** Accounts: the gateway's account table, one add row underneath, and the dialog. */
function AccountsTab(props: {
  t: Translate
  store: PanelStore
  document: StatusDocument
  pending?: string
}): ReactElement {
  const { t, store, document, pending } = props
  const busy = pending !== undefined
  const [confirmRemove, setConfirmRemove] = useState<string | undefined>(undefined)
  const [addOpen, setAddOpen] = useState(false)
  return (
    <>
      <SettingsGroup title={t('accountsTitle')} description={t('accountsDesc')}>
        {document.accounts.length === 0
          ? <p className="wb2-hint">{t('accountsEmpty')}</p>
          : (
            <div className="cs-tableWrap">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>{t('colAccount')}</th>
                    <th>{t('colState')}</th>
                    <th>{t('creditsLabel')}</th>
                    <th>{t('colSuccess')}</th>
                    <th>{t('colUsage')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {document.accounts.map(account => {
                    const tone = accountTone(account)
                    const name = account.nickname === '' ? t('noName') : account.nickname
                    const unlimited = account.creditsTotal === -1
                    const pct = unlimited
                      ? 100
                      : account.creditsTotal !== undefined && account.creditsTotal > 0
                        ? Math.min(100, Math.round((account.credits ?? 0) / account.creditsTotal * 100))
                        : 0
                    const expiry = account.tokenExpiresAt === undefined
                      ? undefined
                      : (() => {
                        const at = Date.parse(account.tokenExpiresAt)
                        if (!Number.isFinite(at)) return undefined
                        const days = Math.floor((at - Date.now()) / 86_400_000)
                        if (days > 7 && account.hasRefreshToken) return undefined
                        return at <= Date.now()
                          ? t('credentialExpired')
                          : t('credentialExpiry', new Date(at).toISOString().slice(0, 10))
                      })()
                    return (
                      <tr key={account.uid}>
                        <td>
                          <div className="cs-cellWho">
                            <div className="cs-nm">
                              <StatusDot tone={tone} title={accountStateText(account, t)} />
                              <span title={account.uid}>{name}</span>
                              {account.realm === 'global' ? <Badge tone="muted">{t('realmGlobalShort')}</Badge> : null}
                              {account.enterprise ? <Badge tone="muted">{t('enterpriseShort')}</Badge> : null}
                            </div>
                            <span className="cs-uid">{account.uid.length > 16 ? account.uid.slice(0, 16) + '…' : account.uid}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cs-cellState">
                            <Badge tone={tone === 'ok' ? 'ok' : tone === 'error' ? 'error' : tone === 'warn' ? 'warn' : 'muted'}>
                              {accountStateText(account, t)}
                            </Badge>
                            {account.disabledReason === undefined ? null : <span className="cs-note">{account.disabledReason}</span>}
                            {account.rateLimitedModels === 0 ? null : (
                              <span className="cs-note">{t('accountRateLimited', account.rateLimitedModels)}</span>
                            )}
                            {expiry === undefined ? null : <span className="cs-note">{expiry}</span>}
                          </div>
                        </td>
                        <td className="cs-cellCred">
                          <div>
                            {unlimited
                              ? t('creditsUnlimited')
                              : account.credits === undefined
                                ? '—'
                                : (
                                  <>
                                    {account.credits}
                                    {account.creditsTotal !== undefined && account.creditsTotal > 0
                                      ? <span className="of">{'/' + String(account.creditsTotal)}</span>
                                      : null}
                                  </>
                                )}
                          </div>
                          <div className="cs-credBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                            <i style={{ width: String(pct) + '%' }} />
                          </div>
                        </td>
                        <td className="cs-num">
                          {account.successCount}
                          <span className="dim">{' / '}</span>
                          {account.failStreak}
                        </td>
                        <td className="cs-num">
                          {account.requestCount ?? 0}
                          <span className="dim">{' · '}</span>
                          {account.totalTokens === undefined ? '—' : formatTokens(account.totalTokens)}
                          <div className="cs-note">
                            {account.lastSuccess === undefined
                              ? '—'
                              : new Date(account.lastSuccess).toISOString().slice(5, 16).replace('T', ' ')}
                          </div>
                        </td>
                        <td>
                          <div className="cs-acts">
                            {account.enterprise
                              ? null
                              : (
                                <ActionButton
                                  label={account.checkinDone ? t('actionCheckinDone') : t('actionCheckin')}
                                  disabled={busy}
                                  onClick={() => { void store.act({ action: 'account', uid: account.uid, op: 'checkin' }, account.uid) }}
                                />
                              )}
                            <ActionButton
                              label={t('actionBalance')}
                              disabled={busy}
                              onClick={() => { void store.act({ action: 'account', uid: account.uid, op: 'balance' }, account.uid) }}
                            />
                            {account.status === 'disabled'
                              ? (
                                <ActionButton
                                  label={t('actionEnable')}
                                  tone="primary"
                                  disabled={busy}
                                  onClick={() => { void store.act({ action: 'account', uid: account.uid, op: 'revive' }, account.uid) }}
                                />
                              )
                              : account.status === 'paused'
                                ? (
                                  <ActionButton
                                    label={t('actionResume')}
                                    tone="primary"
                                    disabled={busy}
                                    onClick={() => { void store.act({ action: 'account', uid: account.uid, op: 'resume' }, account.uid) }}
                                  />
                                )
                                : (
                                  <>
                                    <ActionButton
                                      label={t('actionPause')}
                                      disabled={busy}
                                      onClick={() => { void store.act({ action: 'account', uid: account.uid, op: 'pause' }, account.uid) }}
                                    />
                                    <ActionButton
                                      label={t('actionDisable')}
                                      disabled={busy}
                                      onClick={() => { void store.act({ action: 'account', uid: account.uid, op: 'disable' }, account.uid) }}
                                    />
                                  </>
                                )}
                            <ActionButton
                              label={confirmRemove === account.uid ? t('actionRemoveConfirm') : t('actionRemove')}
                              tone="danger"
                              disabled={busy}
                              onClick={() => {
                                if (confirmRemove !== account.uid) {
                                  setConfirmRemove(account.uid)
                                  return
                                }
                                setConfirmRemove(undefined)
                                void store.act({ action: 'account', uid: account.uid, op: 'remove' }, account.uid)
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        <div className="cs-addRow">
          <ActionButton label={'+ ' + t('addAccountTitle')} onClick={() => { setAddOpen(true) }} />
        </div>
      </SettingsGroup>
      <AddAccountDialog t={t} store={store} open={addOpen} onClose={() => { setAddOpen(false) }} />
    </>
  )
}

/** The process: state, controls, where it lives, and what it printed. */
function GatewayTab(props: {
  t: Translate
  store: PanelStore
  document: StatusDocument
  pending?: string
}): ReactElement {
  const { t, store, document, pending } = props
  const busy = pending !== undefined
  const gateway = document.gateway
  const tone = gatewayTone(gateway.state)
  return (
    <>
      <SettingsGroup
        title={t('gatewayTitle')}
        description={t('gatewayDesc')}
        action={(
          <>
            {gateway.state === 'running' || gateway.state === 'external'
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
            {gateway.managed
              ? (
                <ActionButton
                  label={t('gatewayStop')}
                  tone="danger"
                  disabled={busy}
                  onClick={() => { void store.act({ action: 'gateway-stop' }, 'gateway-stop') }}
                />
              )
              : null}
          </>
        )}
      >
        <SettingRow
          title={(
            <>
              <StatusDot tone={tone} title={gatewayStateText(gateway.state, t)} />
              {t('gatewayTitle')}
              <Badge tone={tone === 'ok' ? 'ok' : tone === 'error' ? 'error' : tone === 'warn' ? 'warn' : 'muted'}>
                {gatewayStateText(gateway.state, t)}
              </Badge>
              {gateway.pid === undefined ? null : <Badge tone="muted">{t('gatewayPid', gateway.pid)}</Badge>}
              {gateway.managed ? <Badge tone="muted">{t('gatewayManaged')}</Badge> : null}
            </>
          )}
          error={gateway.error}
          description={gateway.state === 'external'
            ? t('gatewayExternalHint')
            : gateway.restarts === 0
              ? undefined
              : t('gatewayRestarts', gateway.restarts)}
          control={(
            <ActionButton
              label={t('testConnection')}
              disabled={busy}
              onClick={() => { void store.act({ action: 'test-connection' }, 'test-connection') }}
            />
          )}
        />
        <SettingRow
          title={t('gatewayBinary')}
          description={t('gatewayBinaryHint')}
          control={<span className="wb2-mono">{gateway.binary ?? '—'}</span>}
        />
        <SettingRow title={t('gatewayWorkdir')} control={<span className="wb2-mono">{gateway.workdir}</span>} />
        <SettingRow title={t('gatewayConfig')} control={<span className="wb2-mono">{gateway.configPath}</span>} />
      </SettingsGroup>

      <SettingsGroup title={t('gatewayLog')}>
        <pre
          className="wb2-tokenArea"
          style={{ maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'var(--dsw-alias-font-mono,ui-monospace,Menlo,monospace)' }}
        >
          {gateway.log.length === 0
            ? t('gatewayLogEmpty')
            : gateway.log.map(line => line.at.slice(11, 19) + ' [' + line.stream + '] ' + line.text).join(String.fromCharCode(10))}
        </pre>
      </SettingsGroup>
    </>
  )
}

function ModelsTab(props: {
  t: Translate
  store: PanelStore
  document: StatusDocument
  pending?: string
}): ReactElement {
  const { t, store, document, pending } = props
  const [query, setQuery] = useState('')
  const models: readonly WebModel[] = document.models
  const [filter, setFilter] = useState<'all' | 'checked'>('all')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return models.filter(model => {
      if (filter === 'checked' && !model.enabled) return false
      if (needle === '') return true
      return model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle)
    })
  }, [models, query, filter])
  const busy = pending !== undefined
  const added = new Set(document.sync.added)
  const changed = new Set(document.sync.changed)

  if (models.length === 0) {
    return (
      <SettingsGroup title={t('modelsTitle')}>
        <p className="wb2-hint">
          {t('modelsEmpty')}
          {' '}
          {t('modelsEmptyHint')}
        </p>
      </SettingsGroup>
    )
  }

  return (
    <>
      <SettingsGroup
        title={t('modelsTitle')}
        description={t('modelsDesc')}
        action={(
          <>
            <input
              className="wb2-input"
              type="search"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(event) => { setQuery(event.target.value) }}
            />
            <SegmentedField
            label={t('onlyCheckedHint')}
            value={filter}
            onChange={(value) => { setFilter(value === 'checked' ? 'checked' : 'all') }}
            options={[
              { value: 'all', label: t('onlyCheckedAll') },
              { value: 'checked', label: t('onlyCheckedOnly') },
            ]}
          />
          </>
        )}
      >
        <SettingRow
          title={t('autoRegister')}
          titleFor="wb2-auto-register"
          description={t('autoRegisterHint')}
          tag={(
            <Badge tone={document.sync.autoRegister ? 'ok' : 'muted'}>
              {document.sync.autoRegister ? t('stateOn') : t('stateOff')}
            </Badge>
          )}
          control={(
            <ToggleField
              id="wb2-auto-register"
              label={t('autoRegister')}
              checked={document.sync.autoRegister}
              disabled={busy}
              onChange={(checked) => { void store.act({ action: 'auto-register', enabled: checked }, 'auto-register') }}
            />
          )}
        />
        <div className="cs-cardActions">
          <ActionButton label={t('enableAll')} disabled={busy} onClick={() => { void store.act({ action: 'models-all', enabled: true }) }} />
          <ActionButton label={t('disableAll')} disabled={busy} onClick={() => { void store.act({ action: 'models-all', enabled: false }) }} />
          <ActionButton label={t('syncHidden')} disabled={busy} onClick={() => { void store.act({ action: 'sync-hidden' }) }} />
        </div>
        {filtered.length === 0
          ? <p className="wb2-hint">{t('searchPlaceholder')}</p>
          : filtered.map(model => (
            <SettingRow
              key={model.id}
              title={(
                <>
                  {model.name}
                  {model.enabled ? null : <Badge tone="warn">{t('modelHiddenBadge')}</Badge>}
                  {added.has(model.id) ? <Badge tone="ok">{t('syncAdded', 1)}</Badge> : null}
                  {changed.has(model.id) ? <Badge tone="muted">{t('syncChanged', 1)}</Badge> : null}
                  {model.supportsImages ? <Badge tone="muted">{t('modelVision')}</Badge> : null}
                  {model.credits === undefined ? null : <Badge tone="muted">{t('modelCredits', model.credits)}</Badge>}
                </>
              )}
              description={(
                <>
                  <span className="wb2-mono">{model.id}</span>
                  {' · '}
                  {t('modelContext', formatTokens(model.contextLength))}
                  {' · '}
                  {t('modelOutput', formatTokens(model.maxOutputTokens))}
                </>
              )}
              control={(
                <>
                  {model.efforts.length === 0
                      ? <span className="wb2-hint">{t('modelNoEffort')}</span>
                      : <Badge tone="muted">{model.efforts.join(' / ')}</Badge>}
                  <ToggleField
                    id={'model-toggle-' + model.id}
                    label={model.name + ' ' + t('modelEnabled')}
                    checked={model.enabled}
                    disabled={busy}
                    onChange={(checked) => {
                      void store.act({ action: 'model', id: model.id, enabled: checked }, 'model:' + model.id)
                    }}
                  />
                </>
              )}
            />
          ))}
      </SettingsGroup>
    </>
  )
}

/** Connection: the address, key, cadence, and sync policy. */
function ConnectionTab(props: {
  t: Translate
  store: PanelStore
  document: StatusDocument
  pending?: string
}): ReactElement {
  const { t, store, document, pending } = props
  const busy = pending !== undefined
  const [panelUrl, setPanelUrl] = useState(document.connection.panelUrl)
  const [apiKey, setApiKey] = useState('')
  const [refreshSeconds, setRefreshSeconds] = useState(String(document.connection.refreshSeconds))
  const [revealKey, setRevealKey] = useState(false)

  // A save re-reads the document; the field then shows the stored origin even if
  // the user typed a variant (a trailing /v1, say).
  useEffect(() => {
    setPanelUrl(document.connection.panelUrl)
    setRefreshSeconds(String(document.connection.refreshSeconds))
  }, [document.connection.panelUrl, document.connection.refreshSeconds])

  return (
    <>
      <SettingsGroup title={t('settingsTitle')} description={t('settingsDesc')}>
        <SettingRow
          title={t('fieldPanelUrl')}
          titleFor="wb2-panel-url"
          description={t('fieldPanelUrlHint')}
          control={(
            <input
              id="wb2-panel-url"
              className="wb2-input"
              value={panelUrl}
              disabled={busy}
              onChange={(event) => { setPanelUrl(event.target.value) }}
            />
          )}
        />
        <SettingRow
          title={t('fieldApiKey')}
          titleFor="wb2-panel-key"
          description={t('fieldApiKeyHint')}
          control={(
            <>
              <input
                id="wb2-panel-key"
                className="wb2-input"
                type={revealKey ? 'text' : 'password'}
                placeholder={document.connection.hasApiKey ? '********' : t('fieldApiKeyPlaceholder')}
                value={apiKey}
                disabled={busy}
                onChange={(event) => { setApiKey(event.target.value) }}
              />
              <button type="button" className="wb2-linkButton" onClick={() => { setRevealKey(!revealKey) }}>
                {revealKey ? t('hideKey') : t('showKey')}
              </button>
            </>
          )}
        />
        <SettingRow
          title={t('fieldRefresh')}
          titleFor="wb2-refresh"
          description={t('fieldRefreshHint')}
          control={(
            <input
              id="wb2-refresh"
              className="wb2-input"
              type="number"
              min={10}
              max={600}
              value={refreshSeconds}
              disabled={busy}
              onChange={(event) => { setRefreshSeconds(event.target.value) }}
            />
          )}
        />
        <SettingRow
          title={t('fieldSync')}
          titleFor="wb2-sync"
          description={t('fieldSyncHint')}
          control={(
            <ToggleField
              id="wb2-sync"
              label={t('fieldSync')}
              checked={document.connection.syncHiddenToPanel}
              disabled={busy}
              onChange={(checked) => {
                void store.act({ action: 'connection', syncHiddenToPanel: checked }, 'connection')
              }}
            />
          )}
        />
        <SettingRow
          title={t('fieldProviderId')}
          description={t('fieldProviderIdHint')}
          control={<span className="wb2-mono">{document.provider.id}</span>}
        />
        <SettingRow
          title={t('syncTitle')}
          description={document.sync.lastSyncedAt === undefined
            ? undefined
            : t('lastUpdated', relativeTime(document.sync.lastSyncedAt))}
          control={(
            <>
              <Badge tone={document.sync.added.length === 0 ? 'muted' : 'ok'}>{t('syncAdded', document.sync.added.length)}</Badge>
              <Badge tone={document.sync.changed.length === 0 ? 'muted' : 'warn'}>{t('syncChanged', document.sync.changed.length)}</Badge>
              <Badge tone={document.sync.removed.length === 0 ? 'muted' : 'warn'}>{t('syncRemoved', document.sync.removed.length)}</Badge>
            </>
          )}
        />
      </SettingsGroup>
      <div className="wb2-inlineActions">
        <ActionButton
          label={pending === 'connection' ? t('saving') : t('save')}
          tone="primary"
          disabled={busy}
          onClick={() => {
            const seconds = Number.parseInt(refreshSeconds, 10)
            void store.act({
              action: 'connection',
              panelUrl,
              ...apiKey.trim() === '' ? {} : { apiKey: apiKey.trim() },
              ...Number.isFinite(seconds) ? { refreshSeconds: seconds } : {},
            }, 'connection').then(() => {
              setApiKey('')
            })
          }}
        />
        <ActionButton
          label={pending === 'test-connection' ? t('testing') : t('testConnection')}
          disabled={busy}
          onClick={() => { void store.act({ action: 'test-connection' }, 'test-connection') }}
        />
      </div>
    </>
  )
}
