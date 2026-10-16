// Bollard UI — bank-transfer-timing · MIT licence · https://bollard-ui.vercel.app/components/bank-transfer-timing

export type Rail = "IMPS" | "NEFT" | "RTGS" | "UPI"
export const RAILS: Rail[] = ["IMPS", "NEFT", "RTGS", "UPI"]

/**
 * Network rules as published (verify before each release; banks may set lower caps):
 * IMPS ₹5 lakh per transaction (RBI, Oct 2021; NPCI IMPS page). RTGS floor ₹2 lakh, no ceiling,
 * 24x7 since 14 Dec 2020, credit within 30 min (RBI RTGS FAQ). NEFT no floor or ceiling, 24x7 in 48
 * half-hourly batches, credit within 2 hours of the batch (RBI notification, Dec 2019; NEFT FAQ).
 */
export const RAIL_RULES = { impsMax: 500000, rtgsMin: 200000, neftCreditHours: 2, rtgsCreditMinutes: 30 }

export type UpiCategory = "p2p" | "merchant" | "tax" | "capital-markets" | "insurance" | "travel" | "credit-card" | "collections" | "jewellery"

/** UPI per-transaction and 24-hour limits by category (NPCI OC-185B, effective 15 Sep 2025; P2P unchanged at ₹1 lakh). Verified merchants only for the higher caps. */
export const UPI_LIMITS: Record<UpiCategory, { perTxn: number; perDay?: number }> = {
  p2p: { perTxn: 100000, perDay: 100000 },
  merchant: { perTxn: 100000 },
  tax: { perTxn: 500000 },
  "capital-markets": { perTxn: 500000, perDay: 1000000 },
  insurance: { perTxn: 500000, perDay: 1000000 },
  travel: { perTxn: 500000, perDay: 1000000 },
  "credit-card": { perTxn: 500000, perDay: 600000 },
  collections: { perTxn: 500000, perDay: 1000000 },
  jewellery: { perTxn: 200000, perDay: 600000 },
}

/** Your bank's own rules for a payee added recently. Banks set these; there is no single RBI number. */
export interface NewPayeeRule {
  /** When the payee was added. */
  addedAt: Date | string | number
  /** Minutes after adding before any transfer is allowed. */
  coolingMinutes?: number
  /** Most that can be sent to the payee during the first period. */
  firstDayLimit?: number
  /** Length of that first period in hours. Defaults to 24. */
  firstDayHours?: number
}

export interface TransferInput {
  amount: number
  rail: Rail
  now: Date
  upiCategory?: UpiCategory
  /** Overrides for `UPI_LIMITS`, e.g. a bank that caps UPI lower. */
  upiLimits?: Partial<Record<UpiCategory, { perTxn: number; perDay?: number }>>
  /** Your bank's per-day limit for each rail, if lower than the network's. */
  bankLimits?: Partial<Record<Rail, number>>
  newPayee?: NewPayeeRule
  /** Bank holidays as YYYY-MM-DD (India time). Sundays and 2nd/4th Saturdays are added automatically. */
  holidays?: string[]
  /** `branch` transfers only leave during branch hours on working days. */
  channel?: "online" | "branch"
  /** Branch hours in India time, "HH:MM". Defaults to 10:00–16:00. */
  branchHours?: { open: string; close: string }
}

export type TransferIssue =
  | { kind: "rtgs-min"; level: "block"; min: number; suggest: Rail[] }
  | { kind: "imps-max"; level: "block"; max: number; suggest: Rail[] }
  | { kind: "upi-max"; level: "block"; max: number; category: UpiCategory; suggest: Rail[] }
  | { kind: "bank-limit"; level: "block"; max: number; suggest: Rail[] }
  | { kind: "cooling"; level: "block"; until: Date; minutes: number }
  | { kind: "first-day"; level: "block"; max: number; until: Date }
  | { kind: "neft-large"; level: "info"; suggest: Rail[] }
  | { kind: "holiday"; level: "info" }

export type Arrival =
  | { kind: "instant" }
  | { kind: "realtime"; by: Date }
  | { kind: "batch"; batch: Date; by: Date }
  | { kind: "branch-closed"; leaves: Date }

const IST = 330 * 60000
/** India-time calendar parts of a moment, whatever the browser's zone (India has no DST). */
export function istParts(date: Date) {
  const d = new Date(date.getTime() + IST)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), dow: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), iso: d.toISOString().slice(0, 10) }
}
const istMidnight = (date: Date) => new Date(Math.floor((date.getTime() + IST) / 86400000) * 86400000 - IST)
const toMinutes = (hhmm: string, fallback: number) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "")
  return m ? Math.min(1439, Number(m[1]) * 60 + Number(m[2])) : fallback
}

/** Sundays, 2nd and 4th Saturdays (RBI, since 2015) and any date in `holidays`. */
export function isBankHoliday(date: Date, holidays: string[] = []): boolean {
  const p = istParts(date)
  return p.dow === 0 || (p.dow === 6 && ((p.day >= 8 && p.day <= 14) || (p.day >= 22 && p.day <= 28))) || holidays.includes(p.iso)
}

/** The next NEFT settlement: batches settle every half hour, round the clock. */
export function nextNeftBatch(now: Date): Date {
  const step = 30 * 60000
  return new Date(Math.floor((now.getTime() + IST) / step) * step + step - IST)
}

function branchOpening(now: Date, holidays: string[], hours: { open: string; close: string }): Date | undefined {
  const open = toMinutes(hours.open, 600)
  const close = toMinutes(hours.close, 960)
  const minutes = istParts(now).minutes
  if (!isBankHoliday(now, holidays) && minutes >= open && minutes < close) return undefined
  let day = istMidnight(now)
  if (isBankHoliday(now, holidays) || minutes >= close) day = new Date(day.getTime() + 86400000)
  for (let i = 0; i < 14 && isBankHoliday(day, holidays); i++) day = new Date(day.getTime() + 86400000)
  return new Date(day.getTime() + open * 60000)
}

const toDate = (value: Date | string | number | undefined) => {
  const d = value instanceof Date ? value : value === undefined ? undefined : new Date(value)
  return d && Number.isFinite(d.getTime()) ? d : undefined
}

/** When the money arrives on this rail, and everything that would stop or slow it. */
export function checkTransfer(input: TransferInput): { arrival: Arrival; issues: TransferIssue[] } {
  const amount = Number.isFinite(input.amount) ? Math.max(0, input.amount) : 0
  const now = toDate(input.now) ?? new Date(0)
  const { rail } = input
  const holidays = Array.isArray(input.holidays) ? input.holidays : []
  const issues: TransferIssue[] = []
  const fits = (r: Rail) => r === "NEFT" || (r === "IMPS" && amount <= RAIL_RULES.impsMax) || (r === "RTGS" && amount >= RAIL_RULES.rtgsMin)
  const others = (prefer: Rail[]) => prefer.filter((r) => r !== rail && fits(r))

  if (amount > 0) {
    if (rail === "RTGS" && amount < RAIL_RULES.rtgsMin) issues.push({ kind: "rtgs-min", level: "block", min: RAIL_RULES.rtgsMin, suggest: others(["IMPS", "NEFT"]) })
    if (rail === "IMPS" && amount > RAIL_RULES.impsMax) issues.push({ kind: "imps-max", level: "block", max: RAIL_RULES.impsMax, suggest: others(["RTGS", "NEFT"]) })
    if (rail === "UPI") {
      const category = input.upiCategory ?? "p2p"
      const limit = { ...UPI_LIMITS, ...input.upiLimits }[category] ?? UPI_LIMITS.p2p
      if (amount > limit.perTxn) issues.push({ kind: "upi-max", level: "block", max: limit.perTxn, category, suggest: others(["IMPS", "RTGS", "NEFT"]) })
    }
    const bank = input.bankLimits?.[rail]
    if (bank !== undefined && Number.isFinite(bank) && amount > bank) issues.push({ kind: "bank-limit", level: "block", max: bank, suggest: others(["IMPS", "RTGS", "NEFT"]) })
    if (rail === "NEFT" && amount >= RAIL_RULES.rtgsMin) issues.push({ kind: "neft-large", level: "info", suggest: ["RTGS"] })
  }

  const added = toDate(input.newPayee?.addedAt)
  if (added && amount > 0) {
    const cooling = Math.max(0, Number(input.newPayee?.coolingMinutes) || 0)
    const until = new Date(added.getTime() + cooling * 60000)
    if (until > now) issues.push({ kind: "cooling", level: "block", until, minutes: Math.ceil((until.getTime() - now.getTime()) / 60000) })
    const cap = Number(input.newPayee?.firstDayLimit)
    const end = new Date(added.getTime() + (Number(input.newPayee?.firstDayHours) || 24) * 3600000)
    if (Number.isFinite(cap) && cap > 0 && amount > cap && end > now) issues.push({ kind: "first-day", level: "block", max: cap, until: end })
  }

  const leaves = input.channel === "branch" && (rail === "NEFT" || rail === "RTGS") ? branchOpening(now, holidays, input.branchHours ?? { open: "10:00", close: "16:00" }) : undefined
  if (!leaves && isBankHoliday(now, holidays)) issues.push({ kind: "holiday", level: "info" })

  let arrival: Arrival
  if (leaves) arrival = { kind: "branch-closed", leaves }
  else if (rail === "NEFT") {
    const batch = nextNeftBatch(now)
    arrival = { kind: "batch", batch, by: new Date(batch.getTime() + RAIL_RULES.neftCreditHours * 3600000) }
  } else if (rail === "RTGS") arrival = { kind: "realtime", by: new Date(now.getTime() + RAIL_RULES.rtgsCreditMinutes * 60000) }
  else arrival = { kind: "instant" }
  return { arrival, issues }
}
