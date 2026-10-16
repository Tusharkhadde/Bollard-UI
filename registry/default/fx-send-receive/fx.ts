/** Which box the user typed in. The other side is worked out from the rate and fees. */
export type FxSide = "send" | "receive"
/** SWIFT charge instruction. OUR: sender pays every bank. SHA: banks along the way may deduct. BEN: recipient pays all. */
export type FxCharges = "OUR" | "SHA" | "BEN"

export interface FxQuote {
  /** Units of the receiving currency for one unit of the sending currency (Wise's `rate`). */
  rate: number
  /** Provider fee in the sending currency, taken from what you send. */
  fixedFee?: number
  /** Provider fee as a percent of what you send, e.g. 0.6 for 0.6%. */
  percentFee?: number
  /** Most that intermediary and receiving banks may deduct, in the receiving currency (SHA and BEN only). */
  intermediaryFee?: number
  /** Extra cost in the sending currency for OUR, so nothing is deducted on the way. */
  ourFee?: number
}

export interface FxAmountValue {
  side: FxSide
  amount: number | null
}

export interface FxExpected {
  /** What must arrive, e.g. the invoice total. */
  amount: number
  currency: string
}

export type FxProblem =
  | { kind: "wrongBox"; typed: number }
  | { kind: "short"; by: number; worstCase: boolean }
  | { kind: "deductions"; upTo: number }
  | { kind: "over"; by: number }
  | { kind: "currency"; expected: string }

export interface FxReadback {
  /** Total taken from the sender, fees and any OUR charge included. */
  send: number
  /** What the recipient's bank is asked to credit before any deduction along the way. */
  receive: number
  /** Lowest the recipient may actually see after intermediary deductions. */
  arrivesAtLeast: number
  fee: number
  problems: FxProblem[]
}

/** Decimal places a currency uses (JPY 0, KWD 3), falling back to 2 for unknown codes. */
export function minorUnits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

const roundTo = (n: number, digits: number) => {
  const f = 10 ** digits
  return Math.round((n + Number.EPSILON) * f) / f
}

/** The decimal separator a locale writes ("." for en, "," for de), or null when it can't be read. */
function localeDecimal(locale?: string): "." | "," | null {
  if (!locale) return null
  try {
    const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value
    return part === "," || part === "." ? part : null
  } catch {
    return null
  }
}

/**
 * Reads a typed or pasted amount. Handles grouping in either style ("1,200.50", "1.200,50", "1 200,50",
 * "12,00,000"), currency symbols and codes, a BOM, CRLF and stray spaces. Returns null for anything
 * that isn't a finite non-negative number. A lone separator before exactly three digits ("1.200", "1,200")
 * is ambiguous; pass `locale` to read it the way that locale writes it ("1.200" is 1200 in de-DE).
 */
export function parseAmount(raw: unknown, locale?: string): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null
  if (typeof raw !== "string") return null
  let s = raw.replace(/^\uFEFF/, "").replace(/[\r\n\t\u00a0\u202f']/g, " ").trim().slice(0, 40)
  // Currency codes and symbols only: a stray letter inside the number ("1e5", "1O0") is a typo, not a code.
  s = s.replace(/\/-$/, "").replace(/^[A-Za-z]{1,4}\.?\s*|\s*[A-Za-z]{1,4}\.?$/g, "").replace(/[$€£₹¥₩₺₽₱₫₦₴₪]/g, "").replace(/\s+/g, "")
  if (!s || /[^\d.,]/.test(s) || !/\d/.test(s)) return null
  const only = s.match(/^\d{1,3}([.,])\d{3}$/)
  const hint = localeDecimal(locale)
  if (only && hint) return Number(only[1] === hint ? s.replace(",", ".") : s.replace(/[.,]/, ""))
  const lastDot = s.lastIndexOf(".")
  const lastComma = s.lastIndexOf(",")
  let decimal: "." | "," | null = null
  if (lastDot >= 0 && lastComma >= 0) decimal = lastDot > lastComma ? "." : ","
  else if (lastComma >= 0) decimal = /,\d{1,2}$/.test(s) && (s.match(/,/g) ?? []).length === 1 ? "," : null
  else if (lastDot >= 0) decimal = /\.\d{3}$/.test(s) && (s.match(/\./g) ?? []).length > 1 ? null : "."
  const normal = decimal === "," ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  if (decimal === null && /\./.test(normal) && (normal.match(/\./g) ?? []).length > 1) return Number(normal.replace(/\./g, ""))
  const n = Number(normal)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= Math.max(tolerance, Math.abs(b) * 0.005)

/**
 * Works out both sides of a transfer and what can go wrong with it. Pure, so it can run on a server too.
 * `rate` is receiving units per sending unit; fees are taken from what is sent (as Wise and most providers do).
 */
export function readTransfer(
  value: FxAmountValue,
  quote: FxQuote,
  from: string,
  to: string,
  charges: FxCharges = "SHA",
  expected?: FxExpected | null,
): FxReadback {
  const rate = Number(quote?.rate)
  const fixed = Math.max(0, Number(quote?.fixedFee) || 0)
  const pct = Math.min(99, Math.max(0, Number(quote?.percentFee) || 0)) / 100
  const inter = charges === "OUR" ? 0 : Math.max(0, Number(quote?.intermediaryFee) || 0)
  const our = charges === "OUR" ? Math.max(0, Number(quote?.ourFee) || 0) : 0
  from = String(from ?? "").toUpperCase()
  to = String(to ?? "").toUpperCase()
  const sd = minorUnits(from)
  const td = minorUnits(to)
  const amount = value?.amount
  const empty: FxReadback = { send: 0, receive: 0, arrivesAtLeast: 0, fee: 0, problems: [] }
  if (!(rate > 0) || !Number.isFinite(rate) || amount == null || !(amount > 0) || !Number.isFinite(amount)) {
    if (expected && expected.currency.toUpperCase() !== to) empty.problems.push({ kind: "currency", expected: expected.currency })
    return empty
  }

  let send: number
  let receive: number
  if (value.side === "send") {
    send = roundTo(amount, sd)
    const base = send - our
    receive = Math.max(0, roundTo((base * (1 - pct) - fixed) * rate, td))
  } else {
    receive = roundTo(amount, td)
    send = roundTo((receive / rate + fixed) / (1 - pct) + our, sd)
  }
  const fee = roundTo(send - our - receive / rate, sd) + our
  const arrivesAtLeast = Math.max(0, roundTo(receive - inter, td))
  const problems: FxProblem[] = []

  if (expected && expected.amount > 0 && Number.isFinite(expected.amount)) {
    const tol = 10 ** -td
    if (expected.currency.toUpperCase() !== to) problems.push({ kind: "currency", expected: expected.currency })
    else {
      // The classic slip: the invoice figure typed into "You send", so fees and the rate shrink it on the way.
      if (value.side === "send" && from !== to && near(amount, expected.amount, tol) && !near(receive, expected.amount, tol))
        problems.push({ kind: "wrongBox", typed: amount })
      if (receive < expected.amount - tol) problems.push({ kind: "short", by: roundTo(expected.amount - receive, td), worstCase: false })
      else if (arrivesAtLeast < expected.amount - tol) problems.push({ kind: "short", by: roundTo(expected.amount - arrivesAtLeast, td), worstCase: true })
      else if (receive > expected.amount * 1.01 + tol) problems.push({ kind: "over", by: roundTo(receive - expected.amount, td) })
    }
  } else if (inter > 0) problems.push({ kind: "deductions", upTo: inter })

  return { send, receive, arrivesAtLeast, fee: roundTo(fee, sd), problems }
}
