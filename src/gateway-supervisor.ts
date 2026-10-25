/**
 * The process half, now owned by a host composition row.
 *
 * The gateway is a Go binary, so "the host runs it" can only mean the host's
 * subprocess seam owns the child. This supervisor never imports
 * `node:child_process`: it asks `ctx.subprocess` for a managed handle, reads the
 * handle's streams, and terminates through the handle. A panel reload does not
 * touch it; a host shutdown terminates the managed range.
 *
 * @module dsh-workbuddy-panel/gateway-supervisor
 */

import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { inheritGatewayConfig } from './default-config.ts'
import type { GatewayLogLine, GatewayState, GatewayStatus, ServerStatus } from './gateway-contract.ts'

/** The probe's answer. */
export type ProbeResult = 'up' | 'foreign' | 'down'

/** One spawn request; structurally the subset of `ctx.subprocess` this row uses. */
export interface SubprocessSpawnSpec {
  argv: readonly string[]
  cwd: string
  stdio: {
    stdin: 'ignore'
    stdout: 'pipe'
    stderr: 'pipe'
  }
  graceMs: number
}

/** The handle shape this row consumes. */
export interface SubprocessHandleLike {
  stdout?: Readable | null
  stderr?: Readable | null
  done: Promise<{ exitCode: number | null, signal: string | null }>
  terminate(): void
  waitForExit(): Promise<unknown>
}

/** The host service shape this row consumes. */
export interface SubprocessLike {
  spawn(spec: SubprocessSpawnSpec): SubprocessHandleLike
}

/** The server cache shape this row consumes. */
export interface GatewayServerPort {
  resolveBinary(): string | undefined
  status(): ServerStatus
}

/** What the supervisor reads from its owner. */
export interface GatewaySupervisorOptions {
  subprocess(): SubprocessLike | undefined
  /**
   * The cache to run from, read on every use.
   *
   * A getter, not a captured object: installing a kernel from the release
   * channel swaps the store underneath a running supervisor, and the next start
   * must resolve the new binary without rebuilding this row.
   */
  server(): GatewayServerPort
  configPath(): string
  workdir(): string
  port(): number
  authDir?(): string
  baseConfig?(): Record<string, unknown> | undefined
  autoStart(): boolean
  restartLimit(): number
  logLimit?: number
  log?(message: string, error?: unknown): void
  probeTimeoutMs?: number
  killGraceMs?: number
}

/** Depth of the visible log when the caller names none. */
const DEFAULT_LOG_LIMIT = 240

/** Ceiling for a restart's backoff. */
const MAX_BACKOFF_MS = 30_000

/** Grace before a stop escalates to SIGKILL. */
const KILL_GRACE_MS = 5_000

/** Read a JSON object without throwing. */
function readJsonObject(path: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

/** Turn a chunk into complete lines, keeping the partial tail for the next one. */
function splitLines(buffer: string, chunk: string): { lines: readonly string[], rest: string } {
  const parts = (buffer + chunk).split(/\r?\n/u)
  return { lines: parts.slice(0, -1), rest: parts.at(-1) ?? '' }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isBlockedState(state: GatewayState): boolean {
  return state === 'server-missing' || state === 'server-invalid' || state === 'host-unavailable'
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolveWait) => {
    const timer = setTimeout(resolveWait, ms)
    timer.unref?.()
  })
}

/**
 * Supervise one `workbuddy2api` gateway through the host subprocess seam.
 *
 * Every method is safe to call at any time: paths and the server cache are read
 * lazily, so a settings change lands without restarting the host row.
 */
export class GatewaySupervisor {
  private handle?: SubprocessHandleLike
  private stopping = false
  private restartTimer?: ReturnType<typeof setTimeout>
  private restarts = 0
  private since?: string
  private lastExit?: GatewayStatus['lastExit']
  private error?: string
  private state: GatewayState = 'stopped'
  private ready = false
  private readonly logLines: GatewayLogLine[] = []
  private stdoutBuffer = ''
  private stderrBuffer = ''
  private disposed = false

  constructor(private readonly options: GatewaySupervisorOptions) {}

  /** The ring buffer's depth. */
  private get limit(): number {
    return this.options.logLimit ?? DEFAULT_LOG_LIMIT
  }

  /** Append one line, dropping the oldest beyond the limit. */
  private note(stream: GatewayLogLine['stream'], text: string): void {
    this.logLines.push({ at: new Date().toISOString(), stream, text })
    while (this.logLines.length > this.limit) this.logLines.shift()
  }

  /** Feed one stream chunk into the line buffer. */
  private feed(stream: 'stdout' | 'stderr', chunk: Buffer | string): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    const current = stream === 'stdout' ? this.stdoutBuffer : this.stderrBuffer
    const split = splitLines(current, text)
    if (stream === 'stdout') this.stdoutBuffer = split.rest
    else this.stderrBuffer = split.rest
    for (const line of split.lines) {
      const trimmed = line.trimEnd()
      if (trimmed !== '') this.note(stream, trimmed)
    }
  }

  /** Flush a partial line before a process is declared gone. */
  private flushLines(): void {
    for (const stream of ['stdout', 'stderr'] as const) {
      const buffer = stream === 'stdout' ? this.stdoutBuffer : this.stderrBuffer
      if (buffer.trim() !== '') this.note(stream, buffer.trimEnd())
      if (stream === 'stdout') this.stdoutBuffer = ''
      else this.stderrBuffer = ''
    }
  }

  /** The verified executable this row would run right now. */
  resolveBinary(): string | undefined {
    return this.options.server().resolveBinary()
  }

  /**
   * Ensure a usable `config.json`, generating one when it is missing.
   *
   * The generated document is the full panel default, not a five-field
   * minimum: a minimal config starts the process but silently drops the pool
   * policy and every scheduled task.
   */
  ensureConfig(): { path: string, created: boolean, apiKey?: string } {
    const path = this.options.configPath()
    const existing = readJsonObject(path)
    if (existing !== undefined) return { path, created: false }
    mkdirSync(this.options.workdir(), { recursive: true })
    const apiKey = 'wb2a-' + randomBytes(18).toString('hex')
    const authDir = this.options.authDir?.() ?? ''
    const document = inheritGatewayConfig(this.options.baseConfig?.(), {
      apiKey,
      port: this.options.port(),
      authDir,
    })
    mkdirSync(join(this.options.workdir(), 'data'), { recursive: true })
    writeFileSync(path, JSON.stringify(document, null, 2) + String.fromCharCode(10), 'utf8')
    this.note('plugin', 'generated ' + path + ' with a fresh api key')
    return { path, created: true, apiKey }
  }

  /** Write a new api_key into the gateway config, keeping every other field. */
  updateConfigApiKey(key: string): boolean {
    const path = this.options.configPath()
    const document = readJsonObject(path) ?? { listen: ':' + String(this.options.port()) }
    try {
      mkdirSync(this.options.workdir(), { recursive: true })
      writeFileSync(path, JSON.stringify({ ...document, api_key: key }, null, 2) + String.fromCharCode(10), 'utf8')
      this.note('plugin', 'api key updated in ' + path)
      return true
    } catch (error: unknown) {
      this.note('plugin', 'could not write the api key: ' + messageOf(error))
      return false
    }
  }

  /** The API key the gateway's config.json carries, when readable. */
  apiKeyFromConfig(): string | undefined {
    const document = readJsonObject(this.options.configPath())
    const key = document?.['api_key']
    return typeof key === 'string' && key !== '' ? key : undefined
  }

  /**
   * Probe `/healthz` and verify the service identity.
   *
   * A raw `http` request, not `fetch`: this is a loopback liveness check, and a
   * `fetch` would honour an ambient proxy. The identity check is what separates
   * "our gateway" from "some other service on the same port".
   */
  async probe(): Promise<ProbeResult> {
    return await new Promise<ProbeResult>((resolveProbe) => {
      const req = request({
        host: '127.0.0.1',
        port: this.options.port(),
        path: '/healthz',
        method: 'GET',
        timeout: this.options.probeTimeoutMs ?? 2_000,
        headers: { Accept: 'application/json' },
      }, response => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          if (body.length < 4_096) body += chunk
        })
        response.on('end', () => {
          const status = response.statusCode ?? 0
          const rawHeader = response.headers['x-service']
          const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
          let jsonService: unknown
          try {
            const parsed: unknown = JSON.parse(body)
            if (typeof parsed === 'object' && parsed !== null) jsonService = (parsed as Record<string, unknown>)['service']
          } catch {
            // No JSON body; the header can still identify the service.
          }
          const identity = header === 'workbuddy2api' || jsonService === 'workbuddy2api'
          if ((status === 200 || status === 503) && identity) resolveProbe('up')
          else resolveProbe('foreign')
        })
      })
      req.on('timeout', () => {
        req.destroy()
        resolveProbe('down')
      })
      req.on('error', () => { resolveProbe('down') })
      req.end()
    })
  }

  /** Recompute the state without spawning anything. */
  async refresh(): Promise<GatewayStatus> {
    if (this.handle !== undefined) {
      if (!this.ready) {
        const probe = await this.probe()
        if (probe === 'up') {
          this.ready = true
          this.state = 'running'
          this.error = undefined
        } else if (probe === 'foreign') {
          this.state = 'port-conflict'
          this.error = 'port ' + String(this.options.port()) + ' is used by another service'
        } else {
          this.state = 'starting'
        }
      } else {
        this.state = 'running'
      }
      return this.status()
    }
    const probe = await this.probe()
    if (probe === 'up') {
      this.state = 'external'
      this.error = undefined
    } else if (probe === 'foreign') {
      this.state = 'port-conflict'
      this.error = 'port ' + String(this.options.port()) + ' is used by another service'
    } else if (!isBlockedState(this.state)) {
      this.state = this.error === undefined ? 'stopped' : 'failed'
    }
    return this.status()
  }

  /** Start the gateway if it is not already up. */
  async start(): Promise<GatewayStatus> {
    this.disposed = false
    if (this.handle !== undefined) return this.status()
    const probe = await this.probe()
    if (probe === 'up') {
      this.state = 'external'
      this.error = undefined
      return this.status()
    }
    if (probe === 'foreign') {
      this.state = 'port-conflict'
      this.error = 'port ' + String(this.options.port()) + ' is used by another service'
      this.note('plugin', this.error)
      return this.status()
    }

    const config = this.ensureConfig()
    const binary = this.resolveBinary()
    if (binary === undefined) {
      const server = this.options.server().status()
      const installedButInvalid = server.installedVersion !== undefined && server.installedVersion === server.version
      this.state = installedButInvalid ? 'server-invalid' : 'server-missing'
      this.error = server.error ?? (installedButInvalid
        ? 'the server binary failed verification'
        : 'the server is not installed; download it in the gateway tab')
      this.note('plugin', this.error)
      return this.status()
    }
    const subprocess = this.options.subprocess()
    if (subprocess === undefined) {
      this.state = 'host-unavailable'
      this.error = 'the DSH subprocess service is unavailable; this host cannot run the gateway'
      this.note('plugin', this.error)
      return this.status()
    }

    this.stopping = false
    this.error = undefined
    this.ready = false
    this.since = new Date().toISOString()
    try {
      const handle = subprocess.spawn({
        argv: [binary, '-config', config.path],
        cwd: this.options.workdir(),
        stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
        graceMs: this.options.killGraceMs ?? KILL_GRACE_MS,
      })
      this.handle = handle
      this.state = 'starting'
      this.note('plugin', 'spawned via DSH host subprocess: ' + binary)
      handle.stdout?.on('data', (chunk: Buffer) => { this.feed('stdout', chunk) })
      handle.stderr?.on('data', (chunk: Buffer) => { this.feed('stderr', chunk) })
      handle.done.then(
        outcome => { this.afterExit(outcome.exitCode, outcome.signal) },
        error => { this.afterExit(null, null, error) },
      )
    } catch (error: unknown) {
      this.handle = undefined
      this.state = 'failed'
      this.error = messageOf(error)
      this.note('plugin', 'spawn failed: ' + this.error)
    }
    return this.status()
  }

  /** Decide what follows one exit: a backed-off restart, or a resting failure. */
  private afterExit(code: number | null, signal: string | null, failure?: unknown): void {
    this.flushLines()
    this.handle = undefined
    this.ready = false
    this.since = undefined
    this.lastExit = { code, signal, at: new Date().toISOString() }
    if (failure !== undefined) {
      this.error = messageOf(failure)
      this.note('plugin', 'subprocess failed: ' + this.error)
    }
    this.note('plugin', 'exited (code ' + String(code ?? 'null') + ', signal ' + String(signal ?? 'null') + ')')
    if (this.stopping || this.disposed) {
      this.state = 'stopped'
      return
    }
    if (!this.options.autoStart()) {
      this.state = 'failed'
      return
    }
    const limit = this.options.restartLimit()
    if (this.restarts >= limit) {
      this.error = 'gateway exited ' + String(this.restarts) + ' times; automatic restart gave up'
      this.note('plugin', this.error)
      this.state = 'failed'
      return
    }
    const wait = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** this.restarts)
    this.restarts += 1
    this.state = 'failed'
    this.note('plugin', 'restarting in ' + String(wait) + 'ms (' + String(this.restarts) + '/' + String(limit) + ')')
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined
      if (this.disposed) return
      void this.start()
    }, wait)
    this.restartTimer.unref?.()
  }

  /**
   * Stop the gateway.
   *
   * A child this row started is terminated through its host handle. An external
   * gateway is left alone: stopping a process this row did not spawn belongs
   * where it was started.
   */
  async stop(): Promise<GatewayStatus> {
    this.stopping = true
    if (this.restartTimer !== undefined) {
      clearTimeout(this.restartTimer)
      this.restartTimer = undefined
    }
    const handle = this.handle
    if (handle === undefined) {
      const probe = await this.probe()
      if (probe === 'up') {
        this.state = 'external'
        this.error = 'this gateway was started outside the host row; stop it where it was started'
        return this.status()
      }
      if (probe === 'foreign') {
        this.state = 'port-conflict'
        this.error = 'port ' + String(this.options.port()) + ' is used by another service'
        return this.status()
      }
      this.state = 'stopped'
      this.error = undefined
      return this.status()
    }
    try {
      handle.terminate()
    } catch {
      // Already gone.
    }
    await Promise.race([
      handle.waitForExit().catch(() => {}),
      delay((this.options.killGraceMs ?? KILL_GRACE_MS) + 1_000),
    ])
    this.flushLines()
    this.handle = undefined
    this.state = 'stopped'
    this.since = undefined
    this.ready = false
    this.restarts = 0
    this.note('plugin', 'stopped')
    return this.status()
  }

  /** Stop then start, keeping the restart counter reset. */
  async restart(): Promise<GatewayStatus> {
    this.restarts = 0
    await this.stop()
    return this.start()
  }

  /** The current snapshot. */
  status(): GatewayStatus {
    const server = this.options.server().status()
    const binary = server.binaryPath
    return {
      state: this.state,
      managed: this.handle !== undefined,
      host: this.options.subprocess() === undefined ? 'unavailable' : 'dsh-subprocess',
      ...binary === undefined ? {} : { binary },
      serverVersion: server.version,
      configPath: this.options.configPath(),
      workdir: this.options.workdir(),
      port: this.options.port(),
      ...this.since === undefined ? {} : { since: this.since },
      restarts: this.restarts,
      ...this.lastExit === undefined ? {} : { lastExit: this.lastExit },
      ...this.error === undefined ? {} : { error: this.error },
      autoStart: this.options.autoStart(),
      log: this.logLines.slice(-60),
    }
  }

  /** Terminate the handle and wait for the managed range to settle. */
  async dispose(): Promise<void> {
    this.disposed = true
    if (this.restartTimer !== undefined) {
      clearTimeout(this.restartTimer)
      this.restartTimer = undefined
    }
    const handle = this.handle
    this.handle = undefined
    if (handle === undefined) return
    try {
      handle.terminate()
    } catch {
      // Nothing left to signal.
    }
    await Promise.race([
      handle.waitForExit().catch(() => {}),
      delay((this.options.killGraceMs ?? KILL_GRACE_MS) + 1_000),
    ])
  }
}
