/**
 * The adapter's catalog-facing contract: two picker groups, each listing one
 * gateway realm, the declared reasoning levels on resolution, and a domestic
 * route that can still resolve a model selected before the split.
 */
import { describe, expect, it } from 'vitest'
import { createWorkBuddy2ApiAdapter } from '../src/adapter.ts'
import type { CatalogModel } from '../src/catalog.ts'

/** One merged catalog row. */
function model(id: string, region: 'cn' | 'global', name = 'Hy3'): CatalogModel {
  return {
    id,
    name,
    region,
    contextLength: 192_000,
    maxOutputTokens: 64_000,
    declaredEfforts: ['off', 'low', 'high'],
    efforts: ['off', 'low', 'high'],
    defaultEffort: 'high',
    canDisableThinking: true,
    supportsImages: true,
    supportsReasoning: true,
    onlyReasoning: false,
    tags: [],
    enabled: true,
  }
}

/** Build the route over a fixed catalog. */
function adapterOver(catalog: readonly CatalogModel[]) {
  return createWorkBuddy2ApiAdapter({
    catalog: () => catalog,
    v1BaseUrl: () => 'http://127.0.0.1:7863/v1',
    apiKey: () => 'k',
    hidden: () => [],
  })
}

describe('workbuddy2api adapter', () => {
  it('registers one picker group per realm, domestic first', async () => {
    const adapter = adapterOver([model('cn:hy3', 'cn'), model('global:gpt', 'global', 'GPT')])
    expect(adapter.providers.map(provider => provider.id)).toEqual(['workbuddy2api', 'workbuddy2api-global'])
    expect(adapter.providers.map(provider => provider.displayName)).toEqual([
      'WorkBuddy2API · CN',
      'WorkBuddy2API · Global',
    ])
  })

  it('lists each realm only in its own group, with unprefixed names', async () => {
    const adapter = adapterOver([model('cn:hy3', 'cn'), model('global:gpt', 'global', 'GPT')])
    const domestic = await adapter.adapter.listModels('workbuddy2api')
    const international = await adapter.adapter.listModels('workbuddy2api-global')
    expect(domestic.map(entry => entry.id)).toEqual(['cn:hy3'])
    expect(domestic.map(entry => entry.name)).toEqual(['Hy3'])
    expect(international.map(entry => entry.id)).toEqual(['global:gpt'])
    expect(international.map(entry => entry.name)).toEqual(['GPT'])
  })

  it('still resolves a pre-split international session on the domestic route', async () => {
    const adapter = adapterOver([model('cn:hy3', 'cn'), model('global:gpt', 'global', 'GPT')])
    const resolved = await adapter.adapter.resolveModel('workbuddy2api', 'global:gpt')
    expect(resolved.id).toBe('global:gpt')
    expect(resolved.name).toBe('GPT')
  })

  it('publishes the narrowed levels and the chosen default on resolution', async () => {
    const adapter = adapterOver([model('cn:hy3', 'cn')])
    const resolved = await adapter.adapter.resolveModel('workbuddy2api', 'cn:hy3')
    expect(resolved.reasoning?.efforts.map(entry => entry.id)).toEqual(['off', 'low', 'high'])
    expect(resolved.reasoning?.defaultEffort).toBe('high')
  })
})
