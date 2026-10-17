// Bollard UI — cheque-check · MIT licence · https://bollard-ui.vercel.app/components/cheque-check

/**
 * Pure cheque-date rules (India first, configurable elsewhere). Sources:
 * - RBI DBOD.AML.BC.No.47/14.01.001/2011-12 (4 Nov 2011): from 1 Apr 2012 banks don't pay cheques, drafts,
 *   pay orders or banker's cheques presented more than three months after the instrument's date.
 * - RBI CTS-2010 standard (DPSS.CO.CHD.No.1832, 22 Feb 2010) and RBI cheque clearing FAQ: no changes on a cheque
 *   other than for date validation; a changed payee, amount in figures or amount in words needs a fresh cheque.
 * - RBI DPSS.CO.RPPD.No.309/04.07.005/2020-21 (25 Sep 2020): Positive Pay is offered for cheques of ₹50,000 and
 *   above, and banks may make it mandatory from ₹5,00,000.
 * - RBI doesn't say whether "three months from the date" ends on the same date three months on or the day before.
 *   Under General Clauses Act 1897 s.9, "from" excludes the first day, so 14 Jul runs to 14 Oct; some banks and
 *   treasuries stop a day earlier (1 Apr → 30 Jun). The window shows the earlier, safe day; the disputed last day is a
 *   warning, not a block.
 */

export type ChequeMode = "receive" | "issue"
export type ChequeCorrection = "none" | "date" | "amount" | "payee"

export interface ChequeDetails {
  /** The date exactly as written in the boxes, e.g. "14102026", "14/10/2026" or "14-10-26". */
  date: string
  /** Amount in rupees (or your currency). */
  amount?: number | null
  /** Anything crossed out or overwritten on the cheque. */
  corrected?: ChequeCorrection
}

export interface ChequeRules {
  /** Months a cheque stays valid from its date. RBI: 3. */
  validityMonths?: number
  /** Positive Pay is offered from this amount. RBI: 50,000. */
  positivePayFrom?: number
  /** Many banks return cheques from this amount without Positive Pay. RBI allows banks to mandate it: 5,00,000. */
  positivePayMandatoryFrom?: number
  /** Warn when this few days are left to deposit. Default 7. */
  soonDays?: number
}

export type ParsedChequeDate =
  | { ok: true; day: number; month: number; year: number; shortYear: boolean }
  | { ok: false; reason: "empty" | "incomplete" | "month" | "noSuchDay"; day?: number; month?: number; year?: number }

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

/**
 * Reads a cheque date as written: DD MM YYYY in any separators, 8 or 6 bare digits like the CTS boxes, a month name
 * ("14 Oct 2026") or a pasted ISO date ("2026-10-14").
 */
export function parseChequeDate(text: unknown): ParsedChequeDate {
  const raw = typeof text === "string" ? text.replace(/^\uFEFF/, "").trim() : ""
  if (!raw) return { ok: false, reason: "empty" }
  const named = raw.toLowerCase().replace(/[a-z]+/g, (w) => { const i = MONTHS.indexOf(w.slice(0, 3)); return i >= 0 ? ` ${i + 1} ` : " " })
  let parts = /^\d{8}$/.test(raw) ? [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4)]
    : /^\d{6}$/.test(raw) ? [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4)]
    : named.split(/[^\d]+/).filter(Boolean)
  if (parts.length === 3 && parts[0].length === 4) parts = [parts[2], parts[1], parts[0]]
  if (parts.length < 3 || parts.some((p) => p.length > 4) || ![2, 4].includes(parts[2].length)) return { ok: false, reason: "incomplete" }
  const [day, month] = [Number(parts[0]), Number(parts[1])]
  const shortYear = parts[2].length === 2
  const year = shortYear ? 2000 + Number(parts[2]) : Number(parts[2])
  if (month < 1 || month > 12) return { ok: false, reason: "month", day, month, year }
  if (day < 1 || day > daysIn(year, month)) return { ok: false, reason: "noSuchDay", day, month, year }
  return { ok: true, day, month, year, shortYear }
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()
/** Whole days since 1970 for a calendar date, so time zones and DST never shift a day. */
export const dayNumber = (year: number, month: number, day: number) => Math.round(Date.UTC(year, month - 1, day) / 864e5)
export const fromDayNumber = (n: number) => {
  const d = new Date(n * 864e5)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/**
 * Last day the bank will pay: the day before the same date `months` later (dated 14 Jul → 13 Oct), or the month's
 * last day when that date doesn't exist (31 Mar → 30 Jun). Deliberately the cautious reading of "three months".
 */
export function lastValidDay(year: number, month: number, day: number, months = 3): number {
  const total = month - 1 + months
  const y = year + Math.floor(total / 12)
  const m = (total % 12) + 1
  const dim = daysIn(y, m)
  return day > dim ? dayNumber(y, m, dim) : dayNumber(y, m, day) - 1
}

/** The same date `months` later (or that month's last day): the end of the window on the legal reading. */
export function sameDateLimit(year: number, month: number, day: number, months = 3): number {
  const total = month - 1 + months
  const y = year + Math.floor(total / 12)
  const m = (total % 12) + 1
  return dayNumber(y, m, Math.min(day, daysIn(y, m)))
}

export type ChequeIssue =
  | { kind: "incomplete" | "month" }
  | { kind: "noSuchDay"; day: number; month: number }
  | { kind: "shortYear"; year: number }
  | { kind: "stale"; expired: number }
  /** Exactly three months on: valid on the legal reading, refused by some banks. */
  | { kind: "lastDay"; day: number }
  | { kind: "lastYear"; suggested: number }
  | { kind: "soon"; until: number; days: number }
  | { kind: "postDated"; from: number }
  | { kind: "postDatedIssue"; from: number }
  | { kind: "corrected"; field: "amount" | "payee" }
  | { kind: "dateCorrected" }
  | { kind: "positivePay"; mandatory: boolean }

export interface ChequeReadback {
  issues: ChequeIssue[]
  /** First and last day the bank will pay, as day numbers, when the date is readable. */
  from?: number
  until?: number
  /** True when the bank will return the cheque as it stands. */
  blocked: boolean
}

/** Checks a cheque against the validity window, post-dating, CTS correction rules and Positive Pay. */
export function checkCheque(details: Partial<ChequeDetails> | null | undefined, today: number | undefined, mode: ChequeMode = "receive", rules: ChequeRules = {}): ChequeReadback {
  const { validityMonths = 3, positivePayFrom = 50000, positivePayMandatoryFrom = 500000, soonDays = 7 } = rules
  const issues: ChequeIssue[] = []
  const parsed = parseChequeDate(details?.date)
  const amount = Number(details?.amount)
  let from: number | undefined
  let until: number | undefined

  if (!parsed.ok) {
    if (parsed.reason === "noSuchDay") issues.push({ kind: "noSuchDay", day: parsed.day ?? 0, month: parsed.month ?? 0 })
    else if (parsed.reason !== "empty") issues.push({ kind: parsed.reason })
  } else {
    from = dayNumber(parsed.year, parsed.month, parsed.day)
    until = lastValidDay(parsed.year, parsed.month, parsed.day, validityMonths)
    if (parsed.shortYear) issues.push({ kind: "shortYear", year: parsed.year })
    if (today !== undefined) {
      const lastYear = dayNumber(parsed.year + 1, parsed.month, Math.min(parsed.day, daysIn(parsed.year + 1, parsed.month)))
      if (today > until) {
        // A January cheque still carrying last year's date: offer the year it was probably meant to have.
        const now = fromDayNumber(today)
        if (mode === "issue" && now.month <= 2 && parsed.year === now.year - 1 && Math.abs(lastYear - today) <= 45) issues.push({ kind: "lastYear", suggested: parsed.year + 1 })
        else if (mode === "receive" && today === sameDateLimit(parsed.year, parsed.month, parsed.day, validityMonths) && today !== until) issues.push({ kind: "lastDay", day: today })
        else issues.push({ kind: "stale", expired: until })
      } else if (today < from) {
        issues.push(mode === "receive" ? { kind: "postDated", from } : { kind: "postDatedIssue", from })
      } else if (mode === "receive" && until - today < soonDays) {
        issues.push({ kind: "soon", until, days: until - today + 1 })
      }
    }
  }
  if (details?.corrected === "amount" || details?.corrected === "payee") issues.push({ kind: "corrected", field: details.corrected })
  if (details?.corrected === "date") issues.push({ kind: "dateCorrected" })
  if (Number.isFinite(amount) && amount >= positivePayFrom && (mode === "issue" || amount >= positivePayMandatoryFrom))
    issues.push({ kind: "positivePay", mandatory: amount >= positivePayMandatoryFrom })

  const blocking = new Set(["incomplete", "month", "noSuchDay", "stale", "lastYear", "corrected"])
  return { issues, from, until, blocked: issues.some((i) => blocking.has(i.kind)) }
}

/** Rewrites the date in the same shape the user typed, with a new year. */
export function withYear(text: string, year: number): string {
  const p = parseChequeDate(text)
  if (!p.ok && p.reason !== "noSuchDay") return text
  const d = p.day ?? 1
  const m = p.month ?? 1
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${year}`
}
