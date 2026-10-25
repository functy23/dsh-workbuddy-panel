/**
 * The model catalog this plugin serves, and the local overrides layered on it.
 *
 * The panel is the source of truth for what exists and what each model can do;
 * the local document is the source of truth for what the *user* wants from it —
 * which models appear, and which reasoning level a model runs at by default.
 * Merging them here, in one pure function, is what keeps the picker, the route's
 * descriptors, the settings page, and the panel sync agreeing about the answer.
 *
 * @module dsh-workbuddy2api-connect/catalog
 */

import type { PanelModel } from './panel-client.ts'

/** Reasoning levels pi-ai can express, in display order. */
export const THINKING_LEVELS = ['off', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** One reasoning level name. */
export type ThinkingLevel = typeof THINKING_LEVELS[number]

/** Whether a value is a level this plugin can offer. */
export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === 'string' && (THINKING_LEVELS as readonly string[]).includes(value)
}

/** The local document's per-model entry. */
export interface ModelOverride {
  /** Whether the model appears in DSH's picker. Absent means enabled. */
  enabled?: boolean
  /** The level this model should run at when a request names none. */
  effort?: ThinkingLevel
  /**
   * The levels the picker may offer. Absent means "every level the panel
   * declares"; an empty list is treated as absent rather than as "none", since a
   * model with no selectable level cannot be pinned to one.
   */
  efforts?: readonly ThinkingLevel[]
}

/** Which WorkBuddy gateway a model id belongs to. */
export type ModelRegion = 'cn' | 'global'

/**
 * The region encoded in a gateway model id.
 *
 * `/v1/models` and `/panel/api/models` prefix every id with the realm that
 * serves it (`cn:` or `global:`). A bare id is the CN realm: that is the
 * gateway's own default and the historical shape before the prefix existed.
 */
export function regionOfModel(id: string): ModelRegion {
  return id.startsWith('global:') ? 'global' : 'cn'
}

/** One model after the override layer is applied. */
export interface CatalogModel {
  id: string
  name: string
  /** Gateway realm this model is served by. */
  region: ModelRegion
  description?: string
  vendor?: string
  credits?: string
  contextLength: number
  maxOutputTokens: number
  /** Levels the panel declares for this model, plus `off` when it can disable thinking. */
  declaredEfforts: readonly ThinkingLevel[]
  /** Levels actually offered to the picker (the override's subset, or the declared set). */
  efforts: readonly ThinkingLevel[]
  /** Level used when a request does not name one. */
  defaultEffort?: ThinkingLevel
  canDisableThinking: boolean
  supportsImages: boolean
  supportsReasoning: boolean
  onlyReasoning: boolean
  tags: readonly string[]
  /** Whether the picker lists it. */
  enabled: boolean
}

/** The declared level set of one panel row: its efforts, plus `off` when allowed. */
export function declaredEffortsOf(model: PanelModel): ThinkingLevel[] {
  const declared = model.supportedEfforts.filter(isThinkingLevel)
  if (model.canDisableThinking && !declared.includes('off')) declared.unshift('off')
  return declared
}

/** Pick the level a model should default to, from the override then the panel. */
function defaultEffortOf(
  override: ModelOverride | undefined,
  offered: readonly ThinkingLevel[],
  panelDefault: ThinkingLevel | undefined,
): ThinkingLevel | undefined {
  if (override?.effort !== undefined && offered.includes(override.effort)) return override.effort
  if (panelDefault !== undefined && offered.includes(panelDefault)) return panelDefault
  return offered.find(level => level !== 'off')
}

/**
 * Merge the panel catalog with the local override document.
 *
 * A model with no override is enabled and runs at the panel's own default, so a
 * fresh install — and every model the panel adds later — needs no local entry to
 * appear. An override naming a level the panel no longer declares is ignored
 * rather than obeyed: the panel is the capability authority, and pinning a level
 * a model cannot accept would fail every request.
 */
export function buildCatalog(
  models: readonly PanelModel[],
  overrides: Readonly<Record<string, ModelOverride>>,
): CatalogModel[] {
  const built = models.map(model => {
    const override = overrides[model.id]
    const declared = declaredEffortsOf(model)
    const restricted = override?.efforts?.filter(level => declared.includes(level)) ?? []
    const offered = restricted.length > 0 ? restricted : declared
    const panelDefault = model.defaultEffort !== undefined && isThinkingLevel(model.defaultEffort)
      ? model.defaultEffort
      : undefined
    const defaultEffort = defaultEffortOf(override, offered, panelDefault)
    return {
      id: model.id,
      name: model.name,
      region: regionOfModel(model.id),
      ...model.description === undefined ? {} : { description: model.description },
      ...model.vendor === undefined ? {} : { vendor: model.vendor },
      ...model.credits === undefined ? {} : { credits: model.credits },
      contextLength: model.contextLength,
      maxOutputTokens: model.maxOutputTokens,
      declaredEfforts: declared,
      efforts: offered,
      ...defaultEffort === undefined ? {} : { defaultEffort },
      canDisableThinking: model.canDisableThinking,
      supportsImages: model.supportsImages,
      supportsReasoning: model.supportsReasoning,
      onlyReasoning: model.onlyReasoning,
      tags: model.tags,
      enabled: override?.enabled !== false,
    }
  })
  // The gateway serves /panel/api/models out of a Go map, so its order changes on
  // every request. Sorting here is what keeps the picker's rows still: realm
  // first (domestic before international), then id. The id is realm-prefixed, so
  // the second key already keeps a realm together — the first key is what makes
  // the two blocks explicit when a catalog is displayed as one list.
  return built.sort((left, right) => {
    const rank = regionRank(left.region) - regionRank(right.region)
    if (rank !== 0) return rank
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  })
}

/** Display order of the two realms: domestic first, international second. */
function regionRank(region: ModelRegion): number {
  return region === 'cn' ? 0 : 1
}

/** Ids the user has hidden locally — what the picker filters out. */
export function hiddenIds(catalog: readonly CatalogModel[]): string[] {
  return catalog.filter(model => !model.enabled).map(model => model.id)
}

/** Every id the picker should list. */
export function visibleIds(catalog: readonly CatalogModel[]): string[] {
  return catalog.filter(model => model.enabled).map(model => model.id)
}

/**
 * The panel `models.hidden` list this plugin should push, given a catalog.
 *
 * The panel's own hidden list is an *authoritative reject* at the gateway, so it
 * is derived from the local enabled set alone. The plugin keeps the union with
 * whatever the panel hid for its own reasons: this document is the one place
 * that might also carry an operator's hand-edit, and silently un-hiding a model
 * somebody else disabled is worse than a slightly stale entry.
 */
export function panelHiddenList(catalog: readonly CatalogModel[], previous: readonly string[]): string[] {
  const local = new Set(hiddenIds(catalog))
  const kept = previous.filter(id => !catalog.some(model => model.id === id))
  return [...new Set([...kept, ...local])].sort()
}
