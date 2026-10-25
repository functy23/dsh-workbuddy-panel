/**
 * Where this plugin keeps its documents.
 *
 * Everything lives in one directory under the harness home ($DSH_HOME, else
 * ~/.dsh) so a user can inspect or delete the plugin's state without hunting
 * through the profile tree. The gateway's own working directory sits INSIDE that
 * directory: the host row's managed process keeps its auths/ and data/ there,
 * which is what makes the whole integration self-contained — removing the
 * plugin's directory removes the gateway's state with it.
 *
 * @module dsh-workbuddy2api-gateway/paths
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

/** The harness home directory ($DSH_HOME, else ~/.dsh). */
export function dshHome(): string {
  const configured = process.env['DSH_HOME']
  return configured !== undefined && configured.trim() !== '' ? configured : join(homedir(), '.dsh')
}

/** This plugin's data directory. */
export function pluginDataDir(): string {
  return join(dshHome(), 'workbuddy2api-gateway')
}

/** The supervised gateway's working directory (its auths/ and data/ live here). */
export function gatewayWorkdir(): string {
  return join(pluginDataDir(), 'gateway')
}

/** The gateway's config.json path. */
/**
 * The verified server cache.
 *
 * The gateway binary is NOT shipped in this package. It lives here, under a
 * version/platform directory, after its SHA-256 matched the pinned
 * `server.json`. The host row is the only writer; the panel reads status.
 */
export function serverRootDir(): string {
  return join(pluginDataDir(), 'server')
}

export function gatewayConfigPath(): string {
  return join(gatewayWorkdir(), 'config.json')
}

/**
 * The manifest the cache is currently pinned to.
 *
 * Starts absent (the packaged `server.json` wins). A kernel installed from the
 * release channel writes its manifest here, so a restart keeps serving the
 * version the user chose instead of silently falling back to the packaged pin.
 */
export function activeServerManifestPath(): string {
  return join(serverRootDir(), 'manifest.json')
}

/** Kernel update cadence + last check time, written by the settings page. */
export function kernelUpdateSettingsPath(): string {
  return join(pluginDataDir(), 'kernel-update.json')
}

/** The gateway's own usage ledger (one bucket per hour, realm, account, model). */
export function gatewayUsagePath(): string {
  return join(gatewayWorkdir(), 'data', 'usage.json')
}

/** Local per-model overrides (enabled flags, effort choices). */
export function modelOverridesPath(): string {
  return join(pluginDataDir(), 'model-overrides.json')
}

/** Connection settings written by the settings page. */
export function connectionSettingsPath(): string {
  return join(pluginDataDir(), 'connection.json')
}

/** Saved copy of the last successful catalog, for offline starts. */
export function catalogCachePath(): string {
  return join(pluginDataDir(), 'catalog.json')
}
