/**
 * The separation invariant: only the host gateway row may run a child process,
 * and even that row uses `ctx.subprocess` rather than `node:child_process`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function filesUnder(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? filesUnder(child) : [child]
  })
}

describe('panel / kernel separation', () => {
  it('never imports node:child_process', () => {
    const offenders = filesUnder('src')
      .filter(file => /\.(?:ts|tsx)$/u.test(file))
      .filter(file => /from\s+['"]node:child_process['"]/u.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
