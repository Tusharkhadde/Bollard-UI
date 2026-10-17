// Bollard UI — bnpl-schedule-check · MIT licence · https://bollard-ui.vercel.app/components/bnpl-schedule-check

import { addDays, differenceInCalendarDays, format, isValid, lastDayOfMonth, parseISO } from "date-fns"

/** One payment of a plan. `date` is a calendar day, "YYYY-MM-DD". */
export interface BnplInstalment {
  date: string
  amount: number
}

/** A plan already running elsewhere (another store, another provider). */
export interface BnplPlan {
  name: string
  instalments: BnplInstalment[]
}

/** The card the plan would charge. `expires` is printed-card style "MM/YY" (or "YYYY-MM"). */
export interface BnplCard {
  label: string
  expires: string
}

/** The provider's late-fee rule, e.g. Afterpay US: $8 per missed payment, at most 25% of the order. */
export interface BnplLateFee {
  perMissed: number
  capPercent?: number
  capAmount?: number
}

export type BnplSource = "card" | "bank"

/** What the user can change: where payments come from and the (possibly moved) date of each payment. */
export interface BnplValue {
  source: BnplSource
  dates: string[]
}

export interface BnplClash {
  index: number
  others: { name: string; date: string; amount: number }[]
  total: number
}

export type BnplProblem =
  | { kind: "cardExpires"; indexes: number[]; expiresOn: string }
  | { kind: "beforePayday"; index: number; payday: string; days: number; canMove: boolean }
  | { kind: "stacked"; plans: number; worst: BnplClash }

export interface BnplCheckOptions {
  /** Plans already running. */
  others?: BnplPlan[]
  /** Paydays as "YYYY-MM-DD". */
  paydays?: string[]
  card?: BnplCard | null
  /** A payment due this many days or fewer before payday is flagged. Default 3. */
  payGapDays?: number
  /** Other plans' payments within this many days count as the same squeeze. Default 3. */
  stackWindowDays?: number
  /** The furthest a payment may be moved later (providers cap rescheduling). Default 7. */
  maxShiftDays?: number
  /** The first payment is taken at checkout, so it can't move. Default true. */
  firstPaidNow?: boolean
}

/** Reads "YYYY-MM-DD" as a local calendar day, or null for anything invalid. */
export function parseDay(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null
  const d = parseISO(raw.trim())
  return isValid(d) ? d : null
}

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

/** Last day a card works: the end of its printed expiry month. Accepts "MM/YY", "MM/YYYY" and "YYYY-MM". */
export function cardLastDay(expires: unknown): Date | null {
  if (typeof expires !== "string") return null
  const s = expires.trim()
  let m = s.match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/)
  let year: number, month: number
  if (m) {
    month = Number(m[1])
    year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
  } else if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) {
    year = Number(m[1])
    month = Number(m[2])
  } else return null
  if (month < 1 || month > 12) return null
  return lastDayOfMonth(new Date(year, month - 1, 1))
}

/** A pay-in-N plan: equal payments every `everyDays`, the last one absorbing rounding so they add up exactly (at most 60). */
export function payInN(total: number, first: string, count = 4, everyDays = 14, digits = 2): BnplInstalment[] {
  const start = parseDay(first)
  // Clamp the count first, so the last payment always absorbs the remainder and the plan adds up to the total.
  count = Math.min(60, Math.floor(Number(count)))
  if (!start || !(total > 0) || !Number.isFinite(total) || !(count >= 1)) return []
  const f = 10 ** digits
  const cents = Math.round(total * f)
  const each = Math.floor(cents / count)
  return Array.from({ length: count }, (_, i) => ({
    date: dayKey(addDays(start, i * everyDays)),
    amount: (i === count - 1 ? cents - each * (count - 1) : each) / f,
  }))
}

/** Paydays every `everyDays` from `from`, up to `until` (inclusive). */
export function paydaysEvery(from: string, everyDays: number, until: string): string[] {
  const a = parseDay(from)
  const b = parseDay(until)
  if (!a || !b || !(everyDays >= 1)) return []
  const out: string[] = []
  for (let d = a; d <= b && out.length < 400; d = addDays(d, everyDays)) out.push(dayKey(d))
  return out
}

/** Most the user can be charged in late fees on this order, and after how many missed payments that is reached. */
export function lateFeeCap(total: number, fee: BnplLateFee | null | undefined) {
  const per = Math.max(0, Number(fee?.perMissed) || 0)
  const caps = [fee?.capAmount, fee?.capPercent != null ? (total * Number(fee.capPercent)) / 100 : undefined].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0,
  )
  const max = caps.length ? Math.min(...caps) : Infinity
  return { per: Math.min(per, max), max, reachedAfter: per > 0 && Number.isFinite(max) ? Math.ceil(max / per) : null }
}

/**
 * Checks a schedule against the user's card, paydays and other plans. Pure, so it can run on a server.
 * Problems come back worst first: a card that dies before a payment, payments landing just before payday,
 * then plans stacking up in the same few days.
 */
export function checkSchedule(plan: BnplInstalment[], value: BnplValue, opts: BnplCheckOptions = {}): BnplProblem[] {
  const { others = [], paydays = [], card, payGapDays = 3, stackWindowDays = 3, maxShiftDays = 7, firstPaidNow = true } = opts
  const days = plan.map((p, i) => parseDay(value?.dates?.[i] ?? p.date))
  const problems: BnplProblem[] = []

  const last = card ? cardLastDay(card.expires) : null
  if (value?.source !== "bank" && last) {
    const indexes = days.flatMap((d, i) => (d && d > last ? [i] : []))
    if (indexes.length) problems.push({ kind: "cardExpires", indexes, expiresOn: dayKey(last) })
  }

  const pays = paydays.map(parseDay).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())
  days.forEach((d, i) => {
    if (!d || (firstPaidNow && i === 0)) return
    const next = pays.find((p) => p >= d)
    if (!next) return
    const gap = differenceInCalendarDays(next, d)
    if (gap >= 1 && gap <= payGapDays) problems.push({ kind: "beforePayday", index: i, payday: dayKey(next), days: gap, canMove: gap <= maxShiftDays })
  })

  const otherPays = others.flatMap((o) => (o?.instalments ?? []).map((p) => ({ name: String(o.name ?? ""), date: p.date, amount: Number(p.amount) || 0, d: parseDay(p.date) })))
  const clashes: BnplClash[] = days.flatMap((d, i) => {
    if (!d) return []
    const near = otherPays.filter((o) => o.d && Math.abs(differenceInCalendarDays(o.d, d)) <= stackWindowDays)
    if (!near.length) return []
    return [{ index: i, others: near.map(({ name, date, amount }) => ({ name, date, amount })), total: (Number(plan[i]?.amount) || 0) + near.reduce((s, o) => s + o.amount, 0) }]
  })
  if (clashes.length) {
    const worst = clashes.reduce((a, b) => (b.total > a.total ? b : a))
    const plans = new Set(clashes.flatMap((c) => c.others.map((o) => o.name))).size + 1
    problems.push({ kind: "stacked", plans, worst })
  }
  return problems
}
