/**
 * The host supervisor's contract: it generates a config when there is none, it
 * asks the server cache for a verified executable, and it never spawns without
 * the host subprocess seam.
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GatewaySupervisor } from '../src/gateway-supervisor.ts'
import type { SubprocessHandleLike, SubprocessLike, SubprocessSpawnSpec } from '../src/gateway-supervisor.ts'
import type { ServerStatus } from '../src/gateway-contract.ts'

/** A server cache stand-in. */
function serverStatus(binary: string | undefined): ServerStatus {
  return {
    platform: 'darwin',
    arch: 'arm64',
    supported: true,
    version: '1.13.0-panel',
    apiVersion: 1,
    installed: binary !== undefined,
    ...binary === undefined ? {} : { binaryPath: binary },
    sha256: '0'.repeat(64),
    size: 1,
    downloadSize: 1,
    releaseUrl: '',
    download: { state: 'idle', received: 1, total: 1 },
  }
}

/** A subprocess handle whose exit is driven by the test. */
function fakeHandle() {
  let resolveDone: (value: { exitCode: number | null, signal: string | null }) => void = () => {}
  const done = new Promise<{ exitCode: number | null, signal: string | null }>((resolve) => {
    resolveDone = resolve
  })
  const handle: SubprocessHandleLike = {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    done,
    terminate: vi.fn(() => { resolveDone({ exitCode: 0, signal: null }) }),
    waitForExit: vi.fn(async () => {}),
  }
  return { handle, resolveDone }
}

/** A supervisor rooted in a throwaway directory. */
function makeSupervisor(options: {
  port?: number
  autoStart?: boolean
  binary?: string
  subprocess?: SubprocessLike
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'wb2g-host-'))
  const workdir = join(root, 'gateway')
  mkdirSync(workdir, { recursive: true })
  const binary = options.binary
  const supervisor = new GatewaySupervisor({
    subprocess: () => options.subprocess,
    server: {
      resolveBinary: () => binary,
      status: () => serverStatus(binary),
    },
    configPath: () => join(workdir, 'config.json'),
    workdir: () => workdir,
    port: () => options.port ?? 59_999,
    autoStart: () => options.autoStart ?? false,
    restartLimit: () => 2,
    probeTimeoutMs: 100,
  })
  return { supervisor, workdir, root }
}

const supervisors: GatewaySupervisor[] = []
afterEach(async () => {
  await Promise.all(supervisors.splice(0).map(supervisor => supervisor.dispose()))
})

describe('host supervisor', () => {
  it('generates a config with a random key and a loopback port', () => {
    const { supervisor, workdir } = makeSupervisor({ port: 61_111 })
    supervisors.push(supervisor)
    const created = supervisor.ensureConfig()
    expect(created.created).toBe(true)
    const document = JSON.parse(readFileSync(join(workdir, 'config.json'), 'utf8')) as Record<string, unknown>
    expect(document['listen']).toBe(':61111')
    expect(String(document['api_key'])).toMatch(/^wb2a-[0-9a-f]{36}$/)
    expect(document['auth_dir']).toBe('./auths')
    expect(supervisor.apiKeyFromConfig()).toBe(document['api_key'])
    expect(supervisor.ensureConfig().created).toBe(false)
  })

  it('reports stopped when nothing listens and nothing was spawned', async () => {
    const { supervisor } = makeSupervisor()
    supervisors.push(supervisor)
    const status = await supervisor.refresh()
    expect(status.state).toBe('stopped')
    expect(status.managed).toBe(false)
  })

  it('refuses to spawn when the server cache has no verified binary', async () => {
    const { supervisor } = makeSupervisor()
    supervisors.push(supervisor)
    const status = await supervisor.start()
    expect(status.state).toBe('server-missing')
    expect(status.error).toContain('not installed')
  })

  it('refuses to spawn when the host has no subprocess service', async () => {
    const { supervisor } = makeSupervisor({ binary: '/tmp/workbuddy2api' })
    supervisors.push(supervisor)
    const status = await supervisor.start()
    expect(status.state).toBe('host-unavailable')
  })

  it('spawns through the host seam and reads its streams', async () => {
    const { handle } = fakeHandle()
    const spawn = vi.fn((_spec: SubprocessSpawnSpec) => handle)
    const subprocess: SubprocessLike = { spawn }
    const { supervisor } = makeSupervisor({ binary: '/tmp/workbuddy2api', subprocess })
    supervisors.push(supervisor)
    const started = await supervisor.start()
    expect(started.state).toBe('starting')
    expect(spawn).toHaveBeenCalledTimes(1)
    const spec = spawn.mock.calls[0]?.[0]
    expect(spec?.argv[0]).toBe('/tmp/workbuddy2api')
    expect(spec?.argv[1]).toBe('-config')
    expect(spec?.graceMs).toBe(5_000)
    ;(handle.stdout as PassThrough).write('listening on :7863\n')
    const status = supervisor.status()
    expect(status.log.some(line => line.text.includes('listening'))).toBe(true)
    expect(status.managed).toBe(true)
  })

  it('stops through the handle rather than signalling a pid', async () => {
    const { handle } = fakeHandle()
    const subprocess: SubprocessLike = { spawn: () => handle }
    const { supervisor } = makeSupervisor({ binary: '/tmp/workbuddy2api', subprocess })
    supervisors.push(supervisor)
    await supervisor.start()
    const stopped = await supervisor.stop()
    expect(handle.terminate).toHaveBeenCalledTimes(1)
    expect(handle.waitForExit).toHaveBeenCalled()
    expect(stopped.state).toBe('stopped')
    expect(stopped.managed).toBe(false)
  })

  it('a stop on an unspawned, unlistening gateway is a clean no-op', async () => {
    const { supervisor } = makeSupervisor()
    supervisors.push(supervisor)
    const status = await supervisor.stop()
    expect(status.state).toBe('stopped')
    expect(status.error).toBeUndefined()
  })
})
