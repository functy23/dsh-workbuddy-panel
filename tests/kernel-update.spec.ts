import { describe, expect, it } from 'vitest'
import {
  CHANNEL_TAG,
  channelManifestUrl,
  compareVersions,
  fetchLatestServerManifest,
  githubRepoFromBase,
} from '../src/kernel-update.ts'

const BASE = 'https://github.com/functy23/dsh-workbuddy-panel/releases/download'
const CHANNEL = BASE + '/' + CHANNEL_TAG + '/server.json'
const sha = 'a'.repeat(64)

/** A manifest document shaped like the packaged one. */
function manifest(version: string, releaseBaseUrl = BASE): Record<string, unknown> {
  return {
    schemaVersion: 1,
    version,
    apiVersion: 1,
    minPanel: '0.4.0',
    releaseTag: 'server-v' + version,
    releaseBaseUrl,
    assets: {
      'darwin-arm64': {
        asset: 'workbuddy2api-' + version + '-darwin-arm64.gz',
        sha256: sha,
        size: 10,
        downloadSize: 5,
      },
    },
  }
}

/** A fetch stub keyed by URL that records every URL it was asked for. */
function stubFetch(routes: Record<string, unknown>, calls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    calls.push(url)
    if (!(url in routes)) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(routes[url]), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

describe('version comparison', () => {
  it('orders numeric segments and treats a suffix as a pre-release', () => {
    expect(compareVersions('1.14.0-panel', '1.13.0-panel')).toBeGreaterThan(0)
    expect(compareVersions('1.13.0-panel', '1.14.0-panel')).toBeLessThan(0)
    expect(compareVersions('1.14.0-panel', '1.14.0-panel')).toBe(0)
    expect(compareVersions('1.14.0', '1.14.0-panel')).toBeGreaterThan(0)
    expect(compareVersions('1.14.10-panel', '1.14.9-panel')).toBeGreaterThan(0)
  })
})

describe('channel location', () => {
  it('derives owner/repo from a GitHub release base only', () => {
    expect(githubRepoFromBase(BASE)).toEqual({ owner: 'functy23', repo: 'dsh-workbuddy-panel' })
    expect(githubRepoFromBase('https://mirror.example.test/releases/download')).toBeUndefined()
    expect(githubRepoFromBase('http://github.com/a/b')).toBeUndefined()
    expect(githubRepoFromBase('not a url')).toBeUndefined()
  })

  it('builds one fixed URL, whatever the kernel version is', () => {
    expect(channelManifestUrl(BASE)).toBe(CHANNEL)
    expect(channelManifestUrl(BASE + '/')).toBe(CHANNEL)
    expect(channelManifestUrl('  ' + BASE + '  ')).toBe(CHANNEL)
    expect(channelManifestUrl('https://mirror.example.test/download')).toBeUndefined()
    expect(channelManifestUrl('')).toBeUndefined()
  })
})

describe('channel discovery', () => {
  it('reads the fixed channel document and never touches the releases API', async () => {
    const calls: string[] = []
    const fetchImpl = stubFetch({ [CHANNEL]: manifest('1.15.0-panel') }, calls)
    const result = await fetchLatestServerManifest({ fetchImpl, releaseBaseUrl: BASE })
    expect(result.version).toBe('1.15.0-panel')
    expect(result.releaseTag).toBe('server-v1.15.0-panel')
    expect(calls).toEqual([CHANNEL])
    expect(calls.some(url => url.includes('api.github.com'))).toBe(false)
  })

  it('prefers an explicit channel document (self-hosted mirror)', async () => {
    const calls: string[] = []
    const fetchImpl = stubFetch({
      'https://channel.test/server.json': manifest('1.20.0-panel', 'https://github.com/other/repo/releases/download'),
    }, calls)
    const result = await fetchLatestServerManifest({
      fetchImpl,
      releaseBaseUrl: BASE,
      manifestUrl: 'https://channel.test/server.json',
    })
    expect(result.version).toBe('1.20.0-panel')
    expect(calls).toEqual(['https://channel.test/server.json'])
  })

  it('rejects a channel document that points downloads at another repository', async () => {
    const fetchImpl = stubFetch({
      [CHANNEL]: manifest('1.15.0-panel', 'https://github.com/someone-else/fork/releases/download'),
    })
    await expect(fetchLatestServerManifest({ fetchImpl, releaseBaseUrl: BASE }))
      .rejects.toThrow(/does not match the packaged channel/u)
  })

  it('reports the HTTP status together with the URL', async () => {
    const fetchImpl = (async () => new Response('rate limited', { status: 403 })) as unknown as typeof fetch
    await expect(fetchLatestServerManifest({ fetchImpl, releaseBaseUrl: BASE }))
      .rejects.toThrow(/HTTP 403 for https:\/\/github\.com\/functy23\/dsh-workbuddy-panel/u)
  })

  it('refuses a non-GitHub channel base', async () => {
    await expect(fetchLatestServerManifest({ fetchImpl: stubFetch({}), releaseBaseUrl: 'https://mirror.example.test/download' }))
      .rejects.toThrow(/not a GitHub release base/u)
  })
})
