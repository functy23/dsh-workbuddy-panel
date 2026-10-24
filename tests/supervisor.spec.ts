/**
 * The supervisor's contract: it generates a config when there is none, it finds
 * an executable it is pointed at, and it never claims to run something it did
 * not spawn.
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PanelSupervisor } from '../src/supervisor.ts'

/** A supervisor rooted in a throwaway directory. */
function makeSupervisor(options: { port?: number, autoStart?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'wb2g-'))
  const workdir = join(root, 'gateway')
  mkdirSync(workdir, { recursive: true })
  const supervisor = new PanelSupervisor({
    // A probe port nothing listens on, so refresh() cannot adopt an unrelated
    // gateway running on this machine.
    port: () => options.port ?? 59_999,
    configPath: () => join(workdir, 'config.json'),
    workdir: () => workdir,
    autoStart: () => options.autoStart ?? false,
    restartLimit: () => 2,
    probeTimeoutMs: 150,
  })
  return { supervisor, workdir, root }
}

describe('supervisor', () => {
  it('generates a config with a random key and a loopback port', () => {
    const { supervisor, workdir } = makeSupervisor({ port: 61_111 })
    const created = supervisor.ensureConfig()
    expect(created.created).toBe(true)
    const document = JSON.parse(readFileSync(join(workdir, 'config.json'), 'utf8')) as Record<string, unknown>
    expect(document['listen']).toBe(':61111')
    expect(String(document['api_key'])).toMatch(/^wb2a-[0-9a-f]{36}$/)
    expect(document['auth_dir']).toBe('./auths')
    expect(supervisor.apiKeyFromConfig()).toBe(document['api_key'])
    // A second call is a no-op: the user's file is never rewritten.
    expect(supervisor.ensureConfig().created).toBe(false)
  })

  it('finds the executable shipped inside the package', () => {
    const { supervisor } = makeSupervisor()
    // No configured path and an empty workdir: the packaged bin/ is the answer,
    // before any machine-wide guess.
    expect(supervisor.resolveBinary()).toContain('bin/workbuddy2api')
  })

  it('reports stopped when nothing listens and nothing was spawned', async () => {
    const { supervisor } = makeSupervisor()
    const status = await supervisor.refresh()
    expect(status.state).toBe('stopped')
    expect(status.managed).toBe(false)
  })

  it('a stop on an unspawned, unlistening gateway is a clean no-op', async () => {
    const { supervisor } = makeSupervisor()
    const status = await supervisor.stop()
    expect(status.state).toBe('stopped')
    expect(status.error).toBeUndefined()
  })
})
