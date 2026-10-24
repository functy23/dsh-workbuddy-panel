/**
 * The process half: this plugin owns the `workbuddy2api` gateway instead of
 * asking the user to run it.
 *
 * "Owns" is deliberate and has three consequences:
 *
 * 1. **It finds the binary.** A configured path wins; otherwise the search walks
 *    the places a locally built gateway usually sits (`~/Downloads/…`, a
 *    `bin/` beside this plugin's data, `/usr/local/bin`, then `PATH`). The
 *    answer is cached until the next explicit refresh so a start attempt is not
 *    a filesystem crawl.
 * 2. **It writes the config.** A missing `config.json` is generated with a
 *    random API key, a loopback listen address, and `auth_dir`/`state_file`
 *    inside this plugin's data directory — so the gateway's state belongs to the
 *    plugin and no path leaks into the user's home by accident. An existing
 *    config is never rewritten: it is the user's file, and the panel hot-applies
 *    changes made through its own API.
 * 3. **It supervises.** The child's stdout/stderr are kept in a ring buffer the
 *    settings page can show, a crash restarts it with exponential backoff up to a
 *    limit, and a stop is always SIGTERM first with a SIGKILL deadline.
 *
 * The one case this file does NOT own is a gateway somebody else started: a
 * healthy `/healthz` with no child process means `external`. The rest of the
 * plugin treats that exactly like a managed one — the difference is only that
 * stopping it is refused, because killing a process this plugin did not spawn
 * would be a surprise, not a feature.
 *
 * @module dsh-workbuddy2api-gateway/supervisor
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { inheritGatewayConfig } from './default-config.ts'
import { bundledGatewayBinary } from './paths.ts'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'

/** How the gateway is running right now. */
export type SupervisorState =
  /** No child, and `/healthz` does not answer: nothing is serving this port. */
  | 'stopped'
  /** A child was spawned and has not answered a health probe yet. */
  | 'starting'
  /** A child this plugin spawned is answering. */
  | 'running'
  /** A gateway this plugin did not spawn is answering on the port. */
  | 'external'
  /** The last start or the last crash left nothing running. */
  | 'failed'

/** One line of gateway output, as the settings page shows it. */
export interface SupervisorLogLine {
  at: string
  stream: 'stdout' | 'stderr' | 'plugin'
  text: string
}

/** The process snapshot the status document carries. */
export interface SupervisorStatus {
  state: SupervisorState
  /** True only when this plugin spawned the running child. */
  managed: boolean
  pid?: number
  /** The resolved executable, when one was found. */
  binary?: string
  /** Where the gateway's document lives. */
  configPath: string
  /** The gateway's working directory (its `auths/` and `data/` live here). */
  workdir: string
  /** The loopback port the health probe uses. */
  port: number
  /** ISO time the current run began. */
  since?: string
  /** How many times this plugin restarted the child after a crash. */
  restarts: number
  /** The most recent exit, when there was one. */
  lastExit?: { code: number | null, signal: string | null, at: string }
  /** Why the last start failed, when it did. */
  error?: string
  /** Whether a crash should be followed by an automatic restart. */
  autoStart: boolean
  /** The tail of the gateway's output, oldest first. */
  log: readonly SupervisorLogLine[]
}

/** What the supervisor reads from the plugin. */
export interface SupervisorOptions {
  /** The user's configured executable path; an empty string means "discover". */
  binary(): string
  /** The gateway's `config.json` path. */
  configPath(): string
  /** The gateway's working directory. */
  workdir(): string
  /** Where the gateway keeps its accounts; empty means the workdir default. */
  authDir?(): string
  /** A gateway document to inherit from (an existing install), when there is one. */
  baseConfig?(): Record<string, unknown> | undefined

  /** The loopback port to probe. */
  port(): number
  /** Whether a crash restarts the child. */
  autoStart(): boolean
  /** Restarts allowed in one run before the supervisor gives up. */
  restartLimit(): number
  /** Ring-buffer depth for the visible log. */
  logLimit?: number
  /** Where plugin-level events go (the host's logger). */
  log?(message: string, error?: unknown): void
  /** Health probe deadline. */
  probeTimeoutMs?: number
}

/** Depth of the visible log when the caller names none. */
const DEFAULT_LOG_LIMIT = 240

/** Ceiling for a restart's backoff. */
const MAX_BACKOFF_MS = 30_000

/** Grace before a stop escalates to SIGKILL. */
const KILL_GRACE_MS = 5_000

/** Candidate executables, most specific first. */
function candidateBinaries(configured: string, workdir: string, bundled: string): readonly string[] {
  const exe = process.platform === 'win32' ? 'workbuddy2api.exe' : 'workbuddy2api'
  const home = homedir()
  // An explicitly configured path is the whole answer: silently running a
  // different executable than the one the user named would be worse than failing.
  if (configured !== '') return [configured]
  const fromPath = (process.env['PATH'] ?? '')
    .split(delimiter)
    .filter(entry => entry !== '')
    .map(entry => join(entry, exe))
  return [
    process.env['WORKBUDDY2API_BIN'] ?? '',
    join(workdir, 'bin', exe),
    bundled,
    join(home, 'Downloads', 'workbuddy2api-panel', exe),
    join(home, 'workbuddy2api-panel', exe),
    join(home, 'Desktop', 'workbuddy2api-panel', exe),
    '/usr/local/bin/workbuddy2api',
    '/opt/homebrew/bin/workbuddy2api',
    ...fromPath,
  ].filter(entry => entry !== '')
}

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

/** Turn whatever a gateway prints into one visible line. */
function lineOf(chunk: Buffer): readonly string[] {
  return chunk
    .toString('utf8')
    .split(/\r?\n/u)
    .map(line => line.trimEnd())
    .filter(line => line !== '')
}

/**
 * Supervise one `workbuddy2api` gateway.
 *
 * Every method is safe to call at any time: the supervisor re-reads the
 * configured paths on each call, so a settings change lands without a restart of
 * the plugin.
 */
export class PanelSupervisor {
  private child?: ChildProcess
  private stopping = false
  private restartTimer?: ReturnType<typeof setTimeout>
  private restarts = 0
  private since?: string
  private lastExit?: SupervisorStatus['lastExit']
  private error?: string
  private state: SupervisorState = 'stopped'
  private readonly logLines: SupervisorLogLine[] = []
  /** Cached executable, dropped whenever a start is asked for explicitly. */
  private resolvedBinary?: string
  private disposed = false

  constructor(private readonly options: SupervisorOptions) {}

  /** The ring buffer's depth. */
  private get limit(): number {
    return this.options.logLimit ?? DEFAULT_LOG_LIMIT
  }

  /** Append one line, dropping the oldest beyond the limit. */
  private note(stream: SupervisorLogLine['stream'], text: string): void {
    this.logLines.push({ at: new Date().toISOString(), stream, text })
    while (this.logLines.length > this.limit) this.logLines.shift()
  }

  /** The executable this plugin would run right now, or undefined. */
  resolveBinary(): string | undefined {
    if (this.resolvedBinary !== undefined) return this.resolvedBinary
    for (const candidate of candidateBinaries(this.options.binary(), this.options.workdir(), bundledGatewayBinary())) {
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          this.resolvedBinary = resolve(candidate)
          return this.resolvedBinary
        }
      } catch {
        // An unreadable candidate is simply not the answer.
      }
    }
    return undefined
  }

  /** Forget the cached executable (a settings change, or a retry after "not found"). */
  invalidateBinary(): void {
    this.resolvedBinary = undefined
  }

  /**
   * Ensure a usable `config.json`, generating one when it is missing.
   *
   * The generated document is minimal on purpose: every field it sets is one the
   * gateway needs to run at all (listen address, admin key, where accounts and
   * state live). Anything else — pool strategy, schedules, prompt rewriting — is
   * left to the gateway's own defaults, which is what its documentation calls a
   * recommended configuration.
   */
  ensureConfig(): { path: string, created: boolean, apiKey?: string } {
    const path = this.options.configPath()
    const existing = readJsonObject(path)
    if (existing !== undefined) return { path, created: false }
    mkdirSync(this.options.workdir(), { recursive: true })
    const apiKey = 'wb2a-' + randomBytes(18).toString('hex')
    const authDir = this.options.authDir?.() ?? ''
    // The full panel document, not a minimal one: a five-field config starts the
    // process but silently drops the pool policy and every scheduled task. An
    // existing install's document is merged underneath when one is found.
    const document = inheritGatewayConfig(this.options.baseConfig?.(), {
      apiKey,
      port: this.options.port(),
      authDir,
    })
    mkdirSync(join(this.options.workdir(), 'data'), { recursive: true })
    writeFileSync(path, JSON.stringify(document, null, 2) + '\n', 'utf8')
    this.note('plugin', 'generated ' + path + ' with a fresh api key')
    return { path, created: true, apiKey }
  }

  /** The API key the gateway's `config.json` carries, when it is readable. */
  /**
   * Write a new api_key into the gateway config, keeping every other field.
   *
   * The settings page promises one key and the gateway honours exactly one: the
   * document in its own directory. A key stored only here would leave the gateway
   * answering 401 to its own supervisor (and the web panel locked out), so a
   * changed key is written there and the process is restarted to honour it.
   */
  updateConfigApiKey(key: string): boolean {
    const path = this.options.configPath()
    const document = readJsonObject(path) ?? { listen: ':' + String(this.options.port()) }
    try {
      mkdirSync(this.options.workdir(), { recursive: true })
      writeFileSync(path, JSON.stringify({ ...document, api_key: key }, null, 2) + String.fromCharCode(10), 'utf8')
      this.note('plugin', 'api key updated in ' + path)
      return true
    } catch (error: unknown) {
      this.note('plugin', 'could not write the api key: ' + String(error))
      return false
    }
  }

  apiKeyFromConfig(): string | undefined {
    const document = readJsonObject(this.options.configPath())
    const key = document?.['api_key']
    return typeof key === 'string' && key !== '' ? key : undefined
  }

  /**
   * Probe `/healthz`; the gateway answers 503 when it has no account yet.
   *
   * A raw `http` request, not `fetch`: this is a loopback liveness check, and a
   * `fetch` would honour an ambient proxy — turning "nothing listens here" into
   * "the proxy answered 503", which is exactly the wrong answer at the wrong
   * time.
   */
  async probe(): Promise<boolean> {
    return await new Promise<boolean>((resolveProbe) => {
      const req = request({
        host: '127.0.0.1',
        port: this.options.port(),
        path: '/healthz',
        method: 'GET',
        timeout: this.options.probeTimeoutMs ?? 2_000,
        headers: { Accept: 'application/json' },
      }, response => {
        const status = response.statusCode ?? 0
        response.resume()
        // 200 = ready, 503 = running but no usable account. Both mean "up".
        resolveProbe(status === 200 || status === 503)
      })
      req.on('timeout', () => {
        req.destroy()
        resolveProbe(false)
      })
      req.on('error', () => { resolveProbe(false) })
      req.end()
    })
  }

  /** Recompute the state without spawning anything. */
  async refresh(): Promise<SupervisorStatus> {
    if (this.child !== undefined) {
      this.state = this.since === undefined ? 'starting' : 'running'
      return this.status()
    }
    const alive = await this.probe()
    this.state = alive ? 'external' : this.error === undefined ? 'stopped' : 'failed'
    return this.status()
  }

  /** Start the gateway if it is not already up. */
  async start(): Promise<SupervisorStatus> {
    this.disposed = false
    if (this.child !== undefined) return this.status()
    if (await this.probe()) {
      this.state = 'external'
      this.error = undefined
      return this.status()
    }
    // The config is written even when the executable is missing: it is the file
    // the user needs to look at while deciding which path to configure, and
    // generating it costs nothing.
    const config = this.ensureConfig()
    this.invalidateBinary()
    const binary = this.resolveBinary()
    if (binary === undefined) {
      this.state = 'failed'
      this.error = 'workbuddy2api executable not found; set its path in this page'
      this.note('plugin', this.error)
      return this.status()
    }
    this.stopping = false
    this.error = undefined
    this.since = new Date().toISOString()
    try {
      const child = spawn(binary, ['-config', config.path], {
        cwd: this.options.workdir(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      this.child = child
      this.state = 'starting'
      this.note('plugin', 'spawned ' + binary + ' (pid ' + String(child.pid ?? -1) + ')')
      child.stdout?.on('data', (chunk: Buffer) => {
        for (const line of lineOf(chunk)) this.note('stdout', line)
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        for (const line of lineOf(chunk)) this.note('stderr', line)
      })
      child.on('exit', (code, signal) => {
        this.child = undefined
        this.since = undefined
        this.lastExit = { code, signal, at: new Date().toISOString() }
        this.note('plugin', 'exited (code ' + String(code ?? 'null') + ', signal ' + String(signal ?? 'null') + ')')
        this.afterExit(code)
      })
      child.on('error', (error: unknown) => {
        this.note('plugin', 'spawn failed: ' + String(error))
        this.error = error instanceof Error ? error.message : String(error)
        this.child = undefined
        this.state = 'failed'
      })
    } catch (error: unknown) {
      this.child = undefined
      this.state = 'failed'
      this.error = error instanceof Error ? error.message : String(error)
      this.note('plugin', 'spawn threw: ' + this.error)
    }
    return this.status()
  }

  /** Decide what follows one exit: a backed-off restart, or a resting failure. */
  private afterExit(code: number | null): void {
    // Only our own stop is clean. The gateway exits 0 on SIGTERM, so the code alone
    // cannot distinguish it from an operator kill or a crash — and a gateway nobody
    // restarts is a route that silently dies with it.
    const clean = this.stopping
    this.state = clean ? 'stopped' : 'failed'
    if (clean || this.disposed) return
    if (!this.options.autoStart()) return
    const limit = this.options.restartLimit()
    if (this.restarts >= limit) {
      this.error = 'gateway exited ' + String(this.restarts) + ' times; automatic restart gave up'
      this.note('plugin', this.error)
      return
    }
    const delay = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** this.restarts)
    this.restarts += 1
    this.note('plugin', 'restarting in ' + String(delay) + 'ms (' + String(this.restarts) + '/' + String(limit) + ')')
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined
      if (this.disposed) return
      void this.start()
    }, delay)
    this.restartTimer.unref?.()
  }

  /**
   * Stop the gateway.
   *
   * A child this plugin spawned gets SIGTERM, then SIGKILL after a grace period.
   * An external gateway is left alone — the status says so, and the page renders
   * that refusal as information rather than as a failed action.
   */
  async stop(): Promise<SupervisorStatus> {
    this.stopping = true
    if (this.restartTimer !== undefined) {
      clearTimeout(this.restartTimer)
      this.restartTimer = undefined
    }
    const child = this.child
    if (child === undefined) {
      const alive = await this.probe()
      if (alive) {
        this.state = 'external'
        this.error = 'this gateway was started outside the plugin; stop it where it was started'
        return this.status()
      }
      this.state = 'stopped'
      this.error = undefined
      return this.status()
    }
    child.kill('SIGTERM')
    await new Promise<void>((resolveWait) => {
      const deadline = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // Already gone.
        }
      }, KILL_GRACE_MS)
      child.once('exit', () => {
        clearTimeout(deadline)
        resolveWait()
      })
      setTimeout(resolveWait, KILL_GRACE_MS + 1_000).unref?.()
    })
    this.child = undefined
    this.state = 'stopped'
    this.since = undefined
    this.restarts = 0
    this.note('plugin', 'stopped')
    return this.status()
  }

  /** Stop then start, keeping the restart counter. */
  async restart(): Promise<SupervisorStatus> {
    this.restarts = 0
    await this.stop()
    return this.start()
  }

  /** The current snapshot. */
  status(): SupervisorStatus {
    const binary = this.resolvedBinary
    return {
      state: this.state,
      managed: this.child !== undefined,
      ...this.child?.pid === undefined ? {} : { pid: this.child.pid },
      ...binary === undefined ? {} : { binary },
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

  /** Drop the child and every timer, without waiting for anything. */
  dispose(): void {
    this.disposed = true
    if (this.restartTimer !== undefined) clearTimeout(this.restartTimer)
    this.restartTimer = undefined
    const child = this.child
    this.child = undefined
    if (child === undefined) return
    try {
      child.kill('SIGTERM')
    } catch {
      // Nothing left to signal.
    }
  }
}
