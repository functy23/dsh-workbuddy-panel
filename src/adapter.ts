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
import type { CatalogModel, ThinkingLevel } from './catalog.ts'

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
  /** Provider route; defaults to {@link WORKBUDDY2API_PROVIDER}. */
  providerId?: string
  /** Name the picker shows for the group. */
  displayName?: string
  /** Live catalog read; called on every listing and resolution. */
  catalog: () => readonly CatalogModel[]
  /** The panel's `/v1` origin, re-read per request so a URL change applies. */
  v1BaseUrl: () => string
  /** The panel key sent as `Authorization: Bearer`. */
  apiKey: () => string
  /** Model ids the local overrides hide from the picker. */
  hidden: () => readonly string[]
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

/** What {@link createWorkBuddy2ApiAdapter} hands back. */
export interface WorkBuddy2ApiAdapter {
  adapter: PiAiAdapter
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
    },
    adapterOptions: PiAiAdapterOptions,
  ) {
    super(adapterOptions)
  }

  /** Hide locally disabled models from the picker only. */
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const models = await super.listModels(provider)
    const hidden = new Set(this.options.hidden())
    return models.filter(model => !hidden.has(model.id))
  }

  /** Publish the effective level set and default for one model. */
  override async resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo> {
    const resolved = await super.resolveModel(provider, model, signal)
    const entry = findModel(this.options.catalog(), model)
    if (entry === undefined || !entry.supportsReasoning || entry.efforts.length === 0) return resolved
    return {
      ...resolved,
      reasoning: {
        efforts: entry.efforts.map(level => ({ id: ReasoningEffortId(level), name: levelLabel(level) })),
        ...entry.defaultEffort === undefined ? {} : { defaultEffort: ReasoningEffortId(entry.defaultEffort) },
      },
    }
  }

  /** Stamp the user's default effort onto a request that names none. */
  override stream(options: Parameters<PiAiAdapter['stream']>[0]): ReturnType<PiAiAdapter['stream']> {
    if (options.reasoningEffort === undefined) {
      const entry = findModel(this.options.catalog(), options.model)
      const fallback = entry?.defaultEffort
      if (entry !== undefined && fallback !== undefined && entry.efforts.includes(fallback)) {
        return super.stream({ ...options, reasoningEffort: ReasoningEffortId(fallback) })
      }
    }
    return super.stream(options)
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
  const displayName = options.displayName ?? 'WorkBuddy2API'

  const buildModels = (): Model<Api>[] => {
    const baseUrl = options.v1BaseUrl()
    return options.catalog().map(model => toPiModel(model, baseUrl, providerId))
  }

  const base = createProvider({
    id: providerId,
    name: displayName,
    auth: {
      apiKey: {
        name: 'workbuddy2api-panel key',
        async resolve({ credential }) {
          const apiKey = credential?.key
          return apiKey === undefined || apiKey.length === 0
            ? undefined
            : { auth: { apiKey }, source: 'workbuddy2api-panel' }
        },
      },
    },
    models: buildModels(),
    api: openAICompletionsApi(),
  })

  // Reuse the constructed provider for dispatch, but answer the catalog from the
  // live read: this is the pattern `dsh-llm-pi-ai` itself uses.
  const provider: Provider = { ...base, getModels: () => buildModels() }

  const profile: ResolvedPiAiProviderProfile = {
    provider: providerId,
    displayName,
    streamIdleTimeoutMs: WORKBUDDY2API_STREAM_IDLE_TIMEOUT_MS,
    retryPolicy: resolveRetryPolicy(undefined, 'dsh-workbuddy2api-connect retryPolicy'),
    configuredMaxTokens: new Map(),
    modelErrors: new Map(),
    maxRequestImageBytes: 20_971_520,
    requestImagePixelBudget: 4_194_304,
    requestImageMaxBytes: 1_048_576,
    piProvider: provider,
  }

  let profiles = new Map<string, ResolvedPiAiProviderProfile>([[providerId, profile]])

  const adapter = new PanelPiAiAdapter(
    { catalog: options.catalog, hidden: options.hidden },
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

  return {
    adapter,
    invalidate: () => {
      profiles = new Map<string, ResolvedPiAiProviderProfile>([[providerId, profile]])
    },
  }
}
