/**
 * The plugin's own glyph, drawn inline for the settings header.
 *
 * The settings navigation cannot show one: `settings.section` is projected to
 * `{ id, order, label }` and the label is resolved to plain text, so a section
 * row has no icon seat. The page's own header does, and that is where this goes —
 * the same topology as icon.svg, at 22px, in `currentColor` so it follows the
 * theme instead of pinning a blue that only works on one of them.
 *
 * @module dsh-workbuddy2api-gateway/client/glyph
 */

import type { ReactElement } from 'react'

/** The glyph. */
export function GatewayGlyph({ size = 22 }: { size?: number }): ReactElement {
  return (
    <svg
      className="cs-glyph"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        <path d="M256 232v44" />
        <path d="M256 276c0 42-40 60-74 82" />
        <path d="M256 276c0 42 40 60 74 82" />
      </g>
      <circle cx="256" cy="178" r="76" fill="currentColor" />
      <circle cx="150" cy="380" r="62" fill="currentColor" opacity="0.65" />
      <circle cx="362" cy="380" r="62" fill="currentColor" opacity="0.65" />
    </svg>
  )
}
