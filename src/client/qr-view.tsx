/**
 * The dialog's QR symbol: a matrix from `encodeQrCode` painted as one path.
 *
 * One `<path>` instead of `size*size` rectangles: a version-10 symbol is ~57x57,
 * and a few thousand DOM nodes for one dialog is a cost the browser pays on every
 * keystroke elsewhere on the page. Adjacent modules merge into horizontal runs
 * because SVG fills are expensive per subpath, not per glyph.
 *
 * The frame is white and square whatever the theme: a scanner needs contrast, and
 * a QR drawn in the page's dark palette does not scan.
 *
 * @module dsh-workbuddy2api-gateway/client/qr-view
 */

import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { encodeQrCode, isDarkQrModule } from './qr-code.ts'

/** Props. */
export interface QrViewProps {
  /** The payload, normally a sign-in URL. */
  value: string
  /** Rendered edge length in CSS pixels. */
  size?: number
}

/** The quiet zone the spec asks for, in modules. */
const QUIET = 4

/** Render one QR symbol, or nothing when the payload cannot be encoded. */
export function QrView({ value, size = 176 }: QrViewProps): ReactElement | null {
  const code = useMemo(() => {
    try {
      return encodeQrCode(value)
    } catch {
      return undefined
    }
  }, [value])

  const path = useMemo(() => {
    if (code === undefined) return ''
    const runs: string[] = []
    for (let y = 0; y < code.size; y += 1) {
      let x = 0
      while (x < code.size) {
        if (!isDarkQrModule(code, x, y)) {
          x += 1
          continue
        }
        let width = 1
        while (x + width < code.size && isDarkQrModule(code, x + width, y)) width += 1
        runs.push('M' + String(x + QUIET) + ' ' + String(y + QUIET) + 'h' + String(width) + 'v1h-' + String(width) + 'z')
        x += width
      }
    }
    return runs.join('')
  }, [code])

  if (code === undefined || path === '') return null
  const total = code.size + QUIET * 2
  return (
    <div className="wb2-qrFrame">
      <svg
        width={size}
        height={size}
        viewBox={'0 0 ' + String(total) + ' ' + String(total)}
        shapeRendering="crispEdges"
        role="img"
        aria-label="QR"
      >
        <rect width={total} height={total} fill="#ffffff" />
        <path d={path} fill="#141413" />
      </svg>
    </div>
  )
}
