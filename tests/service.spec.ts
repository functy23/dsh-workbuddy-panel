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
import type { GatewayHost, GatewayState, GatewayStatus, ServerStatus } from '../src/gateway-contract.ts'

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

/** A host-row stand-in that always reads as running and external. */
const HOST = {
  serviceVersion: 1,
  status,
  kernelUpdate: () => ({ cadence: 'hourly' as const, latestVersion: '1.13.0-panel', available: false, installing: false }),
  serverStatus: (): ServerStatus => ({
    platform: 'darwin',
    arch: 'arm64',
    supported: true,
    version: '1.13.0-panel',
    apiVersion: 1,
    installed: true,
    binaryPath: '/tmp/workbuddy2api',
    sha256: '0'.repeat(64),
    size: 1,
    downloadSize: 1,
    releaseUrl: '',
    download: { state: 'idle', received: 1, total: 1 },
  }),
  apiKeyFromConfig: () => 'k',
} as unknown as GatewayHost

/** The status every call answers with. */
function status(): GatewayStatus {
  return {
    state: 'external',
    managed: false,
    host: 'dsh-subprocess',
    serverVersion: '1.13.0-panel',
    configPath: '/tmp/config.json',
    workdir: '/tmp',
    port: 7863,
    restarts: 0,
    autoStart: false,
    log: [],
  }
}

/** Build a service over a scripted gateway. */
function makeService(
  models: () => Promise<PanelModel[]>,
  hostStatus: () => GatewayStatus = status,
  clientOverrides: Record<string, unknown> = {},
) {
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
    ...clientOverrides,
  } as unknown as PanelClient
  return new WorkBuddy2ApiService({
    version: '0.1.0-test',
    providerId: 'workbuddy2api',
    providerOwned: true,
    connection,
    overrides: new ModelOverridesStore(join(root, 'overrides.json')),
    client,
    host: () => ({ ...HOST, status: hostStatus }) as GatewayHost,
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

  it('classifies domestic and international models and orders domestic first', async () => {
    const service = makeService(async () => [model('global:gpt'), model('cn:hy3'), model('global:kimi')])
    await service.refresh()
    const status = service.status()
    expect(status.models.map(entry => entry.id)).toEqual(['cn:hy3', 'global:gpt', 'global:kimi'])
    expect(status.models.map(entry => entry.region)).toEqual(['cn', 'global', 'global'])
  })

  it('publishes a completion marker when a login poll finishes', async () => {
    let polls = 0
    const service = makeService(async () => [model('cn:a')], status, {
      loginStart: async (realm: string) => ({ url: 'https://example.test/login', state: 's1', realm }),
      loginPoll: async () => {
        polls += 1
        return polls === 1 ? { done: false } : { done: true, uid: 'u3', nickname: 'C' }
      },
    })
    await service.loginStart('cn')
    expect(service.status().login?.realm).toBe('cn')
    await service.loginPoll('s1')
    expect(service.status().login).toBeDefined()
    await service.loginPoll('s1')
    const done = service.status()
    expect(done.login).toBeUndefined()
    expect(done.loginDone).toMatchObject({ realm: 'cn', uid: 'u3', nickname: 'C' })
  })

  it('ignores a poll from a challenge the dialog already replaced', async () => {
    let sequence = 0
    const service = makeService(async () => [model('cn:a')], status, {
      loginStart: async (realm: string) => ({ url: 'https://example.test/' + realm, state: 's' + String(++sequence), realm }),
      loginPoll: async () => ({ done: true, uid: 'stale' }),
    })
    await service.loginStart('cn')
    await service.loginStart('global')
    await service.loginPoll('s1')
    const current = service.status()
    expect(current.login?.realm).toBe('global')
    expect(current.loginDone).toBeUndefined()
  })

  it('keeps a chosen effort as the model default', async () => {
    const service = makeService(async () => [model('cn:a', 'A', ['off', 'high', 'max'])])
    await service.refresh()
    await service.setModel({ id: 'cn:a', effort: 'max' })
    expect(service.status().models[0]?.defaultEffort).toBe('max')
  })

  it('scopes bulk enable and disable to one realm', async () => {
    const service = makeService(async () => [model('cn:a'), model('global:b')])
    await service.refresh()
    await service.setAllModels(false, 'cn')
    let status = service.status()
    expect(status.models.find(entry => entry.id === 'cn:a')?.enabled).toBe(false)
    expect(status.models.find(entry => entry.id === 'global:b')?.enabled).toBe(true)
    await service.setAllModels(true, 'cn')
    status = service.status()
    expect(status.models.find(entry => entry.id === 'cn:a')?.enabled).toBe(true)
  })

  it('keeps the previous catalog through a transient empty read', async () => {
    let models: PanelModel[] = [model('cn:a'), model('global:b')]
    const service = makeService(async () => models)
    await service.refresh()
    models = []
    await service.refresh()
    expect(service.catalogModels().map(entry => entry.id)).toEqual(['cn:a', 'global:b'])
    expect(service.status().error).toContain('keeping the previous catalog')
    await service.refresh()
    await service.refresh()
    expect(service.catalogModels()).toEqual([])
  })

  it('keeps the models of a realm one read forgot to mention', async () => {
    let models: PanelModel[] = [model('cn:a'), model('global:b')]
    const service = makeService(async () => models)
    await service.refresh()

    // The gateway answers 200 with the domestic realm alone while its global
    // account is unavailable. Adopting that read would make the global session
    // already running unresolvable ("has no configured model").
    models = [model('cn:a')]
    await service.refresh()
    expect(service.catalogModels().map(entry => entry.id)).toEqual(['cn:a', 'global:b'])
    expect(service.status().sync.removed).toEqual([])
    expect(service.status().error).toContain('no global models')

    models = [model('cn:a'), model('global:b')]
    await service.refresh()
    expect(service.status().error).toBeUndefined()
  })

  it('follows a realm that stays gone', async () => {
    let models: PanelModel[] = [model('cn:a'), model('global:b')]
    const service = makeService(async () => models)
    await service.refresh()
    models = [model('cn:a')]
    for (let read = 0; read < 4; read += 1) await service.refresh()
    expect(service.catalogModels().map(entry => entry.id)).toEqual(['cn:a'])
    expect(service.status().sync.removed).toEqual(['global:b'])
  })

  it('does not claim a panel connection after the gateway stops', async () => {
    let state: GatewayState = 'external'
    const service = makeService(async () => [model('cn:a')], () => ({ ...status(), state }))
    await service.refresh()
    expect(service.status().panel.connected).toBe(true)
    state = 'stopped'
    const document = service.status()
    expect(document.panel.connected).toBe(false)
    expect(document.panel.version).toBeUndefined()
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
