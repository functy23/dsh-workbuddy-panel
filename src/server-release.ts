/**
 * The one server release this panel pins.
 *
 * `server.json` lives at the package root and travels with the panel. It names
 * the exact gateway build, the asset for each platform, and the SHA-256 of the
 * decompressed binary. A remote manifest is never trusted: GitHub only serves
 * bytes, and a mirror that changes them fails the local check.
 *
 * @module dsh-workbuddy-panel/server-release
 */

import { readFileSync } from 'node:fs'

/** One platform's release asset. */
export interface ServerAsset {
  /** Release asset file name, e.g. `workbuddy2api-1.13.0-panel-darwin-arm64.gz`. */
  asset: string
  /** SHA-256 of the decompressed binary. */
  sha256: string
  /** Decompressed binary size in bytes. */
  size: number
  /** Compressed download size in bytes. */
  downloadSize: number
}

/** The pinned release document. */
export interface ServerManifest {
  schemaVersion: 1
  /** Gateway version, e.g. `1.13.0-panel`. */
  version: string
  /** Gateway API generation the panel expects. */
  apiVersion: number
  /** Oldest panel version that understands this release. */
  minPanel: string
  /** GitHub Release tag, e.g. `server-v1.13.0-panel`. */
  releaseTag: string
  /** Base URL every asset hangs from. */
  releaseBaseUrl: string
  /** Assets keyed by `<platform>-<arch>`. */
  assets: Record<string, ServerAsset>
}

/** Node platform/arch pair as the manifest spells it. */
export function platformKey(platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
  const normalizedArch = arch === 'x64' ? 'x64' : arch
  return platform + '-' + normalizedArch
}

/** Read and validate the packaged manifest once. */
let cached: ServerManifest | undefined

export function serverManifest(): ServerManifest {
  if (cached !== undefined) return cached
  const text = readFileSync(new URL('../server.json', import.meta.url), 'utf8')
  cached = parseServerManifest(JSON.parse(text) as unknown)
  return cached
}

/** Validate a manifest document; exported so the release script can reuse it. */
export function parseServerManifest(value: unknown): ServerManifest {
  if (!isRecord(value)) throw new Error('server.json: expected an object')
  if (value['schemaVersion'] !== 1) throw new Error('server.json: unsupported schemaVersion')
  const version = nonEmptyString(value['version'], 'version')
  const apiVersion = positiveInteger(value['apiVersion'], 'apiVersion')
  const minPanel = nonEmptyString(value['minPanel'], 'minPanel')
  const releaseTag = nonEmptyString(value['releaseTag'], 'releaseTag')
  const releaseBaseUrl = nonEmptyString(value['releaseBaseUrl'], 'releaseBaseUrl')
  if (!/^https:\/\//u.test(releaseBaseUrl)) throw new Error('server.json: releaseBaseUrl must be HTTPS')
  const assets = value['assets']
  if (!isRecord(assets)) throw new Error('server.json: assets must be an object')
  const parsed: Record<string, ServerAsset> = {}
  for (const [key, entry] of Object.entries(assets)) {
    if (!isRecord(entry)) throw new Error('server.json: asset ' + key + ' must be an object')
    const asset = nonEmptyString(entry['asset'], key + '.asset')
    const sha256 = nonEmptyString(entry['sha256'], key + '.sha256').toLowerCase()
    if (!/^[0-9a-f]{64}$/u.test(sha256)) throw new Error('server.json: ' + key + '.sha256 must be 64 hex characters')
    parsed[key] = {
      asset,
      sha256,
      size: positiveInteger(entry['size'], key + '.size'),
      downloadSize: positiveInteger(entry['downloadSize'], key + '.downloadSize'),
    }
  }
  if (Object.keys(parsed).length === 0) throw new Error('server.json: at least one asset is required')
  return { schemaVersion: 1, version, apiVersion, minPanel, releaseTag, releaseBaseUrl, assets: parsed }
}

/** The asset for one platform, when the release has one. */
export function assetForPlatform(
  manifest: ServerManifest,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): ServerAsset | undefined {
  return manifest.assets[platformKey(platform, arch)]
}

/** The GitHub Release asset URL for one manifest entry. */
export function releaseAssetUrl(manifest: ServerManifest, asset: ServerAsset, baseUrl = manifest.releaseBaseUrl): string {
  return baseUrl.replace(/\/+$/u, '') + '/' + manifest.releaseTag + '/' + asset.asset
}

/** Whether this manifest can run on the current platform. */
export function supportsCurrentPlatform(manifest: ServerManifest): boolean {
  return assetForPlatform(manifest) !== undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('server.json: ' + field + ' must be a non-empty string')
  return value
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('server.json: ' + field + ' must be a positive integer')
  }
  return value
}
