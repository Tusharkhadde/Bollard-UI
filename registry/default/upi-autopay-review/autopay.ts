// Bollard UI — upi-autopay-review · MIT licence · https://bollard-ui.vercel.app/components/upi-autopay-review

/**
 * Pure checks for a UPI AutoPay (e-mandate) before the customer approves it.
 * Rules: RBI "Digital Payments – E-mandate Framework, 2026" (21 Apr 2026): validity period on every
 * mandate (4b), pre-debit notice at least 24 hours before each debit with an opt-out of that debit
 * (6a–c), debits above ₹15,000 need AFA (₹1,00,000 for insurance premiums, mutual funds and credit
 * card bills, 8a–b), customer may set the maximum value of a variable mandate (4c) and modify the
 * validity or withdraw it at any time (4b), and registration is free (10a).
 * https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=13374
 */

export type MandateFrequency =
  | "onetime" | "daily" | "weekly" | "fortnightly" | "monthly" | "bimonthly"
  | "quarterly" | "halfyearly" | "yearly" | "aspresented"

export type MandateCategory = "general" | "mutualFund" | "insurance" | "creditCard"

export interface Mandate {
  /** Merchant name the mandate shows. */
  merchant: string
  /** Merchant UPI ID. */
  merchantVpa?: string
  /** The cap: the most any single debit can be. */
  maxAmount: number
  /** "max" lets every debit vary up to the cap; "fixed" debits exactly the cap. */
  amountRule?: "max" | "fixed"
  frequency: MandateFrequency
  /** Start of validity (Date, ISO string or epoch ms). */
  start?: Date | string | number | null
  /** End of validity. Missing, null or 30+ years out means "until you cancel". */
  end?: Date | string | number | null
  /** Sets the PIN-free debit limit. */
  category?: MandateCategory
}

export interface MandatePlan {
  /** What the user thinks they signed up for ("Premium monthly"). */
  name?: string
  /** The plan's price per cycle. */
  price: number
  /** The plan's billing cycle. */
  frequency?: MandateFrequency
  /** The merchant the user meant to pay. */
  merchant?: string
}

export type AutopayIssue =
  | { kind: "capHigh"; cap: number; price: number; ratio: number; fixed?: boolean }
  | { kind: "asPresented" }
  | { kind: "frequency"; plan: MandateFrequency; mandate: MandateFrequency }
  | { kind: "noEnd" }
  | { kind: "longEnd"; years: number }
  | { kind: "merchant"; expected: string; actual: string }
  | { kind: "overPinFree"; limit: number }
  | { kind: "badDates" }

/** PIN-free (no AFA) limit per debit for the category, in rupees. */
export const pinFreeLimit = (category: MandateCategory = "general") => (category === "general" ? 15_000 : 1_00_000)

/** Debits a year at the cap; null when the merchant picks the dates ("as presented"). */
export const CYCLES_PER_YEAR: Record<MandateFrequency, number | null> = {
  onetime: 1, daily: 365, weekly: 52, fortnightly: 26, monthly: 12, bimonthly: 6,
  quarterly: 4, halfyearly: 2, yearly: 1, aspresented: null,
}

/** Safe epoch ms from a date-ish value, or null for missing or invalid input. */
export function toTime(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN
  return Number.isFinite(time) ? time : null
}

const amount = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0)
const normal = (name: string) => name.toLowerCase().replace(/\b(pvt|private|ltd|limited|india|inc|llp|technologies|tech)\b/g, "").replace(/[^a-z0-9]/g, "")

/** The worst case in a year: cap × debits a year. Null when the merchant chooses the dates. */
export function worstCaseYear(mandate: Mandate): number | null {
  const cycles = CYCLES_PER_YEAR[mandate.frequency] ?? null
  return cycles === null ? null : amount(mandate.maxAmount) * cycles
}

/**
 * Everything worth a second look before approving. `capRatio` is how far above the plan price a cap
 * may sit before it is flagged (1.5 = 50% headroom for GST or a price rise).
 */
export function reviewMandate(mandate: Mandate, plan?: MandatePlan | null, options: { now?: number; capRatio?: number } = {}): AutopayIssue[] {
  const issues: AutopayIssue[] = []
  if (!mandate || typeof mandate !== "object") return issues
  const cap = amount(mandate.maxAmount)
  const price = amount(plan?.price)
  const ratio = options.capRatio ?? 1.5
  // A fixed mandate debits the cap every time, so any amount above the price (beyond paise rounding) is an overcharge.
  const fixed = mandate.amountRule === "fixed"
  if (price > 0 && cap > (fixed ? price + 0.5 : price * ratio)) issues.push({ kind: "capHigh", cap, price, ratio: cap / price, ...(fixed ? { fixed } : {}) })
  if (mandate.frequency === "aspresented") issues.push({ kind: "asPresented" })
  else if (plan?.frequency && plan.frequency !== mandate.frequency) issues.push({ kind: "frequency", plan: plan.frequency, mandate: mandate.frequency })

  const start = toTime(mandate.start) ?? options.now ?? null
  const end = toTime(mandate.end)
  if (end !== null && start !== null && end <= start) issues.push({ kind: "badDates" })
  else if (end === null) issues.push({ kind: "noEnd" })
  else if (start !== null) {
    const years = (end - start) / (365.25 * 86_400_000)
    if (years >= 30) issues.push({ kind: "noEnd" })
    else if (years > 5) issues.push({ kind: "longEnd", years: Math.floor(years) })
  }

  if (plan?.merchant && mandate.merchant && normal(plan.merchant) && !normal(mandate.merchant).includes(normal(plan.merchant)) && !normal(plan.merchant).includes(normal(mandate.merchant)))
    issues.push({ kind: "merchant", expected: plan.merchant, actual: mandate.merchant })
  const limit = pinFreeLimit(mandate.category)
  if (cap > limit) issues.push({ kind: "overPinFree", limit })
  return issues
}

/** A sensible cap for a variable mandate: the price rounded up to the next ₹10 (₹1 under ₹100). */
export const suggestedCap = (price: number) => (price < 100 ? Math.ceil(price) : Math.ceil(price / 10) * 10)

/** End date `years` after start (or now), as epoch ms. */
export function endAfter(mandate: Mandate, years: number, now: number) {
  const date = new Date(toTime(mandate.start) ?? now)
  date.setFullYear(date.getFullYear() + years)
  return date.getTime()
}
