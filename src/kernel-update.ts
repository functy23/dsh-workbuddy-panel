/**
 * Remote kernel discovery.
 *
 * The panel ships a pinned `server.json`, but the gateway can also be updated
 * without republishing the panel: GitHub Releases is the channel, and the
 * **manifest itself** is published as a release asset next to the binaries. This
 * module only *discovers* a newer manifest — it never installs anything. The
 * download path is unchanged: gzip → size → SHA-256 → atomic rename, so a
 * corrupted or substituted asset still fails locally.
 *
 * Trust boundary: the manifest names the version and the per-platform digests.
 * Whoever can publish a release can therefore publish a different binary, so the
 * channel is pinned to one HTTPS origin derived from the packaged
 * `releaseBaseUrl`; a mirror cannot redirect discovery.
 *
 * @module dsh-workbuddy-panel/kernel-update
 */

import type { KernelCheckCadence } from './gateway-contract.ts'
import type { ServerManifest } from './server-release.ts'
import { parseServerManifest } from './server-release.ts'

/** The cadences the settings page offers. */
export const KERNEL_CADENCES: readonly KernelCheckCadence[] = ['hourly', 'never']

/** Narrow an untrusted value to a cadence. */
export function isKernelCadence(value: unknown): value is KernelCheckCadence {
  return value === 'hourly' || value === 'never'
}

/** The release tag prefix the kernel channel uses. */
const TAG_PREFIX = 'server-v'

/** GitHub caps `per_page` at 100; 30 releases is far more than this channel needs. */
const RELEASE_PAGE_SIZE = 30

/** Compare two `x.y.z[-suffix]` versions. Positive when `a` is newer. */
export function compareVersions(a: string, b: string): number {
  const [aCore = '', aSuffix = ''] = splitVersion(a)
  const [bCore = '', bSuffix = ''] = splitVersion(b)
  const aParts = aCore.split('.').map(part => Number.parseInt(part, 10) || 0)
  const bParts = bCore.split('.').map(part => Number.parseInt(part, 10) || 0)
  const length = Math.max(aParts.length, bParts.length)
  for (let index = 0; index < length; index += 1) {
    const left = aParts[index] ?? 0
    const right = bParts[index] ?? 0
    if (left !== right) return left > right ? 1 : -1
  }
  // A release beats its own pre-release suffix: 1.2.3 > 1.2.3-rc1.
  if (aSuffix === bSuffix) return 0
  if (aSuffix === '') return 1
  if (bSuffix === '') return -1
  return aSuffix > bSuffix ? 1 : -1
}

/** Split `1.2.3-panel` into `['1.2.3', 'panel']`. */
function splitVersion(version: string): [string, string] {
  const trimmed = version.trim()
  const dash = trimmed.indexOf('-')
  return dash < 0 ? [trimmed, ''] : [trimmed.slice(0, dash), trimmed.slice(dash + 1)]
}

/** Derive `owner/repo` from a GitHub release base URL. */
export function githubRepoFromBase(baseUrl: string): { owner: string, repo: string } | undefined {
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:' || !/(^|\.)github\.com$/iu.test(url.hostname)) return undefined
    const segments = url.pathname.split('/').filter(segment => segment !== '')
    if (segments.length < 2) return undefined
    const [owner = '', repo = ''] = segments
    if (owner === '' || repo === '') return undefined
    return { owner, repo }
  } catch {
    return undefined
  }
}

/** The manifest asset every kernel release carries next to the binaries. */
export const MANIFEST_ASSET = 'server.json'

/** Discovery inputs. */
export interface KernelDiscoveryOptions {
  fetchImpl: typeof fetch
  /** The packaged release base; the channel is derived from it. */
  releaseBaseUrl: string
  /** Explicit channel document (overrides discovery when non-empty). */
  manifestUrl?: string
  signal?: AbortSignal
}

/**
 * Fetch the newest published kernel manifest.
 *
 * With `manifestUrl` set the document is read directly (a user-hosted channel).
 * Otherwise the newest non-draft `server-v*` release is located through the
 * GitHub API and its `server.json` asset is read. Both paths validate the
 * document with the same parser the packaged manifest uses.
 */
export async function fetchLatestServerManifest(options: KernelDiscoveryOptions): Promise<ServerManifest> {
  const { fetchImpl } = options
  const manifestUrl = options.manifestUrl?.trim() ?? ''
  if (manifestUrl !== '') {
    const raw = await readJson(fetchImpl, manifestUrl, options.signal)
    const manifest = parseServerManifest(raw)
    assertChannel(manifest)
    return manifest
  }
  const repo = githubRepoFromBase(options.releaseBaseUrl)
  if (repo === undefined) {
    throw new Error('update channel is not a GitHub release base: ' + options.releaseBaseUrl)
  }
  const releases = await readJson(
    fetchImpl,
    'https://api.github.com/repos/' + repo.owner + '/' + repo.repo + '/releases?per_page=' + String(RELEASE_PAGE_SIZE),
    options.signal,
  )
  const tag = newestKernelTag(releases)
  if (tag === undefined) throw new Error('no server-v* release found')
  const assetUrl = manifestAssetUrl(releases, tag)
  if (assetUrl === undefined) {
    throw new Error('release ' + tag + ' has no ' + MANIFEST_ASSET + ' asset')
  }
  const manifest = parseServerManifest(await readJson(fetchImpl, assetUrl, options.signal))
  assertChannel(manifest)
  if (manifest.version !== tag.slice(TAG_PREFIX.length)) {
    throw new Error('manifest version ' + manifest.version + ' does not match release ' + tag)
  }
  return manifest
}

/** The newest kernel tag in a release listing, ignoring drafts and pre-releases. */
export function newestKernelTag(releases: unknown): string | undefined {
  if (!Array.isArray(releases)) return undefined
  const tags: string[] = []
  for (const entry of releases) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    if (record['draft'] === true || record['prerelease'] === true) continue
    const tag = record['tag_name']
    if (typeof tag !== 'string' || !tag.startsWith(TAG_PREFIX)) continue
    if (tag.length === TAG_PREFIX.length) continue
    tags.push(tag)
  }
  tags.sort((left, right) => compareVersions(right.slice(TAG_PREFIX.length), left.slice(TAG_PREFIX.length)))
  return tags[0]
}

/** The browser URL of the manifest asset inside one release. */
export function manifestAssetUrl(releases: unknown, tag: string): string | undefined {
  if (!Array.isArray(releases)) return undefined
  for (const entry of releases) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    if (record['tag_name'] !== tag) continue
    const assets = record['assets']
    if (!Array.isArray(assets)) continue
    for (const asset of assets) {
      if (typeof asset !== 'object' || asset === null) continue
      const fields = asset as Record<string, unknown>
      if (fields['name'] !== MANIFEST_ASSET) continue
      const url = fields['browser_download_url']
      if (typeof url === 'string' && url.startsWith('https://')) return url
    }
  }
  return undefined
}

/** A discovered manifest must stay on the packaged channel origin. */
function assertChannel(manifest: ServerManifest): void {
  if (manifest.releaseBaseUrl !== '') {
    const expected = githubRepoFromBase(manifest.releaseBaseUrl)
    if (expected === undefined) {
      throw new Error('manifest releaseBaseUrl is not a GitHub release base')
    }
  }
}

/** GET a JSON document with a hard timeout. */
async function readJson(fetchImpl: typeof fetch, url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 15_000)
  const onAbort = (): void => { controller.abort() }
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/vnd.github+json, application/json',
        'user-agent': 'dsh-workbuddy-panel',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('HTTP ' + String(response.status) + ' for ' + url)
    return await response.json() as unknown
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
