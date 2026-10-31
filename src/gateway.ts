/**
 * The host composition row: the gateway's lifecycle belongs here, not in the
 * panel.
 *
 * The row registers `workbuddy2apiGateway`, owns the server cache, and asks
 * `ctx.subprocess` for a managed child. The panel row reads this service; it
 * never imports `node:child_process` and never writes the gateway's config.
 *
 * @module dsh-workbuddy-panel/gateway
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { GATEWAY_HOST_SERVICE, GATEWAY_HOST_SERVICE_VERSION } from './gateway-contract.ts'
import type {
  GatewayCredential,
  GatewayCredentialWrite,
  GatewayHost,
  GatewayStatus,
  KernelCheckCadence,
  KernelUpdateStatus,
  ServerStatus,
} from './gateway-contract.ts'
import { GatewaySupervisor } from './gateway-supervisor.ts'
import type { SubprocessLike } from './gateway-supervisor.ts'
import {
  compareVersions,
  fetchLatestServerManifest,
  isKernelCadence,
  KERNEL_CADENCES,
} from './kernel-update.ts'
import { activeServerManifestPath, gatewayConfigPath, gatewayWorkdir, kernelUpdateSettingsPath, serverRootDir } from './paths.ts'
import { parseServerManifest, serverManifest } from './server-release.ts'
import type { ServerManifest } from './server-release.ts'
import { ServerStore } from './server-store.ts'
import { readStoreDocument, writeStoreDocument } from './store-file.ts'
import { authFileDocument } from './token-import.ts'

/** Poll floor for the process state. */
const TICK_MS = 5_000

/** Format version of the kernel-update document. */
const KERNEL_SETTINGS_VERSION = 1

/** Characters a uid may use before it becomes a file name. */
const UID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u

/** First discovery run after the row loads; keeps startup off the network. */
const KERNEL_FIRST_CHECK_MS = 30_000

/** Hourly cadence. */
const KERNEL_CHECK_INTERVAL_MS = 3_600_000

/** Error → one line, for the status document. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Find an existing gateway document to inherit from.
 *
 * A user who already runs a panel has real settings in it — pool weights, hidden
 * models, an upstream fingerprint. Pointing this plugin at that machine must not
 * throw them away, so the first readable candidate becomes the base of the
 * generated document (the owned fields are still overwritten).
 */
function discoverGatewayConfig(ownPath: string): Record<string, unknown> | undefined {
  const home = homedir()
  const candidates = [
    join(home, 'Downloads', 'workbuddy2api-panel', 'config.json'),
    join(home, 'workbuddy2api-panel', 'config.json'),
    join(home, 'Desktop', 'workbuddy2api-panel', 'config.json'),
  ]
  for (const candidate of candidates) {
    if (candidate === ownPath) continue
    try {
      const parsed: unknown = JSON.parse(readFileSync(candidate, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Missing or malformed: fall through to the next candidate.
    }
  }
  return undefined
}

/** Host-row composition defaults. */
export const Config = z.object({
  /** Loopback port the gateway listens on and the health probe uses. */
  port: z.natural().min(1).max(65535).default(7863),
  /** Start the gateway with the host row (and restart it after a crash). */
  autoStart: z.boolean().default(true),
  /** Restarts allowed in one run before supervision gives up. */
  restartLimit: z.natural().default(5),
  /** Accounts directory; empty means '<workdir>/auths'. */
  authDir: z.string().default(''),
  /** Download the pinned server automatically when it is missing. */
  autoDownload: z.boolean().default(false),
  /** Optional HTTPS mirror for the release assets; checksums stay pinned. */
  serverBaseUrl: z.string().default(''),
  /**
   * Default update cadence for the kernel channel: 'hourly' or 'never'.
   *
   * The settings page persists the user's choice separately; this value is the
   * install default and the fallback when that document is missing.
   */
  checkUpdates: z.string().default('hourly'),
  /** Explicit channel document URL; empty = discover through GitHub Releases. */
  manifestUrl: z.string().default(''),
})

/** Parsed host-row config. */
export interface Config {
  port: number
  autoStart: boolean
  restartLimit: number
  authDir: string
  autoDownload: boolean
  serverBaseUrl: string
  checkUpdates: string
  manifestUrl: string
}

/**
 * The host-owned gateway service.
 *
 * It survives a panel reload because it is a separate composition row. A host
 * row reload terminates and restarts the gateway; that is the intended
 * boundary.
 */
export default class GatewayHostService extends Service implements GatewayHost {
  static Config = Config

  readonly serviceVersion = GATEWAY_HOST_SERVICE_VERSION

  private readonly owner: Context
  private readonly config: Config
  /**
   * The cache the supervisor runs from.
   *
   * Replaced when a kernel from the release channel installs: the supervisor
   * reads it through a getter, so the swap takes effect on the next start
   * without rebuilding the process row.
   */
  private server: ServerStore
  private readonly bundledManifest: ServerManifest
  private readonly supervisor: GatewaySupervisor
  private subprocess?: SubprocessLike
  private timer?: ReturnType<typeof setInterval>
  private checkTimer?: ReturnType<typeof setTimeout>
  private downloadPromise?: Promise<ServerStatus>
  private started = false
  /** The manifest discovered by the latest successful check. */
  private remote?: ServerManifest
  /** When the last check finished, and why it failed if it did. */
  private lastCheck?: { at: string, error?: string }
  /** True while a discovered kernel is downloading/installing. */
  private installing = false
  /** Aborts the in-flight discovery when the row unloads. */
  private readonly checkAbort = new AbortController()

  constructor(ctx: Context, config: Config) {
    super(ctx, GATEWAY_HOST_SERVICE)
    this.owner = ctx
    this.config = config
    this.bundledManifest = serverManifest()
    // A persisted manifest only serves while its binary is actually installed;
    // otherwise fall back to the packaged pin so the gateway stays runnable.
    const active = this.createStore(this.loadActiveManifest())
    const fallback = active.status().installed || active.status().version === this.bundledManifest.version
      ? undefined
      : this.createStore(this.bundledManifest)
    this.server = fallback !== undefined && fallback.status().installed ? fallback : active
    this.supervisor = new GatewaySupervisor({
      subprocess: () => this.subprocess,
      server: () => this.server,
      configPath: gatewayConfigPath,
      workdir: gatewayWorkdir,
      port: () => this.config.port,
      authDir: () => this.config.authDir,
      baseConfig: () => discoverGatewayConfig(gatewayConfigPath()),
      autoStart: () => this.config.autoStart,
      restartLimit: () => this.config.restartLimit,
      log: (message, error) => {
        if (error === undefined) ctx.logger.info(message)
        else ctx.logger.warn(message, error)
      },
    })

    ctx.effect(() => {
      this.timer = setInterval(() => {
        void this.supervisor.refresh()
      }, TICK_MS)
      this.timer.unref?.()
      return async () => {
        if (this.timer !== undefined) clearInterval(this.timer)
        this.timer = undefined
        await this.supervisor.dispose()
      }
    }, 'workbuddy2api-gateway-host: process ticker')

    ctx.effect(() => {
      this.scheduleKernelCheck()
      return () => {
        if (this.checkTimer !== undefined) clearTimeout(this.checkTimer)
        this.checkTimer = undefined
        this.checkAbort.abort()
      }
    }, 'workbuddy2api-gateway-host: kernel update ticker')

    ctx.inject(['subprocess'], subCtx => {
      this.subprocess = subCtx.get('subprocess') as unknown as SubprocessLike | undefined
      subCtx.effect(() => () => {
        this.subprocess = undefined
      }, 'workbuddy2api-gateway-host: subprocess seam')
      this.startIfConfigured()
    })
  }

  /** The process snapshot. */
  status(): GatewayStatus {
    return this.supervisor.status()
  }

  /** The pinned server and its local cache state. */
  serverStatus(): ServerStatus {
    return this.server.status()
  }

  async start(): Promise<GatewayStatus> {
    return this.supervisor.start()
  }

  async stop(): Promise<GatewayStatus> {
    return this.supervisor.stop()
  }

  async restart(): Promise<GatewayStatus> {
    return this.supervisor.restart()
  }

  /**
   * Start the download and return immediately.
   *
   * The panel polls `serverStatus()` for progress. When the download finishes,
   * an auto-start row brings the gateway up with the new binary.
   */
  downloadServer(): Promise<ServerStatus> {
    if (this.downloadPromise === undefined) {
      this.downloadPromise = this.server.download()
        .then(status => {
          if (this.config.autoStart) void this.supervisor.start()
          return status
        })
        .catch(error => {
          this.owner.logger.warn('workbuddy2api-gateway-host: server download failed', error)
          return this.server.status()
        })
        .finally(() => {
          this.downloadPromise = undefined
        })
    }
    // The download runs in the background; the caller gets the current state and
    // polls serverStatus() for progress.
    return Promise.resolve(this.server.status())
  }

  /** Abort the in-flight download. */
  cancelDownload(): void {
    this.server.cancel()
  }

  /** Re-hash the installed binary. */
  async verifyServer(): Promise<ServerStatus> {
    return this.server.verify()
  }

  ensureConfig(): { path: string, created: boolean, apiKey?: string } {
    return this.supervisor.ensureConfig()
  }

  apiKeyFromConfig(): string | undefined {
    return this.supervisor.apiKeyFromConfig()
  }

  updateConfigApiKey(key: string): boolean {
    return this.supervisor.updateConfigApiKey(key)
  }

  /**
   * Write token-only credentials into the gateway's auth directory.
   *
   * The panel API cannot take these: `import/cockpit` skips every record without
   * a refresh token, because an account it cannot renew is one it would have to
   * disable later. The directory does take them — the loader only requires an
   * access token — and a credential without a refresh token is exactly the one
   * the scheduler leaves alone. So the file is the door, and the caller restarts
   * the gateway to make the pool read it.
   */
  importCredentials(records: readonly GatewayCredential[]): GatewayCredentialWrite {
    const directory = this.authDirPath()
    const written: string[] = []
    const errors: string[] = []
    for (const record of records) {
      // The uid becomes a file name: refuse anything that could walk out of the
      // directory before it is joined into a path.
      if (!UID_PATTERN.test(record.uid)) {
        errors.push(record.uid + ': uid may only use letters, digits, - and _')
        continue
      }
      if (record.accessToken.trim() === '') {
        errors.push(record.uid + ': empty access token')
        continue
      }
      const target = join(directory, 'workbuddy-' + record.uid + '.json')
      const temporary = target + '.tmp'
      try {
        mkdirSync(directory, { recursive: true })
        writeFileSync(temporary, JSON.stringify(authFileDocument(record), null, 2) + String.fromCharCode(10), {
          encoding: 'utf8',
          mode: 0o600,
        })
        renameSync(temporary, target)
        written.push(record.uid)
      } catch (error: unknown) {
        errors.push(record.uid + ': ' + messageOf(error))
        try {
          rmSync(temporary, { force: true })
        } catch {
          // The rename may already have consumed it.
        }
      }
    }
    if (written.length > 0) {
      this.owner.logger.info('workbuddy2api-gateway-host: wrote ' + String(written.length) + ' credential file(s) into ' + directory)
    }
    return { written, errors }
  }

  /**
   * The gateway's auth directory.
   *
   * Its document names it (`auth_dir`, relative to the working directory by
   * default); an absolute override is honoured as written. Reading the document
   * instead of assuming `./auths` keeps a hand-edited config working.
   */
  private authDirPath(): string {
    const workdir = gatewayWorkdir()
    try {
      const parsed: unknown = JSON.parse(readFileSync(gatewayConfigPath(), 'utf8'))
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return join(workdir, 'auths')
      const configured = (parsed as Record<string, unknown>)['auth_dir']
      if (typeof configured !== 'string' || configured.trim() === '') return join(workdir, 'auths')
      return isAbsolute(configured) ? configured : join(workdir, configured)
    } catch {
      return join(workdir, 'auths')
    }
  }

  /** Kernel discovery state (cadence, last check, offered version). */
  kernelUpdate(): KernelUpdateStatus {
    const active = this.server.status().version
    const latest = this.remote?.version
    return {
      cadence: this.cadence(),
      ...this.lastCheck?.at === undefined ? {} : { lastCheckedAt: this.lastCheck.at },
      ...latest === undefined ? {} : { latestVersion: latest },
      available: latest !== undefined && compareVersions(latest, active) > 0,
      installing: this.installing,
      ...this.lastCheck?.error === undefined ? {} : { error: this.lastCheck.error },
    }
  }

  /**
   * Ask the channel what the newest kernel is.
   *
   * Discovery never installs anything and never throws: a failed check is part
   * of the status (the page shows it as a warning), because an offline machine
   * must keep running the kernel it already has.
   */
  async checkKernelUpdate(): Promise<KernelUpdateStatus> {
    if (this.installing) return this.kernelUpdate()
    try {
      const manifest = await fetchLatestServerManifest({
        fetchImpl: fetch,
        // The channel origin is the *packaged* one: a local mirror override must
        // not be able to redirect discovery to another repository.
        releaseBaseUrl: this.bundledManifest.releaseBaseUrl,
        manifestUrl: this.config.manifestUrl,
        signal: this.checkAbort.signal,
      })
      this.remote = manifest
      this.lastCheck = { at: new Date().toISOString() }
    } catch (error) {
      this.lastCheck = { at: new Date().toISOString(), error: messageOf(error) }
      this.owner.logger.warn('workbuddy2api-gateway-host: kernel check failed', error)
    }
    this.persistCheck()
    return this.kernelUpdate()
  }

  /**
   * Download and adopt the discovered kernel.
   *
   * The install keeps the pinned-download guarantees (gzip, size, SHA-256,
   * atomic rename); what changes afterwards is which manifest the host row
   * serves. The manifest is persisted first, so a restart keeps the version the
   * user just installed instead of falling back to the packaged pin.
   */
  async installKernelUpdate(): Promise<ServerStatus> {
    const manifest = this.remote
    if (manifest === undefined || this.installing) return this.server.status()
    if (compareVersions(manifest.version, this.server.status().version) <= 0) return this.server.status()
    this.installing = true
    try {
      const store = this.createStore(manifest)
      const status = await store.download()
      if (!status.installed) {
        this.lastCheck = { at: new Date().toISOString(), error: status.error ?? 'kernel install did not complete' }
        this.persistCheck()
        return status
      }
      try {
        writeStoreDocument(activeServerManifestPath(), manifest)
      } catch (error) {
        this.owner.logger.warn('workbuddy2api-gateway-host: could not persist the active manifest', error)
      }
      this.server = store
      this.lastCheck = { at: new Date().toISOString() }
      this.persistCheck()
      if (this.config.autoStart) void this.supervisor.restart()
      return store.status()
    } catch (error) {
      this.owner.logger.warn('workbuddy2api-gateway-host: kernel install failed', error)
      this.lastCheck = { at: new Date().toISOString(), error: messageOf(error) }
      this.persistCheck()
      return this.server.status()
    } finally {
      this.installing = false
    }
  }

  /** Persist the update cadence and reschedule the checker. */
  setKernelCadence(cadence: KernelCheckCadence): KernelUpdateStatus {
    if (isKernelCadence(cadence)) {
      try {
        writeStoreDocument(kernelUpdateSettingsPath(), {
          version: KERNEL_SETTINGS_VERSION,
          cadence,
          ...this.lastCheck?.at === undefined ? {} : { lastCheckedAt: this.lastCheck.at },
        })
      } catch (error) {
        this.owner.logger.warn('workbuddy2api-gateway-host: could not persist the update cadence', error)
      }
    }
    this.scheduleKernelCheck()
    return this.kernelUpdate()
  }

  /** The effective cadence: the saved choice, else the install default. */
  private cadence(): KernelCheckCadence {
    const stored = readStoreDocument(
      kernelUpdateSettingsPath(),
      KERNEL_SETTINGS_VERSION,
      document => (isKernelCadence(document['cadence']) ? document['cadence'] : undefined),
    )
    if (stored !== undefined) return stored
    if (isKernelCadence(this.config.checkUpdates)) return this.config.checkUpdates
    return KERNEL_CADENCES[0] ?? 'hourly'
  }

  /** (Re)arm the self-rescheduling checker. 'never' disarms it. */
  private scheduleKernelCheck(delayMs = KERNEL_FIRST_CHECK_MS): void {
    if (this.checkTimer !== undefined) {
      clearTimeout(this.checkTimer)
      this.checkTimer = undefined
    }
    if (this.cadence() !== 'hourly') return
    this.checkTimer = setTimeout(() => {
      this.checkTimer = undefined
      void this.checkKernelUpdate().finally(() => {
        this.scheduleKernelCheck(KERNEL_CHECK_INTERVAL_MS)
      })
    }, delayMs)
    this.checkTimer.unref?.()
  }

  /** Persist the last check stamp next to the cadence. */
  private persistCheck(): void {
    try {
      writeStoreDocument(kernelUpdateSettingsPath(), {
        version: KERNEL_SETTINGS_VERSION,
        cadence: this.cadence(),
        ...this.lastCheck?.at === undefined ? {} : { lastCheckedAt: this.lastCheck.at },
      })
    } catch {
      // A failed write must not break the row; the in-memory stamp still serves.
    }
  }

  /** Build a cache bound to one manifest, keeping the row's mirror preferences. */
  private createStore(manifest: ServerManifest): ServerStore {
    return new ServerStore({
      rootDir: serverRootDir(),
      manifest,
      ...this.config.serverBaseUrl === '' ? {} : { releaseBaseUrl: this.config.serverBaseUrl },
      log: (message, error) => {
        if (error === undefined) this.owner.logger.info(message)
        else this.owner.logger.warn(message, error)
      },
    })
  }

  /**
   * The manifest the cache currently serves.
   *
   * A kernel installed from the channel persists its manifest; that document
   * wins only while it is at least as new as the packaged pin, so upgrading the
   * plugin pulls the pin forward instead of being pinned back by an old choice.
   */
  private loadActiveManifest(): ServerManifest {
    const path = activeServerManifestPath()
    if (!existsSync(path)) return this.bundledManifest
    try {
      const stored = parseServerManifest(JSON.parse(readFileSync(path, 'utf8')) as unknown)
      if (compareVersions(stored.version, this.bundledManifest.version) < 0) return this.bundledManifest
      return stored
    } catch (error) {
      this.owner?.logger.warn('workbuddy2api-gateway-host: ignoring an unreadable active manifest', error)
      return this.bundledManifest
    }
  }

  /** Start once the subprocess seam is available; never spawn from the panel. */
  private startIfConfigured(): void {
    if (this.started) return
    this.started = true
    if (this.config.autoStart) {
      void this.supervisor.start().then(status => {
        if (status.state === 'server-missing' && this.config.autoDownload) {
          void this.downloadServer()
        }
      })
      return
    }
    if (this.config.autoDownload && !this.server.status().installed) {
      void this.downloadServer()
    }
  }
}