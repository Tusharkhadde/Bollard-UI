// Bollard UI — dimension-input · MIT licence · https://bollard-ui.vercel.app/components/dimension-input

export type DimensionUnit = "mm" | "cm" | "m" | "in" | "ft"
export type Axis = "w" | "h" | "d"
export const AXES: Axis[] = ["w", "h", "d"]

/** Centimetres per unit. */
export const UNIT_CM: Record<DimensionUnit, number> = { mm: 0.1, cm: 1, m: 100, in: 2.54, ft: 30.48 }

/** What the thing being measured usually looks like, in centimetres. */
export interface DimensionCategory {
  /** "a carry-on bag", used in messages. */
  label: string
  /** Smallest and largest plausible side, in cm. */
  minCm: number
  maxCm: number
  /** Axes from longest to shortest when the thing has a usual shape (a TV is wider than tall). */
  order?: Axis[]
}

export const DIMENSION_CATEGORIES = {
  parcel: { label: "a parcel", minCm: 1, maxCm: 200 },
  "carry-on": { label: "a carry-on bag", minCm: 10, maxCm: 80, order: ["h", "w", "d"] },
  tv: { label: "a TV", minCm: 2, maxCm: 250, order: ["w", "h", "d"] },
  phone: { label: "a phone", minCm: 0.5, maxCm: 25, order: ["h", "w", "d"] },
  furniture: { label: "furniture", minCm: 20, maxCm: 350 },
  bookshelf: { label: "a bookshelf", minCm: 15, maxCm: 300, order: ["h", "w", "d"] },
} satisfies Record<string, DimensionCategory>

export type Sides = Record<Axis, number>

const UNIT_WORDS: [RegExp, DimensionUnit][] = [
  [/(mm|millimet(er|re)s?)\b/, "mm"], [/(cm|centimet(er|re)s?)\b/, "cm"], [/(ft|feet|foot|')/, "ft"],
  [/(\binch(es)?\b|\bin\b|")/, "in"], [/\b(m|met(er|re)s?)\b/, "m"],
]

/** Reads a pasted "40 x 30 x 20 cm", 16" × 12" × 8", "1200*600*450mm" or "16 by 12 by 8 inches". */
export function parseDimensions(text: string): { values: [number, number, number]; unit?: DimensionUnit } | null {
  const lower = text.toLowerCase().replace(/,(?=\d{3}\b)/g, "")
  const numbers = lower.match(/\d+(?:[.,]\d+)?/g)
  if (!numbers || numbers.length !== 3 || !/[x×*]|by/.test(lower)) return null
  const values = numbers.map((n) => Number(n.replace(",", "."))) as [number, number, number]
  const unit = UNIT_WORDS.find(([re]) => re.test(lower.replace(/\d+(?:[.,]\d+)?/g, " ")))?.[1]
  return { values, unit }
}

const inRange = (cm: number, c: DimensionCategory) => cm >= c.minCm && cm <= c.maxCm

export type DimensionIssue =
  | { kind: "unit"; unit: DimensionUnit; message: string }
  | { kind: "digit"; axis: Axis; fixValue: number; message: string }
  | { kind: "range"; axes: Axis[]; message: string }
  | { kind: "order"; fix: Sides; message: string }

/**
 * The likeliest slip in a set of sides for a category: a wrong unit (every side
 * fits if read as inches), one side with an extra or missing digit, a side out
 * of range, or sides entered in the wrong order for the thing's usual shape.
 */
export function findDimensionIssue(sides: Sides, unit: DimensionUnit, category: DimensionCategory, names: Record<Axis, string>): DimensionIssue | null {
  const cm = (u: DimensionUnit, v: number) => v * UNIT_CM[u]
  const out = AXES.filter((a) => !inRange(cm(unit, sides[a]), category))
  if (out.length) {
    // Prefer the unit whose reading sits nearest the middle of the plausible range.
    const middle = Math.sqrt(category.minCm * category.maxCm)
    const typical = Math.cbrt(sides.w * sides.h * sides.d)
    const score = (u: DimensionUnit) => Math.abs(Math.log(cm(u, typical) / middle))
    const best = (Object.keys(UNIT_CM) as DimensionUnit[])
      .filter((u) => u !== unit && AXES.every((a) => inRange(cm(u, sides[a]), category)))
      .sort((a, b) => score(a) - score(b))[0]
    if (best && out.length > 1) return { kind: "unit", unit: best, message: `Too ${cm(unit, sides[out[0]]) > category.maxCm ? "big" : "small"} for ${category.label} in ${unit}. Were these ${best}?` }
    if (out.length === 1) {
      const a = out[0]
      const fixValue = [sides[a] / 10, sides[a] * 10].find((v) => inRange(cm(unit, v), category))
      if (fixValue !== undefined) return { kind: "digit", axis: a, fixValue, message: `${names[a]} ${sides[a]} ${unit} is off for ${category.label}. A digit too ${fixValue < sides[a] ? "many" : "few"}?` }
    }
    if (best) return { kind: "unit", unit: best, message: `That doesn't fit ${category.label} in ${unit}. Were these ${best}?` }
    return { kind: "range", axes: out, message: `${out.map((a) => names[a]).join(" and ")} ${out.length > 1 ? "are" : "is"} outside what's usual for ${category.label}.` }
  }
  if (category.order) {
    const sorted = AXES.map((a) => sides[a]).sort((x, y) => y - x)
    const fix = Object.fromEntries(category.order.map((a, i) => [a, sorted[i]])) as Sides
    const moved = AXES.filter((a) => fix[a] !== sides[a])
    if (moved.length)
      return { kind: "order", fix, message: moved.length === 2 ? `${names[moved[0]]} and ${names[moved[1]]} look swapped for ${category.label}.` : `These look out of order for ${category.label}.` }
  }
  return null
}

const round = (n: number, digits = 1) => Number(n.toFixed(digits)).toLocaleString("en", { maximumFractionDigits: digits })

/** Reads sides back in the other system: cm (or m for large) for imperial input, inches for metric. */
export function formatOtherSystem(sides: Sides, unit: DimensionUnit) {
  const cm = AXES.map((a) => sides[a] * UNIT_CM[unit])
  if (unit === "in" || unit === "ft") return Math.max(...cm) >= 300 ? `${cm.map((v) => round(v / 100, 2)).join(" × ")} m` : `${cm.map((v) => round(v)).join(" × ")} cm`
  return Math.max(...cm) >= 300 ? `${cm.map((v) => round(v / 30.48)).join(" × ")} ft` : `${cm.map((v) => round(v / 2.54)).join(" × ")} in`
}

/** Volume in litres (or m³) and cubic feet, plus courier volumetric weight for a divisor in cm³/kg. */
export function volumeReadback(sides: Sides, unit: DimensionUnit, divisor: number | null) {
  const cm3 = AXES.reduce((p, a) => p * sides[a] * UNIT_CM[unit], 1)
  const litres = cm3 / 1000
  const volume = litres >= 1000 ? `${round(litres / 1000, 2)} m³` : `${round(litres, litres < 10 ? 1 : 0)} L`
  const ft3 = `${round(cm3 / 28316.85, 2)} ft³`
  const kg = divisor ? cm3 / divisor : null
  return { volume, ft3, weight: kg === null ? null : `${round(kg)} kg (${round(kg * 2.20462)} lb)` }
}
