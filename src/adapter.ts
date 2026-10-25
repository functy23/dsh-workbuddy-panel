/**
 * The `workbuddy2api` route: one pi-ai provider pointed at a local
 * `workbuddy2api-panel`'s OpenAI-compatible `/v1` endpoint.
 *
 * The panel is a normal OpenAI-compatible gateway, so pi-ai's
 * `openai-completions` protocol does the wire work — streaming, tool calls,
 * usage. What this module adds is the two things a hand-managed gateway cannot
 * state by itself:
 *
 * 1. **A live catalog.** The descriptors are rebuilt from the panel's model list
 *    on every read, so a model the panel added (or a capability it changed)
 *    appears without a restart.
 * 2. **Local selection.** Hidden models are filtered from `listModels` only —
 *    never from model *resolution* — so a session already using a model keeps
 *    working after the user hides it, exactly like the reference provider.
 *
 * Reasoning levels ride the model descriptor's `thinkingLevelMap`, which is what
 * makes the harness's own effort selector appear: the panel declares which levels
 * a model accepts (`supported_efforts`) and whether thinking can be switched off,
 * and the local override may narrow that set and choose the default.
 *
 * @module dsh-workbuddy2api-connect/adapter
 */

import { createProvider } from '@earendil-works/pi-ai'
import type {
  Api,
  AuthContext,
  CredentialStore,
  Model,
  ModelThinkingLevel,
  Provider,
  ThinkingLevelMap,
} from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { ReasoningEffortId, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import type { ImageAttachmentAccess, LlmModelInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { PiAiAdapterOptions, ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { regionOfModel } from './catalog.ts'
import type { CatalogModel, ModelRegion, ThinkingLevel } from './catalog.ts'

/** Provider route this bundle owns by default. */
export const WORKBUDDY2API_PROVIDER = 'workbuddy2api'

/** Provider idle ceiling while one stream read is outstanding. */
export const WORKBUDDY2API_STREAM_IDLE_TIMEOUT_MS = 300_000

/** No per-token pricing is knowable behind a subscription gateway; report zero. */
const NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const

/**
 * Inert pi-ai auth plane.
 *
 * The route authenticates with the panel's `api_key`, resolved per request from
 * the plugin's connection document. pi-ai's own credential lifecycle and ambient
 * discovery must never manufacture a second credential for it.
 */
const INERT_AUTH: { credentials: CredentialStore, authContext: AuthContext } = {
  credentials: {
    async read() { return undefined },
    async list() { return [] },
    async modify() {
      throw new Error('dsh-workbuddy2api-connect: this route has no pi-ai credential lifecycle')
    },
    async delete() {},
  },
  authContext: {
    async env() { return undefined },
    async fileExists() { return false },
  },
}

/** Human-readable label for one level. */
function levelLabel(level: ThinkingLevel): string {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`
}

/**
 * Whether an error is the adapter's "this route does not know the model" failure.
 *
 * Structural rather than `instanceof LlmError`: a profile can hold two copies of
 * `dsh-llm`, and a class identity check would then miss the host's own error.
 */
function isUnknownModel(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'UNKNOWN_MODEL'
}

/**
 * Translate one model's offered levels into pi-ai's `thinkingLevelMap`.
 *
 * Every level is pinned explicitly — a supported one to its wire spelling, the
 * rest to `null` — because `null` is what removes a level from the selector.
 * A model with no offered level carries no `thinkingLevelMap` at all: pi-ai then
 * reads a falsy `reasoning` as "off only", which is the honest description of a
 * gateway model whose levels nobody declared.
 */
export function thinkingFields(model: CatalogModel): { reasoning: boolean, thinkingLevelMap?: ThinkingLevelMap } {
  const offered = new Set<string>(model.efforts)
  if (!model.supportsReasoning || offered.size === 0) return { reasoning: false }
  const map: Record<ModelThinkingLevel, string | null> = {
    off: offered.has('off') ? 'off' : null,
    minimal: null,
    low: offered.has('low') ? 'low' : null,
    medium: offered.has('medium') ? 'medium' : null,
    high: offered.has('high') ? 'high' : null,
    xhigh: offered.has('xhigh') ? 'xhigh' : null,
    max: offered.has('max') ? 'max' : null,
  }
  return { reasoning: true, thinkingLevelMap: map as ThinkingLevelMap }
}

/** The reasoning block one catalog row publishes, when it has selectable levels. */
function reasoningOf(model: CatalogModel): LlmResolvedModelInfo['reasoning'] | undefined {
  if (!model.supportsReasoning || model.efforts.length === 0) return undefined
  return {
    efforts: model.efforts.map(level => ({ id: ReasoningEffortId(level), name: levelLabel(level) })),
    ...model.defaultEffort === undefined ? {} : { defaultEffort: ReasoningEffortId(model.defaultEffort) },
  }
}

/** Build one pi-ai model descriptor pointing at the panel. */
function toPiModel(model: CatalogModel, baseUrl: string, providerId: string): Model<Api> {
  return {
    id: model.id,
    name: model.name,
    api: 'openai-completions',
    provider: providerId,
    baseUrl,
    input: model.supportsImages ? ['text', 'image'] : ['text'],
    ...thinkingFields(model),
    cost: NO_COST,
    contextWindow: model.contextLength > 0 ? model.contextLength : 262_144,
    maxTokens: model.maxOutputTokens > 0 ? model.maxOutputTokens : 32_768,
    // The panel's gateway reads `max_tokens`; pi-ai cannot infer that spelling
    // from a loopback URL, so name it.
    compat: { maxTokensField: 'max_tokens' },
  } as unknown as Model<Api>
}

/** Constructor dependencies. */
export interface WorkBuddy2ApiAdapterOptions {
  /** Domestic provider route; defaults to {@link WORKBUDDY2API_PROVIDER}. */
  providerId?: string
  /** International provider route; defaults to `<providerId>-global`. */
  globalProviderId?: string
  /** Base name the picker shows; the two groups append ` · CN` / ` · Global`. */
  displayName?: string
  /** Override for the international group's display name. */
  globalDisplayName?: string
  /** Live catalog read; called on every listing and resolution. */
  catalog: () => readonly CatalogModel[]
  /** The panel's `/v1` origin, re-read per request so a URL change applies. */
  v1BaseUrl: () => string
  /** The panel key sent as `Authorization: Bearer`. */
  apiKey: () => string
  /** Model ids the local overrides hide from the picker. */
  hidden: () => readonly string[]
  /**
   * Rebuild the host-side adapter snapshot after a catalog change.
   *
   * `PiAiAdapter` memoizes one `Models` collection per profile map identity, so
   * a route whose model list grew can keep answering `UNKNOWN_MODEL` until the
   * map is replaced. The service calls this whenever its diff finds a change.
   */
  invalidate?: () => void
  /**
   * The host's durable attachment service, read per request.
   *
   * pi-ai refuses to build a request that still carries an image when this
   * resolves to `undefined` (`UNSUPPORTED_CONTENT`: "pi-ai image input requires
   * the durable attachment service"), so a route that admits image input has to
   * forward the host's store instead of leaving it unset.
   */
  attachments?: () => AttachmentStore | undefined
  /** Bridge one durable reference into the current tool execution world. */
  imageAccess?: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined
}

/** One provider group the adapter registers with the host. */
export interface WorkBuddy2ApiProvider {
  id: string
  displayName: string
  region: ModelRegion
}

/** What {@link createWorkBuddy2ApiAdapter} hands back. */
export interface WorkBuddy2ApiAdapter {
  adapter: PiAiAdapter
  /** The two picker groups, domestic first. */
  providers: readonly WorkBuddy2ApiProvider[]
  /** Announce a catalog change so the pickers re-read their lists. */
  invalidate: () => void
}

/** Look one model up in a catalog snapshot. */
function findModel(catalog: readonly CatalogModel[], id: string): CatalogModel | undefined {
  return catalog.find(entry => entry.id === id)
}

/**
 * The route's adapter: `PiAiAdapter` plus local catalog facts.
 *
 * Three overrides, each answering one question the base class cannot:
 * `listModels` hides locally disabled models, `resolveModel` publishes the
 * narrowed level set and the chosen default, and `stream` supplies that default
 * when the caller names no effort (pi-ai otherwise sends none, and the panel
 * would fall back to its own default rather than the user's choice).
 */
class PanelPiAiAdapter extends PiAiAdapter {
  constructor(
    private readonly options: {
      catalog: () => readonly CatalogModel[]
      hidden: () => readonly string[]
      regionOfRoute: (provider: string) => ModelRegion
      invalidate?: () => void
    },
    adapterOptions: PiAiAdapterOptions,
  ) {
    super(adapterOptions)
  }

  /**
   * Hide locally disabled models and the other realm from the picker only.
   *
   * The domestic route's provider still carries every descriptor, so a session
   * pinned to it can resolve an international model from before the split; the
   * list is what makes the two picker groups disjoint.
   */
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const models = await super.listModels(provider)
    const hidden = new Set(this.options.hidden())
    const region = this.options.regionOfRoute(provider)
    return models.filter(model => !hidden.has(model.id) && regionOfModel(model.id) === region)
  }

  /** Publish the effective level set and default for one model. */
  override async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    try {
      return this.decorate(await super.resolveModel(provider, model, signal), model)
    } catch (error: unknown) {
      const entry = findModel(this.options.catalog(), model)
      if (!isUnknownModel(error) || entry === undefined) throw error
      // The catalog knows this model, so the host snapshot is the stale half:
      // rebuild it once, then answer from the catalog if the retry still misses.
      this.options.invalidate?.()
      try {
        return this.decorate(await super.resolveModel(provider, model, signal), model)
      } catch {
        const reasoning = reasoningOf(entry)
        return {
          provider,
          id: entry.id,
          name: entry.name,
          ...entry.description === undefined ? {} : { description: entry.description },
          inputModalities: entry.supportsImages ? ['text', 'image'] : ['text'],
          context: { contextWindow: entry.contextLength },
          ...reasoning === undefined ? {} : { reasoning },
        }
      }
    }
  }

  /**
   * Prepare one call, rebuilding the adapter snapshot once when the route has
   * not yet learned a model the catalog already serves.
   *
   * `prepareCall` is the path the session takes before a request; without this
   * retry a model added after registration stays unusable until the next full
   * adapter invalidation.
   */
  override async prepareCall(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): ReturnType<PiAiAdapter['prepareCall']> {
    try {
      return await super.prepareCall(provider, model, signal)
    } catch (error: unknown) {
      if (!isUnknownModel(error) || findModel(this.options.catalog(), model) === undefined) throw error
      this.options.invalidate?.()
      return super.prepareCall(provider, model, signal)
    }
  }

  /** Stamp the user's default effort onto a request that names none. */
  override stream(options: Parameters<PiAiAdapter['stream']>[0]): ReturnType<PiAiAdapter['stream']> {
    try {
      if (options.reasoningEffort === undefined) {
        const entry = findModel(this.options.catalog(), options.model)
        const fallback = entry?.defaultEffort
        if (entry !== undefined && fallback !== undefined && entry.efforts.includes(fallback)) {
          return super.stream({ ...options, reasoningEffort: ReasoningEffortId(fallback) })
        }
      }
      return super.stream(options)
    } catch (error: unknown) {
      if (!isUnknownModel(error) || findModel(this.options.catalog(), options.model) === undefined) throw error
      this.options.invalidate?.()
      return super.stream(options)
    }
  }

  /** Attach the catalog's selectable levels to one resolved model. */
  private decorate(resolved: LlmResolvedModelInfo, model: string): LlmResolvedModelInfo {
    const entry = findModel(this.options.catalog(), model)
    const reasoning = entry === undefined ? undefined : reasoningOf(entry)
    return reasoning === undefined ? resolved : { ...resolved, reasoning }
  }
}

/**
 * Assemble the route.
 *
 * The provider's `getModels` and every descriptor's `baseUrl` are read live, so
 * a URL or key change reaches the next request without rebuilding anything. The
 * profile is constructed by hand because `dsh-llm-pi-ai`'s own `resolveProfiles`
 * is not part of its public export surface; every newly required field has to be
 * adopted here explicitly.
 */
export function createWorkBuddy2ApiAdapter(options: WorkBuddy2ApiAdapterOptions): WorkBuddy2ApiAdapter {
  const providerId = options.providerId ?? WORKBUDDY2API_PROVIDER
  const globalProviderId = options.globalProviderId ?? providerId + '-global'
  const baseName = options.displayName ?? 'WorkBuddy2API'
  // A caller that already named a realm keeps that name; otherwise the two
  // groups are the base name plus the realm suffix the picker shows.
  const cnDisplayName = baseName.endsWith(' · CN') || baseName.endsWith(' · Global')
    ? baseName
    : baseName + ' · CN'
  const globalDisplayName = options.globalDisplayName ?? (cnDisplayName.endsWith(' · CN')
    ? cnDisplayName.slice(0, -' · CN'.length) + ' · Global'
    : cnDisplayName + ' · Global')

  const auth = {
    apiKey: {
      name: 'workbuddy2api-panel key',
      async resolve({ credential }: { credential?: { key?: string } }) {
        const apiKey = credential?.key
        return apiKey === undefined || apiKey.length === 0
          ? undefined
          : { auth: { apiKey }, source: 'workbuddy2api-panel' }
      },
    },
  }

  const modelsFor = (route: string, region?: ModelRegion): Model<Api>[] => {
    const baseUrl = options.v1BaseUrl()
    return options.catalog()
      .filter(model => region === undefined || model.region === region)
      .map(model => toPiModel(model, baseUrl, route))
  }

  /**
   * One provider per realm.
   *
   * The domestic provider keeps every descriptor so a session that selected an
   * international model before the split still resolves on its original route;
   * `listModels` is what hides the other realm from that picker group.
   */
  const makeProvider = (id: string, name: string, models: () => Model<Api>[]): Provider => {
    const base = createProvider({ id, name, auth, models: models(), api: openAICompletionsApi() })
    // Reuse the constructed provider for dispatch, but answer the catalog from
    // the live read. `getAllModels` is pi-ai 1.x's every-type listing; it must
    // be overridden too or the host reads the construction-time list.
    return { ...base, getModels: models, getAllModels: models } as Provider
  }

  const cnProvider = makeProvider(providerId, cnDisplayName, () => modelsFor(providerId))
  const globalProvider = makeProvider(globalProviderId, globalDisplayName, () => modelsFor(globalProviderId, 'global'))

  const providers: readonly WorkBuddy2ApiProvider[] = [
    { id: providerId, displayName: cnDisplayName, region: 'cn' },
    { id: globalProviderId, displayName: globalDisplayName, region: 'global' },
  ]
  const regionByRoute = new Map(providers.map(provider => [provider.id, provider.region]))

  const profileFor = (
    id: string,
    name: string,
    piProvider: Provider,
  ): ResolvedPiAiProviderProfile => ({
    provider: id,
    displayName: name,
    streamIdleTimeoutMs: WORKBUDDY2API_STREAM_IDLE_TIMEOUT_MS,
    retryPolicy: resolveRetryPolicy(undefined, 'dsh-workbuddy2api-connect retryPolicy'),
    configuredMaxTokens: new Map(),
    modelErrors: new Map(),
    maxRequestImageBytes: 20_971_520,
    requestImagePixelBudget: 4_194_304,
    requestImageMaxBytes: 1_048_576,
    piProvider,
  })

  const buildProfiles = (): Map<string, ResolvedPiAiProviderProfile> => new Map([
    [providerId, profileFor(providerId, cnDisplayName, cnProvider)],
    [globalProviderId, profileFor(globalProviderId, globalDisplayName, globalProvider)],
  ])

  let profiles = buildProfiles()

  /** Replace the profile map so `PiAiAdapter` rebuilds its `Models` snapshot. */
  const invalidate = (): void => {
    profiles = buildProfiles()
  }

  const adapter = new PanelPiAiAdapter(
    {
      catalog: options.catalog,
      hidden: options.hidden,
      regionOfRoute: route => regionByRoute.get(route) ?? 'cn',
      invalidate,
    },
    {
      profiles: () => profiles,
      auth: INERT_AUTH,
      // The panel key is the route credential: pi-ai sends it as
      // `Authorization: Bearer <api_key>`, which the panel's `/v1` accepts.
      resolveApiKey: async () => options.apiKey(),
      resolveAttachments: options.attachments === undefined ? undefined : () => options.attachments?.(),
      resolveImageAccess: options.imageAccess === undefined
        ? undefined
        : (attachments, ref) => options.imageAccess?.(attachments, ref),
    },
  )

  return { adapter, providers, invalidate }
}
