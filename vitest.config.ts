import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

/** Mirror the build-time define from tsdown.config.ts so tests see the same version. */
const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version as string

/**
 * Resolve a module to the double used in place of it.
 *
 * `@deepseek-ai/dsh-client-ui-primitives` is a PLATFORM SEED module: the browser
 * shell seeds it into the module table and satisfies its bare dependencies
 * (clsx, katex, shiki…). This repo has no shell, so importing the npm package
 * under vitest dies on the first bare specifier. The alias substitutes the
 * plugin's own double, which supplies the members the components use.
 */
const TEST_ALIASES: Record<string, string> = {
  '@deepseek-ai/dsh-client-ui-primitives': new URL('./tests/primitives-stub.tsx', import.meta.url).pathname,
}

export default defineConfig({
  define: {
    __DSH_WB2G_VERSION__: JSON.stringify(PACKAGE_VERSION),
  },
  resolve: {
    alias: TEST_ALIASES,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
})
