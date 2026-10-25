/**
 * Browser half: one settings page, one sidebar footer card, and the dashboard
 * the card opens.
 *
 * Three registrations, one navigation story:
 *
 * 1. `sidebar.footer.action` — the card pinned at the bottom of the sidebar,
 *    directly above the Settings seat, summarising the pool.
 * 2. `main` (keyed `workbuddy2api-panel`) — the dashboard, selected by the
 *    card through `ctx.layout.selectPanel`. Both registrations are required:
 *    the layout resolves the id against its registry, so a card without the
 *    panel would be a dead button.
 * 3. `settings.section` — the management page, at the same navigation level as
 *    General / Models / Plugins, where the models, accounts, and connection are
 *    actually managed.
 *
 * The models-page provider card is registered too: it is the row the Models
 * settings page dispatches for the route this plugin declares, and without a
 * card there the row would lead to an editor that has nothing to offer.
 *
 * Every contribution is guarded at both boundaries where it can throw — the
 * eager `slots.inject` call, and the deferred callback the slot runtime invokes
 * later — so one broken surface cannot take the others (or the host loader)
 * down. The host route keeps serving models throughout.
 *
 * @module dsh-workbuddy2api-connect/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { useEffect, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { WorkBuddy2ApiSettingsPage } from './SettingsPage.tsx'
import { WorkBuddy2ApiFooterEntry, WorkBuddy2ApiPanel } from './panel-view.tsx'
import { WorkBuddy2ApiCreditBadge } from './credit-badge.tsx'
import type { PanelInjected } from './panel-view.tsx'
import { panelStore } from './store.ts'
import { COPY, makeTranslator } from './copy.ts'
import type { Translate } from './copy.ts'
import { PAGE_CSS, PAGE_CSS_ID, PANEL_CSS, PANEL_CSS_ID } from './ui-styles.ts'
import { Badge } from './ui-rows.tsx'

/** Stable browser-plugin name: the package name plus the `-client` half. */
export const name = 'dsh-workbuddy-panel-client'

/**
 * Client services required by this browser half.
 *
 * `modelDirectories` is reached through a scoped `ctx.inject` in the composer
 * credit badge — it may arrive after this fiber starts, and only that seat needs
 * the session's selected route. The other seat owners are not named here either:
 * the slots this bundle registers into belong to different packages, and the
 * seam each host ships is discovered by slot-declaration lifetime rather than by
 * activation order.
 */
export const inject = ['slots', 'locale', 'remote']

/** Prefix for guarded contribution failures. */
const CONTRIBUTION_FAILED = '[dsh-workbuddy2api-connect] client contribution failed (host route unaffected):'

/** Nothing to undo. */
const NOOP_DISPOSER = (): void => {}

/** Settings copy namespace. */
const SETTINGS_NS = 'settings.workbuddy2api.gateway'

/** Dashboard copy namespace. */
const PANEL_NS = 'panel.workbuddy2api.gateway'

/** Settings page id, and the key the provider card is dispatched with. */
const SETTINGS_SECTION_ID = 'dsh-workbuddy2api-gateway'

/** Route id this plugin declares on the host; the Models page keys the card by it. */
const PROVIDER_SETTINGS_NS = 'llm-workbuddy2api-gateway'

/** The dashboard's `main` key: one string shared by the card and the panel cell. */
export const PANEL_ID = 'workbuddy2api-gateway-panel'

/** Reserved `main` key of the conversation, used only as the exit fallback. */
const CONVERSATION_PANEL_ID = 'conversation'

/**
 * The slice of the slot registry this bundle uses, declared structurally.
 *
 * Importing `@deepseek-ai/dsh-client-ui-slots` for values would make the browser
 * resolve a module this bundle never calls; the module augmentation its types
 * carry also changes shape between host generations, which is exactly the
 * churn a plugin's own registration code should not inherit.
 */
interface SlotOptions {
  name: string
  id?: string
  key?: string
  order?: number
  label?: () => string
  locale?: string
  inject?: unknown
}

interface SlotsSeam {
  inject(name: string, callback: () => () => void): void
  register(options: SlotOptions, component: (props: any) => ReactElement | null): () => void
}

interface LocaleSeam {
  register(namespace: string, dictionaries: { zh: unknown, en: unknown }): () => void
  bind(namespace: string): Translate
}

interface LayoutSeam {
  selectPanel(id: string | null): void
}

/** The session model-directory resolver, typed by the one call this bundle makes. */
interface ModelDirectoriesSeam {
  directoryFor(sessionId: string): { store: ModelDirectory['store'] }
}

/**
 * The locale service, typed by the two calls this bundle makes.
 *
 * Reached through `ctx.get` rather than a property: the service table is
 * augmented by the host packages this bundle deliberately does not import, so a
 * property read would not typecheck against a bare Cordis context.
 */
function localeOf(ctx: ClientContext): LocaleSeam {
  return ctx.get('locale') as unknown as LocaleSeam
}

/** The slot registry, typed by the two calls this bundle makes. */
function slotsOf(ctx: ClientContext): SlotsSeam {
  return ctx.get('slots') as unknown as SlotsSeam
}

/** Run one contribution, degrading a throw to a console error. */
function guard<T>(label: string, run: () => T): T | undefined {
  try {
    return run()
  } catch (error: unknown) {
    console.error(CONTRIBUTION_FAILED + ' ' + label, error)
    return undefined
  }
}

/** Inject one stylesheet once; returns its disposer. */
function injectCss(id: string, css: string): () => void {
  if (typeof document === 'undefined') return NOOP_DISPOSER
  if (document.querySelector('style[data-plugin-css="' + id + '"]') !== null) return NOOP_DISPOSER
  const tag = document.createElement('style')
  tag.dataset['plugin'] = 'dsh-workbuddy2api-gateway'
  tag.dataset['pluginCss'] = id
  tag.textContent = css
  document.head.appendChild(tag)
  return () => {
    tag.remove()
  }
}

/** Wire the browser half. */
export function apply(ctx: ClientContext): void {
  // 存活探针：宿主看不到浏览器，这一条请求把“设置页缺失”分成两种情况——
  // 客户端包根本没跑，或跑了但注册失败（见状态文档的 client.helloAt）。
  // 尽力而为：探针失败绝不能拖累任何界面注册。
  try {
    void fetch('/plugins/workbuddy2api-gateway/client-hello', {
      headers: { Accept: 'application/json' },
    }).catch(NOOP_DISPOSER)
  } catch {
    // 没有面包屑页面也照常工作。
  }
  const locale = localeOf(ctx)
  const slots = slotsOf(ctx)

  guard('settings copy', () => {
    ctx.effect(() => locale.register(SETTINGS_NS, COPY), 'dsh-workbuddy2api-connect: settings copy')
  })
  guard('panel copy', () => {
    ctx.effect(() => locale.register(PANEL_NS, COPY), 'dsh-workbuddy2api-connect: panel copy')
  })
  // The host hands back the stored template; the filling is ours, because the
  // templates here are positional and the host fills by name.
  const t = makeTranslator(locale.bind(SETTINGS_NS) as unknown as (key: string) => string)
  const panelT = makeTranslator(locale.bind(PANEL_NS) as unknown as (key: string) => string)

  guard('styles', () => {
    ctx.effect(() => {
      const page = injectCss(PAGE_CSS_ID, PAGE_CSS)
      const dashboard = injectCss(PANEL_CSS_ID, PANEL_CSS)
      return () => {
        page()
        dashboard()
      }
    }, 'dsh-workbuddy2api-connect: styles')
  })

  /** The face both dashboard slots carry; `layout` is read at click time. */
  const panelFace = (): PanelInjected => ({
    t: panelT,
    store: panelStore,
    open: () => {
      const layout = ctx.get('layout') as LayoutSeam | undefined
      if (typeof layout?.selectPanel === 'function') layout.selectPanel(PANEL_ID)
    },
    close: () => {
      const layout = ctx.get('layout') as LayoutSeam | undefined
      if (typeof layout?.selectPanel !== 'function') return
      try {
        layout.selectPanel(null)
      } catch {
        try {
          layout.selectPanel(CONVERSATION_PANEL_ID)
        } catch (error: unknown) {
          console.error('[dsh-workbuddy2api-connect] could not close the dashboard', error)
        }
      }
    },
  })

  guard('dashboard panel', () => {
    slots.inject('main', () => (
      guard('dashboard panel', () => slots.register(
        { name: 'main', key: PANEL_ID, locale: PANEL_NS, inject: panelFace },
        WorkBuddy2ApiPanel,
      )) ?? NOOP_DISPOSER
    ))
  })

  // Gated on `layout`: without `selectPanel` the card would render and do
  // nothing when clicked, and a dead button is worse than no button.
  // The pool's remaining credit, in the composer's own meter row. The sidebar
  // card that used to carry it is gone: the composer is where a turn is spent
  // from, so that is where the figure belongs.
  guard('composer credits', () => {
    // The badge must know which of our two routes the session selected: the
    // domestic and global pools are not convertible, so one figure cannot stand
    // for both. The model-directory service may arrive after this fiber starts,
    // hence the scoped inject rather than an eager read.
    ctx.inject(['modelDirectories'], scope => {
      const modelDirectories = (scope as unknown as { modelDirectories: ModelDirectoriesSeam }).modelDirectories
      guard('composer credits', () => {
        slots.inject('conversation.composer.dock', () => (
          guard('composer credits', () => slots.register({
            name: 'conversation.composer.dock',
            id: 'workbuddy2api-credits',
            order: 100,
            inject: (sessionId: string) => ({
              t: panelT,
              store: panelStore,
              directory: modelDirectories.directoryFor(sessionId).store,
            }),
          }, WorkBuddy2ApiCreditBadge)) ?? NOOP_DISPOSER
        ))
      })
    })
  })

  // The settings navigation draws its glyph from a host-side, id-keyed map
  // (navIcon), which has no seat for a plugin. So the row is marked here and the
  // glyph is painted by our own stylesheet: a data attribute the host cannot
  // supply, a mask in `currentColor` that follows the theme.
  guard('nav glyph', () => {
    ctx.effect(() => {
      if (typeof document === 'undefined') return () => {}
      const label = t('nav')
      const mark = (): void => {
        for (const button of document.querySelectorAll('button')) {
          if (button.getAttribute('data-wb2a-nav') !== null) continue
          const span = button.querySelector('span')
          if (span === null || span.textContent !== label) continue
          button.setAttribute('data-wb2a-nav', '')
        }
      }
      mark()
      const observer = new MutationObserver(mark)
      observer.observe(document.body, { childList: true, subtree: true })
      return () => {
        observer.disconnect()
      }
    }, 'dsh-workbuddy2api-gateway: nav glyph')
  })

  guard('settings section', () => {
    slots.inject('settings.section', () => (
      guard('settings section', () => slots.register({
        name: 'settings.section',
        id: SETTINGS_SECTION_ID,
        order: 55,
        label: () => t('nav'),
        locale: SETTINGS_NS,
        inject: (): { t: Translate, store: typeof panelStore } => ({ t, store: panelStore }),
      }, WorkBuddy2ApiSettingsPage)) ?? NOOP_DISPOSER
    ))
  })

  // The Models-page provider card: dispatched with `entryKey` equal to the
  // host's `settingsNs` for the route this plugin declares, so both halves must
  // agree on the string.
  guard('provider card', () => {
    slots.inject('settings.models.provider-card', () => (
      guard('provider card', () => slots.register({
        name: 'settings.models.provider-card',
        key: PROVIDER_SETTINGS_NS,
        locale: SETTINGS_NS,
        inject: (): { t: Translate, store: typeof panelStore } => ({ t, store: panelStore }),
      }, WorkBuddy2ApiProviderCard)) ?? NOOP_DISPOSER
    ))
  })
}

/**
 * The Models-page row's card: what the route is and where its models come from.
 *
 * The page's own editor has no fields for a provider whose catalog is served by
 * a gateway, so this card is the whole offer — a sentence, the route id, and the
 * live model count, with the real controls living on the plugin's own page.
 */
function WorkBuddy2ApiProviderCard(props: { t: Translate, store: typeof panelStore }): ReactElement {
  const { t, store } = props
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    store.start()
    return () => {
      store.stop()
    }
  }, [store])
  const document = snapshot.document
  return (
    <div className="wb2-card">
      <div className="wb2-cardHead">
        <span className="wb2-cardTitle">{t('title')}</span>
        <span className="wb2-spacer" />
        {document === undefined
          ? null
          : <Badge tone="muted">{t('overviewModelsValue', document.counts.enabledModels, document.counts.models)}</Badge>}
      </div>
      <p className="wb2-noticeHint">{t('intro')}</p>
    </div>
  )
}