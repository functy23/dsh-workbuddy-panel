#!/usr/bin/env node
/**
 * Install the local development binary into the verified server cache.
 *
 * Production installs download and verify the release asset. This helper is for
 * a developer checkout: it copies `bin/workbuddy2api` into the same cache
 * layout, after checking it against `server.json`, so the host row can start it
 * without network access.
 */
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'), 'workbuddy2api-gateway', 'server')
const manifestPath = fileURLToPath(new URL('../server.json', import.meta.url))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const key = process.platform + '-' + process.arch
const asset = manifest.assets?.[key]
if (asset === undefined) {
  console.error('server.json has no asset for ' + key)
  process.exit(1)
}
const source = fileURLToPath(new URL('../bin/workbuddy2api', import.meta.url))
if (!existsSync(source)) {
  console.error('missing bin/workbuddy2api')
  process.exit(1)
}
const bytes = readFileSync(source)
const sha256 = createHash('sha256').update(bytes).digest('hex')
if (sha256 !== asset.sha256 || bytes.length !== asset.size) {
  console.error('bin/workbuddy2api does not match server.json; run pnpm run server:manifest first')
  process.exit(1)
}
const targetDir = join(root, manifest.version, key)
const target = join(targetDir, process.platform === 'win32' ? 'workbuddy2api.exe' : 'workbuddy2api')
mkdirSync(targetDir, { recursive: true, mode: 0o700 })
copyFileSync(source, target)
if (process.platform !== 'win32') chmodSync(target, 0o755)
const record = {
  version: manifest.version,
  platform: process.platform,
  arch: process.arch,
  binary: target,
  sha256,
  size: bytes.length,
  installedAt: new Date().toISOString(),
}
for (const path of [join(targetDir, 'installed.json'), join(root, 'current.json')]) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 })
}
console.log('installed ' + manifest.version + ' at ' + target)
