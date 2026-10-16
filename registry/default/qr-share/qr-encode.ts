// Bollard UI — qr-share · MIT licence · https://bollard-ui.vercel.app/components/qr-share

/**
 * A small, dependency-free QR Code encoder (ISO/IEC 18004): byte mode, error
 * correction level M, versions 1–40, automatic mask choice. Also a reader that
 * decodes a matrix back to text, so callers can prove nothing was truncated.
 */

/** Error-correction codewords per block and number of blocks at level M, indexed by version. */
const EC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
/** Level M in the format information is 0b00. */
const ECL_BITS = 0

export interface QrCode {
  version: number
  /** Modules per side (21 for version 1). */
  size: number
  /** 0–7. */
  mask: number
  /** `modules[y][x]` is true for a dark module. */
  modules: boolean[][]
}

/** Codeword-capable modules once function patterns are removed. */
function rawModules(version: number) {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

const dataCodewords = (version: number) => Math.floor(rawModules(version) / 8) - EC_PER_BLOCK[version] * BLOCKS[version]

/** Largest UTF-8 payload in bytes that fits at level M for a version. */
export const byteCapacity = (version: number) => dataCodewords(version) - (version < 10 ? 2 : 3)

function alignmentPositions(version: number) {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
  const result = [6]
  for (let pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos)
  return result
}

/* Reed–Solomon over GF(256) with the 0x11D polynomial. */
function multiply(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number) {
  const result = Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = multiply(root, 2)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]) {
  const result = divisor.map(() => 0)
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= multiply(coef, factor)))
  }
  return result
}

/** Splits data into blocks (short blocks first) and returns each with its EC bytes. */
function blockLayout(version: number) {
  const count = BLOCKS[version]
  const ec = EC_PER_BLOCK[version]
  const raw = Math.floor(rawModules(version) / 8)
  const shortBlocks = count - (raw % count)
  const shortLen = Math.floor(raw / count) - ec
  return Array.from({ length: count }, (_, i) => shortLen + (i < shortBlocks ? 0 : 1))
}

const BCH = (data: number, poly: number, bits: number) => {
  let rem = data
  for (let i = 0; i < bits; i++) rem = (rem << 1) ^ ((rem >>> (bits - 1)) * poly)
  return (data << bits) | rem
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

/** Draws finders, timing, alignment and version info; returns the grid and which cells are reserved. */
function functionPatterns(version: number) {
  const size = version * 4 + 17
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const set = (x: number, y: number, dark: boolean) => {
    grid[y][x] = dark
    reserved[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4)
      }
  }
  const align = alignmentPositions(version)
  align.forEach((ay, i) =>
    align.forEach((ax, j) => {
      const corner = (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)
      if (corner) return
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }),
  )
  // Format areas are reserved now and written once the mask is known.
  for (let i = 0; i < 9; i++) {
    if (i !== 6) set(8, i, false)
    if (i !== 6) set(i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    set(size - 1 - i, 8, false)
    set(8, size - 1 - i, false)
  }
  set(8, size - 8, true)
  if (version >= 7) {
    const bits = BCH(version, 0x1f25, 12)
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(a, b, dark)
      set(b, a, dark)
    }
  }
  return { size, grid, reserved }
}

/** The 15 format-information cells in reading order for both copies. */
function formatCells(size: number) {
  const first: [number, number][] = []
  const second: [number, number][] = []
  for (let i = 0; i <= 5; i++) first.push([8, i])
  first.push([8, 7], [8, 8], [7, 8])
  for (let i = 9; i < 15; i++) first.push([14 - i, 8])
  for (let i = 0; i < 8; i++) second.push([size - 1 - i, 8])
  for (let i = 8; i < 15; i++) second.push([8, size - 15 + i])
  return { first, second }
}

/** Data cells in the standard zigzag order (two columns at a time, bottom-right first). */
function dataCells(size: number, reserved: boolean[][]) {
  const cells: [number, number][] = []
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let v = 0; v < size; v++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - v : v
        if (!reserved[y][x]) cells.push([x, y])
      }
    }
  }
  return cells
}

function penalty(m: boolean[][]) {
  const size = m.length
  let score = 0
  const lines = [...m, ...m[0].map((_, x) => m.map((row) => row[x]))]
  for (const line of lines) {
    let run = 1
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
    const s = line.map((d) => (d ? "1" : "0")).join("")
    score += 40 * ((s.match(/(?=10111010000|00001011101)/g) ?? []).length)
  }
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x]
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3
    }
  const dark = m.flat().filter(Boolean).length
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10
  return score
}

/** Encodes `text` as UTF-8 bytes. Throws when it is longer than a version-40 code holds. */
export function encodeQr(text: string): QrCode {
  const bytes = Array.from(new TextEncoder().encode(text))
  let version = 1
  while (version <= 40 && bytes.length > byteCapacity(version)) version++
  if (version > 40) throw new RangeError(`Too long for a QR code: ${bytes.length} bytes (max ${byteCapacity(40)}).`)

  const capacity = dataCodewords(version) * 8
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version < 10 ? 8 : 16)
  bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, capacity - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8)
  const data = Array.from({ length: bits.length / 8 }, (_, i) => bits.slice(i * 8, i * 8 + 8).reduce((a, b) => (a << 1) | b, 0))

  const divisor = rsDivisor(EC_PER_BLOCK[version])
  let offset = 0
  const blocks = blockLayout(version).map((len) => {
    const chunk = data.slice(offset, (offset += len))
    return { data: chunk, ec: rsRemainder(chunk, divisor) }
  })
  const codewords: number[] = []
  const longest = Math.max(...blocks.map((b) => b.data.length))
  for (let i = 0; i < longest; i++) blocks.forEach((b) => i < b.data.length && codewords.push(b.data[i]))
  for (let i = 0; i < divisor.length; i++) blocks.forEach((b) => codewords.push(b.ec[i]))

  const { size, grid, reserved } = functionPatterns(version)
  const cells = dataCells(size, reserved)
  const base = grid.map((row) => [...row])
  cells.forEach(([x, y], i) => (base[y][x] = i < codewords.length * 8 && ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1))

  let best: QrCode | null = null
  let bestScore = Infinity
  MASKS.forEach((fn, mask) => {
    const modules = base.map((row) => [...row])
    cells.forEach(([x, y]) => fn(x, y) && (modules[y][x] = !modules[y][x]))
    const format = BCH((ECL_BITS << 3) | mask, 0x537, 10) ^ 0x5412
    const { first, second } = formatCells(size)
    first.forEach(([x, y], i) => (modules[y][x] = ((format >>> i) & 1) === 1))
    second.forEach(([x, y], i) => (modules[y][x] = ((format >>> i) & 1) === 1))
    const score = penalty(modules)
    if (score < bestScore) [best, bestScore] = [{ version, size, mask, modules }, score]
  })
  return best as unknown as QrCode
}

/**
 * Reads a matrix produced by `encodeQr` back to text and checks every block's
 * error-correction bytes. Returns null when anything doesn't add up.
 */
export function decodeQr(modules: boolean[][]): string | null {
  const size = modules.length
  const version = (size - 17) / 4
  if (!Number.isInteger(version) || version < 1 || version > 40) return null
  const { first } = formatCells(size)
  const format = first.reduce((acc, [x, y], i) => acc | ((modules[y][x] ? 1 : 0) << i), 0) ^ 0x5412
  const mask = (format >>> 10) & 7
  if ((format >>> 13) !== ECL_BITS || BCH(format >>> 10, 0x537, 10) !== format) return null

  const { reserved } = functionPatterns(version)
  const cells = dataCells(size, reserved)
  const total = Math.floor(rawModules(version) / 8)
  const codewords = Array.from({ length: total }, (_, i) =>
    cells.slice(i * 8, i * 8 + 8).reduce((acc, [x, y]) => (acc << 1) | (modules[y][x] !== MASKS[mask](x, y) ? 1 : 0), 0),
  )

  const lengths = blockLayout(version)
  const ecLen = EC_PER_BLOCK[version]
  const blocks = lengths.map(() => ({ data: [] as number[], ec: [] as number[] }))
  let k = 0
  for (let i = 0; i < Math.max(...lengths); i++) lengths.forEach((len, b) => i < len && blocks[b].data.push(codewords[k++]))
  for (let i = 0; i < ecLen; i++) blocks.forEach((b) => b.ec.push(codewords[k++]))
  const divisor = rsDivisor(ecLen)
  if (blocks.some((b) => rsRemainder(b.data, divisor).some((v, i) => v !== b.ec[i]))) return null

  const data = blocks.flatMap((b) => b.data)
  const bits = data.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1))
  let pos = 0
  const read = (n: number) => bits.slice(pos, (pos += n)).reduce((a, b) => (a << 1) | b, 0)
  if (read(4) !== 0b0100) return null
  const length = read(version < 10 ? 8 : 16)
  if (pos + length * 8 > bits.length) return null
  const bytes = Uint8Array.from({ length }, () => read(8))
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}
