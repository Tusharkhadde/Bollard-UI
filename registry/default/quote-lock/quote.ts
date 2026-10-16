// Bollard UI — quote-lock · MIT licence · https://bollard-ui.vercel.app/components/quote-lock

/** Pure helpers for QuoteLock: time left on a held price and how a new quote compares with the one shown. */

export interface Quote {
  /** Stable id of this quote from your server. */
  id: string
  /** What the user pays (or, with `direction="receive"`, what they get). */
  amount: number
  /** ISO 4217 code, e.g. "INR". */
  currency: string
  /** When the held price ends: epoch ms, Date or ISO string. Prefer `validFor` when clocks may disagree. */
  expiresAt?: number | Date | string
  /** How long the price is held, in ms, counted from when this quote reached the browser (immune to a wrong device clock). */
  validFor?: number
  /** Optional line under the amount, e.g. "1 USD = 83.42 INR · fee ₹120". */
  detail?: string
}

export type QuoteDirection = "pay" | "receive"

export interface QuoteChange {
  /** next − previous, in the quote currency. */
  delta: number
  /** Change as a percent of the previous amount. */
  percent: number
  /** True when the change is bad for the user (pays more, or receives less). */
  worse: boolean
  /** True when it's worse by more than the tolerance, so it needs an explicit accept. */
  needsAccept: boolean
}

/** Epoch ms when a quote's hold ends, given when it arrived on this device. NaN when it has neither field. */
export function quoteDeadline(quote: Pick<Quote, "expiresAt" | "validFor">, receivedAt: number) {
  if (typeof quote.validFor === "number" && Number.isFinite(quote.validFor)) return receivedAt + Math.max(0, quote.validFor)
  if (quote.expiresAt === undefined) return NaN
  return new Date(quote.expiresAt).getTime()
}

/** How a new quote compares with the one the user last saw. Tolerance is a percent (0.5 = 0.5%). */
export function compareQuotes(previous: number, next: number, tolerance = 0, direction: QuoteDirection = "pay"): QuoteChange {
  const delta = Math.round((next - previous) * 100) / 100
  const percent = previous ? (delta / Math.abs(previous)) * 100 : 0
  const worse = direction === "pay" ? delta > 0 : delta < 0
  return { delta, percent, worse, needsAccept: worse && Math.abs(percent) > Math.max(0, tolerance) + 1e-9 }
}

/** "0:42" for 42 s, "12:05" for 725 s. */
export function formatHold(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  if (total >= 3600)
    return `${Math.floor(total / 3600)}:${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}
