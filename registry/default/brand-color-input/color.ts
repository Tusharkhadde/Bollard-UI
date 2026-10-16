// Colour parsing and brand-palette matching behind BrandColorInput. Pure functions, safe on the server.

/** Red, green, blue (0–255) and alpha (0–1). */
export type RGBA = [r: number, g: number, b: number, a: number]

export type ColorIssueKind =
  | "unreadable"
  | "stray"
  | "lookalike"
  | "digits"
  | "argb"
  | "short-alpha"
  | "transparent"
  | "alpha-range"
  | "out-of-range"
  | "near"

export interface ColorIssue {
  kind: ColorIssueKind
  /** The text with the problem fixed, when there is one obvious fix. */
  fix?: string
  /** Palette token the fix snaps to. */
  token?: string
  /** Details for the message: what the browser will actually render, the digit count, the alpha. */
  detail?: string
}

export interface ColorReading {
  /** What the browser would render for the text as typed, or null if it can't read it. */
  rgba: RGBA | null
  /** Canonical CSS hex (#rrggbb or #rrggbbaa), or null. */
  hex: string | null
  /** Closest palette token by perceived difference, with ΔE OK (×2 a/b) and whether it is an exact match. */
  nearest: { token: string; hex: string; distance: number; exact: boolean } | null
  /** Problems in priority order; the first one is the one to show. */
  issues: ColorIssue[]
}

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
const hex2 = (n: number) => byte(n).toString(16).padStart(2, "0")

/** #rrggbb, or #rrggbbaa when not opaque. */
export function toHex([r, g, b, a]: RGBA) {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a * 255) : ""}`
}

function fromHexDigits(digits: string): RGBA | null {
  if (!/^[0-9a-f]+$/i.test(digits)) return null
  const full = digits.length <= 4 ? digits.replace(/./g, "$&$&") : digits
  if (full.length !== 6 && full.length !== 8) return null
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16)
  return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1]
}

/** Removes what code and design tools wrap colours in: `color:`, quotes, `;`, `!important`, `0x`, spaces inside a hex. */
export function cleanColor(raw: string) {
  let text = raw.trim()
  text = text.replace(/^[a-z-]+\s*:\s*/i, "").replace(/\s*!important\s*$/i, "").replace(/[;,]+$/, "").trim()
  text = text.replace(/^(["'`])(.*)\1$/, "$2").trim()
  if (/^(0x|#+)?[\s0-9a-f]+$/i.test(text) && /[a-f]|^#|^0x|^\w{6}$/i.test(text)) text = "#" + text.replace(/^(0x|#+)/i, "").replace(/\s+/g, "")
  return text
}

function parseRgb(text: string): { rgba: RGBA; issue?: ColorIssue } | null {
  const m = text.match(/^rgba?\(\s*([^)]*)\)$/i) ?? text.match(/^(\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3})$/)
  if (!m) return null
  const parts = m[1].split(/\s*[,/]\s*|\s+/).filter(Boolean)
  if (parts.length < 3 || parts.length > 4) return null
  const nums = parts.map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p)))
  if (nums.some(Number.isNaN)) return null
  const channels = parts.slice(0, 3).map((p, i) => (p.endsWith("%") ? nums[i] * 255 : nums[i]))
  let alpha = parts[3] ? nums[3] : 1
  let issue: ColorIssue | undefined
  if (channels.some((c) => c < 0 || c > 255)) issue = { kind: "out-of-range" }
  if (alpha > 1 && !parts[3].endsWith("%")) {
    // rgba(30, 64, 175, 255): alpha written as a byte. CSS clamps it to 1, which happens to look right until it's 128.
    issue = { kind: "alpha-range", detail: String(alpha) }
    alpha = alpha <= 255 ? alpha / 255 : 1
  }
  const rgba: RGBA = [byte(channels[0]), byte(channels[1]), byte(channels[2]), Math.max(0, Math.min(1, alpha))]
  if (issue) issue.fix = toHex(rgba)
  return { rgba, issue }
}

function linear(c: number) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** sRGB to OKLab (Björn Ottosson, as used by CSS Color 4). */
export function toOklab([r, g, b]: RGBA): [number, number, number] {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Perceived difference: ΔE OK with a and b doubled, which tracks CIEDE2000 better (CSSWG issue 14207). */
export function colorDistance(x: RGBA, y: RGBA) {
  const [l1, a1, b1] = toOklab(x)
  const [l2, a2, b2] = toOklab(y)
  return Math.hypot(l1 - l2, 2 * (a1 - a2), 2 * (b1 - b2))
}

/** Below this two colours read as the same one; a typed value this close to a token is almost surely meant to be it. */
export const SAME_COLOR = 0.02
/** Below this a value is close enough to a token to offer snapping (eyedropper drift on a compressed screenshot). */
export const NEAR_COLOR = 0.06

export function nearestToken(rgba: RGBA, palette: Record<string, string>): ColorReading["nearest"] {
  let best: ColorReading["nearest"] = null
  for (const [token, value] of Object.entries(palette)) {
    const target = fromHexDigits(value.replace(/^#/, ""))
    if (!target) continue
    const distance = colorDistance(rgba, target)
    if (!best || distance < best.distance) best = { token, hex: toHex(target), distance, exact: toHex(target) === toHex([...rgba.slice(0, 3), 1] as RGBA) }
  }
  return best
}

/** Every hex string one digit away from `digits` (one inserted, deleted or changed). */
function oneDigitAway(digits: string) {
  const out = new Set<string>()
  const hexDigits = "0123456789abcdef"
  for (let i = 0; i <= digits.length; i++) {
    if (i < digits.length) out.add(digits.slice(0, i) + digits.slice(i + 1))
    for (const d of hexDigits) {
      out.add(digits.slice(0, i) + d + digits.slice(i))
      if (i < digits.length) out.add(digits.slice(0, i) + d + digits.slice(i + 1))
    }
  }
  return out
}

/** Finds a palette token that a malformed or slightly-off hex was meant to be. */
function tokenOneDigitAway(digits: string, palette: Record<string, string>) {
  const wanted = new Map(Object.entries(palette).map(([token, value]) => [value.replace(/^#/, "").toLowerCase(), token]))
  for (const candidate of oneDigitAway(digits.toLowerCase())) {
    const token = wanted.get(candidate)
    if (token) return { token, hex: "#" + candidate }
  }
  return null
}

/**
 * Reads a typed or pasted colour and lists what's surprising about it: stray characters, the letter O
 * for zero, a digit too many or few, Android #AARRGGBB order, alpha hidden in 4/8-digit hex, and a value
 * a hair off a brand token.
 */
export function readColor(raw: string, palette: Record<string, string> = {}): ColorReading {
  const issues: ColorIssue[] = []
  const text = cleanColor(raw)
  if (text !== raw.trim()) issues.push({ kind: "stray", fix: text })

  let rgba: RGBA | null = null
  const hexLike = text.match(/^#([0-9a-z]+)$/i)
  if (hexLike) {
    let digits = hexLike[1]
    if (/[oOlI]/.test(digits) && /^[0-9a-fA-FoOlI]+$/.test(digits)) {
      digits = digits.replace(/[oO]/g, "0").replace(/[lI]/g, "1")
      issues.push({ kind: "lookalike", fix: "#" + digits })
    }
    rgba = fromHexDigits(digits)
    if (!rgba && /^[0-9a-f]+$/i.test(digits)) {
      const meant = tokenOneDigitAway(digits, palette)
      issues.push({ kind: "digits", detail: String(digits.length), fix: meant?.hex, token: meant?.token })
    } else if (rgba && digits.length === 8) {
      // Android, Flutter and old IE write alpha first. If that reading is a brand colour, or the leading byte is FF
      // while CSS would make it translucent, the order is almost certainly swapped.
      const argb = fromHexDigits(digits.slice(2))!
      const argbToken = nearestToken(argb, palette)
      const leadingOpaque = /^ff/i.test(digits) && !/ff$/i.test(digits)
      if ((argbToken?.exact && !nearestToken(rgba, palette)?.exact) || leadingOpaque) {
        const alpha = parseInt(digits.slice(0, 2), 16) / 255
        issues.push({ kind: "argb", detail: `${toHex([rgba[0], rgba[1], rgba[2], 1])} at ${Math.round(rgba[3] * 100)}% opacity`, fix: toHex([argb[0], argb[1], argb[2], alpha]), token: argbToken?.exact ? argbToken.token : undefined })
      }
    }
    if (rgba && digits.length === 4 && rgba[3] < 1) issues.push({ kind: "short-alpha", detail: toHex(rgba), fix: "#" + digits.slice(0, 3) })
  } else {
    const rgb = parseRgb(text)
    if (rgb) {
      rgba = rgb.rgba
      if (rgb.issue) issues.push(rgb.issue)
    } else if (text) issues.push({ kind: "unreadable" })
  }
  if (rgba && rgba[3] === 0) issues.push({ kind: "transparent", fix: toHex([rgba[0], rgba[1], rgba[2], 1]) })

  const nearest = rgba ? nearestToken(rgba, palette) : null
  if (rgba && nearest && !nearest.exact && nearest.distance < NEAR_COLOR) {
    issues.push({ kind: "near", token: nearest.token, fix: rgba[3] < 1 ? toHex([...(fromHexDigits(nearest.hex.slice(1))!.slice(0, 3) as [number, number, number]), rgba[3]]) : nearest.hex })
  }
  return { rgba, hex: rgba ? toHex(rgba) : null, nearest, issues }
}
