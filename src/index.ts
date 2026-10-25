/**
 * WorkBuddy2API Gateway for DeepSeek Harness.
 *
 * This is the panel half. The gateway process belongs to the host gateway row;
 * this row only reads it and serves the model route. One mount does five things:
 *
 * 1. **Reads the host row.** The process, its config, and its server cache belong
 *    to `workbuddy2api-gateway-host`; this row only reads `GatewayHost.status()`
 *    and never imports `node:child_process`.
 * 2. **Serves the route.** A pi-ai provider points at the gateway's own
 *    OpenAI-compatible /v1, with the durable-attachment hooks wired so image
 *    input works ({@link createWorkBuddy2ApiAdapter}).
 * 3. **Discovers the catalog.** Every poll diffs the gateway's model list; a new
 *    model joins the picker on its own, a changed descriptor is announced, and a
 *    removed model stops being offered ({@link WorkBuddy2ApiService}).
 * 4. **Owns the control plane.** Accounts, sign-in, check-in, balances and every
 *    model toggle are driven through this plugin's own loopback routes. The
 *    gateway's web panel is never needed, and never opened.
 * 5. **Stays out of the way.** A gateway somebody else started is adopted as an
 *    external instance: health, catalog, and management all work, and only
 *    "stop" declines, because killing a process the host row did not spawn is a
 *    surprise rather than a feature.
 *
 * @module dsh-workbuddy2api-gateway
 */

import { randomBytes } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { ModelOverridesStore } from './overrides-store.ts'
import { ConnectionStore, DEFAULT_CONNECTION } from './settings-store.ts'
import { PanelClient } from './panel-client.ts'
import { createWorkBuddy2ApiAdapter, WORKBUDDY2API_PROVIDER } from './adapter.ts'
import type { WorkBuddy2ApiAdapter } from './adapter.ts'
import { GATEWAY_HOST_SERVICE } from './gateway-contract.ts'
import type { GatewayHost } from './gateway-contract.ts'
import { WorkBuddy2ApiService } from './service.ts'
import { registerGatewayRoutes } from './routes.ts'
import { WORKBUDDY2API_GATEWAY_VERSION } from './version.ts'
import { piAiVersionSummary, piAiVersionWarning, resolvedPiAiVersion } from './pi-ai-version.ts'
import { pluginDataDir } from './paths.ts'

/** Stable Cordis plugin name. */
export const name = 'llm-workbuddy2api-gateway'

/** The model registry required before the route can register. */
export const inject = ['llm']

/**
 * Composition defaults for the panel row.
 *
 * Process fields live in the host row (`workbuddy2api-gateway-host`) now. The
 * four deprecated fields stay accepted so an existing profile patch does not
 * fail schema validation; only `port` is still read, as the default loopback
 * address before the host service answers.
 */
export const Config: z<Config> = z.object({
  providerId: z.string().default(WORKBUDDY2API_PROVIDER),
  displayName: z.string().default('WorkBuddy2API'),
  /** Deprecated: the host row owns the port. Read only as the panel URL default. */
  port: z.natural().min(1).max(65535).default(7863),
  /** Deprecated: the host row owns auto-start. */
  autoStart: z.boolean().default(true),
  /** Deprecated: the host row owns the restart limit. */
  restartLimit: z.natural().default(5),
  /** Poll interval for the catalog, in seconds. */
  refreshSeconds: z.natural().min(10).max(600).default(15),
  /** Panel API key; empty means "use (or generate) the gateway config's key". */
  apiKey: z.string().default(''),
  /** Deprecated: the host row owns the accounts directory. */
  authDir: z.string().default(''),
  /** Whether a model the gateway announces joins the picker without asking. */
  autoRegister: z.boolean().default(true),
})

/** Parsed composition config. */
export interface Config {
  providerId: string
  displayName: string
  port: number
  autoStart: boolean
  restartLimit: number
  refreshSeconds: number
  apiKey: string
  authDir: string
  autoRegister: boolean
}

/** Poll floor for the catalog scheduler. */
const TICK_MS = 5_000

/** The route id this instance actually registered under. */
interface RouteState {
  id: string
  owned: boolean
  conflictWith?: string
}

/**
 * Resolve which provider route this instance may own.
 *
 * A profile that still carries another adapter for the same id already owns it;
 * registering it again would throw DUPLICATE_ADAPTER and take the route down.
 * Rather than fail, this instance falls back to a suffixed route and says so in
 * the status document, so the page can tell the user which group it is managing.
 */
function resolveRoute(llm: { listProviders: () => readonly { id: string }[] }, preferred: string): RouteState {
  const taken = new Set(llm.listProviders().map(provider => provider.id))
  if (!taken.has(preferred)) return { id: preferred, owned: true }
  const fallback = preferred + '-gateway'
  return taken.has(fallback)
    ? { id: preferred + '-' + randomBytes(2).toString('hex'), owned: false, conflictWith: preferred }
    : { id: fallback, owned: false, conflictWith: preferred }
}

/**
 * Resolve one durable image reference into the current tool execution world.
 *
 * The same bridge llm-pi-ai installs for its own routes: the attachment service
 * knows the host path of the normalized copy, and the fs service maps that host
 * path into the vocabulary tools can read. Both are read lazily, so a route
 * registered before either service exists still upgrades.
 */
function imageAccessResolver(ctx: Context) {
  return (attachments: AttachmentStore, ref: ImageAttachmentRef): ImageAttachmentAccess | undefined =>
    resolveImageAttachmentAccess(attachments, hostPath => {
      const fs = ctx.get('fs') as unknown as
        { processPathFromHostPath: (path: string) => string | undefined } | undefined
      return typeof fs?.processPathFromHostPath === 'function' ? fs.processPathFromHostPath(hostPath) : undefined
    }, ref)
}

/** Wire the plugin into the host. */
export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger
  const controlKey = randomBytes(24).toString('hex')

  const connection = new ConnectionStore(undefined, {
    ...DEFAULT_CONNECTION,
    panelUrl: 'http://127.0.0.1:' + String(config.port),
    apiKey: config.apiKey,
    refreshSeconds: config.refreshSeconds,
  })
  const overrides = new ModelOverridesStore()

  // The host composition row owns the process and the server cache. The panel
  // resolves it lazily: the row may load before or after this one, and a row
  // reload must not leave the panel holding a dead reference.
  const host = (): GatewayHost | undefined =>
    ctx.get(GATEWAY_HOST_SERVICE) as unknown as GatewayHost | undefined

  // The route's key: the user's, else the one the host row generated into the
  // gateway's config. Reading it lazily is what lets a key appear after the
  // host wrote the file.
  const client = new PanelClient(() => {
    const settings = connection.current()
    const port = host()?.status().port ?? config.port
    const defaultUrl = 'http://127.0.0.1:' + String(port)
    return {
      baseUrl: settings.panelUrl === DEFAULT_CONNECTION.panelUrl ? defaultUrl : settings.panelUrl,
      apiKey: settings.apiKey !== '' ? settings.apiKey : host()?.apiKeyFromConfig() ?? '',
    }
  })

  /** Route ownership, decided when the llm service is available. */
  let route: RouteState = { id: config.providerId, owned: true }
  /** The international route, resolved beside the domestic one. */
  let globalRoute: RouteState = { id: config.providerId + '-global', owned: true }

  /**
   * The adapter, once the llm service lets us build it.
   *
   * The service can discover a model before this is assigned; the optional
   * call keeps the catalog poller from depending on registration order.
   */
  let adapterHandle: WorkBuddy2ApiAdapter | undefined

  const piAiVersion = resolvedPiAiVersion()
  const piAiWarning = piAiVersionWarning()
  if (piAiWarning === undefined) {
    log.info('workbuddy2api-gateway: pi-ai ' + piAiVersionSummary())
  } else {
    // Report, do not throw: the settings page is how a user finds out what is
    // wrong, so taking the plugin down would hide the diagnosis.
    log.warn(piAiWarning)
  }

  const service = new WorkBuddy2ApiService({
    version: WORKBUDDY2API_GATEWAY_VERSION,
    ...piAiVersion === undefined ? {} : { piAiVersion },
    providerId: route.id,
    providerOwned: route.owned,
    ...route.conflictWith === undefined ? {} : { conflictWith: route.conflictWith },
    connection,
    overrides,
    client,
    host,
    warn: (message, error) => {
      log.warn(message, error)
    },
    onChange: () => {
      // A changed catalog must also rebuild the adapter's own snapshot: the
      // host asks that snapshot to resolve a model before it asks the provider
      // for the live list, and a snapshot built before the model existed
      // answers UNKNOWN_MODEL until the profile map identity changes.
      adapterHandle?.invalidate()
      try {
        ctx.emit('llm/adapters-updated')
      } catch (error: unknown) {
        log.warn('workbuddy2api-gateway: could not announce the catalog change', error)
      }
    },
  })

  // The host row starts the process; the panel only reads the catalog once.
  void service.refresh().catch((error: unknown) => {
    log.warn('workbuddy2api-gateway: first gateway read failed', error)
  })

  // One ticker instead of one timer per interval: the cadence is a setting the
  // page can change, so the schedule is recomputed on each tick rather than
  // frozen at start.
  let lastRead = Date.now()
  const ticker = setInterval(() => {
    const settings = connection.current()
    if (Date.now() - lastRead < settings.refreshSeconds * 1000) return
    lastRead = Date.now()
    if (service.expireLogin()) service.status()
    void service.refresh().catch((error: unknown) => {
      log.warn('workbuddy2api-gateway: gateway poll failed', error)
    })
  }, TICK_MS)
  ticker.unref?.()
  ctx.effect(() => () => {
    clearInterval(ticker)
    service.dispose()
  }, 'dsh-workbuddy2api-gateway: poller')

  ctx.inject(['llm'], llmCtx => {
    const llm = llmCtx.llm
    route = resolveRoute(llm, config.providerId)
    globalRoute = resolveRoute(llm, route.id + '-global')
    service.setProviderRoutes(
      { id: route.id, owned: route.owned, ...route.conflictWith === undefined ? {} : { conflict: route.conflictWith } },
      { id: globalRoute.id, owned: globalRoute.owned, ...globalRoute.conflictWith === undefined ? {} : { conflict: globalRoute.conflictWith } },
    )
    if (!route.owned) {
      log.warn(
        'workbuddy2api-gateway: provider "' + String(route.conflictWith) + '" is already registered by another plugin; ' +
        'this instance serves "' + route.id + '" instead.',
      )
    }

    const adapter = createWorkBuddy2ApiAdapter({
      providerId: route.id,
      globalProviderId: globalRoute.id,
      displayName: config.displayName,
      catalog: () => service.catalogModels(),
      v1BaseUrl: () => client.v1BaseUrl(),
      apiKey: () => {
        const settings = connection.current()
        return settings.apiKey !== '' ? settings.apiKey : host()?.apiKeyFromConfig() ?? ''
      },
      hidden: () => service.catalogModels().filter(model => !model.enabled).map(model => model.id),
      // Image input rides the host's durable attachment store; without these two
      // hooks pi-ai fails every request whose history holds an image.
      attachments: () => ctx.get('attachments') as AttachmentStore | undefined,
      imageAccess: imageAccessResolver(ctx),
    })
    adapterHandle = adapter

    try {
      const releaseDirectory = llm.registerConfigurableProviders(adapter.providers.map(provider => ({
        provider: provider.id,
        displayName: provider.displayName,
        settingsNs: 'llm-workbuddy2api-gateway',
        settingsPath: [],
      })))
      const releaseAdapter = llm.registerAdapter(adapter.providers.map(provider => provider.id), adapter.adapter)
      ctx.effect(() => () => {
        releaseDirectory()
        releaseAdapter()
      }, 'dsh-workbuddy2api-gateway: provider registration')
      log.info(
        'workbuddy2api-gateway: routes ' + adapter.providers.map(provider => provider.id).join(', ') +
        ' registered (' + String(service.catalogModels().length) + ' models)',
      )
    } catch (error: unknown) {
      log.error('workbuddy2api-gateway: provider registration failed', error)
    }
  })

  ctx.inject(['webServer'], webCtx => {
    registerGatewayRoutes(webCtx, { service, controlKey })
  })
}

export { WorkBuddy2ApiService } from './service.ts'
export type { WebStatus, WebAccount, WebModel, WebSync, WebLogin, WebLoginDone, ActionOutcome } from './service.ts'
export { GATEWAY_HOST_SERVICE, GATEWAY_HOST_SERVICE_VERSION } from './gateway-contract.ts'
export type { GatewayHost, GatewayLogLine, GatewayState, GatewayStatus, ServerDownloadState, ServerDownloadStatus, ServerStatus } from './gateway-contract.ts'
export { buildCatalog, hiddenIds, visibleIds, panelHiddenList, THINKING_LEVELS, isThinkingLevel } from './catalog.ts'
export type { CatalogModel, ModelOverride, ThinkingLevel } from './catalog.ts'
export { ModelOverridesStore } from './overrides-store.ts'
export { ConnectionStore, DEFAULT_CONNECTION, clampRefreshSeconds } from './settings-store.ts'
export type { ConnectionSettings } from './settings-store.ts'
export { PanelClient, PanelError, normalizePanelUrl, safeMessage } from './panel-client.ts'
export type { PanelAccount, PanelModel, PanelOverview, AccountOp, BulkOp } from './panel-client.ts'
export { createWorkBuddy2ApiAdapter, WORKBUDDY2API_PROVIDER } from './adapter.ts'
export { STATUS_PATH, ACTION_PATH, parseAction, runAction } from './routes.ts'
export type { GatewayAction } from './routes.ts'
export { WORKBUDDY2API_GATEWAY_VERSION } from './version.ts'
export { gatewayConfigPath, gatewayWorkdir, pluginDataDir, serverRootDir } from './paths.ts'
