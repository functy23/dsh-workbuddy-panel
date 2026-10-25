/**
 * The server cache's contract: a download is verified before it becomes the
 * current binary, and a mismatch never leaves an executable behind.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { ServerChecksumError, ServerStore, ServerUnsupportedPlatformError } from '../src/server-store.ts'
import type { ServerManifest } from '../src/server-release.ts'

const BINARY = Buffer.from('workbuddy2api fake binary for tests\n')
const GZIP = gzipSync(BINARY)
const SHA = createHash('sha256').update(BINARY).digest('hex')

/** One local release server. */
function releaseServer(body: Buffer) {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Length': body.length })
    res.end(body)
  })
  return new Promise<{ url: string, close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        url: 'http://127.0.0.1:' + String(port),
        close: () => new Promise<void>((done, fail) => {
          server.close(error => { error === undefined ? done() : fail(error) })
        }),
      })
    })
  })
}

function manifest(sha = SHA): ServerManifest {
  return {
    schemaVersion: 1,
    version: '1.13.0-panel',
    apiVersion: 1,
    minPanel: '0.4.0',
    releaseTag: 'server-v1.13.0-panel',
    releaseBaseUrl: 'https://example.test/releases',
    assets: {
      'darwin-arm64': {
        asset: 'workbuddy2api-1.13.0-panel-darwin-arm64.gz',
        sha256: sha,
        size: BINARY.length,
        downloadSize: GZIP.length,
      },
    },
  }
}

const servers: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(close => close()))
})

describe('server store', () => {
  it('downloads, verifies, and installs the pinned binary', async () => {
    const release = await releaseServer(GZIP)
    servers.push(release.close)
    const root = mkdtempSync(join(tmpdir(), 'wb2g-server-'))
    const store = new ServerStore({
      rootDir: root,
      manifest: manifest(),
      platform: 'darwin',
      arch: 'arm64',
      releaseBaseUrl: release.url,
      log: () => {},
    })

    expect(store.status().installed).toBe(false)
    expect(store.status().supported).toBe(true)
    expect(store.releaseUrl()).toContain('/server-v1.13.0-panel/')

    const status = await store.download()
    expect(status.installed).toBe(true)
    expect(status.binaryPath).toBeDefined()
    expect(readFileSync(status.binaryPath!, 'utf8')).toBe(BINARY.toString('utf8'))
    expect(store.resolveBinary()).toBe(status.binaryPath)
    expect((await store.verify()).error).toBeUndefined()
    expect(existsSync(join(root, 'current.json'))).toBe(true)
  })

  it('rejects a checksum mismatch and leaves no current binary', async () => {
    const release = await releaseServer(GZIP)
    servers.push(release.close)
    const root = mkdtempSync(join(tmpdir(), 'wb2g-server-'))
    const store = new ServerStore({
      rootDir: root,
      manifest: manifest('0'.repeat(64)),
      platform: 'darwin',
      arch: 'arm64',
      releaseBaseUrl: release.url,
      log: () => {},
    })
    await expect(store.download()).rejects.toBeInstanceOf(ServerChecksumError)
    const status = store.status()
    expect(status.installed).toBe(false)
    expect(status.download.state).toBe('failed')
    expect(status.error).toContain('checksum')
  })

  it('reports an unsupported platform without a download', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wb2g-server-'))
    const store = new ServerStore({
      rootDir: root,
      manifest: manifest(),
      platform: 'linux',
      arch: 's390x',
      log: () => {},
    })
    const status = store.status()
    expect(status.supported).toBe(false)
    expect(status.installed).toBe(false)
    await expect(store.download()).rejects.toBeInstanceOf(ServerUnsupportedPlatformError)
  })
})
