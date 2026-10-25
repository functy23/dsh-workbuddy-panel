/**
 * The verified server cache.
 *
 * One pinned release, one platform directory, one checksum. Downloads are
 * streamed through gzip, hashed while decompressing, written to a private temp
 * file, and renamed into place only after the size and SHA-256 match
 * `server.json`. The panel never executes a partial file and never trusts a
 * remote manifest.
 *
 * @module dsh-workbuddy-panel/server-store
 */

import { createHash, randomBytes } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { serverRootDir } from './paths.ts'
import { assetForPlatform, platformKey, releaseAssetUrl, serverManifest } from './server-release.ts'
import type { ServerAsset, ServerManifest } from './server-release.ts'
import type { ServerDownloadStatus, ServerStatus } from './gateway-contract.ts'

/** The lock is stale after this long; a crashed host must not block forever. */
const LOCK_STALE_MS = 10 * 60_000

/** Hard ceiling for the decompressed binary. */
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024

/** The current pointer document. */
interface InstalledRecord {
  version: string
  platform: string
  arch: string
  binary: string
  sha256: string
  size: number
  installedAt: string
}

/** A download is already in flight in this process. */
export class ServerDownloadInProgressError extends Error {
  constructor() {
    super('a server download is already in progress')
    this.name = 'ServerDownloadInProgressError'
  }
}

/** The pinned release has no asset for this platform. */
export class ServerUnsupportedPlatformError extends Error {
  constructor(key: string) {
    super('server release has no build for ' + key)
    this.name = 'ServerUnsupportedPlatformError'
  }
}

/** The downloaded bytes did not match the pinned size or hash. */
export class ServerChecksumError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerChecksumError'
  }
}

/** The caller aborted the download. */
export class ServerDownloadCancelledError extends Error {
  constructor() {
    super('server download cancelled')
    this.name = 'ServerDownloadCancelledError'
  }
}

/** What the store needs from its owner. */
export interface ServerStoreOptions {
  rootDir?: string
  manifest?: ServerManifest
  platform?: NodeJS.Platform
  arch?: string
  /** Override the manifest's release base (a mirror); the checksum stays pinned. */
  releaseBaseUrl?: string
  fetchImpl?: typeof fetch
  log?: (message: string, error?: unknown) => void
  maxBytes?: number
}

/** The local server cache and its one download state machine. */
export class ServerStore {
  private readonly manifest: ServerManifest
  private readonly rootDir: string
  private readonly platform: NodeJS.Platform
  private readonly arch: string
  private readonly key: string
  private readonly releaseBaseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly log?: (message: string, error?: unknown) => void
  private readonly maxBytes: number
  private progress: ServerDownloadStatus = { state: 'idle', received: 0, total: 0 }
  private lastError?: string
  private active?: { controller: AbortController }
  private verified?: { path: string, size: number, mtimeMs: number }
  private invalid = false

  constructor(options: ServerStoreOptions = {}) {
    this.manifest = options.manifest ?? serverManifest()
    this.rootDir = options.rootDir ?? serverRootDir()
    this.platform = options.platform ?? process.platform
    this.arch = options.arch ?? process.arch
    this.key = platformKey(this.platform, this.arch)
    this.log = options.log
    const requestedBase = options.releaseBaseUrl?.trim() ?? ''
    this.releaseBaseUrl = requestedBase === ''
      ? this.manifest.releaseBaseUrl
      : allowedReleaseBase(requestedBase)
        ? requestedBase
        : this.manifest.releaseBaseUrl
    if (requestedBase !== '' && this.releaseBaseUrl !== requestedBase) {
      this.log?.('workbuddy2api-gateway: ignoring a non-HTTPS server mirror')
    }
    this.fetchImpl = options.fetchImpl ?? fetch
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  }

  /** The pinned asset for this platform, when the release has one. */
  asset(): ServerAsset | undefined {
    return assetForPlatform(this.manifest, this.platform, this.arch)
  }

  /** The release asset URL this store would download. */
  releaseUrl(): string {
    const asset = this.asset()
    return asset === undefined ? '' : releaseAssetUrl(this.manifest, asset, this.releaseBaseUrl)
  }

  /** The current cache and download state. */
  status(): ServerStatus {
    const asset = this.asset()
    const current = this.readCurrent()
    const binary = current === undefined ? undefined : this.binaryPath(current.version)
    const installed = !this.invalid
      && asset !== undefined
      && current?.version === this.manifest.version
      && binary !== undefined
      && this.fileMatches(binary, asset.size)
    const fallbackError = asset === undefined ? 'server release has no build for ' + this.key : undefined
    // A failed update attempt must not make an already-installed server look
    // broken. Keep progress visible only while a download is actually running.
    const working = this.progress.state === 'downloading'
      || this.progress.state === 'verifying'
      || this.progress.state === 'installing'
    const download: ServerDownloadStatus = installed && !working
      ? { state: 'idle', received: asset?.downloadSize ?? 0, total: asset?.downloadSize ?? 0 }
      : { ...this.progress }
    const error = installed && !working ? undefined : this.lastError ?? fallbackError
    return {
      platform: this.platform,
      arch: this.arch,
      supported: asset !== undefined,
      version: this.manifest.version,
      apiVersion: this.manifest.apiVersion,
      installed,
      ...current?.version === undefined ? {} : { installedVersion: current.version },
      ...installed && binary !== undefined ? { binaryPath: binary } : {},
      sha256: asset?.sha256 ?? '',
      size: asset?.size ?? 0,
      downloadSize: asset?.downloadSize ?? 0,
      releaseUrl: asset === undefined ? '' : releaseAssetUrl(this.manifest, asset, this.releaseBaseUrl),
      download,
      ...error === undefined ? {} : { error },
    }
  }

  /** The verified executable for the pinned version, or undefined. */
  resolveBinary(): string | undefined {
    const asset = this.asset()
    const current = this.readCurrent()
    if (asset === undefined || current === undefined || current.version !== this.manifest.version) return undefined
    const binary = this.binaryPath(current.version)
    if (!this.fileMatches(binary, asset.size)) return undefined
    try {
      const stat = statSync(binary)
      if (this.verified?.path === binary && this.verified.size === stat.size && this.verified.mtimeMs === stat.mtimeMs) {
        return binary
      }
      const digest = hashFileSync(binary)
      if (digest !== asset.sha256) {
        this.invalid = true
        this.verified = undefined
        this.lastError = 'server checksum mismatch; download it again'
        this.log?.('workbuddy2api-gateway: ' + this.lastError)
        return undefined
      }
      this.invalid = false
      this.lastError = undefined
      this.verified = { path: binary, size: stat.size, mtimeMs: stat.mtimeMs }
      return binary
    } catch (error: unknown) {
      this.lastError = 'server binary is unreadable: ' + messageOf(error)
      this.log?.('workbuddy2api-gateway: ' + this.lastError, error)
      return undefined
    }
  }

  /** Re-hash the installed binary and report the result. */
  async verify(): Promise<ServerStatus> {
    const asset = this.asset()
    const current = this.readCurrent()
    if (asset === undefined || current === undefined || current.version !== this.manifest.version) {
      this.lastError = 'the pinned server is not installed'
      return this.status()
    }
    const binary = this.binaryPath(current.version)
    if (!this.fileMatches(binary, asset.size)) {
      this.lastError = 'the server binary is missing or has the wrong size'
      return this.status()
    }
    const digest = await hashFile(binary)
    if (digest !== asset.sha256) {
      this.invalid = true
      this.verified = undefined
      this.lastError = 'server checksum mismatch; download it again'
      return this.status()
    }
    const stat = statSync(binary)
    this.invalid = false
    this.verified = { path: binary, size: stat.size, mtimeMs: stat.mtimeMs }
    this.lastError = undefined
    return this.status()
  }

  /** Download, verify, and install the pinned release. */
  async download(): Promise<ServerStatus> {
    if (this.active !== undefined) throw new ServerDownloadInProgressError()
    const asset = this.asset()
    if (asset === undefined) {
      this.lastError = 'server release has no build for ' + this.key
      throw new ServerUnsupportedPlatformError(this.key)
    }
    if (this.status().installed) {
      this.lastError = undefined
      return this.status()
    }

    const controller = new AbortController()
    this.active = { controller }
    this.invalid = false
    this.verified = undefined
    this.lastError = undefined
    this.progress = { state: 'downloading', received: 0, total: asset.downloadSize }
    mkdirSync(this.versionDir(), { recursive: true, mode: 0o700 })
    const temp = join(this.versionDir(), '.part-' + String(process.pid) + '-' + randomBytes(4).toString('hex'))
    let lockHeld = false
    try {
      this.acquireLock()
      lockHeld = true
      const response = await this.fetchImpl(this.releaseUrl(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: 'application/octet-stream' },
      })
      if (!response.ok) throw new Error('server download failed: HTTP ' + String(response.status))
      if (response.body === null) throw new Error('server download returned no body')

      let received = 0
      let bytes = 0
      const hash = createHash('sha256')
      const counter = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
          received += chunk.length
          this.progress = { state: 'downloading', received, total: asset.downloadSize }
          callback(null, chunk)
        },
      })
      const hasher = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
          bytes += chunk.length
          if (bytes > this.maxBytes) {
            callback(new Error('server download exceeded the size cap'))
            return
          }
          hash.update(chunk)
          callback(null, chunk)
        },
      })
      await pipeline(
        Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>),
        counter,
        createGunzip(),
        hasher,
        createWriteStream(temp, { mode: 0o600 }),
      )

      this.progress = { state: 'verifying', received: asset.downloadSize, total: asset.downloadSize }
      if (bytes !== asset.size) {
        throw new ServerChecksumError('server size mismatch: expected ' + String(asset.size) + ', got ' + String(bytes))
      }
      const digest = hash.digest('hex')
      if (digest !== asset.sha256) {
        throw new ServerChecksumError('server checksum mismatch')
      }

      this.progress = { state: 'installing', received: asset.downloadSize, total: asset.downloadSize }
      if (this.platform !== 'win32') chmodSync(temp, 0o755)
      const target = this.binaryPath()
      if (existsSync(target)) unlinkSync(target)
      renameSync(temp, target)
      const record: InstalledRecord = {
        version: this.manifest.version,
        platform: this.platform,
        arch: this.arch,
        binary: target,
        sha256: asset.sha256,
        size: asset.size,
        installedAt: new Date().toISOString(),
      }
      this.writeJsonAtomic(this.installedPath(), record)
      this.writeJsonAtomic(this.currentPath(), record)
      const stat = statSync(target)
      this.verified = { path: target, size: stat.size, mtimeMs: stat.mtimeMs }
      this.invalid = false
      this.progress = { state: 'idle', received: asset.downloadSize, total: asset.downloadSize }
      this.lastError = undefined
      this.cleanupParts()
      this.log?.('workbuddy2api-gateway: installed server ' + this.manifest.version + ' at ' + target)
      return this.status()
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        this.progress = { state: 'cancelled', received: this.progress.received, total: this.progress.total }
        this.lastError = 'server download cancelled'
        throw new ServerDownloadCancelledError()
      }
      const message = messageOf(error)
      this.progress = { state: 'failed', received: this.progress.received, total: this.progress.total, error: message }
      this.lastError = message
      this.log?.('workbuddy2api-gateway: server download failed', error)
      throw error
    } finally {
      try {
        if (existsSync(temp)) unlinkSync(temp)
      } catch {
        // The next start sweeps stale parts.
      }
      if (lockHeld) this.releaseLock()
      this.active = undefined
    }
  }

  /** Abort the in-flight download, if any. */
  cancel(): void {
    this.active?.controller.abort()
  }

  /** The version directory for the pinned release. */
  private versionDir(version = this.manifest.version): string {
    return join(this.rootDir, version, this.key)
  }

  /** The executable path for a version. */
  private binaryPath(version = this.manifest.version): string {
    const exe = this.platform === 'win32' ? 'workbuddy2api.exe' : 'workbuddy2api'
    return join(this.versionDir(version), exe)
  }

  private installedPath(): string {
    return join(this.versionDir(), 'installed.json')
  }

  private currentPath(): string {
    return join(this.rootDir, 'current.json')
  }

  private lockPath(): string {
    return join(this.rootDir, 'download.lock')
  }

  private fileMatches(path: string, size: number): boolean {
    try {
      const stat = statSync(path)
      return stat.isFile() && stat.size === size
    } catch {
      return false
    }
  }

  private readCurrent(): InstalledRecord | undefined {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.currentPath(), 'utf8'))
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
      const record = parsed as Record<string, unknown>
      if (typeof record['version'] !== 'string' || typeof record['binary'] !== 'string') return undefined
      return record as unknown as InstalledRecord
    } catch {
      return undefined
    }
  }

  private writeJsonAtomic(path: string, value: unknown): void {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    const temp = path + '.tmp-' + randomBytes(4).toString('hex')
    writeFileSync(temp, JSON.stringify(value, null, 2) + String.fromCharCode(10), { mode: 0o600 })
    if (existsSync(path)) unlinkSync(path)
    renameSync(temp, path)
  }

  private acquireLock(): void {
    mkdirSync(this.rootDir, { recursive: true, mode: 0o700 })
    const path = this.lockPath()
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const fd = openSync(path, 'wx', 0o600)
        try {
          writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }))
        } finally {
          closeSync(fd)
        }
        return
      } catch (error: unknown) {
        if (!isErrno(error, 'EEXIST')) throw error
        try {
          const age = Date.now() - statSync(path).mtimeMs
          if (age > LOCK_STALE_MS) {
            unlinkSync(path)
            continue
          }
        } catch {
          continue
        }
        throw new ServerDownloadInProgressError()
      }
    }
    throw new ServerDownloadInProgressError()
  }

  private releaseLock(): void {
    try {
      unlinkSync(this.lockPath())
    } catch {
      // Already gone.
    }
  }

  /** Remove stale temp files from a crashed download. */
  private cleanupParts(): void {
    try {
      for (const entry of readdirSync(this.versionDir(), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.startsWith('.part-')) continue
        const path = join(this.versionDir(), entry.name)
        try {
          if (Date.now() - statSync(path).mtimeMs > 24 * 60 * 60_000) unlinkSync(path)
        } catch {
          // Ignore a file another process is still writing.
        }
      }
    } catch {
      // No directory yet.
    }
  }
}

/** Synchronous SHA-256 for the start path; the file is only a few MB. */
function hashFileSync(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Async SHA-256 for an explicit verify action. */
async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isErrno(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code
}

/** A mirror is HTTPS, or loopback HTTP for tests. */
function allowedReleaseBase(value: string): boolean {
  return /^https:\/\//u.test(value) || /^http:\/\/(?:127\.0\.0\.1|localhost)(?::|\/|$)/u.test(value)
}

/** Re-export for callers that only need the default cache root. */
export { serverRootDir }
