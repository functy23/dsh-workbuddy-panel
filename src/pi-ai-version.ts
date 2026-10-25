/**
 * Which `@earendil-works/pi-ai` this plugin actually loaded.
 *
 * Pi is a peer the host also uses, and a pnpm profile can expose more than one
 * copy: with a `hoisted` linker, a peer-only plugin resolves the bare specifier
 * to whatever a *different* plugin left at the profile root — which is how one
 * machine ended up running 0.82.1 and dying with `PI_AI_ERROR` before any HTTP.
 * This plugin therefore declares pi-ai as a real, exactly pinned dependency, so
 * the copy it imports is its own and the version it gets is the version it was
 * built against. This module publishes that fact at startup and in the status
 * document, because it is the one thing a support report needs and the one the
 * plugin cannot infer from its own version.
 *
 * @module dsh-workbuddy2api-gateway/pi-ai-version
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Package name, spelled once. */
const PI_AI = '@earendil-works/pi-ai'

/**
 * Oldest pi-ai generation this plugin runs on.
 *
 * 0.87 is where `estimateMessageTokens` grew its `system` branch. Below it, the
 * host's collapsed system message is walked as a block array, `block.name` is
 * undefined, and every request dies at `PI_AI_ERROR` reading `.length`.
 */
export const MIN_PI_AI_VERSION = '0.87.0'

/** Walk up from a module entry until the manifest of `name` is found. */
function manifestVersionOf(entry: string, name: string): string | undefined {
  let dir = dirname(fileURLToPath(entry))
  // The entry sits at <package>/dist/index.js; a few extra steps keep this
  // working if that layout shifts between pi-ai generations.
  for (let step = 0; step < 6; step += 1) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: unknown
        version?: unknown
      }
      if (manifest.name === name && typeof manifest.version === 'string') return manifest.version
    } catch {
      // No manifest here, or not readable: keep walking up.
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

/** The pi-ai version this module resolves, or undefined when it cannot be read. */
export function resolvedPiAiVersion(): string | undefined {
  let entry: string
  try {
    entry = import.meta.resolve(PI_AI)
  } catch {
    return undefined
  }
  return manifestVersionOf(entry, PI_AI)
}

/**
 * The pi-ai version the host's LLM layer resolves, best effort.
 *
 * `@deepseek-ai/dsh-llm-pi-ai` owns the `Models` collection this plugin's
 * provider registers into, so its copy is the other half of the pair. A
 * generation gap between the two is not fatal — providers cross that boundary as
 * plain objects — but it is the first thing to look at when a request dies, so
 * it is reported beside our own version rather than guessed at in a bug report.
 */
export function hostPiAiVersion(): string | undefined {
  let entry: string
  try {
    entry = import.meta.resolve('@deepseek-ai/dsh-llm-pi-ai')
  } catch {
    return undefined
  }
  let dir = dirname(fileURLToPath(entry))
  for (let step = 0; step < 6; step += 1) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'node_modules', PI_AI, 'package.json'), 'utf8')) as {
        version?: unknown
      }
      if (typeof manifest.version === 'string') return manifest.version
    } catch {
      // No nested copy at this level: the host's copy may be hoisted higher.
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

/** Compare two `major.minor.patch` versions; a prerelease tag compares as its base. */
function compareVersions(left: string, right: string): number {
  const parse = (value: string): number[] =>
    (value.split('-')[0] ?? '').split('.').map(part => Number.parseInt(part, 10) || 0)
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** The generation pair a support report needs, for one log line. */
export function piAiVersionSummary(): string {
  const loaded = resolvedPiAiVersion() ?? 'unresolved'
  const host = hostPiAiVersion()
  return host === undefined ? loaded : loaded + ' (host ' + host + ')'
}

/**
 * One warning when the loaded pi-ai cannot carry this plugin, or undefined.
 *
 * A hard failure would take the settings page down with it — the page is how a
 * user finds out what is wrong — so this reports instead of throwing, and names
 * the fix rather than the symptom.
 */
export function piAiVersionWarning(): string | undefined {
  const version = resolvedPiAiVersion()
  if (version === undefined) {
    return 'workbuddy2api-gateway: could not resolve ' + PI_AI + '; requests on this route will fail. ' +
      'It is a pinned dependency of this plugin - reinstall the plugin (pnpm install) and restart DSH.'
  }
  if (compareVersions(version, MIN_PI_AI_VERSION) < 0) {
    return 'workbuddy2api-gateway: loaded ' + PI_AI + ' ' + version + ', but this plugin needs >=' + MIN_PI_AI_VERSION + '. ' +
      'Copies below that have no system branch in estimateMessageTokens, so every request fails at PI_AI_ERROR. ' +
      'Resolution escaped to a hoisted profile-root copy: reinstall this plugin so its own pinned copy wins.'
  }
  const host = hostPiAiVersion()
  if (host !== undefined && host.split('.').slice(0, 2).join('.') !== version.split('.').slice(0, 2).join('.')) {
    return 'workbuddy2api-gateway: loaded ' + PI_AI + ' ' + version + ', host LLM layer resolves ' + host + '. ' +
      'Providers cross that boundary as plain objects, so this usually works; check it first if a request fails.'
  }
  return undefined
}
