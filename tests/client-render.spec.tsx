/**
 * Server-render smoke test for the browser half.
 *
 * Not a DOM test: it answers the one question a build cannot — does the page
 * render at all with a realistic document, and does every copy key resolve to
 * finished text (no stray {0} placeholders, no raw key names)? The surfaces are
 * pure projections of the store, so a static render covers them.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorkBuddy2ApiSettingsPage } from '../src/client/SettingsPage.tsx'
import { WorkBuddy2ApiFooterEntry, WorkBuddy2ApiPanel } from '../src/client/panel-view.tsx'
import { WorkBuddy2ApiCreditBadge } from '../src/client/credit-badge.tsx'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { COPY, makeTranslator } from '../src/client/copy.ts'
import type { StoreSnapshot } from '../src/client/store.ts'
import type { StatusDocument } from '../src/client/status-document.ts'

const zh = makeTranslator(key => key in COPY.zh ? (COPY.zh as Record<string, string>)[key]! : key)
const en = makeTranslator(key => key in COPY.en ? (COPY.en as Record<string, string>)[key]! : key)

/** A document shaped like a real one, with every optional field present. */
const document = {
  ok: true,
  controlKey: 'k',
  version: '0.1.0',
  piAiVersion: '1.1.0',
  provider: { id: 'workbuddy2api', owned: true, global: { id: 'workbuddy2api-global', owned: true } },
  connection: { panelUrl: 'http://127.0.0.1:7863', hasApiKey: true, refreshSeconds: 15, syncHiddenToPanel: true, autoRegister: true },
  gateway: {
    state: 'running', managed: true, host: 'dsh-subprocess', serverVersion: '1.13.0-panel',
    binary: '/opt/workbuddy2api/workbuddy2api',
    configPath: '/tmp/workbuddy2api-gateway/config.json', workdir: '/tmp/workbuddy2api-gateway', port: 7863,
    since: '2026-10-24T08:00:00.000Z', restarts: 1, autoStart: true,
    log: [{ at: '2026-10-24T08:00:01.000Z', stream: 'stdout', text: 'workbuddy2api listening on :7863' }],
  },
  server: {
    platform: 'darwin', arch: 'arm64', supported: true, version: '1.13.0-panel', apiVersion: 1,
    installed: true, binaryPath: '/Users/test/.dsh/workbuddy2api-gateway/server/1.13.0-panel/darwin-arm64/workbuddy2api',
    sha256: 'd48a6c46877a340c824f18c4ee5ce77c349b6b0679405c040f48c902005cc87b',
    size: 14_276_994, downloadSize: 7_721_207, releaseUrl: 'https://example.test/server.gz',
    download: { state: 'idle', received: 7_721_207, total: 7_721_207 },
  },
  kernel: {
    cadence: 'hourly', lastCheckedAt: '2026-10-24T09:30:00.000Z', latestVersion: '1.14.0-panel',
    available: true, installing: false,
  },
  panel: { connected: true, version: '1.13.0-panel', uptimeSec: 3600, authRequired: true },
  sync: { lastSyncedAt: '2026-10-24T09:00:00.000Z', added: ['cn:glm-5v-turbo'], removed: [], changed: [], autoRegister: true },
  counts: { total: 2, healthy: 1, cooling: 1, disabled: 0, paused: 0, models: 2, enabledModels: 1, hiddenModels: 1 },
  accounts: [
    {
      uid: 'u1', nickname: '低调哥', realm: 'cn', credits: 2099, creditsTotal: 2100, status: 'active',
      hasRefreshToken: true, checkinDone: true, successCount: 21, failStreak: 0, requestCount: 21,
      lastModel: 'cn:deepseek-v4.1-flash', tokenExpiresAt: '2026-11-23T08:50:42+08:00',
      rateLimitedModels: 0, enterprise: false,
    },
    {
      uid: 'u2', nickname: '刘吉鹏', realm: 'global', credits: 5, status: 'cooling', hasRefreshToken: false,
      checkinDone: false, successCount: 0, failStreak: 3, rateLimitedModels: 1, enterprise: true,
    },
  ],
  models: [
    {
      id: 'cn:deepseek-v4.1-flash', name: 'Deepseek-V4.1-Flash', region: 'cn', credits: 'x0.05',
      contextLength: 1_000_000, maxOutputTokens: 393_216, efforts: ['off', 'low', 'high', 'max'],
      defaultEffort: 'high', enabled: true, canDisableThinking: true, supportsImages: true,
      supportsReasoning: true, onlyReasoning: false, tags: [],
    },
    {
      id: 'cn:glm-5.3', name: 'GLM-5.3', region: 'cn', contextLength: 1_000_000, maxOutputTokens: 131_072,
      efforts: ['low', 'high'], defaultEffort: 'high', enabled: false, canDisableThinking: true,
      supportsImages: true, supportsReasoning: true, onlyReasoning: true, tags: [],
    },
    {
      id: 'global:gpt-5.4', name: 'GPT-5.4', region: 'global', contextLength: 400_000, maxOutputTokens: 128_000,
      efforts: ['low', 'high'], defaultEffort: 'high', enabled: true, canDisableThinking: true,
      supportsImages: true, supportsReasoning: true, onlyReasoning: false, tags: [],
    },
  ],
  usage: {
    days: Array.from({ length: 84 }, (_, index) => ({
      date: new Date(Date.parse('2026-10-24T00:00:00Z') - (83 - index) * 86_400_000).toISOString().slice(0, 10),
      calls: index % 7,
      tokens: index % 7 * 1000,
      credits: index % 7 * 0.5,
    })),
    calls: 300,
    tokens: 40_000,
    credits: 20,
    activeDays: 12,
    peakHour: 22,
    topModel: 'cn:deepseek-v4.1-flash',
    empty: false,
  },
  updatedAt: '2026-10-24T09:00:01.000Z',
} as unknown as StatusDocument

/** A store stand-in with the surface the components use. */
function fakeStore(snapshot: StoreSnapshot): never {
  return {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    start: () => {},
    stop: () => {},
    act: () => Promise.resolve(),
    dismissMessage: () => {},
  } as unknown as never
}

describe('settings page render', () => {
  const store = fakeStore({ document, loading: false })

  it('renders the gateway tab in Chinese copy with no placeholders left', () => {
    const html = renderToStaticMarkup(<WorkBuddy2ApiSettingsPage t={zh} store={store} />)
    expect(html).toContain('WorkBuddy2API 互通')
    expect(html).toContain('概览')
    expect(html).toContain('账号')
    expect(html).toContain('模型')
    expect(html).toContain('网关进程')
    expect(html).toContain('用量')
    expect(html).toContain('Token 总量')
    expect(html).toContain('剩余积分')
    expect(html).toContain('最常用模型')
    expect(html).toContain('下午 10 点')
    expect(html).not.toMatch(/\{\d\}/)
    expect(html).not.toContain('gatewayStateRunning')
  })

  it('renders the separately downloaded server card on the gateway tab', () => {
    const html = renderToStaticMarkup(<WorkBuddy2ApiSettingsPage t={zh} store={store} initialTab="gateway" />)
    expect(html).toContain('服务端')
    expect(html).toContain('已安装')
    expect(html).toContain('SHA-256')
    expect(html).toContain('由 DSH 宿主托管')
    expect(html).not.toMatch(/\{\d\}/)
  })

  it('offers a realm tab and starts on the domestic models', () => {
    const html = renderToStaticMarkup(<WorkBuddy2ApiSettingsPage t={zh} store={store} initialTab="models" />)
    expect(html).toContain('国内版')
    expect(html).toContain('国际版')
    expect(html).toContain('Deepseek-V4.1-Flash')
    // The tab starts on the domestic realm; the international row is not rendered.
    expect(html).not.toContain('GPT-5.4')
  })

  it('renders the English copy for the same document', () => {
    const html = renderToStaticMarkup(<WorkBuddy2ApiSettingsPage t={en} store={store} />)
    expect(html).toContain('WorkBuddy2API Connect')
    expect(html).toContain('Gateway process')
    expect(html).toContain('Running')
    expect(html).not.toMatch(/\{\d\}/)
  })

  it('renders an unavailable state instead of throwing when nothing was read', () => {
    const html = renderToStaticMarkup(
      <WorkBuddy2ApiSettingsPage t={zh} store={fakeStore({ loading: true, error: 'status document unavailable' })} />,
    )
    expect(html).toContain('失败：')
  })
})

/** A model-directory store with one selected provider. */
function fakeDirectory(provider: string): ModelDirectory['store'] {
  return {
    subscribe: () => () => {},
    getSnapshot: () => ({ current: { provider, model: 'x' } }),
  } as unknown as ModelDirectory['store']
}

describe('credit badge', () => {
  const store = fakeStore({ document, loading: false })

  it('shows the domestic pool when the domestic route is selected', () => {
    const html = renderToStaticMarkup(
      <WorkBuddy2ApiCreditBadge t={zh} store={store} directory={fakeDirectory('workbuddy2api')} />,
    )
    expect(html).toContain('CN 剩余积分')
    expect(html).toContain('2,099')
  })

  it('shows the global pool when the global route is selected', () => {
    const html = renderToStaticMarkup(
      <WorkBuddy2ApiCreditBadge t={zh} store={store} directory={fakeDirectory('workbuddy2api-global')} />,
    )
    expect(html).toContain('Global 剩余积分')
    expect(html).toContain('5')
    expect(html).not.toContain('2,099')
  })

  it('renders nothing for another provider', () => {
    const html = renderToStaticMarkup(
      <WorkBuddy2ApiCreditBadge t={zh} store={store} directory={fakeDirectory('deepseek')} />,
    )
    expect(html).toBe('')
  })
})

describe('dashboard render', () => {
  const store = fakeStore({ document, loading: false })
  const face = { t: zh, store, open: () => {}, close: () => {} }

  it('names the gateway state in the footer card', () => {
    const html = renderToStaticMarkup(<WorkBuddy2ApiFooterEntry {...face} />)
    expect(html).toContain('运行中')
    expect(html).toContain('1/2 账号可用')
    expect(html).toContain('1/2 模型启用')
  })

  it('renders the panel with the process controls, accounts, and models', () => {
    const html = renderToStaticMarkup(<WorkBuddy2ApiPanel {...face} />)
    expect(html).toContain('低调哥')
    expect(html).toContain('Deepseek-V4.1-Flash')
    expect(html).toContain('重启')
    expect(html).toContain('停止')
  })

  it('draws nothing on the sidebar before the first read', () => {
    const html = renderToStaticMarkup(
      <WorkBuddy2ApiFooterEntry t={zh} store={fakeStore({ loading: true })} open={() => {}} close={() => {}} />,
    )
    expect(html).toBe('')
  })
})
