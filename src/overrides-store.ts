/**
 * The local per-model override document: which models the user hid, and which
 * reasoning level each one runs at.
 *
 * Small, synchronous, and defensive: a corrupt or version-mismatched file reads
 * as "no overrides", which means every model the panel offers stays enabled and
 * keeps the panel's default effort. That is the right failure direction — a
 * broken preference file must not silently empty the user's model picker.
 *
 * @module dsh-workbuddy2api-connect/overrides-store
 */

import { modelOverridesPath } from './paths.ts'
import { readStoreDocument, writeStoreDocument } from './store-file.ts'
import { isThinkingLevel } from './catalog.ts'
import type { ModelOverride, ThinkingLevel } from './catalog.ts'
import { isJsonObject } from './json-value.ts'

/** Format version this build writes and accepts. */
const OVERRIDES_VERSION = 1

/** Decode one override entry, dropping anything unusable. */
function decodeOverride(value: unknown): ModelOverride | undefined {
  if (!isJsonObject(value)) return undefined
  const override: ModelOverride = {}
  if (typeof value['enabled'] === 'boolean') override.enabled = value['enabled']
  if (isThinkingLevel(value['effort'])) override.effort = value['effort']
  if (Array.isArray(value['efforts'])) {
    const efforts = value['efforts'].filter(isThinkingLevel)
    if (efforts.length > 0) override.efforts = efforts
  }
  return Object.keys(override).length === 0 ? undefined : override
}

/** The overrides document, read and written through the shared atomic store. */
export class ModelOverridesStore {
  constructor(private readonly path: string = modelOverridesPath()) {}

  /** Every stored override, keyed by model id. */
  all(): Record<string, ModelOverride> {
    const models = readStoreDocument(this.path, OVERRIDES_VERSION, document => {
      if (!isJsonObject(document['models'])) return undefined
      return document['models']
    })
    if (models === undefined) return {}
    const decoded: Record<string, ModelOverride> = {}
    for (const [id, value] of Object.entries(models)) {
      const override = decodeOverride(value)
      if (override !== undefined) decoded[id] = override
    }
    return decoded
  }

  /** One model's override, when it has one. */
  get(id: string): ModelOverride | undefined {
    return this.all()[id]
  }

  /**
   * Apply a patch to one model.
   *
   * `enabled: true`, `effort: undefined` and `efforts: []` all mean "back to the
   * panel's answer": the entry is pruned instead of stored, so the document only
   * ever holds facts that differ from the panel. That keeps a later panel change
   * (a new default level, a removed capability) visible instead of masked by a
   * stale local copy.
   */
  set(id: string, patch: { enabled?: boolean, effort?: ThinkingLevel | null, efforts?: readonly ThinkingLevel[] }): ModelOverride | undefined {
    const models = this.all()
    const next: ModelOverride = { ...models[id] }
    if (patch.enabled !== undefined) {
      if (patch.enabled) delete next.enabled
      else next.enabled = false
    }
    if (patch.effort !== undefined) {
      if (patch.effort === null) delete next.effort
      else next.effort = patch.effort
    }
    if (patch.efforts !== undefined) {
      if (patch.efforts.length === 0) delete next.efforts
      else next.efforts = patch.efforts
    }
    if (Object.keys(next).length === 0) delete models[id]
    else models[id] = next
    this.write(models)
    return Object.keys(next).length === 0 ? undefined : next
  }

  /** Enable or hide every model the catalog currently lists. */
  setAll(catalog: readonly { id: string }[], enabled: boolean): void {
    const models = this.all()
    for (const model of catalog) {
      const next: ModelOverride = { ...models[model.id] }
      if (enabled) delete next.enabled
      else next.enabled = false
      if (Object.keys(next).length === 0) delete models[model.id]
      else models[model.id] = next
    }
    this.write(models)
  }

  /** Replace the whole document (used by tests and by a reset action). */
  write(models: Record<string, ModelOverride>): void {
    writeStoreDocument(this.path, {
      version: OVERRIDES_VERSION,
      updatedAt: new Date().toISOString(),
      models,
    })
  }
}
