/**
 * The service's contract: a model the gateway starts answering joins the catalog
 * on its own, a removed one leaves it, a failed read keeps the last catalog, and
 * auto-registration off holds the catalog still.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkBuddy2ApiService } from '../src/service.ts'
import { ConnectionStore, DEFAULT_CONNECTION } from '../src/settings-store.ts'
import { ModelOverridesStore } from '../src/overrides-store.ts'
import type { PanelClient, PanelModel, PanelOverview } from '../src/panel-client.ts'
import type { PanelSupervisor, SupervisorStatus } from '../src/supervisor.ts'

/** One model as the gateway reports it. */
function model(id: string, name = id, efforts: readonly string[] = ['low', 'high']): PanelModel {
  return {
    id,
    name,
    contextLength: 1_000_000,
    maxOutputTokens: 64_000,
    supportedEfforts: efforts,
    defaultEffort: efforts[1],
    canDisableThinking: true,
    supportsImages: true,
    supportsReasoning: true,
    onlyReasoning: false,
    tags: [],
    supportsToolCall: true,
  } as PanelModel
}

/** An overview with two accounts. */
const OVERVIEW: PanelOverview = {
  authRequired: true,
  total: 2,
  healthy: 1,
  cooling: 1,
  disabled: 0,
  paused: 0,
  inFlightFull: false,
  accounts: [
    {
      uid: 'u1', nickname: 'A', realm: 'cn', status: 'active', credits: 100, creditsTotal: 200,
      hasRefreshToken: true, checkinDone: true, successCount: 3, failStreak: 0,
      rateLimitedModels: [], enterprise: false, paused: false, cooling: false, disabled: false,
    },
    {
      uid: 'u2', nickname: 'B', realm: 'global', status: 'cooling', credits: 5, creditsTotal: 200,
      hasRefreshToken: true, checkinDone: false, successCount: 0, failStreak: 2,
      rateLimitedModels: [{ model: 'm' }], enterprise: true, paused: false, cooling: true, disabled: false,
    },
  ],
} as unknown as PanelOverview

/** A supervisor stand-in that always reads as running and external. */
const SUPERVISOR = {
  refresh: async (): Promise<SupervisorStatus> => status(),
  status,
  invalidateBinary: () => {},
  apiKeyFromConfig: () => 'k',
} as unknown as PanelSupervisor

/** The status every call answers with. */
function status(): SupervisorStatus {
  return {
    state: 'external',
    managed: false,
    configPath: '/tmp/config.json',
    workdir: '/tmp',
    port: 7863,
    restarts: 0,
    autoStart: false,
    log: [],
  }
}

/** Build a service over a scripted gateway. */
function makeService(models: () => Promise<PanelModel[]>) {
  const root = mkdtempSync(join(tmpdir(), 'wb2g-svc-'))
  const connection = new ConnectionStore(join(root, 'connection.json'), {
    ...DEFAULT_CONNECTION,
    panelUrl: 'http://127.0.0.1:7863',
    apiKey: 'k',
  })
  const client = {
    overview: async () => OVERVIEW,
    models,
    config: async () => ({ raw: { models: { hidden: ['legacy-model'] } } }),
    saveHidden: async () => ({ ok: true }),
  } as unknown as PanelClient
  return new WorkBuddy2ApiService({
    version: '0.1.0-test',
    providerId: 'workbuddy2api',
    providerOwned: true,
    connection,
    overrides: new ModelOverridesStore(join(root, 'overrides.json')),
    client,
    supervisor: SUPERVISOR,
    cachePath: join(root, 'catalog.json'),
  })
}

describe('service discovery', () => {
  it('adopts a model the gateway starts answering', async () => {
    let models: PanelModel[] = [model('cn:a')]
    const service = makeService(async () => models)
    await service.refresh()
    expect(service.catalogModels().map(entry => entry.id)).toEqual(['cn:a'])
    expect(service.status().models[0]?.efforts).toEqual(expect.arrayContaining(['low', 'high']))

    models = [model('cn:a'), model('cn:b', 'B')]
    await service.refresh()
    const after = service.status()
    expect(after.models.map(entry => entry.id)).toEqual(['cn:a', 'cn:b'])
    expect(after.sync.added).toEqual(['cn:b'])
    expect(after.counts.models).toBe(2)
  })

  it('drops a model the gateway stops answering', async () => {
    let models: PanelModel[] = [model('cn:a'), model('cn:b')]
    const service = makeService(async () => models)
    await service.refresh()
    models = [model('cn:a')]
    await service.refresh()
    expect(service.catalogModels().map(entry => entry.id)).toEqual(['cn:a'])
    expect(service.status().sync.removed).toEqual(['cn:b'])
  })

  it('keeps the last catalog when a read fails', async () => {
    let fail = false
    const service = makeService(async () => {
      if (fail) throw new Error('gateway down')
      return [model('cn:a')]
    })
    await service.refresh()
    fail = true
    await service.refresh()
    expect(service.catalogModels().map(entry => entry.id)).toEqual(['cn:a'])
    expect(service.status().error).toContain('gateway down')
  })

  it('holds the catalog still while auto-registration is off', async () => {
    let models: PanelModel[] = [model('cn:a')]
    const service = makeService(async () => models)
    await service.refresh()
    await service.setAutoRegister(false)
    models = [model('cn:a'), model('cn:b')]
    await service.refresh()
    expect(service.catalogModels().map(entry => entry.id)).toEqual(['cn:a'])
    expect(service.status().sync.added).toEqual([])
  })

  it('reports the pool and the reasoning levels the panel declares', async () => {
    const service = makeService(async () => [model('cn:a', 'A', ['off', 'high', 'max'])])
    await service.refresh()
    const status = service.status()
    expect(status.counts.total).toBe(2)
    expect(status.counts.healthy).toBe(1)
    expect(status.accounts[1]?.rateLimitedModels).toBe(1)
    expect(status.models[0]?.efforts).toEqual(['off', 'high', 'max'])
  })
})
