#!/usr/bin/env node
/**
 * Stamp server.json from the local development binary.
 *
 * This is a release-helper, not part of the installed package: it hashes
 * `bin/workbuddy2api` and writes the pinned manifest the panel reads. Other
 * platform entries already present in server.json are preserved.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const version = process.argv[2] ?? '1.14.0-panel'
const binary = new URL('../bin/workbuddy2api', import.meta.url)
if (!existsSync(binary)) {
  console.error('missing bin/workbuddy2api; build the gateway first')
  process.exit(1)
}
const bytes = readFileSync(binary)
const sha256 = createHash('sha256').update(bytes).digest('hex')
const size = statSync(binary).size
const downloadSize = gzipSync(bytes, { level: 9 }).length
const platform = process.platform
const arch = process.arch
const key = platform + '-' + arch
const asset = 'workbuddy2api-' + version + '-' + key + '.gz'
const path = new URL('../server.json', import.meta.url)

let existing = {}
if (existsSync(path)) {
  try {
    existing = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    existing = {}
  }
}
const sameVersion = typeof existing === 'object' && existing !== null && existing.version === version
const assets = {
  ...(sameVersion ? existing.assets ?? {} : {}),
  [key]: { asset, sha256, size, downloadSize },
}
const document = {
  schemaVersion: 1,
  version,
  apiVersion: 1,
  minPanel: '0.4.0',
  releaseTag: 'server-v' + version,
  releaseBaseUrl: 'https://github.com/functy23/dsh-workbuddy-panel/releases/download',
  assets,
}
writeFileSync(path, JSON.stringify(document, null, 2) + '\n', 'utf8')
console.log('server.json: ' + version + ' ' + key + ' sha256=' + sha256.slice(0, 16) + '… size=' + size + ' download=' + downloadSize)
