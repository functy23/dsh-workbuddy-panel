import { readFileSync } from 'node:fs'
import type { UserConfig } from 'tsdown'

/**
 * This package's own manifest, read once.
 *
 * The browser module identity is not a free choice: the host keys every browser
 * module by the *resolved manifest's package name*, so an id that no longer
 * equals `name` leaves the client half failing to activate. Deriving it makes
 * that class of rename impossible.
 */
const MANIFEST = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { name: string, version: string }

/** Browser module identity; must equal the package name. */
const PLUGIN_ID = MANIFEST.name

/** Build-time define map; `src/version.ts` reads `__DSH_WB2G_VERSION__`. */
const VERSION_DEFINE = { __DSH_WB2G_VERSION__: JSON.stringify(MANIFEST.version) }

/**
 * Modules the host loader provides, kept out of the browser bundle.
 *
 * `dsh-client-ui-primitives` is a platform seed module that ships its own CSS
 * modules: bundling it would duplicate those stylesheets and give the page a
 * second set of component identities.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-locale/client',
] as const

export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    define: VERSION_DEFINE,
    deps: {
      neverBundle: [
        '@earendil-works/pi-ai',
        '@deepseek-ai/schemastery',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-attachment',
        '@deepseek-ai/dsh-home-paths',
        '@deepseek-ai/dsh-host-webserver',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-llm-pi-ai',
        '@deepseek-ai/dsh-settings',
      ],
    },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: false,
    clean: false,
    define: VERSION_DEFINE,
    deps: { neverBundle: [...CLIENT_EXTERNALS] },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
