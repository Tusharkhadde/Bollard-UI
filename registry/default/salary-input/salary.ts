/** Pure parsing and sanity checks for salary amounts. No React. */

export type SalaryPeriod = "month" | "year"

export interface ParsedSalary {
  /** The amount in whole currency units, for the period below. */
  amount: number
  /** A period written in the text itself ("12 LPA", "85k/month"), which wins over the picker. */
  period?: SalaryPeriod
  /** True when the text carried a unit (k, lakh, crore, million), so it can't be a bare-number slip. */
  hasUnit: boolean
}

export type SalarySlip =
  | { kind: "lakhs"; amount: number; period: SalaryPeriod; lakhs: number }
  /** Outside India: a bare "85" meant as 85,000. `thousands` is the amount meant. */
  | { kind: "thousands"; amount: number; period: SalaryPeriod; thousands: number }
  | { kind: "period"; amount: number; period: SalaryPeriod; other: SalaryPeriod }
  | { kind: "zeros"; amount: number; period: SalaryPeriod; fixed: number; factor: number }
  | { kind: "range"; amount: number; period: SalaryPeriod; direction: "above" | "below" }

const UNITS: Record<string, number> = {
  k: 1e3, thousand: 1e3, l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, lpa: 1e5,
  cr: 1e7, crore: 1e7, crores: 1e7, cpa: 1e7, m: 1e6, mn: 1e6, million: 1e6,
}
const YEAR = /^(lpa|cpa|pa|p\.a\.?|a|per|yearly|annual|annually|year|yr|y|annum|per annum)$/
const MONTH = /^(pm|p\.m\.?|monthly|month|mo|mth)$/

/**
 * Reads what people actually type: "12 LPA", "12L", "1.2 Cr", "85k/month",
 * "₹50,000 pm", "12,00,000". Returns null when it isn't an amount.
 */
export function parseSalary(text: string): ParsedSalary | null {
  const clean = text
    .toLowerCase()
    .replace(/(\d)[,_\s](?=\d)/g, "$1")
    .replace(/₹|rs\.?|inr|\$|usd|€|eur|£|gbp/g, " ")
    // "per month", "a year", "/ yr" all become one separator, so "50000 per month" reads like "50000/month".
    .replace(/\s*\/\s*|\s+(?:per|an?)\s+(?!annum)/g, " / ")
    .replace(/\s+/g, " ")
    .trim()
  const match = clean.match(/^(\d+(?:\.\d+)?|\.\d+)\s*([a-z.]+)?\s*(?:\/)?\s*([a-z.]+(?: annum)?)?$/)
  if (!match) return null
  let [, num, unit = "", period = ""] = match
  if (!period && (YEAR.test(unit) || MONTH.test(unit)) && !UNITS[unit]) [period, unit] = [unit, ""]
  if (unit && !UNITS[unit]) return null
  if (period && !YEAR.test(period) && !MONTH.test(period)) return null
  const amount = Number(num) * (UNITS[unit] ?? 1)
  if (!Number.isFinite(amount)) return null
  const named = unit === "lpa" || unit === "cpa" ? "year" : YEAR.test(period) ? "year" : MONTH.test(period) ? "month" : undefined
  return { amount: Math.round(amount), period: named, hasUnit: !!unit }
}

/** Yearly amount for a value in either period. */
export const toYearly = (amount: number, period: SalaryPeriod) => (period === "month" ? amount * 12 : amount)

/**
 * Yearly range used when no expected range is given: ₹1.2 lakh (₹10,000 a month) to ₹1.2 crore.
 * Outside it, the check only speaks up when the other period would fit.
 */
export const PLAUSIBLE_YEARLY: [number, number] = [1.2e5, 1.2e7]

/** A yearly range wide enough for any salary in the currency ($1,000 a month to $2M a year), or null when unknown, which skips the generic check. */
export function plausibleYearly(currency = "INR"): [number, number] | null {
  if (currency === "INR") return PLAUSIBLE_YEARLY
  if (["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "NZD", "SGD"].includes(currency)) return [1.2e4, 2e6]
  if (["AED", "SAR", "QAR"].includes(currency)) return [3.6e4, 6e6]
  return null
}

/**
 * The likeliest slip in a salary, or null. With an expected yearly range it
 * tells a monthly figure typed as yearly (×12) from an extra or missing zero
 * (×10); without one it falls back to what is plausible for any salary.
 */
export function checkSalary(
  parsed: ParsedSalary,
  period: SalaryPeriod,
  expected?: [number, number],
  options: { currency?: string; plausible?: [number, number] | null } = {},
): SalarySlip | null {
  const { amount } = parsed
  const { currency = "INR" } = options
  if (amount <= 0) return null
  // "12" in an Indian salary field is almost always 12 lakh; "85" elsewhere is 85 thousand.
  if (!parsed.hasUnit && currency === "INR" && amount < 100) return { kind: "lakhs", amount, period, lakhs: amount }
  if (!parsed.hasUnit && currency !== "INR" && amount < 1000) return { kind: "thousands", amount, period, thousands: amount * 1000 }

  const plausible = options.plausible === undefined ? plausibleYearly(currency) : options.plausible
  const range = expected ?? plausible
  if (!range) return null
  const [min, max] = range
  const yearly = toYearly(amount, period)
  // A role's range gets some slack either side; the generic range is already wide.
  const slack = expected ? 1.25 : 1
  const fits = (y: number) => y >= min / slack && y <= max * slack
  if (fits(yearly)) return null

  const other: SalaryPeriod = period === "month" ? "year" : "month"
  if (!parsed.period && fits(toYearly(amount, other))) return { kind: "period", amount, period, other }
  if (expected) {
    for (const factor of [10, 0.1, 100, 0.01]) {
      if (fits(yearly / factor)) return { kind: "zeros", amount, period, fixed: Math.round(amount / factor), factor }
    }
    return { kind: "range", amount, period, direction: yearly > max ? "above" : "below" }
  }
  return null
}

/** "12 lakh", "1.25 crore", "85 thousand" for INR; "1.2 million" otherwise. Never rounds up past the real value. */
export function amountInWords(amount: number, system: "indian" | "international" = "indian") {
  const scales: [number, string][] =
    system === "indian" ? [[1e7, "crore"], [1e5, "lakh"], [1e3, "thousand"]] : [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]]
  for (const [size, name] of scales) {
    if (amount >= size) {
      const v = Math.floor((amount / size) * 100) / 100
      return `${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${name}`
    }
  }
  return String(amount)
}
