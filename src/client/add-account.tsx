/**
 * The add-account dialog: pick a realm, then finish sign-in.
 *
 * The flow starts by itself. Opening the dialog (or switching realm) mints a
 * challenge immediately — a "start" button in front of a QR code is a step whose
 * only outcome is the same QR code one second later.
 *
 * Two finishes, because the gateway offers two:
 *
 * 1. **Domestic — scan.** The challenge is a URL; it is drawn as a QR code, with
 *    copy/open/check as the escape hatches.
 * 2. **International — open in the browser.** The gateway cannot hand that realm's
 *    hand-off to a phone, so the dialog offers one emphasised button that opens
 *    the sign-in page, and polls in the background for the account to land.
 *
 * Token sign-in stays available for both realms: pasting an exported account is
 * the only route that needs no browser at all.
 *
 * @module dsh-workbuddy2api-gateway/client/add-account
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { PanelStore } from './store.ts'
import type { Translate } from './copy.ts'
import { SegmentedField } from './ui-rows.tsx'
import { ActionButton } from './ui-button.tsx'
import { QrView } from './qr-view.tsx'

/** Props. */
export interface AddAccountDialogProps {
  t: Translate
  store: PanelStore
  open: boolean
  onClose(): void
  /** Realm to open on; the host omits it (domestic), previews use it. */
  initialRealm?: 'cn' | 'global'
}

/** How often the dialog asks whether the browser finished. */
const POLL_MS = 4_000

/** The dialog. */
export function AddAccountDialog({ t, store, open, onClose, initialRealm }: AddAccountDialogProps): ReactElement | null {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [realm, setRealm] = useState<'cn' | 'global'>(initialRealm ?? 'cn')
  const [mode, setMode] = useState<'qr' | 'token'>('qr')
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState(false)
  const login = snapshot.document?.login

  useEffect(() => {
    if (!open) return
    store.start()
    return () => {
      store.stop()
    }
  }, [open, store])

  // Mint the challenge without being asked. A challenge for the OTHER realm is
  // cancelled first: the gateway keeps one per process, and leaving it open would
  // make the next start answer with the old link.
  useEffect(() => {
    if (!open || mode !== 'qr') return
    if (login !== undefined && login.realm === realm) return
    if (login !== undefined) {
      void store.act({ action: 'login-cancel' })
      return
    }
    void store.act({ action: 'login-start', realm }, 'login-start')
  }, [open, mode, realm, login, store])

  useEffect(() => {
    if (!open || login === undefined) return
    const timer = setInterval(() => {
      void store.act({ action: 'login-poll', state: login.state }, 'login-poll')
    }, POLL_MS)
    return () => {
      clearInterval(timer)
    }
  }, [open, login, store])

  // Success is an account that was not there when the dialog opened.
  //
  // Watching the challenge instead conflates "the user switched realm or mode"
  // with "the gateway finished" — every such switch cancels the challenge, and
  // the old code closed the dialog on that cancellation.
  const baseline = useRef<number | undefined>(undefined)
  const accounts = snapshot.document?.accounts.length ?? 0
  useEffect(() => {
    if (!open) {
      baseline.current = undefined
      return
    }
    if (baseline.current === undefined) {
      baseline.current = accounts
      return
    }
    if (accounts > baseline.current) {
      baseline.current = undefined
      setToken('')
      onClose()
    }
  }, [open, accounts, onClose])

  const submitToken = useCallback(() => {
    void store.act({ action: 'import', payload: token }, 'import').then(() => {
      setToken('')
      onClose()
    })
  }, [onClose, store, token])

  if (!open) return null
  const scan = mode === 'qr' && realm === 'cn'

  return (
    <div
      className="wb2-overlay"
      role="presentation"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="wb2-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('addAccountTitle')}
        style={{ width: 'min(360px, 92vw)', maxWidth: 'min(360px, 92vw)' }}
      >
        <h3 className="wb2-dialogTitle">{t('addAccountTitle')}</h3>
        <p className="wb2-dialogBody">{t('addPickHint')}</p>

        <SegmentedField
          className="cs-segFull"
          label={t('addRealm')}
          value={realm}
          onChange={(value) => { setRealm(value === 'global' ? 'global' : 'cn') }}
          options={[
            { value: 'cn', label: t('accountRealmCn') },
            { value: 'global', label: t('accountRealmGlobal') },
          ]}
        />

        <SegmentedField
          className="cs-segFull"
          label={t('addMode')}
          value={mode}
          onChange={(value) => { setMode(value === 'token' ? 'token' : 'qr') }}
          options={[
            { value: 'qr', label: realm === 'global' ? t('addModeWeb') : t('addModeQr') },
            { value: 'token', label: t('addModeToken') },
          ]}
        />

        {mode === 'token'
          ? (
            <>
              <textarea
                className="wb2-tokenArea"
                value={token}
                placeholder={t('addTokenPlaceholder')}
                onChange={event => { setToken(event.target.value) }}
              />
              <p className="wb2-hint">{t('addTokenHint')}</p>
              <div className="wb2-dialogActions">
                <ActionButton label={t('addTokenSubmit')} tone="primary" disabled={token.trim() === ''} onClick={submitToken} />
              </div>
            </>
          )
          : login === undefined
            ? <p className="wb2-hint cs-center">{t('addStarting')}</p>
            : scan
              ? (
                <>
                  <QrView value={login.url} />
                  <p className="wb2-hint cs-center">{t('addWaiting')}</p>
                  <div className="wb2-dialogActions">
                    <button
                      type="button"
                      className="wb2-linkButton"
                      onClick={() => {
                        void navigator.clipboard?.writeText(login.url)
                        setCopied(true)
                        setTimeout(() => { setCopied(false) }, 1_500)
                      }}
                    >
                      {copied ? t('copied') : t('copy')}
                    </button>
                    <ActionButton
                      label={t('addPoll')}
                      onClick={() => { void store.act({ action: 'login-poll', state: login.state }, 'login-poll') }}
                    />
                  </div>
                </>
              )
              : (
                <>
                  <a className="cs-openButton" href={login.url} target="_blank" rel="noreferrer">
                    {t('addOpen')}
                  </a>
                  <p className="wb2-hint cs-center">{t('addGlobalHint')}</p>
                </>
              )}

        <div className="cs-dialogFull">
          <ActionButton
            label={t('addCancel')}
            onClick={() => {
              if (login !== undefined) void store.act({ action: 'login-cancel' })
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
