// Bollard UI — contrast-picker · MIT licence · https://bollard-ui.vercel.app/components/contrast-picker

/** WCAG 2 contrast maths (relative luminance per WCAG 2.2, sRGB threshold 0.04045) and a lightness-only fixer. */

export type Rgb = [number, number, number]

/** Parses #rgb, #rrggbb (the # is optional). Returns null for anything else. */
export function parseHex(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, "")
  const full = /^[\da-f]{3}$/i.test(hex) ? hex.replace(/./g, "$&$&") : hex
  if (!/^[\da-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

export const toHex = (rgb: Rgb) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")

export function luminance([r, g, b]: Rgb) {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** The WCAG 2 contrast ratio, from 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Formats a ratio truncated, never rounded up: 4.499 is "4.49", because WCAG has no rounding and 4.499 fails 4.5. */
export const formatRatio = (ratio: number) => (Math.floor(ratio * 100) / 100).toFixed(2)

export const WCAG_THRESHOLDS = { AA: { normal: 4.5, large: 3 }, AAA: { normal: 7, large: 4.5 } } as const

function toHsl([r, g, b]: Rgb): Rgb {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s, l]
}

function fromHsl([h, s, l]: Rgb): Rgb {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round) as Rgb
}

/**
 * The closest colour to `adjust` (same hue and saturation, only lightness moved) that reaches
 * `target` against `other`, checked after rounding to hex. It only moves away from `other`, so
 * dark-on-light stays dark-on-light. Null when no lightness on that side is enough.
 */
export function nearestPassing(adjust: Rgb, other: Rgb, target: number): string | null {
  const [h, s, l] = toHsl(adjust)
  const dir = luminance(adjust) >= luminance(other) ? 1 : -1
  for (let next = l; next >= 0 && next <= 1; next += dir / 1000) {
    const rgb = fromHsl([h, s, next])
    if (contrastRatio(rgb, other) >= target) return toHex(rgb)
  }
  const end = fromHsl([h, s, dir > 0 ? 1 : 0])
  return contrastRatio(end, other) >= target ? toHex(end) : null
}
