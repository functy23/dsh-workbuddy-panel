/**
 * The contract between the panel row and the host gateway row.
 *
 * The panel never owns a process: it reads this interface from the host
 * composition row that does. Keeping the vocabulary in one leaf module means the
 * browser half can import the status shapes without importing the supervisor,
 * the server store, or any Node built-in.
 *
 * @module dsh-workbuddy-panel/gateway-contract
 */

/** How the gateway is running right now. */
export type GatewayState =
  /** No verified server binary is installed for this platform. */
  | 'server-missing'
  /** A binary exists but failed its checksum or cannot be executed. */
  | 'server-invalid'
  /** The host composition has no subprocess service to run the binary. */
  | 'host-unavailable'
  /** Something else owns the loopback port. */
  | 'port-conflict'
  /** No child, and nothing answers the health probe. */
  | 'stopped'
  /** A child is starting but has not answered the health probe yet. */
  | 'starting'
  /** A child started by this host row is answering. */
  | 'running'
  /** A gateway this host row did not start is answering. */
  | 'external'
  /** The last start or crash left nothing running. */
  | 'failed'

/** One line of gateway output, as the settings page shows it. */
export interface GatewayLogLine {
  at: string
  stream: 'stdout' | 'stderr' | 'plugin'
  text: string
}

/** The process snapshot the status document carries. */
export interface GatewayStatus {
  state: GatewayState
  /** True only while this host row owns a live subprocess handle. */
  managed: boolean
  /** Which host seam runs the process, or why none can. */
  host: 'dsh-subprocess' | 'unavailable'
  /** The verified executable, when one is installed. */
  binary?: string
  /** The server release this panel pins. */
  serverVersion?: string
  /** Where the gateway's document lives. */
  configPath: string
  /** The gateway's working directory (its auths/ and data/ live here). */
  workdir: string
  /** The loopback port the health probe uses. */
  port: number
  /** ISO time the current run began. */
  since?: string
  /** How many times this host row restarted the child after a crash. */
  restarts: number
  /** The most recent exit, when there was one. */
  lastExit?: { code: number | null, signal: string | null, at: string }
  /** Why the last start failed, when it did. */
  error?: string
  /** Whether a crash should be followed by an automatic restart. */
  autoStart: boolean
  /** The tail of the gateway's output, oldest first. */
  log: readonly GatewayLogLine[]
}

/** The server download state machine. */
export type ServerDownloadState =
  | 'idle'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'failed'
  | 'cancelled'

/** Download progress for one pinned server release. */
export interface ServerDownloadStatus {
  state: ServerDownloadState
  /** Compressed bytes received so far. */
  received: number
  /** Compressed size the manifest declares. */
  total: number
  error?: string
}

/** The server artifact this panel pins and the local cache state. */
export interface ServerStatus {
  /** Node's platform, e.g. `darwin`. */
  platform: string
  /** Node's architecture, e.g. `arm64`. */
  arch: string
  /** Whether the pinned manifest has an asset for this platform. */
  supported: boolean
  /** The version this panel pins. */
  version: string
  /** Gateway API generation the panel expects. */
  apiVersion: number
  /** Whether the pinned version is installed and executable. */
  installed: boolean
  /** The version currently in the cache, even when it is not the pinned one. */
  installedVersion?: string
  /** The verified binary path, when installed. */
  binaryPath?: string
  /** SHA-256 of the decompressed binary. */
  sha256: string
  /** Decompressed binary size. */
  size: number
  /** Compressed download size. */
  downloadSize: number
  /** The GitHub Release asset URL. */
  releaseUrl: string
  /** Download progress. */
  download: ServerDownloadStatus
  /** The last download or verification failure. */
  error?: string
}

/** How often the host row looks for a newer kernel. */
export type KernelCheckCadence = 'hourly' | 'never'

/**
 * Kernel update discovery state.
 *
 * The packaged `server.json` stays the floor: discovery only ever *offers* a
 * newer release, and installing one still goes through the same gzip → size →
 * SHA-256 → atomic rename path as the pinned download.
 */
export interface KernelUpdateStatus {
  /** The cadence the user picked; persisted next to the plugin's documents. */
  cadence: KernelCheckCadence
  /** ISO time of the last completed check, successful or not. */
  lastCheckedAt?: string
  /** The newest version the channel offers, when a check succeeded. */
  latestVersion?: string
  /** True when `latestVersion` is newer than the active kernel. */
  available: boolean
  /** True while a newer kernel is downloading or installing. */
  installing: boolean
  /** Why the last check failed, when it did. */
  error?: string
}

/**
 * One credential the host row may write into the gateway's auth directory.
 *
 * This is the shape a token-only credential takes. The panel's own API refuses an
 * account it cannot renew — `import/cockpit` skips any record without a
 * `refresh_token` — while the `auths/` directory loads the same credential with
 * an empty refresh token (`has_refresh_token: false`) and the scheduler then
 * leaves its refresh, keepalive and check-in alone instead of killing it on the
 * first 12153. Writing the file is therefore the only honest door for a bare
 * access token; the caller restarts the gateway, which reads the directory once
 * at startup.
 */
export interface GatewayCredential {
  /** Account id; the gateway re-checks it before it becomes a file name. */
  uid: string
  nickname: string
  accessToken: string
  /** Empty means "access token only" — the panel API cannot take it. */
  refreshToken: string
  /** Unix seconds; 0 when the input did not say. */
  expiresAt: number
  realm: 'cn' | 'global'
  /** `X-Domain` value; empty lets the gateway fall back to the endpoint host. */
  domain: string
}

/** What one auth-file write produced. */
export interface GatewayCredentialWrite {
  /** Uids whose file is on disk now. */
  written: readonly string[]
  /** One line per credential that could not be written. */
  errors: readonly string[]
}

/** What the panel reads from the host row. */
export interface GatewayHost {
  /** Contract generation; the panel refuses a row it cannot understand. */
  readonly serviceVersion: number
  status(): GatewayStatus
  serverStatus(): ServerStatus
  /** Kernel discovery state, including the persisted cadence. */
  kernelUpdate(): KernelUpdateStatus
  /** Check the channel now; resolves with the post-check state. */
  checkKernelUpdate(): Promise<KernelUpdateStatus>
  /** Download and install the discovered kernel, then adopt it. */
  installKernelUpdate(): Promise<ServerStatus>
  /** Persist a new cadence and reschedule the timer. */
  setKernelCadence(cadence: KernelCheckCadence): KernelUpdateStatus
  start(): Promise<GatewayStatus>
  stop(): Promise<GatewayStatus>
  restart(): Promise<GatewayStatus>
  downloadServer(): Promise<ServerStatus>
  cancelDownload(): void
  verifyServer(): Promise<ServerStatus>
  ensureConfig(): { path: string, created: boolean, apiKey?: string }
  apiKeyFromConfig(): string | undefined
  updateConfigApiKey(key: string): boolean
  /**
   * Write token-only credentials into the gateway's auth directory.
   *
   * Guarantees the bytes are on disk atomically and that the uid is safe as a
   * file name; it does not reload the pool, because the gateway reads that
   * directory once at startup. A caller that wants the accounts live calls
   * {@link GatewayHost.restart} afterwards.
   */
  importCredentials(records: readonly GatewayCredential[]): GatewayCredentialWrite
}

/** The Cordis service name the host row registers. */
export const GATEWAY_HOST_SERVICE = 'workbuddy2apiGateway'

/**
 * The contract generation this panel understands.
 *
 * 3 adds {@link GatewayHost.importCredentials}: a token-only credential can only
 * enter through the auths directory, so the panel needs a writer on the row that
 * owns that directory.
 */
export const GATEWAY_HOST_SERVICE_VERSION = 3
