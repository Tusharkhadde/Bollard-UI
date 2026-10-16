// Bollard UI — billing-period-input · MIT licence · https://bollard-ui.vercel.app/components/billing-period-input

export type BillingPeriod = "week" | "month" | "quarter" | "year"
export type PriceBasis = "seat" | "total"

/** Length of each period in months. A week is 12/52 of a month, so ₹100/week reads back as ₹5,200/year. */
export const PERIOD_MONTHS: Record<BillingPeriod, number> = { week: 12 / 52, month: 1, quarter: 3, year: 12 }

/** Converts an amount billed every `from` into the same rate billed every `to`. */
export function convertPrice(amount: number, from: BillingPeriod, to: BillingPeriod) {
  return (amount / PERIOD_MONTHS[from]) * PERIOD_MONTHS[to]
}

/** Reads "₹ 5,988", "5988.00" or "1,499.5" as a number; null when it isn't one. */
export function parsePrice(text: string) {
  const clean = text.replace(/[^\d.,-]/g, "").replace(/,/g, "")
  if (!clean || !/^-?\d*\.?\d*$/.test(clean) || clean === "." || clean === "-") return null
  return Number(clean)
}

/** A known-good price to compare against: the current price, the plan below, or last year's. */
export interface PriceReference {
  amount: number
  period: BillingPeriod
  /** Whether the reference amount is per seat. */
  basis?: PriceBasis
  /** How the reference is named in warnings, e.g. "the current Pro price". */
  label?: string
}

export type PriceSlip =
  | { kind: "period"; ratio: number; meant: BillingPeriod }
  | { kind: "total-as-seat"; ratio: number }
  | { kind: "seat-as-total"; ratio: number }
  | { kind: "jump"; ratio: number }

/** Within a band of `target`. Year-vs-month gets a wide band for 1–2 free months; short spans stay tight. */
const near = (ratio: number, target: number) => {
  const wide = Math.max(target, 1 / target) >= 8
  return ratio >= target * (wide ? 0.65 : 0.9) && ratio <= target * (wide ? 1.25 : 1.1)
}

/**
 * Compares a price with a reference, per seat per month, and names the likely slip: a price for a
 * longer or shorter period typed into this one (₹5,988 in the monthly field when ₹499 was meant;
 * yearly plans are often discounted, so 8–15× counts), a team total typed as a per-seat price or the
 * reverse, or a plain implausible jump. Both a period and a seat slip are returned when both fit.
 */
export function checkPrice(
  { amount, period, basis = "total", seats = 1 }: { amount: number; period: BillingPeriod; basis?: PriceBasis; seats?: number },
  reference?: PriceReference,
  periods: BillingPeriod[] = ["week", "month", "quarter", "year"],
): PriceSlip[] {
  if (!reference || amount <= 0 || reference.amount <= 0) return []
  const perSeatMonth = (value: number, per: BillingPeriod, b: PriceBasis) => convertPrice(value, per, "month") / (b === "seat" ? 1 : seats)
  const ratio = perSeatMonth(amount, period, basis) / perSeatMonth(reference.amount, reference.period, reference.basis ?? "total")
  const slips: PriceSlip[] = []

  for (const other of periods) {
    const factor = PERIOD_MONTHS[other] / PERIOD_MONTHS[period]
    if (other !== period && Math.max(factor, 1 / factor) >= 3 && near(ratio, factor)) slips.push({ kind: "period", ratio, meant: other })
  }
  if (seats > 1 && basis === "seat" && near(ratio, seats)) slips.push({ kind: "total-as-seat", ratio })
  if (seats > 1 && basis === "total" && near(ratio, 1 / seats)) slips.push({ kind: "seat-as-total", ratio })
  if (!slips.length && (ratio >= 2.5 || ratio <= 0.4)) slips.push({ kind: "jump", ratio })
  return slips
}
