// Dose parsing, ISMP error-prone designation checks and read-back, behind DoseInput. Pure functions, safe on the server.
// Rules follow the ISMP List of Error-Prone Abbreviations, Symbols, and Dose Designations (2024).

export type DoseUnit = "mg" | "mcg" | "g" | "nanograms" | "units" | "mL" | "L" | "mEq" | "mmol"

export interface Dose {
  amount: number
  unit: DoseUnit | null
}

export type DoseIssueKind =
  | "unreadable"
  | "decimal-comma"
  | "fraction"
  | "leading-zero"
  | "trailing-zero"
  | "multiplier"
  | "unit"
  | "period"
  | "spacing"
  | "grouping"
  | "no-unit"

export interface DoseIssue {
  kind: DoseIssueKind
  /** What was typed for the part at fault ("U", "1.0", "10mg"). */
  typed: string
  /** The safe way to write that part, when it can be fixed. */
  safe?: string
  /** Full replacement texts when the fix isn't one obvious choice ("1M" could be thousand or million). */
  options?: string[]
}

/** How each way of writing a unit reads, and the safe spelling. `risky` marks ISMP's error-prone forms. */
const UNIT_FORMS: [RegExp, DoseUnit, boolean][] = [
  [/^mg$/i, "mg", false],
  [/^mcg$/i, "mcg", false],
  [/^(µg|μg|ug)$/i, "mcg", true],
  [/^(g|gm|grams?)$/i, "g", false],
  [/^(ng|nanog)$/i, "nanograms", true],
  [/^nanograms?$/i, "nanograms", false],
  [/^units?$/i, "units", false],
  [/^(u|iu|i\.u\.|international units?)$/i, "units", true],
  [/^mL$/, "mL", false],
  [/^(ml|cc)$/i, "mL", true],
  [/^L$/, "L", false],
  [/^l$/, "L", true],
  [/^meq$/i, "mEq", false],
  [/^mmol$/i, "mmol", false],
]

const MASS: Partial<Record<DoseUnit, number>> = { g: 1000, mg: 1, mcg: 0.001, nanograms: 0.000001 }
const VOLUME: Partial<Record<DoseUnit, number>> = { L: 1000, mL: 1 }

/** The amount in `to` units, or null when the units measure different things (mg vs units). */
export function convertDose(amount: number, from: DoseUnit, to: DoseUnit): number | null {
  if (from === to) return amount
  for (const scale of [MASS, VOLUME]) if (scale[from] && scale[to]) return (amount * scale[from]!) / scale[to]!
  return null
}

/** Writes a number the safe way: leading zero, no trailing zeros, commas from 1,000 (US style). */
export function formatAmount(amount: number) {
  const [whole, fraction] = String(+amount.toPrecision(12)).split(".")
  return whole.replace(/\B(?=(\d{3})+$)/g, ",") + (fraction ? "." + fraction : "")
}

export interface DoseReading {
  dose: Dose | null
  issues: DoseIssue[]
  /** The whole dose written safely ("0.5 mg"), when it could be read. */
  safe: string | null
}

/** Reads a typed dose and lists every ISMP error-prone designation in it, in reading order. */
export function readDose(text: string, defaultUnit?: DoseUnit): DoseReading {
  const raw = text.trim()
  if (!raw) return { dose: null, issues: [], safe: null }
  const m = raw.match(/^(\d+\s*\/\s*\d+|\d*[.,]?\d*(?:,\d{3})*(?:\.\d+)?)\s*(?:(k|m{1,2}|thousand|million)\b)?\s*(\S.*?)?$/i)
  if (!m || !/\d/.test(m[1])) return { dose: null, issues: [{ kind: "unreadable", typed: raw }], safe: null }
  const [, num, mult, unitText] = m
  const issues: DoseIssue[] = []
  let amount: number

  if (num.includes("/")) {
    const [a, b] = num.split("/").map(Number)
    amount = a / b
    issues.push({ kind: "fraction", typed: num, safe: formatAmount(amount) })
  } else if (/^\d+,\d{1,2}$|^0,\d+$/.test(num)) {
    amount = parseFloat(num.replace(",", "."))
    issues.push({ kind: "decimal-comma", typed: num, safe: formatAmount(amount) })
  } else {
    amount = parseFloat(num.replace(/,/g, ""))
    if (num.startsWith(".")) issues.push({ kind: "leading-zero", typed: num, safe: formatAmount(amount) })
    if (/\.\d*0$/.test(num)) issues.push({ kind: "trailing-zero", typed: num, safe: formatAmount(amount) })
    if (/^\d{5,}/.test(num)) issues.push({ kind: "grouping", typed: num, safe: formatAmount(amount) })
  }

  if (mult) {
    const word = mult.toLowerCase()
    const factor = word === "k" || word === "thousand" ? 1000 : word === "million" || word === "mm" ? 1e6 : null
    if (!factor || word.length < 3) {
      // ISMP: "M" has meant both thousand (Roman numeral) and million; "MM" and "K" get misread too.
      const rest = unitText ? " " + unitText : ""
      issues.push({ kind: "multiplier", typed: mult, options: factor ? [formatAmount(amount * factor) + rest] : [formatAmount(amount * 1000) + rest, formatAmount(amount * 1e6) + rest] })
    }
    if (factor) amount *= factor
  }

  let unit: DoseUnit | null = null
  if (unitText) {
    const bare = unitText.replace(/\.$/, "")
    const form = UNIT_FORMS.find(([re]) => re.test(bare))
    if (!form) return { dose: null, issues: [{ kind: "unreadable", typed: raw }], safe: null }
    unit = form[1]
    if (form[2]) issues.push({ kind: "unit", typed: bare, safe: unit })
    if (bare !== unitText && !/^i\.u\.$/i.test(unitText)) issues.push({ kind: "period", typed: unitText, safe: unit })
    const flush = raw.match(/\d([a-zµμ]+)/i)
    if (flush && !mult) issues.push({ kind: "spacing", typed: raw.slice(Math.max(0, flush.index! - 2), flush.index! + 1 + flush[1].length), safe: `${num.slice(-2)} ${flush[1]}` })
  } else if (defaultUnit) {
    issues.push({ kind: "no-unit", typed: num, safe: defaultUnit })
  }

  const safeUnit = unit ?? defaultUnit
  const safe = issues.some((i) => i.kind === "multiplier" && i.options!.length > 1) ? null : `${formatAmount(amount)}${safeUnit ? " " + safeUnit : ""}`
  return { dose: { amount, unit }, issues, safe }
}

export interface DoseRange {
  min: number
  max: number
  unit: DoseUnit
}

/**
 * How far a dose is outside the usual range (how many times above max, or below min), and the nearby
 * readings that land inside it: a slipped decimal (×10, ×100) or mg typed for mcg (×1,000).
 */
export function checkRange(dose: Dose, range: DoseRange) {
  if (!dose.unit) return null
  const value = convertDose(dose.amount, dose.unit, range.unit)
  if (value === null || value <= 0) return null
  const factor = value > range.max ? value / range.max : value < range.min ? range.min / value : 1
  const inRange = (v: number) => v >= range.min && v <= range.max
  // Same number in a neighbouring unit first (mg typed for mcg), then a slipped decimal point.
  const tries: Dose[] = MASS[dose.unit] ? (["mcg", "mg", "g"] as DoseUnit[]).filter((u) => u !== dose.unit).map((u) => ({ amount: dose.amount, unit: u })) : []
  for (const k of [10, 100, 1000]) tries.push({ amount: dose.amount / k, unit: dose.unit }, { amount: dose.amount * k, unit: dose.unit })
  const seen = new Set<number>()
  const suggestions: string[] = []
  for (const t of tries) {
    const v = convertDose(t.amount, t.unit!, range.unit)
    if (v === null || !inRange(v) || seen.has(+v.toPrecision(9))) continue
    seen.add(+v.toPrecision(9))
    suggestions.push(`${formatAmount(t.amount)} ${t.unit}`)
  }
  return { factor, above: value > range.max, suggestions: suggestions.slice(0, 2) }
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

function wholeWords(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "")
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + wholeWords(n % 100) : "")
  for (const [size, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]] as const) {
    if (n >= size) return wholeWords(Math.floor(n / size)) + " " + name + (n % size ? " " + wholeWords(n % size) : "")
  }
  return String(n)
}

/** Spells a dose the way it should be read back aloud: 0.25 mg → "zero point two five milligrams". */
export function spellDose(dose: Dose, unitWords: Record<DoseUnit, [one: string, many: string]>) {
  const [whole, fraction] = String(+dose.amount.toPrecision(12)).split(".")
  const number = wholeWords(+whole) + (fraction ? " point " + Array.from(fraction, (d) => ONES[+d]).join(" ") : "")
  if (!dose.unit) return number
  const [one, many] = unitWords[dose.unit]
  return `${number} ${dose.amount === 1 ? one : many}`
}
