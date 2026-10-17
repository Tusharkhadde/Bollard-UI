// Bollard UI — redact-image · MIT licence · https://bollard-ui.vercel.app/components/redact-image

/** A rectangle in the image's own pixels (not screen pixels). */
export interface Region {
  x: number
  y: number
  width: number
  height: number
  /** What was found there, such as "Email" or "Card number". */
  label?: string
  /** Which detector pattern found it, when `findSensitiveText` did. Stable across translations. */
  kind?: string
}

/** One word from a text detector (Tesseract, the Shape Detection API, a server OCR), in image pixels. */
export interface DetectedWord extends Omit<Region, "label"> {
  text: string
}

/**
 * Grows a box by `pad` pixels and snaps it outward to whole pixels, so anti-aliased
 * glyph edges and half-covered pixel rows can't leak the shape of the text.
 */
export function padRegion(region: Region, pad: number, imageWidth: number, imageHeight: number): Region {
  const x = Math.max(0, Math.floor(region.x - pad))
  const y = Math.max(0, Math.floor(region.y - pad))
  const right = Math.min(imageWidth, Math.ceil(region.x + region.width + pad))
  const bottom = Math.min(imageHeight, Math.ceil(region.y + region.height + pad))
  return { ...region, x, y, width: right - x, height: bottom - y }
}

/** True when `outer` fully contains `inner`. */
export const covers = (outer: Region, inner: Region) =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height

function luhn(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return sum % 10 === 0
}

/** English names for what the detector finds; pass your own to `findSensitiveText` to translate them. */
export const SENSITIVE_LABELS = {
  email: "Email",
  apiKey: "API key",
  card: "Card number",
  aadhaar: "Aadhaar",
  pan: "PAN",
  ifsc: "IFSC",
  phone: "Phone",
}
export type SensitiveKind = keyof typeof SENSITIVE_LABELS

const PATTERNS: { kind: SensitiveKind; test: (text: string) => boolean }[] = [
  { kind: "email", test: (t) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t) },
  { kind: "apiKey", test: (t) => /^(sk|pk|rk)_(live|test)_\w{8,}|^gh[pousr]_\w{20,}|^AKIA[0-9A-Z]{16}$|^xox[abp]-|^eyJ[\w-]+\.[\w-]+/.test(t) },
  { kind: "card", test: (t) => /^\d{13,19}$/.test(t.replace(/[ -]/g, "")) && luhn(t.replace(/[ -]/g, "")) },
  { kind: "aadhaar", test: (t) => /^[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}$/.test(t) },
  { kind: "pan", test: (t) => /^[A-Z]{5}\d{4}[A-Z]$/.test(t) },
  { kind: "ifsc", test: (t) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(t) },
  { kind: "phone", test: (t) => /^(\+?\d{1,3}[ -]?)?[6-9]\d{4}[ -]?\d{5}$|^\+\d[\d -]{8,14}\d$/.test(t) },
]

const union = (words: DetectedWord[]): Region => {
  const x = Math.min(...words.map((w) => w.x))
  const y = Math.min(...words.map((w) => w.y))
  return {
    x,
    y,
    width: Math.max(...words.map((w) => w.x + w.width)) - x,
    height: Math.max(...words.map((w) => w.y + w.height)) - y,
  }
}

/**
 * Picks the sensitive words out of a text detector's output: emails, API keys,
 * card numbers (Luhn-checked), Aadhaar, PAN, IFSC and phone numbers. Numbers split
 * into groups ("4111 1111 1111 1111") are joined with up to three following words
 * on the same line before testing. `labels` translates the names shown on each suggestion.
 */
export function findSensitiveText(words: DetectedWord[], labels: Partial<Record<SensitiveKind, string>> = {}): Region[] {
  const names = { ...SENSITIVE_LABELS, ...labels }
  const found: Region[] = []
  for (let i = 0; i < words.length; i++) {
    for (let span = 4; span >= 1; span--) {
      const group = words.slice(i, i + span)
      if (group.length < span) continue
      const sameLine = group.every((w) => Math.abs(w.y - group[0].y) < group[0].height / 2)
      if (!sameLine) continue
      const text = group.map((w) => w.text.replace(/[.,;:)]+$/, "")).join(" ")
      const match = PATTERNS.find((p) => p.test(text))
      if (match) {
        found.push({ ...union(group), kind: match.kind, label: names[match.kind] })
        i += span - 1
        break
      }
    }
  }
  return found
}

/** PNG chunks that carry text, dates, EXIF or a colour profile, none of which a shared screenshot needs. */
const METADATA_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME", "iCCP"])

export interface PngReport {
  valid: boolean
  width: number
  height: number
  chunks: string[]
  /** Metadata chunk types found. */
  metadata: string[]
  /** Bytes after the IEND chunk, where aCropalypse-style leftovers of the original live. */
  trailingBytes: number
}

/** Walks a PNG's chunks without decoding pixels. */
export function inspectPng(bytes: Uint8Array): PngReport {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  const report: PngReport = { valid: signature.every((b, i) => bytes[i] === b), width: 0, height: 0, chunks: [], metadata: [], trailingBytes: 0 }
  if (!report.valid) return report
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    report.chunks.push(type)
    if (type === "IHDR") [report.width, report.height] = [view.getUint32(offset + 8), view.getUint32(offset + 12)]
    if (METADATA_CHUNKS.has(type)) report.metadata.push(type)
    offset += 12 + length
    if (type === "IEND") break
  }
  report.trailingBytes = Math.max(0, bytes.length - offset)
  report.valid = report.chunks[0] === "IHDR" && report.chunks[report.chunks.length - 1] === "IEND"
  return report
}
