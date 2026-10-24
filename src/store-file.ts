/**
 * Atomic JSON store I/O shared by every plugin-owned document.
 *
 * Reads degrade to `undefined` on any defect (absent, unreadable, not JSON,
 * wrong format version) because every caller reacts the same way: fall back to
 * what it can serve without the file.
 *
 * Writes replace the document in one atomic step: a per-write random temp name
 * opened exclusively (so two processes cannot truncate each other), mode 0600
 * on the fresh inode, and a rename that stays on one filesystem.
 *
 * @module dsh-workbuddy2api-connect/store-file
 */

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseJsonObject } from './json-value.ts'

/** Read a version-matched store document and pick the caller's value out of it. */
export function readStoreDocument<T>(
  path: string,
  version: number,
  pick: (document: Record<string, unknown>) => T | undefined,
): T | undefined {
  if (!existsSync(path)) return undefined
  try {
    const document = parseJsonObject(readFileSync(path, 'utf8'))
    if (document === undefined || document['version'] !== version) return undefined
    return pick(document)
  } catch {
    return undefined
  }
}

/** Replace a store document atomically. */
export function writeStoreDocument(path: string, document: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = resolve(`${path}.${randomBytes(6).toString('hex')}.tmp`)
  writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  renameSync(temporary, path)
}
