/**
 * The plugin's own pi-ai edge: the declaration, the resolution, and the guard
 * that reports when the two disagree.
 *
 * This is the regression test for PI_AI_ERROR. The failure was never in the
 * plugin's code — it was a peer-only declaration resolved to a co-installed
 * plugin's stale copy at the profile root, where estimateMessageTokens had no
 * system branch. The fix is a real, exactly pinned dependency; these cases fail
 * the moment that edge is dropped back to a peer, or the pin drifts away from
 * what actually resolves.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MIN_PI_AI_VERSION,
  hostPiAiVersion,
  piAiVersionSummary,
  piAiVersionWarning,
  resolvedPiAiVersion,
} from '../src/pi-ai-version.ts'

/** The manifest this package ships. */
const MANIFEST = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/** Numeric parts of a version, prerelease tag dropped. */
function parts(version: string): number[] {
  return version.split('-')[0]!.split('.').map(part => Number.parseInt(part, 10) || 0)
}

describe('pi-ai dependency edge', () => {
  it('declares pi-ai as a pinned dependency, not a peer', () => {
    expect(MANIFEST.dependencies?.['@earendil-works/pi-ai']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(MANIFEST.peerDependencies?.['@earendil-works/pi-ai']).toBeUndefined()
    expect(MANIFEST.devDependencies?.['@earendil-works/pi-ai']).toBeUndefined()
  })

  it('resolves the exact copy the manifest pins', () => {
    expect(resolvedPiAiVersion()).toBe(MANIFEST.dependencies?.['@earendil-works/pi-ai'])
  })

  it('resolves a generation the plugin can run on', () => {
    const version = resolvedPiAiVersion()
    expect(version).toBeDefined()
    const [major = 0, minor = 0] = parts(version!)
    const [minMajor = 0, minMinor = 0] = parts(MIN_PI_AI_VERSION)
    expect(major * 1000 + minor).toBeGreaterThanOrEqual(minMajor * 1000 + minMinor)
  })

  it('reports no warning when the copy is correct', () => {
    expect(piAiVersionWarning()).toBeUndefined()
  })

  it('names the loaded copy in the startup summary', () => {
    const summary = piAiVersionSummary()
    expect(summary.startsWith(resolvedPiAiVersion()!)).toBe(true)
    expect(hostPiAiVersion() === undefined || /^\d+\./.test(hostPiAiVersion()!)).toBe(true)
  })
})
