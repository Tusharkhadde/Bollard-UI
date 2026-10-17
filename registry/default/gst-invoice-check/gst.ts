// Bollard UI — gst-invoice-check · MIT licence · https://bollard-ui.vercel.app/components/gst-invoice-check

import { checkTaxId, cleanTaxId, GST_STATES } from "@/registry/default/tax-id-input/tax-id"

/** Union territories without a legislature charge UTGST instead of SGST (UTGST Act, 2017). */
export const UTGST_CODES = ["04", "25", "26", "31", "35", "38"]

/**
 * GST 2.0 slabs, 22 Sep 2025 to 31 Jan 2026: 28% only for tobacco and pan masala. 7.5% and 12% are
 * the real-estate rates of Notification 11/2017-CT(R) that GST 2.0 left alone (12% only for projects
 * that opted for the pre-2019 rate).
 */
export const GST_RATES = [0, 0.1, 0.25, 1.5, 3, 5, 7.5, 12, 18, 28, 40]
/** Slabs before 22 Sep 2025. */
export const GST_RATES_2017 = [0, 0.1, 0.25, 1.5, 3, 5, 7.5, 12, 18, 28]
/** From 1 Feb 2026 the 28% schedule is gone: tobacco and pan masala at 40%, bidis at 18% (Notification 19/2025-CT(R)). */
export const GST_RATES_2026 = [0, 0.1, 0.25, 1.5, 3, 5, 7.5, 12, 18, 40]
export const GST_2_DATE = "2025-09-22"
export const GST_28_END_DATE = "2026-02-01"

/**
 * Each slab set with the day it took effect (IST), newest last. `rare` rates are still legal but
 * almost never right for ordinary goods and services, so they get a softer warning.
 */
export const GST_SLAB_PERIODS: { from: string; rates: number[]; rare: number[] }[] = [
  { from: "2017-07-01", rates: GST_RATES_2017, rare: [] },
  { from: GST_2_DATE, rates: GST_RATES, rare: [12, 28] },
  { from: GST_28_END_DATE, rates: GST_RATES_2026, rare: [12] },
]

const starts = (from: string) => new Date(`${from}T00:00:00+05:30`).getTime()

/** The day `rate` was dropped (or, with `rare`, narrowed to a niche) on or before `at`. */
function slabEnded(rate: number, at: number, rare = false) {
  return GST_SLAB_PERIODS.find((p, i) => {
    const prev = GST_SLAB_PERIODS[i - 1]
    if (!prev || starts(p.from) > at) return false
    return rare ? p.rare.includes(rate) && !prev.rare.includes(rate) : !p.rates.includes(rate) && prev.rates.includes(rate)
  })?.from
}

export type GstHead = "cgst" | "sgst" | "utgst" | "igst"

export interface GstLine {
  description: string
  /** Value before tax. */
  taxableValue: number
  /** Total GST rate in percent, e.g. 18. */
  rate: number
}

/** What the invoice actually shows. Leave a head out when it isn't on the invoice. */
export type GstCharged = Partial<Record<GstHead | "total", number>>

export interface GstInvoice {
  supplierGstin: string
  /** Buyer's GSTIN for B2B invoices. Its state is the default place of supply. */
  recipientGstin?: string
  /** Two-digit state code of the place of supply ("29"). 96 is a foreign country. */
  placeOfSupply?: string
  /** SEZ supplies and exports are inter-state whatever the states. */
  supplyType?: "regular" | "sez" | "export"
  lines: GstLine[]
  charged: GstCharged
  /** Picks the rate slabs in force. Defaults to the current ones. */
  invoiceDate?: Date | string
  /** Largest round-off allowed on the invoice total, in rupees. */
  roundOff?: number
  /**
   * Export or SEZ supply under a Letter of Undertaking (or bond): zero-rated, so no IGST is charged.
   * Without it, exports and SEZ supplies are checked as IGST-paid.
   */
  lut?: boolean
}

export type GstIssue =
  | { kind: "gstin"; party: "supplier" | "recipient" }
  | { kind: "no-pos" }
  | { kind: "head"; wanted: "intra" | "inter" }
  | { kind: "ut-head"; wanted: "sgst" | "utgst" }
  | { kind: "split"; cgst: number; other: number }
  | { kind: "rate"; line: number; rate: number; retired: boolean; endedOn?: string; rare?: boolean }
  | { kind: "lut" }
  | { kind: "amount"; head: GstHead; charged: number; expected: number }
  | { kind: "total"; charged: number; expected: number }
  | { kind: "pos-differs"; recipientState: string }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Checks an invoice's tax the way a GST officer would: supplier state (GSTIN digits 1–2)
 * against place of supply picks CGST + SGST/UTGST or IGST, every rate must be a slab in force
 * on the invoice date, each head and the total must add up. Returns the expected tax too, so
 * a caller can offer a one-tap fix.
 */
export function checkGstInvoice(invoice: GstInvoice) {
  const issues: GstIssue[] = []
  const supplier = cleanTaxId(invoice.supplierGstin)
  const recipient = invoice.recipientGstin ? cleanTaxId(invoice.recipientGstin) : ""
  if (checkTaxId("gstin", supplier, true).status !== "valid") issues.push({ kind: "gstin", party: "supplier" })
  if (recipient && checkTaxId("gstin", recipient, true).status !== "valid") issues.push({ kind: "gstin", party: "recipient" })

  const from = supplier.slice(0, 2)
  const pos = invoice.placeOfSupply ?? (recipient ? recipient.slice(0, 2) : undefined)
  if (!pos || !GST_STATES[pos]) issues.push({ kind: "no-pos" })
  if (recipient && pos && recipient.slice(0, 2) !== pos) issues.push({ kind: "pos-differs", recipientState: recipient.slice(0, 2) })

  const type = invoice.supplyType ?? (pos === "96" ? "export" : "regular")
  const intra = type === "regular" && !!pos && from === pos
  const localHead: GstHead = UTGST_CODES.includes(from) ? "utgst" : "sgst"

  const date = new Date(invoice.invoiceDate ?? Date.now())
  const t = date.getTime()
  const period = [...GST_SLAB_PERIODS].reverse().find((p) => starts(p.from) <= t) ?? GST_SLAB_PERIODS[0]
  invoice.lines.forEach((line, i) => {
    if (!period.rates.includes(line.rate)) {
      const endedOn = slabEnded(line.rate, t)
      issues.push({ kind: "rate", line: i, rate: line.rate, retired: !!endedOn, endedOn })
    } else if (period.rare.includes(line.rate)) issues.push({ kind: "rate", line: i, rate: line.rate, retired: true, endedOn: slabEnded(line.rate, t, true), rare: true })
  })

  const taxable = round2(invoice.lines.reduce((sum, l) => sum + l.taxableValue, 0))
  const tax = invoice.lines.reduce((sum, l) => sum + (l.taxableValue * l.rate) / 100, 0)
  const zeroRated = !!invoice.lut && (type === "export" || type === "sez")
  const expected: GstCharged = intra ? { cgst: round2(tax / 2), [localHead]: round2(tax / 2) } : { igst: zeroRated ? 0 : round2(tax) }
  expected.total = Math.round(taxable + (expected.cgst ?? 0) * 2 + (expected.igst ?? 0))

  const c = invoice.charged
  if (zeroRated && (c.cgst ?? 0) + (c.sgst ?? 0) + (c.utgst ?? 0) + (c.igst ?? 0) > 0) issues.push({ kind: "lut" })
  const chargedIntra = (c.cgst ?? 0) + (c.sgst ?? 0) + (c.utgst ?? 0) > 0
  const chargedInter = (c.igst ?? 0) > 0
  const tolerance = Math.max(0.5, 0.01 * invoice.lines.length)
  const wrongHead = (intra && chargedInter) || (!intra && chargedIntra)
  if (zeroRated) { /* reported above as one "lut" issue */ }
  else if (wrongHead) issues.push({ kind: "head", wanted: intra ? "intra" : "inter" })
  else if (intra) {
    const wrongLocal = localHead === "sgst" ? c.utgst : c.sgst
    if (wrongLocal) issues.push({ kind: "ut-head", wanted: localHead })
    const other = (c.sgst ?? 0) + (c.utgst ?? 0)
    if (Math.abs((c.cgst ?? 0) - other) > tolerance) issues.push({ kind: "split", cgst: c.cgst ?? 0, other })
  }
  if (!wrongHead && !zeroRated) {
    for (const head of ["cgst", "sgst", "utgst", "igst"] as const) {
      const want = expected[head] ?? 0
      const got = head === localHead ? (c.sgst ?? 0) + (c.utgst ?? 0) : head === "sgst" || head === "utgst" ? 0 : c[head] ?? 0
      if (want && Math.abs(got - want) > tolerance) issues.push({ kind: "amount", head, charged: got, expected: want })
    }
  }
  const chargedTax = (c.cgst ?? 0) + (c.sgst ?? 0) + (c.utgst ?? 0) + (c.igst ?? 0)
  // The total is checked against the invoice's own tax lines, so one wrong tax figure is one issue, not two.
  const adds = taxable + chargedTax
  if (c.total !== undefined && Math.abs(c.total - adds) > (invoice.roundOff ?? 1)) issues.push({ kind: "total", charged: c.total, expected: round2(adds) })

  return { from, pos, intra, type, localHead, taxable, expected, issues }
}
