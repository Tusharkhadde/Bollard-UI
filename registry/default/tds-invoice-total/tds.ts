/**
 * Pure TDS maths for an Indian freelancer's invoice.
 * - Income-tax Act, 2025 s.393(1) Table Sl. 6(iii) (old s.194J): professional fees 10%, technical
 *   services 2%; threshold ₹50,000 a year per payment type. Sl. 6(i) (old s.194C): contracts 1%
 *   (individual/HUF) or 2% (others); ₹30,000 a sum or ₹1,00,000 a year. In force for sums paid or
 *   credited from 1 Apr 2026; earlier sums stay under the 1961 Act.
 * - s.393(1)(a): once the year's total crosses the threshold, TDS is due on the entire amount, so the
 *   invoice that crosses it may carry TDS on the earlier, untaxed invoices too (a "catch-up").
 * - s.393(4) Sl. 8–9: no TDS when an individual/HUF pays for personal purposes, except Sl. 6(ii)
 *   (old s.194M): 2% once an individual/HUF pays over ₹50 lakh a year for contract or professional work.
 * - s.397(2) (old s.206AA): no PAN, TDS at the higher of the normal rate or 20%.
 * - CBDT Circular 23/2017: when GST is shown separately, TDS is on the amount without GST (kept in
 *   force for the 2025 Act by s.536(2)(j)).
 * The Act that applies is fixed by the earlier of credit or payment; the invoice date is a proxy.
 * Sources: incometaxindia.gov.in/w/section-393-5, /w/section-397-6.
 */

export type TdsKind = "professional" | "technical" | "contract"
export type TdsPayer = "business" | "personal" | "abroad"

export interface TdsInvoice {
  /** Your fee before GST, in rupees. */
  fee: number
  /** Kind of work: sets the TDS rate and threshold. */
  kind?: TdsKind
  /** Who pays: an Indian business deducts TDS; a person paying for themselves or a client abroad doesn't. */
  payer?: TdsPayer
  /** Contracts only: 1% for an individual/HUF, 2% for anyone else. */
  payeeType?: "individual" | "other"
  /** Are you GST registered (you add GST on top). */
  gstRegistered?: boolean
  /** GST rate in percent. Default 18. */
  gstRate?: number
  /** Have you given the client your PAN. Default true. */
  panShared?: boolean
  /** Earlier invoices from this client this tax year, before this one. */
  paidThisYear?: number
  /** TDS the client says they deducted, to reconcile. */
  clientTds?: number | null
}

export type TdsIssue =
  | { kind: "noPan"; normalRate: number }
  | { kind: "onGst"; deducted: number; right: number }
  | { kind: "wrongRate"; deducted: number; usedRate: number; right: number }
  | { kind: "notRequired"; deducted: number }
  | { kind: "mismatch"; deducted: number; right: number }

export interface TdsResult {
  fee: number
  gst: number
  gstRate: number
  /** Invoice total: fee + GST. */
  gross: number
  /** TDS rate in percent, after any no-PAN uplift; 0 when TDS doesn't apply. */
  rate: number
  tds: number
  /** What lands in your account. */
  net: number
  /** Why TDS does or doesn't apply. "personalLarge": a person paying over ₹50 lakh a year (2%). */
  reason: "applies" | "below" | "personal" | "personalLarge" | "abroad"
  /** The threshold that decides it, and the year's total including this invoice. */
  threshold: number
  yearTotal: number
  /** Section to quote: the 2025 Act from 1 Apr 2026, the 1961 Act before. */
  section: { current: string; old?: string }
  /** Catch-up TDS the client legitimately took on earlier invoices this year, when it matches; else 0. */
  catchUp: number
  issues: TdsIssue[]
}

export const NEW_ACT_FROM = Date.UTC(2026, 3, 1) - 5.5 * 3_600_000 // 1 Apr 2026, 00:00 IST
const MAX = 1e12
const rupees = (value: unknown) => {
  const n = typeof value === "number" ? value : typeof value === "string" ? parseAmount(value) : NaN
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX) : 0
}
const paise = (n: number) => Math.round(n * 100) / 100

/** "₹1,23,456.50", "50k", "1.2 lakh" → number; NaN for garbage. Handles a BOM and stray spaces. */
export function parseAmount(text: string): number {
  if (typeof text !== "string") return NaN
  const clean = text.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[₹,\s]|rs\.?|inr/g, "")
  const match = clean.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lakhs|lac|cr|crore)?$/)
  if (!match) return NaN
  const scale = { k: 1e3, l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, cr: 1e7, crore: 1e7 }[match[2] ?? ""] ?? 1
  return Number(match[1]) * scale
}

/** Base TDS rate for the work, before any no-PAN uplift. */
export const baseRate = (kind: TdsKind = "professional", payeeType: "individual" | "other" = "individual") =>
  kind === "professional" ? 10 : kind === "technical" ? 2 : payeeType === "individual" ? 1 : 2

/** Section to quote. `personal` is the ₹50 lakh rule for individuals (old 194M). */
export function sectionFor(kind: TdsKind, date: number, personal = false) {
  const old = personal ? "194M" : kind === "contract" ? "194C" : "194J"
  if (!(date >= NEW_ACT_FROM)) return { current: old }
  return { current: personal ? "393(1) Sl. 6(ii)" : kind === "contract" ? "393(1) Sl. 6(i)" : "393(1) Sl. 6(iii)", old }
}

const PERSONAL_LIMIT = 50_00_000

export function computeTds(invoice: TdsInvoice, options: { date?: number } = {}): TdsResult {
  const input = invoice && typeof invoice === "object" ? invoice : ({ fee: 0 } as TdsInvoice)
  const kind: TdsKind = input.kind === "technical" || input.kind === "contract" ? input.kind : "professional"
  const payer: TdsPayer = input.payer === "personal" || input.payer === "abroad" ? input.payer : "business"
  const fee = rupees(input.fee)
  const gstRate = Number.isFinite(input.gstRate) && (input.gstRate as number) >= 0 && (input.gstRate as number) <= 100 ? (input.gstRate as number) : 18
  // Exports of services are zero-rated, so a client abroad pays no GST.
  const gst = input.gstRegistered && payer !== "abroad" ? paise((fee * gstRate) / 100) : 0
  const gross = paise(fee + gst)
  const yearTotal = paise(rupees(input.paidThisYear) + fee)
  // Technical services aren't covered by the ₹50 lakh rule for individuals; contract and professional work are.
  const personalLarge = payer === "personal" && kind !== "technical" && yearTotal > PERSONAL_LIMIT
  const threshold = personalLarge ? PERSONAL_LIMIT : kind === "contract" ? (fee > 30_000 ? 30_000 : 1_00_000) : 50_000
  const over = kind === "contract" ? fee > 30_000 || yearTotal > 1_00_000 : yearTotal > 50_000
  const reason = payer === "abroad" ? "abroad" : personalLarge ? "personalLarge" : payer === "personal" ? "personal" : over ? "applies" : "below"
  const normalRate = personalLarge ? 2 : baseRate(kind, input.payeeType)
  const noPan = input.panShared === false
  const rate = reason === "applies" || reason === "personalLarge" ? (noPan ? Math.max(normalRate, 20) : normalRate) : 0
  const tds = paise((fee * rate) / 100)
  const issues: TdsIssue[] = []
  if (noPan && (payer === "business" || personalLarge)) issues.push({ kind: "noPan", normalRate })

  // The invoice that first crosses the yearly threshold may carry TDS on the earlier, untaxed invoices.
  const earlier = rupees(input.paidThisYear)
  const aggregateThreshold = personalLarge ? PERSONAL_LIMIT : kind === "contract" ? 1_00_000 : 50_000
  const possibleCatchUp = rate > 0 && earlier > 0 && earlier <= aggregateThreshold && yearTotal > aggregateThreshold ? paise((earlier * rate) / 100) : 0

  const deducted = input.clientTds === null || input.clientTds === undefined ? null : rupees(input.clientTds)
  const catchUp = deducted !== null && possibleCatchUp > 0 && Math.abs(deducted - tds - possibleCatchUp) < 1 ? possibleCatchUp : 0
  if (deducted !== null && !catchUp && Math.abs(deducted - tds) >= 1) {
    const near = (a: number, b: number) => Math.abs(a - b) < 1
    const usedRate = [1, 2, 10, 20].find((r) => near(deducted, (fee * r) / 100))
    const gstRateUsed = [1, 2, 10, 20].find((r) => gst > 0 && near(deducted, (gross * r) / 100))
    if (rate === 0) issues.push({ kind: "notRequired", deducted })
    else if (gstRateUsed !== undefined) issues.push({ kind: "onGst", deducted, right: tds })
    else if (usedRate !== undefined) issues.push({ kind: "wrongRate", deducted, usedRate, right: tds })
    else issues.push({ kind: "mismatch", deducted, right: tds })
  }
  const taken = deducted ?? tds
  return {
    fee, gst, gstRate, gross, rate, tds, net: paise(gross - taken), reason, threshold, yearTotal,
    section: sectionFor(kind, options.date ?? Date.now(), personalLarge), catchUp, issues,
  }
}
