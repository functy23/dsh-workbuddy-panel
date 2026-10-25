import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  fetchLatestServerManifest,
  githubRepoFromBase,
  manifestAssetUrl,
  newestKernelTag,
} from '../src/kernel-update.ts'

const sha = 'a'.repeat(64)

/** A manifest document shaped like the packaged one. */
function manifest(version: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    version,
    apiVersion: 1,
    minPanel: '0.4.0',
    releaseTag: 'server-v' + version,
    releaseBaseUrl: 'https://github.com/functy23/dsh-workbuddy-panel/releases/download',
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

/** One release entry as the GitHub API spells it. */
function release(tag: string, options: { draft?: boolean, prerelease?: boolean, manifest?: boolean } = {}): Record<string, unknown> {
  const assets = options.manifest === false
    ? [{ name: 'workbuddy2api-x.gz', browser_download_url: 'https://example.test/x.gz' }]
    : [{ name: 'server.json', browser_download_url: 'https://example.test/' + tag + '/server.json' }]
  return { tag_name: tag, draft: options.draft === true, prerelease: options.prerelease === true, assets }
}

/** A fetch stub keyed by URL. */
function stubFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!(url in routes)) return new Response('not found', { status: 404 })
    return new Response(JSON.stringify(routes[url]), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

const API = 'https://api.github.com/repos/functy23/dsh-workbuddy-panel/releases?per_page=30'

describe('version comparison', () => {
  it('orders numeric segments and treats a suffix as a pre-release', () => {
    expect(compareVersions('1.14.0-panel', '1.13.0-panel')).toBeGreaterThan(0)
    expect(compareVersions('1.13.0-panel', '1.14.0-panel')).toBeLessThan(0)
    expect(compareVersions('1.14.0-panel', '1.14.0-panel')).toBe(0)
    expect(compareVersions('1.14.0', '1.14.0-panel')).toBeGreaterThan(0)
    expect(compareVersions('1.14.10-panel', '1.14.9-panel')).toBeGreaterThan(0)
  })
})

describe('channel discovery', () => {
  it('derives owner/repo from a GitHub release base only', () => {
    expect(githubRepoFromBase('https://github.com/functy23/dsh-workbuddy-panel/releases/download'))
      .toEqual({ owner: 'functy23', repo: 'dsh-workbuddy-panel' })
    expect(githubRepoFromBase('https://mirror.example.test/releases/download')).toBeUndefined()
    expect(githubRepoFromBase('http://github.com/a/b')).toBeUndefined()
    expect(githubRepoFromBase('not a url')).toBeUndefined()
  })

  it('picks the newest kernel tag, ignoring panel releases and drafts', () => {
    const releases = [
      release('v0.4.1'),
      release('server-v1.13.0-panel'),
      release('server-v1.14.0-panel'),
      release('server-v1.15.0-panel', { draft: true }),
      release('server-v1.16.0-panel', { prerelease: true }),
    ]
    expect(newestKernelTag(releases)).toBe('server-v1.14.0-panel')
    expect(newestKernelTag([])).toBeUndefined()
    expect(newestKernelTag('nope')).toBeUndefined()
  })

  it('finds the manifest asset inside one release', () => {
    const releases = [release('server-v1.14.0-panel'), release('server-v1.15.0-panel', { manifest: false })]
    expect(manifestAssetUrl(releases, 'server-v1.14.0-panel'))
      .toBe('https://example.test/server-v1.14.0-panel/server.json')
    expect(manifestAssetUrl(releases, 'server-v1.15.0-panel')).toBeUndefined()
  })

  it('reads the newest manifest through the API', async () => {
    const fetchImpl = stubFetch({
      [API]: [release('v0.4.1'), release('server-v1.13.0-panel'), release('server-v1.14.0-panel')],
      'https://example.test/server-v1.14.0-panel/server.json': manifest('1.14.0-panel'),
    })
    const result = await fetchLatestServerManifest({
      fetchImpl,
      releaseBaseUrl: 'https://github.com/functy23/dsh-workbuddy-panel/releases/download',
    })
    expect(result.version).toBe('1.14.0-panel')
    expect(result.releaseTag).toBe('server-v1.14.0-panel')
  })

  it('rejects a manifest whose version disagrees with its tag', async () => {
    const fetchImpl = stubFetch({
      [API]: [release('server-v1.14.0-panel')],
      'https://example.test/server-v1.14.0-panel/server.json': manifest('1.13.0-panel'),
    })
    await expect(fetchLatestServerManifest({
      fetchImpl,
      releaseBaseUrl: 'https://github.com/functy23/dsh-workbuddy-panel/releases/download',
    })).rejects.toThrow(/does not match/u)
  })

  it('reports a release without a manifest asset', async () => {
    const fetchImpl = stubFetch({ [API]: [release('server-v1.14.0-panel', { manifest: false })] })
    await expect(fetchLatestServerManifest({
      fetchImpl,
      releaseBaseUrl: 'https://github.com/functy23/dsh-workbuddy-panel/releases/download',
    })).rejects.toThrow(/no server\.json asset/u)
  })

  it('reads an explicit channel document without touching the API', async () => {
    let calls = 0
    const fetchImpl = (async (input: string | URL | Request) => {
      calls += 1
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url !== 'https://channel.test/server.json') return new Response('nope', { status: 404 })
      return new Response(JSON.stringify(manifest('1.20.0-panel')), { status: 200 })
    }) as unknown as typeof fetch
    const result = await fetchLatestServerManifest({
      fetchImpl,
      releaseBaseUrl: 'https://github.com/functy23/dsh-workbuddy-panel/releases/download',
      manifestUrl: 'https://channel.test/server.json',
    })
    expect(result.version).toBe('1.20.0-panel')
    expect(calls).toBe(1)
  })

  it('refuses a non-GitHub channel base', async () => {
    await expect(fetchLatestServerManifest({
      fetchImpl: stubFetch({}),
      releaseBaseUrl: 'https://mirror.example.test/download',
    })).rejects.toThrow(/not a GitHub release base/u)
  })
})
