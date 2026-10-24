/**
 * The build-stamped package version, injected by `tsdown` at build time.
 *
 * Read through this module rather than a literal so the status document, the
 * settings page's version chip, and `package.json` cannot drift apart: the define
 * map in `tsdown.config.ts` reads the same manifest field.
 *
 * @module dsh-workbuddy2api-gateway/version
 */

/** `package.json`'s version, substituted at build time. */
declare const __DSH_WB2G_VERSION__: string

/** This build's version. */
export const WORKBUDDY2API_GATEWAY_VERSION: string =
  typeof __DSH_WB2G_VERSION__ === 'string' ? __DSH_WB2G_VERSION__ : '0.0.0-dev'
