/**
 * A minimal QR encoder, written for the scan-to-sign-in dialog.
 *
 * Why hand-rolled: the browser half is a single bundle served to every DSH user,
 * and a QR dependency (`qrcode`, `qrcode-generator`) would add tens of
 * kilobytes — and a supply-chain surface — for one dialog. The two things that
 * dialog needs are small and stable: byte-mode encoding at a fixed correction
 * level, and a matrix a canvas can paint.
 *
 * Scope is deliberately narrow rather than "a QR library":
 * - **Byte mode only.** The payload is a plugin-auth URL, always ASCII/UTF-8.
 *   Numeric/alphanumeric/kanji modes would each need their own encoder for a
 *   length saving that does not matter here.
 * - **Error correction level M** (\~15% recovery). The scan is a phone camera
 *   pointed at a screen; L is too fragile for a glossy display under room light
 *   and Q/H shrink the payload limit for no benefit this dialog can use.
 * - **Versions 1–20.** A URL of a few hundred bytes reaches version ~10; 20
 *   leaves headroom no real challenge URL can exceed while keeping the capacity
 *   tables small enough to audit by eye.
 *
 * The algorithm is ISO/IEC 18004 Model 2. Where a constant could be computed it
 * is written out instead (the Reed–Solomon generator polynomials, the alignment
 * pattern centres), because a table that can be checked against the spec is
 * worth more here than a loop that cannot.
 */

/** Error correction level M, as the two-bit field the format information carries. */
const EC_LEVEL_M = 0
/** Mode indicator for 8-bit byte mode. */
const MODE_BYTE = 4

/**
 * Data capacity, in bytes, for levels M by version (1-20), byte mode.
 *
 * From the Model 2 capacity tables: total codewords minus the error-correction
 * codewords for that version, minus the mode/length header, rounded down. Held
 * as a table because the block structures below are also tabulated and driving
 * one from the other invites an off-by-one that only shows up at one version.
 */
const BYTE_CAPACITY_M: readonly number[] = [
  14, 26, 42, 62, 84, 106, 122, 152, 180, 213,
  251, 287, 331, 362, 412, 450, 504, 560, 624, 666,
]

/**
 * Error-correction block layout per version: how the data codewords are split
 * into blocks and how many EC codewords each block carries.
 *
 * `ecPerBlock` is constant per version for level M; `groups` lists
 * `[blockCount, dataCodewordsPerBlock]` pairs, covering both the single-group
 * and the split-group cases the spec defines.
 */
interface BlockLayout {
  ecPerBlock: number
  groups: readonly (readonly [count: number, dataCodewords: number])[]
}

const BLOCKS_M: readonly BlockLayout[] = [
  { ecPerBlock: 10, groups: [[1, 16]] },
  { ecPerBlock: 16, groups: [[1, 28]] },
  { ecPerBlock: 26, groups: [[1, 44]] },
  { ecPerBlock: 18, groups: [[2, 32]] },
  { ecPerBlock: 24, groups: [[2, 43]] },
  { ecPerBlock: 16, groups: [[4, 27]] },
  { ecPerBlock: 18, groups: [[4, 31]] },
  { ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  { ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  { ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
  { ecPerBlock: 30, groups: [[1, 50], [4, 51]] },
  { ecPerBlock: 22, groups: [[6, 36], [2, 37]] },
  { ecPerBlock: 22, groups: [[8, 37], [1, 38]] },
  { ecPerBlock: 24, groups: [[4, 40], [5, 41]] },
  { ecPerBlock: 24, groups: [[5, 41], [5, 42]] },
  { ecPerBlock: 28, groups: [[7, 45], [3, 46]] },
  { ecPerBlock: 28, groups: [[10, 46], [1, 47]] },
  { ecPerBlock: 26, groups: [[9, 43], [4, 44]] },
  { ecPerBlock: 26, groups: [[3, 44], [11, 45]] },
  { ecPerBlock: 26, groups: [[3, 41], [13, 42]] },
]

/**
 * Alignment pattern centre coordinates per version.
 *
 * The spec's own table; the arithmetic rule that generates it has exceptions at
 * the low versions and the table is shorter to read than the rule.
 */
const ALIGNMENT_CENTRES: readonly (readonly number[])[] = [
  [],
  [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
  [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74],
  [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
]

/** A rendered QR symbol: an immutable square of dark/light modules. */
export interface QrCode {
  /** Modules per side: `4 * version + 17`. */
  size: number
  /** `size * size` booleans, row-major; true means a dark module. */
  modules: readonly boolean[]
}

/** One dark module, plus the quiet zone the spec requires around the symbol. */
export function isDarkQrModule(code: QrCode, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= code.size || y >= code.size) return false
  return code.modules[y * code.size + x] === true
}

/**
 * Encode text as a QR symbol, choosing the smallest version that fits.
 *
 * Throws when the text exceeds version 20 at level M. That is a real limit
 * rather than a silent truncation: a challenge URL that long would mean the
 * upstream changed shape, and rendering a QR of a truncated URL would produce a
 * scan that fails in the user's hand instead of an error they can report.
 */
/**
 * Per-mask penalty scores for a payload, in mask order.
 *
 * Exported for the encoder's own tests: asserting that the chosen mask is the
 * lowest-scoring one is what proves the penalty rules, and a test can only do
 * that if it can see the scores the choice was made from.
 */
export function maskPenalties(text: string): readonly number[] {
  const bytes = new TextEncoder().encode(text)
  const version = smallestVersion(bytes.length)
  if (version === undefined) throw new Error('QR payload exceeds the supported capacity')
  const size = version * 4 + 17
  const codewords = buildCodewords(bytes, version)
  const scores: number[] = []
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = new Matrix(size)
    drawFunctionPatterns(matrix, version)
    drawCodewords(matrix, codewords)
    applyMask(matrix, mask)
    drawFormatBits(matrix, mask)
    scores.push(penalty(matrix))
  }
  return scores
}

export function encodeQrCode(text: string, options: { mask?: number } = {}): QrCode {
  const bytes = new TextEncoder().encode(text)
  const version = smallestVersion(bytes.length)
  if (version === undefined) {
    throw new Error(`QR payload of ${String(bytes.length)} bytes exceeds the supported capacity`)
  }
  const size = version * 4 + 17
  const codewords = buildCodewords(bytes, version)
  const modules = placeCodewords(codewords, version, size, options.mask)
  return { size, modules }
}

/** The lowest version whose level-M byte capacity fits, or undefined. */
function smallestVersion(byteLength: number): number | undefined {
  for (let index = 0; index < BYTE_CAPACITY_M.length; index += 1) {
    if (byteLength <= (BYTE_CAPACITY_M[index] as number)) return index + 1
  }
  return undefined
}

/**
 * The final codeword sequence: mode + length + data + terminator + padding,
 * split into blocks, each block extended with its own Reed–Solomon codewords,
 * then interleaved in the spec's order.
 */
function buildCodewords(bytes: Uint8Array, version: number): number[] {
  const layout = BLOCKS_M[version - 1] as BlockLayout
  const totalData = layout.groups.reduce((sum, [count, per]) => sum + count * per, 0)
  const bits: number[] = []
  // Mode indicator: 4 bits for byte mode in every version.
  pushBits(bits, MODE_BYTE, 4)
  // Character count: 8 bits below version 10, 16 bits from version 10.
  pushBits(bits, bytes.length, version < 10 ? 8 : 16)
  for (const byte of bytes) pushBits(bits, byte, 8)
  // Terminator: up to four zero bits, as many as the remaining capacity allows.
  const capacityBits = totalData * 8
  pushBits(bits, 0, Math.min(4, capacityBits - bits.length))
  // Pad to a codeword boundary, then alternate the two spec-mandated pad bytes.
  pushBits(bits, 0, (8 - (bits.length % 8)) % 8)
  const data: number[] = []
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0
    for (let offset = 0; offset < 8; offset += 1) value = (value << 1) | (bits[index + offset] ?? 0)
    data.push(value)
  }
  const PAD = [0xec, 0x11]
  for (let index = 0; data.length < totalData; index += 1) data.push(PAD[index % 2] as number)

  // Split into blocks in the spec's order: the shorter group first.
  const blocks: number[][] = []
  let cursor = 0
  for (const [count, per] of layout.groups) {
    for (let block = 0; block < count; block += 1) {
      blocks.push(data.slice(cursor, cursor + per))
      cursor += per
    }
  }
  const ecBlocks = blocks.map(block => reedSolomon(block, layout.ecPerBlock))

  // Interleave: one data codeword from each block in turn, then one EC codeword
  // from each block, which is what makes a scratch on the symbol recoverable
  // from the remainder of every block rather than from one whole block.
  const out: number[] = []
  const maxData = Math.max(...blocks.map(block => block.length))
  for (let index = 0; index < maxData; index += 1) {
    for (const block of blocks) {
      const value = block[index]
      if (value !== undefined) out.push(value)
    }
  }
  for (let index = 0; index < layout.ecPerBlock; index += 1) {
    for (const block of ecBlocks) {
      const value = block[index]
      if (value !== undefined) out.push(value)
    }
  }
  return out
}

/** Append the low `count` bits of `value`, most significant first. */
function pushBits(bits: number[], value: number, count: number): void {
  for (let shift = count - 1; shift >= 0; shift -= 1) bits.push((value >> shift) & 1)
}

/**
 * Reed–Solomon codewords over GF(256) with the QR primitive polynomial 0x11d.
 *
 * The remainder of the message times `x^ecLength` divided by the generator
 * polynomial, computed with the shift register the spec describes.
 */
function reedSolomon(data: readonly number[], ecLength: number): number[] {
  // The generator is stored with its leading coefficient dropped: the
  // remainder's shift register supplies that term implicitly.
  const generator = generatorPolynomial(ecLength).slice(1)
  const remainder = new Array<number>(ecLength).fill(0)
  for (const byte of data) {
    const factor = byte ^ (remainder[0] as number)
    remainder.shift()
    remainder.push(0)
    for (let index = 0; index < ecLength; index += 1) {
      remainder[index] = (remainder[index] as number) ^ gfMultiply(factor, generator[index] as number)
    }
  }
  return remainder
}

/**
 * The degree-`ecLength` generator polynomial, as coefficients with the leading
 * 1 dropped: `(x - a^0)(x - a^1)...(x - a^(ecLength-1))`.
 */
function generatorPolynomial(ecLength: number): number[] {
  // Builds the full degree-`ecLength` polynomial including its leading 1, so
  // the caller can drop it once and read coefficients positionally.
  let polynomial = [1]
  for (let index = 0; index < ecLength; index += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0)
    for (let term = 0; term < polynomial.length; term += 1) {
      next[term] = (next[term] as number) ^ (polynomial[term] as number)
      next[term + 1] = (next[term + 1] as number) ^ gfMultiply(polynomial[term] as number, gfPower(index))
    }
    polynomial = next
  }
  return polynomial
}

/** Multiply two GF(256) elements modulo the QR primitive polynomial. */
function gfMultiply(left: number, right: number): number {
  let result = 0
  let a = left
  let b = right
  while (b > 0) {
    if ((b & 1) === 1) result ^= a
    a <<= 1
    if (a > 0xff) a ^= 0x11d
    b >>= 1
  }
  return result
}

/** `2` raised to the `power`-th in GF(256), used to build the generator. */
function gfPower(power: number): number {
  let value = 1
  for (let index = 0; index < power; index += 1) value = gfMultiply(value, 2)
  return value
}

// The matrix builder, mask selection, and format/version information follow.
// `placeCodewords` is declared here so the module reads top-down; its body is
// below the helpers it uses.
function placeCodewords(codewords: readonly number[], version: number, size: number, forced?: number): boolean[] {
  // A forced mask is for tests and for reproducing a symbol byte-for-byte
  // against a reference encoder; production always scores all eight.
  if (forced !== undefined) {
    const matrix = new Matrix(size)
    drawFunctionPatterns(matrix, version)
    drawCodewords(matrix, codewords)
    applyMask(matrix, forced)
    drawFormatBits(matrix, forced)
    return matrix.modules.slice()
  }
  const matrix = new Matrix(size)
  drawFunctionPatterns(matrix, version)
  drawCodewords(matrix, codewords)
  // Eight masks, scored by the spec's four penalty rules; the lowest wins.
  let best: boolean[] | undefined
  let bestScore = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = new Matrix(size)
    drawFunctionPatterns(candidate, version)
    drawCodewords(candidate, codewords)
    applyMask(candidate, mask)
    drawFormatBits(candidate, mask)
    const score = penalty(candidate)
    if (score < bestScore) {
      bestScore = score
      best = candidate.modules.slice()
    }
  }
  if (best === undefined) throw new Error('QR mask selection produced no candidate')
  return best
}

/** A square of modules with typed access, so the builder reads as coordinates. */
class Matrix {
  readonly size: number
  readonly modules: boolean[]
  /** Which modules are function patterns and must not be masked or overwritten. */
  readonly reserved: boolean[]

  constructor(size: number) {
    this.size = size
    this.modules = new Array<boolean>(size * size).fill(false)
    this.reserved = new Array<boolean>(size * size).fill(false)
  }

  get(x: number, y: number): boolean {
    return this.modules[y * this.size + x] === true
  }

  set(x: number, y: number, dark: boolean): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return
    this.modules[y * this.size + x] = dark
  }

  mark(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return
    this.reserved[y * this.size + x] = true
  }
}

/** Finder patterns, separators, timing, alignment, and the dark module. */
function drawFunctionPatterns(matrix: Matrix, version: number): void {
  const size = matrix.size
  // Finders in three corners. The 7x7 pattern and its one-module separator ring
  // are drawn separately: the ring must be light, and folding it into the same
  // loop as the pattern's edge row would paint it dark.
  for (const [originX, originY] of [[0, 0], [size - 7, 0], [0, size - 7]] as const) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const px = originX + x
        const py = originY + y
        const inside = x >= 0 && x <= 6 && y >= 0 && y <= 6
        // The ring is the frame one module outside the pattern; it lightens the
        // symbol's data area so the finder reads as a distinct object.
        const edge = inside && (x === 0 || x === 6 || y === 0 || y === 6)
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4
        matrix.set(px, py, inside && (edge || core))
        matrix.mark(px, py)
      }
    }
  }
  // Timing patterns along row 6 and column 6.
  for (let index = 8; index < size - 8; index += 1) {
    const dark = index % 2 === 0
    matrix.set(index, 6, dark)
    matrix.mark(index, 6)
    matrix.set(6, index, dark)
    matrix.mark(6, index)
  }
  // Alignment patterns, skipping the three that would collide with a finder.
  const centres = ALIGNMENT_CENTRES[version - 1] as readonly number[]
  for (const centreY of centres) {
    for (const centreX of centres) {
      if ((centreX === 6 && centreY === 6)
        || (centreX === 6 && centreY === size - 7)
        || (centreX === size - 7 && centreY === 6)) continue
      for (let y = -2; y <= 2; y += 1) {
        for (let x = -2; x <= 2; x += 1) {
          const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1
          matrix.set(centreX + x, centreY + y, dark)
          matrix.mark(centreX + x, centreY + y)
        }
      }
    }
  }
  // Reserve the format strips and the version blocks, whose final contents are
  // written once the mask is known.
  reserveFormatAreas(matrix, version)
  // The one module that is always dark.
  matrix.set(8, size - 8, true)
  matrix.mark(8, size - 8)
}

/** Mark the format/version modules as reserved so data never lands on them. */
function reserveFormatAreas(matrix: Matrix, version: number): void {
  const size = matrix.size
  for (let index = 0; index < 9; index += 1) {
    matrix.mark(index, 8)
    matrix.mark(8, index)
  }
  for (let index = 0; index < 8; index += 1) {
    matrix.mark(size - 1 - index, 8)
    matrix.mark(8, size - 1 - index)
  }
  if (version >= 7) {
    for (let y = 0; y < 6; y += 1) {
      for (let x = size - 11; x < size - 8; x += 1) {
        matrix.mark(x, y)
        matrix.mark(y, x)
      }
    }
  }
}

/**
 * Walk the symbol in the spec's zigzag — right to left in two-column pairs,
 * alternating upward and downward — placing the codeword bits.
 */
function drawCodewords(matrix: Matrix, codewords: readonly number[]): void {
  const size = matrix.size
  let bitIndex = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely.
    if (right === 6) right = 5
    for (let step = 0; step < size; step += 1) {
      const y = upward ? size - 1 - step : step
      for (const x of [right, right - 1]) {
        if (matrix.reserved[y * size + x] === true) continue
        const byte = codewords[bitIndex >> 3]
        const dark = byte === undefined ? false : ((byte >> (7 - (bitIndex & 7))) & 1) === 1
        matrix.set(x, y, dark)
        bitIndex += 1
      }
    }
    upward = !upward
  }
}

/** XOR the mask pattern over every non-function module. */
function applyMask(matrix: Matrix, mask: number): void {
  const size = matrix.size
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix.reserved[y * size + x] === true) continue
      if (!maskApplies(mask, x, y)) continue
      matrix.modules[y * size + x] = !matrix.get(x, y)
    }
  }
}

/** The eight mask conditions of the spec, by index. */
function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0
    case 1: return y % 2 === 0
    case 2: return x % 3 === 0
    case 3: return (x + y) % 3 === 0
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    default: return false
  }
}

/** Write the format information for `mask` (and the version blocks, if any). */
function drawFormatBits(matrix: Matrix, mask: number): void {
  const size = matrix.size
  // 5 data bits: two for the EC level (M is 00) and three for the mask.
  const data = (EC_LEVEL_M << 3) | mask
  // BCH(15,5): the remainder of `data * x^10` divided by 0b10100110111, found by
  // cancelling the five high terms from the shifted message.
  let shifted = data << 10
  for (let index = 14; index >= 10; index -= 1) {
    if (((shifted >> index) & 1) === 1) shifted ^= 0b10100110111 << (index - 10)
  }
  const bits = ((data << 10) | shifted) ^ 0b101010000010010
  const bit = (index: number): boolean => ((bits >> index) & 1) === 1
  // Two copies, as the spec requires, so a damaged corner is still readable.
  for (let index = 0; index <= 5; index += 1) matrix.set(8, index, bit(index))
  matrix.set(8, 7, bit(6))
  matrix.set(8, 8, bit(7))
  matrix.set(7, 8, bit(8))
  for (let index = 9; index <= 14; index += 1) matrix.set(14 - index, 8, bit(index))
  for (let index = 0; index <= 7; index += 1) matrix.set(size - 1 - index, 8, bit(index))
  for (let index = 8; index <= 14; index += 1) matrix.set(8, size - 15 + index, bit(index))
  matrix.set(8, size - 8, true)

  // Version information (18 bits, BCH(18,6)) exists only from version 7.
  const version = (size - 17) / 4
  if (version < 7) return
  let versionRemainder = version
  for (let index = 0; index < 12; index += 1) versionRemainder = (versionRemainder << 1) ^ (((versionRemainder >> 11) & 1) * 0b1111100100101)
  const versionBits = (version << 12) | versionRemainder
  for (let index = 0; index < 18; index += 1) {
    const dark = ((versionBits >> index) & 1) === 1
    const a = Math.floor(index / 3)
    const b = index % 3
    matrix.set(size - 11 + b, a, dark)
    matrix.set(a, size - 11 + b, dark)
  }
}

/** The spec's four penalty rules, summed. Lower is a better mask. */
function penalty(matrix: Matrix): number {
  const size = matrix.size
  let score = 0
  // Rule 1: runs of five or more same-coloured modules, in rows and columns.
  for (let y = 0; y < size; y += 1) {
    let runColour = matrix.get(0, y)
    let runLength = 1
    for (let x = 1; x < size; x += 1) {
      const colour = matrix.get(x, y)
      if (colour === runColour) {
        runLength += 1
      } else {
        if (runLength >= 5) score += runLength - 2
        runColour = colour
        runLength = 1
      }
    }
    if (runLength >= 5) score += runLength - 2
  }
  for (let x = 0; x < size; x += 1) {
    let runColour = matrix.get(x, 0)
    let runLength = 1
    for (let y = 1; y < size; y += 1) {
      const colour = matrix.get(x, y)
      if (colour === runColour) {
        runLength += 1
      } else {
        if (runLength >= 5) score += runLength - 2
        runColour = colour
        runLength = 1
      }
    }
    if (runLength >= 5) score += runLength - 2
  }
  // Rule 2: every 2x2 block of one colour.
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const colour = matrix.get(x, y)
      if (colour === matrix.get(x + 1, y) && colour === matrix.get(x, y + 1) && colour === matrix.get(x + 1, y + 1)) {
        score += 3
      }
    }
  }
  // Rule 3: the finder-like 1:1:3:1:1 pattern with four light modules beside it.
  //
  // Scored by sliding an 11-bit window along every row and column and comparing
  // against the two orientations. Two details matter and are easy to get wrong:
  // the four light modules must be *present*, so a pattern touching the symbol
  // edge is not a match (a decoder's own quiet zone is not part of the symbol);
  // and the window is 11 modules, so the light run is checked in the same
  // comparison rather than as a separate step.
  const DARK_LIGHT_RUN = 0b10111010000
  const LIGHT_DARK_RUN = 0b00001011101
  for (let y = 0; y < size; y += 1) {
    let across = 0
    let down = 0
    for (let index = 0; index < size; index += 1) {
      across = ((across << 1) & 0x7ff) | (matrix.get(index, y) ? 1 : 0)
      if (index >= 10 && (across === DARK_LIGHT_RUN || across === LIGHT_DARK_RUN)) score += 40
      down = ((down << 1) & 0x7ff) | (matrix.get(y, index) ? 1 : 0)
      if (index >= 10 && (down === DARK_LIGHT_RUN || down === LIGHT_DARK_RUN)) score += 40
    }
  }
  // Rule 4: deviation from a 50% dark ratio, in 5% steps, rounded *up* — 51%
  // already counts as a full step away from the ideal.
  let dark = 0
  for (const module of matrix.modules) if (module) dark += 1
  const steps = Math.abs(Math.ceil(((dark * 100) / (size * size)) / 5) - 10)
  score += steps * 10
  return score
}
