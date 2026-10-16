/** Loan terms as the borrower typed them. Every number may be null (empty) or NaN (garbage). */
export interface LoanTerms {
  /** Loan amount in rupees. */
  amount: number | null
  /** Interest rate in % a year, as quoted. */
  rate: number | null
  /** "reducing": interest on what's still owed (the honest way). "flat": interest on the full amount for the whole tenure. */
  rateType: "reducing" | "flat"
  tenure: number | null
  tenureUnit: "months" | "years"
  /** Processing fee, before GST. */
  fee: number | null
  feeUnit: "percent" | "amount"
  /** Other upfront charges in rupees taken from the loan (insurance, stamp duty, documentation). Counted in the APR, as RBI's KFS requires. */
  otherCharges?: number | null
  /** One-off prepayment, rupees. */
  prepay: number | null
  /** Prepay after this many EMIs. */
  prepayAfter: number | null
  /** Keep the EMI and finish sooner, or keep the end date and pay a smaller EMI. */
  prepayMode: "tenure" | "emi"
}

export const EMPTY_LOAN: LoanTerms = {
  amount: null, rate: null, rateType: "reducing", tenure: null, tenureUnit: "years",
  fee: null, feeUnit: "percent", otherCharges: null, prepay: null, prepayAfter: null, prepayMode: "tenure",
}

const MAX_MONTHS = 1200
const ok = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n)

/** Reads "5,00,000", "₹5 lakh", "5L", "1.2 cr", "50k", "12.5" or "12.5%" as a number ("12." mid-typing is 12). Null when empty, NaN when it isn't one. */
export function parseAmount(text: string): number | null {
  const s = String(text ?? "").replace(/^\uFEFF/, "").normalize("NFKC").toLowerCase().replace(/₹|rs\.?|inr|,|%|\s/g, "")
  if (!s) return null
  const m = /^(\d+(?:\.\d*)?|\.\d+)(l|lac|lacs|lakh|lakhs|cr|crore|crores|k)?$/.exec(s)
  if (!m) return Number.NaN
  const unit = m[2] ?? ""
  return Number(m[1]) * (unit.startsWith("c") ? 1e7 : unit === "k" ? 1e3 : unit ? 1e5 : 1)
}

/** Reducing-balance EMI: P·r·(1+r)^n / ((1+r)^n − 1), with r the monthly rate. */
export function emiFor(principal: number, annualRate: number, months: number) {
  if (!(principal > 0) || !(months > 0)) return 0
  const r = annualRate / 1200
  if (r <= 0) return principal / months
  const f = (1 + r) ** months
  return (principal * r * f) / (f - 1)
}

/** Solves for the monthly rate at which `payment` repays `principal` over `months` (bisection, so it never diverges). */
function monthlyRateFor(principal: number, payment: number, months: number) {
  if (!(principal > 0) || !(months > 0) || payment * months <= principal) return 0
  let lo = 0, hi = 1
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (emiFor(principal, mid * 1200, months) > payment) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/** The reducing-balance rate a flat rate really costs: 12% flat over 3 years is about 21% reducing. */
export function flatToReducing(flatRate: number, months: number) {
  if (!(flatRate > 0) || !(months > 0)) return 0
  const P = 100_000
  return monthlyRateFor(P, (P + (P * flatRate * months) / 1200) / months, months) * 1200
}

interface Schedule { interest: number; months: number; lastEmi: number }

/** Month-by-month schedule with an optional prepayment, so partial last EMIs and rounding come out right. */
function simulate(principal: number, r: number, emi: number, months: number, prepay = 0, after = 0, mode: "tenure" | "emi" = "tenure"): Schedule {
  let balance = principal, interest = 0, pay = emi, m = 0, lastEmi = emi
  while (balance > 0.005 && m < MAX_MONTHS) {
    m++
    const due = balance * r
    interest += due
    const payment = Math.min(pay, balance + due)
    balance += due - payment
    lastEmi = payment
    if (prepay > 0 && m === after) {
      balance = Math.max(0, balance - prepay)
      if (mode === "emi" && months - m > 0) pay = emiFor(balance, r * 1200, months - m)
    }
  }
  return { interest, months: m, lastEmi }
}

export interface LoanReadback {
  months: number
  emi: number
  /** The reducing rate actually being paid (same as the quote unless it's flat). */
  effectiveRate: number
  interest: number
  feeBeforeGst: number
  gst: number
  /** Other upfront charges (insurance, stamp duty…), rupees. */
  otherCharges: number
  totalPayable: number
  /** What reaches the bank account: amount − fee − GST − other charges. Zero or less means the charges eat the loan. */
  disbursed: number
  /**
   * Annual cost including fees: the monthly IRR of (money received, EMIs) × 12, on the reducing balance. This is the
   * method of RBI's KFS circular (RBI/2024-25/18, Annex B: ₹20,000 at 15% for 24 months with ₹400 charges → 17.07%).
   * 0 when nothing reaches the account.
   */
  apr: number
  prepayment?: {
    interestSaved: number
    monthsSaved: number
    /** New EMI when keeping the end date. */
    newEmi: number
    charge: number
  }
}

export interface ReadbackOptions {
  /** GST on the processing fee, %. 18 in India (SAC 9971). */
  gstRate?: number
  /** Prepayment charge as % of the amount prepaid (before GST). */
  prepayCharge?: number
}

/** Works out EMI, interest, fees, APR and the effect of a prepayment. Null when the terms can't make a loan yet. */
export function readLoan(t: LoanTerms, { gstRate = 18, prepayCharge = 0 }: ReadbackOptions = {}): LoanReadback | null {
  if (!ok(t.amount) || !ok(t.rate) || !ok(t.tenure) || t.amount <= 0 || t.rate < 0 || t.tenure <= 0 || t.rate > 200) return null
  const months = Math.round(t.tenureUnit === "years" ? t.tenure * 12 : t.tenure)
  if (months < 1 || months > MAX_MONTHS) return null
  const P = t.amount
  const flat = t.rateType === "flat"
  const effectiveRate = flat ? flatToReducing(t.rate, months) : t.rate
  const emi = flat ? (P + (P * t.rate * months) / 1200) / months : emiFor(P, t.rate, months)
  const r = effectiveRate / 1200
  const base = simulate(P, r, emi, months)
  const feeBeforeGst = ok(t.fee) && t.fee > 0 ? Math.min(P, t.feeUnit === "percent" ? (P * t.fee) / 100 : t.fee) : 0
  const gst = (feeBeforeGst * gstRate) / 100
  const otherCharges = ok(t.otherCharges) && t.otherCharges > 0 ? t.otherCharges : 0
  const disbursed = P - feeBeforeGst - gst - otherCharges
  const apr = disbursed > 0 ? monthlyRateFor(disbursed, emi, months) * 1200 : 0
  const out: LoanReadback = { months, emi, effectiveRate, interest: base.interest, feeBeforeGst, gst, otherCharges, totalPayable: P + base.interest + feeBeforeGst + gst + otherCharges, disbursed, apr }
  const after = ok(t.prepayAfter) ? Math.round(t.prepayAfter) : 0
  if (ok(t.prepay) && t.prepay > 0 && after >= 1 && after < base.months) {
    const withPrepay = simulate(P, r, emi, months, t.prepay, after, t.prepayMode)
    const charge = ((t.prepay * prepayCharge) / 100) * (1 + gstRate / 100)
    const newEmi = t.prepayMode === "emi" ? emiFor(Math.max(0, balanceAfter(P, r, emi, after) - t.prepay), effectiveRate, months - after) : emi
    out.prepayment = { interestSaved: base.interest - withPrepay.interest - charge, monthsSaved: base.months - withPrepay.months, newEmi, charge }
  }
  return out
}

function balanceAfter(P: number, r: number, emi: number, k: number) {
  if (r === 0) return Math.max(0, P - emi * k)
  const f = (1 + r) ** k
  return Math.max(0, P * f - (emi * (f - 1)) / r)
}

export type LoanIssue =
  /** `emiAsTyped` is 0 when the typed tenure is too long to work out at all. */
  | { kind: "tenureYears"; months: number; emiAsTyped: number; emiIfFixed: number }
  | { kind: "tenureMonths"; months: number; emiAsTyped: number; emiIfFixed: number }
  | { kind: "monthlyRate"; annual: number }
  | { kind: "flatRate"; effective: number }
  | { kind: "prepayTooLate"; months: number }
  | { kind: "prepayTooBig" }
  /** A prepayment amount with no EMI number to make it after. */
  | { kind: "prepayWhen" }
  /** Fees and charges take the whole loan: nothing reaches the account. */
  | { kind: "feeTooBig" }

export interface IssueOptions extends ReadbackOptions {
  /** Longest plausible loan, years. Above this, "years" was probably months. */
  maxYears?: number
  /** A tenure in months at or below this is double-checked as possibly years. */
  shortMonths?: number
  /** A rate below this % a year is probably a monthly rate. */
  minAnnualRate?: number
}

/** Mistakes in how the terms were typed, each with what the EMI would be either way. */
export function loanIssues(t: LoanTerms, opts: IssueOptions = {}): LoanIssue[] {
  const { maxYears = 30, shortMonths = 10, minAnnualRate = 3 } = opts
  const issues: LoanIssue[] = []
  if (!ok(t.amount) || t.amount <= 0 || !ok(t.tenure) || t.tenure <= 0) return issues
  const rate = ok(t.rate) ? t.rate : 0
  const emiAt = (months: number) => readLoan({ ...t, tenure: months, tenureUnit: "months" }, opts)?.emi ?? 0
  const n = t.tenure
  if (t.tenureUnit === "years" && n > maxYears && Number.isInteger(n) && n <= MAX_MONTHS)
    issues.push({ kind: "tenureYears", months: n, emiAsTyped: n * 12 <= MAX_MONTHS ? emiAt(n * 12) : 0, emiIfFixed: emiAt(n) })
  if (t.tenureUnit === "months" && n <= shortMonths && n <= maxYears && Number.isInteger(n))
    issues.push({ kind: "tenureMonths", months: n, emiAsTyped: emiAt(n), emiIfFixed: emiAt(n * 12) })
  if (rate > 0 && rate < minAnnualRate) issues.push({ kind: "monthlyRate", annual: rate * 12 })
  const read = readLoan(t, opts)
  if (read && t.rateType === "flat" && rate > 0) issues.push({ kind: "flatRate", effective: read.effectiveRate })
  if (read && read.disbursed <= 0) issues.push({ kind: "feeTooBig" })
  if (read && ok(t.prepay) && t.prepay > 0) {
    const after = ok(t.prepayAfter) ? Math.round(t.prepayAfter) : 0
    if (after < 1) issues.push({ kind: "prepayWhen" })
    else if (after >= read.months) issues.push({ kind: "prepayTooLate", months: read.months })
    // Compared with what's still owed then, not the original amount.
    else if (t.prepay >= balanceAfter(t.amount, read.effectiveRate / 1200, read.emi, after) - 0.5) issues.push({ kind: "prepayTooBig" })
  }
  return issues
}
