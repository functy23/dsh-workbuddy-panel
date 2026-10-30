/**
 * Remote kernel discovery.
 *
 * 渠道形式对齐 Swift-Craft-Launcher 的 appcast：**一个固定 URL 的静态清单**，
 * 不列 GitHub Releases API。
 *
 * - 清单就是打包用的 \`server.json\`（版本 + 每平台 SHA-256 + 大小），发布在固定
 *   tag \`server-channel\` 的 release 资产上，URL 永远不变：
 *     https://github.com/<owner>/<repo>/releases/download/server-channel/server.json
 * - 每次发内核只要 \`gh release upload server-channel dist/server.json --clobber\`：
 *   URL 不变，面板不需要跟着发版。
 * - 为什么不用 API：\`/repos/.../releases\` 的匿名配额是 60 次/小时/IP，共享出口
 *   （代理、公司网）很容易被打满，一打满就是 HTTP 403，检查更新直接失败；静态
 *   资产 URL 走 github.com 的普通下载路径，不吃配额，也不受 releases 分页、
 *   草稿/预发布状态影响。
 *
 * 这个模块只**发现**清单，不安装任何东西：下载仍然走 gzip → 大小 → SHA-256 →
 * 原子 rename，所以被替换或损坏的资产在本地照样失败。
 *
 * 信任边界：清单声明版本与每平台摘要。能发布清单的人就能发布别的二进制，所以
 * 默认渠道的 origin 由打包的 \`releaseBaseUrl\` 推出，清单里的 \`releaseBaseUrl\`
 * 必须与它一致；镜像（\`serverBaseUrl\`）不能把发现重定向到别的仓库。
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

/** 渠道清单所在的固定 tag：不是版本号，发布新内核时也不变。 */
export const CHANNEL_TAG = 'server-channel'

/** The manifest asset every kernel release carries next to the binaries. */
export const MANIFEST_ASSET = 'server.json'

/** Compare two \`x.y.z[-suffix]\` versions. Positive when \`a\` is newer. */
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

/** Split \`1.2.3-panel\` into \`['1.2.3', 'panel']\`. */
function splitVersion(version: string): [string, string] {
  const trimmed = version.trim()
  const dash = trimmed.indexOf('-')
  return dash < 0 ? [trimmed, ''] : [trimmed.slice(0, dash), trimmed.slice(dash + 1)]
}

/** Derive \`owner/repo\` from a GitHub release base URL. */
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

/**
 * 由打包的 release base 推出渠道清单的固定 URL。
 *
 * \`.../releases/download\` → \`.../releases/download/server-channel/server.json\`。
 * 非 GitHub release base 返回 undefined（自建镜像请用 \`manifestUrl\` 显式指定）。
 */
export function channelManifestUrl(releaseBaseUrl: string): string | undefined {
  const base = releaseBaseUrl.trim().replace(/\/+$/u, '')
  if (base === '' || githubRepoFromBase(base) === undefined) return undefined
  return base + '/' + CHANNEL_TAG + '/' + MANIFEST_ASSET
}

/** Discovery inputs. */
export interface KernelDiscoveryOptions {
  fetchImpl: typeof fetch
  /** 打包的 release base；默认渠道由它推出。 */
  releaseBaseUrl: string
  /** 显式渠道文档（自建镜像 / 私有分发），非空时优先。 */
  manifestUrl?: string
  signal?: AbortSignal
}

/**
 * Fetch the newest published kernel manifest.
 *
 * 默认只发一个 GET：固定 URL 的渠道清单（见 {@link channelManifestUrl}）。
 * 不请求 api.github.com，所以不存在匿名配额与 403 的问题。
 *
 * \`manifestUrl\` 非空时改读该文档（自建镜像用），此时不再把清单里的
 * \`releaseBaseUrl\` 钉到打包值上——镜像运维方自己负责。
 */
export async function fetchLatestServerManifest(options: KernelDiscoveryOptions): Promise<ServerManifest> {
  const explicit = options.manifestUrl?.trim() ?? ''
  const url = explicit !== '' ? explicit : channelManifestUrl(options.releaseBaseUrl)
  if (url === undefined) {
    throw new Error('update channel is not a GitHub release base: ' + options.releaseBaseUrl)
  }
  const manifest = parseServerManifest(await readJson(options.fetchImpl, url, options.signal))
  assertChannel(manifest, explicit === '' ? options.releaseBaseUrl : undefined)
  return manifest
}

/** 清单必须留在打包的渠道 origin 上，避免"换了清单就换下载源"。 */
function assertChannel(manifest: ServerManifest, pinnedBase?: string): void {
  if (manifest.releaseBaseUrl === '') return
  if (githubRepoFromBase(manifest.releaseBaseUrl) === undefined) {
    throw new Error('manifest releaseBaseUrl is not a GitHub release base')
  }
  if (pinnedBase === undefined) return
  const expected = pinnedBase.trim().replace(/\/+$/u, '')
  const actual = manifest.releaseBaseUrl.trim().replace(/\/+$/u, '')
  if (actual !== expected) {
    throw new Error('manifest releaseBaseUrl ' + manifest.releaseBaseUrl + ' does not match the packaged channel ' + expected)
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
        accept: 'application/json',
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
