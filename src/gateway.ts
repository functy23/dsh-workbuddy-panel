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

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { GATEWAY_HOST_SERVICE, GATEWAY_HOST_SERVICE_VERSION } from './gateway-contract.ts'
import type { GatewayHost, GatewayStatus, ServerStatus } from './gateway-contract.ts'
import { GatewaySupervisor } from './gateway-supervisor.ts'
import type { SubprocessLike } from './gateway-supervisor.ts'
import { gatewayConfigPath, gatewayWorkdir, serverRootDir } from './paths.ts'
import { ServerStore } from './server-store.ts'

/** Poll floor for the process state. */
const TICK_MS = 5_000

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
})

/** Parsed host-row config. */
export interface Config {
  port: number
  autoStart: boolean
  restartLimit: number
  authDir: string
  autoDownload: boolean
  serverBaseUrl: string
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
  private readonly server: ServerStore
  private readonly supervisor: GatewaySupervisor
  private subprocess?: SubprocessLike
  private timer?: ReturnType<typeof setInterval>
  private downloadPromise?: Promise<ServerStatus>
  private started = false

  constructor(ctx: Context, config: Config) {
    super(ctx, GATEWAY_HOST_SERVICE)
    this.owner = ctx
    this.config = config
    this.server = new ServerStore({
      rootDir: serverRootDir(),
      ...config.serverBaseUrl === '' ? {} : { releaseBaseUrl: config.serverBaseUrl },
      log: (message, error) => {
        if (error === undefined) ctx.logger.info(message)
        else ctx.logger.warn(message, error)
      },
    })
    this.supervisor = new GatewaySupervisor({
      subprocess: () => this.subprocess,
      server: this.server,
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
