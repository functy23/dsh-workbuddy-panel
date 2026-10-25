#!/usr/bin/env node
/**
 * Build the separately distributed server release.
 *
 * The panel package never contains this binary. This script cross-compiles the
 * upstream snapshot for the supported platform matrix, gzips each result, and
 * writes the pinned `server.json` the panel reads. It is a release tool, not a
 * runtime dependency.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const version = process.argv[2] ?? '1.13.0-panel'
const source = fileURLToPath(new URL('../upstream/workbuddy2api-panel', import.meta.url))
const dist = fileURLToPath(new URL('../dist', import.meta.url))
const targets = [
  { goos: 'darwin', goarch: 'arm64', key: 'darwin-arm64', ext: '' },
  { goos: 'darwin', goarch: 'amd64', key: 'darwin-x64', ext: '' },
  { goos: 'linux', goarch: 'amd64', key: 'linux-x64', ext: '' },
  { goos: 'linux', goarch: 'arm64', key: 'linux-arm64', ext: '' },
  { goos: 'win32', goarch: 'amd64', key: 'win32-x64', ext: '.exe' },
]
if (!existsSync(source)) {
  console.error('missing upstream/workbuddy2api-panel')
  process.exit(1)
}
mkdirSync(dist, { recursive: true })
const assets = {}
for (const target of targets) {
  const stem = 'workbuddy2api-' + version + '-' + target.key
  const raw = join(dist, stem + target.ext)
  const gz = join(dist, stem + '.gz')
  console.log('building ' + target.key)
  execFileSync('go', [
    'build',
    '-trimpath',
    '-ldflags',
    '-s -w',
    '-o',
    raw,
    './cmd/server',
  ], {
    cwd: source,
    stdio: 'inherit',
    env: {
      ...process.env,
      CGO_ENABLED: '0',
      GOOS: target.goos,
      GOARCH: target.goarch,
    },
  })
  const bytes = readFileSync(raw)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const compressed = gzipSync(bytes, { level: 9 })
  writeFileSync(gz, compressed)
  assets[target.key] = {
    asset: stem + '.gz',
    sha256,
    size: bytes.length,
    downloadSize: compressed.length,
  }
}
const manifest = {
  schemaVersion: 1,
  version,
  apiVersion: 1,
  minPanel: '0.4.0',
  releaseTag: 'server-v' + version,
  releaseBaseUrl: 'https://github.com/functy23/dsh-workbuddy-panel/releases/download',
  assets,
}
writeFileSync(new URL('../server.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log('wrote server.json with ' + Object.keys(assets).length + ' assets')
