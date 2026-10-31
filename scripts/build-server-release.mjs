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

const version = process.argv[2] ?? '1.14.0-panel'
const source = fileURLToPath(new URL('../upstream/workbuddy2api-panel', import.meta.url))
const dist = fileURLToPath(new URL('../dist', import.meta.url))
const targets = [
  { goos: 'darwin', goarch: 'arm64', key: 'darwin-arm64', ext: '' },
  { goos: 'darwin', goarch: 'amd64', key: 'darwin-x64', ext: '' },
  { goos: 'linux', goarch: 'amd64', key: 'linux-x64', ext: '' },
  { goos: 'linux', goarch: 'arm64', key: 'linux-arm64', ext: '' },
  // 注意 goos 是 Go 的取值（windows），key 是 Node/面板侧的 platform 名（win32）；
  // 两者不同源，写成 goos:'win32' 会让 go build 直接报 unsupported GOOS/GOARCH pair。
  { goos: 'windows', goarch: 'amd64', key: 'win32-x64', ext: '.exe' },
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
    // -X main.appVersion: the manifest and the running binary must agree, or the
    // panel's overview reports a version nobody released.
    '-s -w -X main.appVersion=' + version,
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
const document = JSON.stringify(manifest, null, 2) + '\n'
writeFileSync(new URL('../server.json', import.meta.url), document, 'utf8')
// Two copies leave this directory, and they are not the same thing:
//   dist/server.json            → asset of THIS release (audit trail per version)
//   server-channel/server.json  → the fixed-URL channel document the panel reads.
// The channel document is a release asset on the permanent tag `server-channel`;
// overwriting it in place is what makes discovery version-free and API-free.
writeFileSync(join(dist, 'server.json'), document, 'utf8')
console.log('wrote server.json with ' + Object.keys(assets).length + ' assets')
console.log('')
console.log('1) publish the versioned release:')
console.log('  gh release create server-v' + version + ' dist/workbuddy2api-' + version + '-*.gz dist/server.json ...')
console.log('2) overwrite the fixed channel document (same URL for every version):')
console.log('  gh release upload server-channel dist/server.json --clobber')
console.log('   → ' + manifest.releaseBaseUrl + '/server-channel/server.json')