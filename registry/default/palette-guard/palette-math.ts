// Bollard UI — palette-guard · MIT licence · https://bollard-ui.vercel.app/components/palette-guard

/** Colour maths for PaletteGuard: sRGB ⇄ CIELAB, CIEDE2000 and Machado (2009) colour-vision simulation. */

export type Vision = "normal" | "protan" | "deutan" | "tritan"
type Vec3 = [number, number, number]

/** Machado, Oliveira & Fernandes (2009) matrices at severity 1.0, applied to linear sRGB. */
const MACHADO: Record<Exclude<Vision, "normal">, number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** "#e69f00", "#E69F00" or "#e90" to linear RGB, or null when it is not a hex colour. */
export function parseHex(hex: string): Vec3 | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]
  return [0, 2, 4].map((i) => toLinear(parseInt(h.slice(i, i + 2), 16) / 255)) as Vec3
}

export function toHex(linear: Vec3) {
  return "#" + linear.map((c) => Math.round(clamp01(toGamma(c)) * 255).toString(16).padStart(2, "0")).join("")
}

/** How a colour (linear RGB) looks with full dichromacy of the given type. */
export function simulate(linear: Vec3, vision: Vision): Vec3 {
  if (vision === "normal") return linear
  const m = MACHADO[vision]
  return [0, 3, 6].map((r) => clamp01(m[r] * linear[0] + m[r + 1] * linear[1] + m[r + 2] * linear[2])) as Vec3
}

const D65 = [0.95047, 1, 1.08883]
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
const fInv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27))

export function linearToLab([r, g, b]: Vec3): Vec3 {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / D65[0]
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / D65[2]
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** CIELAB to linear sRGB, or null when the colour is outside the sRGB gamut. */
export function labToLinear([l, a, b]: Vec3): Vec3 | null {
  const fy = (l + 16) / 116
  const x = fInv(fy + a / 500) * D65[0]
  const y = fInv(fy)
  const z = fInv(fy - b / 200) * D65[2]
  const rgb: Vec3 = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ]
  return rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4) ? (rgb.map(clamp01) as Vec3) : null
}

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005). About 2 is barely visible side by side. */
export function deltaE2000([l1, a1, b1]: Vec3, [l2, a2, b2]: Vec3) {
  const rad = Math.PI / 180
  const cBar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)))
  const [ap1, ap2] = [a1 * (1 + g), a2 * (1 + g)]
  const [c1, c2] = [Math.hypot(ap1, b1), Math.hypot(ap2, b2)]
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360)
  const [h1, h2] = [hue(b1, ap1), hue(b2, ap2)]
  let dh = c1 * c2 === 0 ? 0 : h2 - h1
  if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dL = l2 - l1
  const dC = c2 - c1
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh / 2) * rad)
  const lBar = (l1 + l2) / 2
  const cpBar = (c1 + c2) / 2
  let hBar = h1 + h2
  if (c1 * c2 !== 0) hBar = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2
  const t = 1 - 0.17 * Math.cos((hBar - 30) * rad) + 0.24 * Math.cos(2 * hBar * rad) + 0.32 * Math.cos((3 * hBar + 6) * rad) - 0.2 * Math.cos((4 * hBar - 63) * rad)
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2)
  const sc = 1 + 0.045 * cpBar
  const sh = 1 + 0.015 * cpBar * t
  const rt = -2 * Math.sqrt(cpBar ** 7 / (cpBar ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hBar - 275) / 25) ** 2)) * rad)
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh))
}
