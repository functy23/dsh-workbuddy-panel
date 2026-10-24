/**
 * Where this plugin keeps its documents.
 *
 * Everything lives in one directory under the harness home ($DSH_HOME, else
 * ~/.dsh) so a user can inspect or delete the plugin's state without hunting
 * through the profile tree. The gateway's own working directory sits INSIDE that
 * directory: the process this plugin supervises keeps its auths/ and data/ there,
 * which is what makes the whole integration self-contained — removing the
 * plugin's directory removes the gateway's state with it.
 *
 * @module dsh-workbuddy2api-gateway/paths
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
 * The gateway executable shipped inside this package.
 *
 * A published build carries the binary in bin/ (the npm tarball ships ONLY that,
 * never the source snapshot): a fresh install then works without asking the user
 * to build a Go project first.
 */
export function bundledGatewayBinary(): string {
  const exe = process.platform === 'win32' ? 'workbuddy2api.exe' : 'workbuddy2api'
  return fileURLToPath(new URL('../bin/' + exe, import.meta.url))
}

export function gatewayConfigPath(): string {
  return join(gatewayWorkdir(), 'config.json')
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
