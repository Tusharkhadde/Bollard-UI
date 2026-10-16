export type ChargeInterval = "day" | "week" | "month" | "year"

export interface RecurringPlan {
  /** The regular price per period, in major units. */
  amount: number
  interval: ChargeInterval
  /** Periods per renewal, e.g. 3 with "month" for quarterly. */
  intervalCount?: number
  /** The moment of subscribing. */
  now: Date
  /** When a free or paid trial ends and the first real charge lands. */
  trialEndsAt?: Date
  /** Charged today for the trial, e.g. a ₹2 card check. */
  trialAmount?: number
  /** An introductory price for the first `periods` paid periods. */
  intro?: { amount: number; periods: number }
  /** How long before a renewal a cancellation must land. */
  cancelNoticeHours?: number
  /**
   * IANA zone whose calendar the biller renews on ("Asia/Kolkata"). Without it, months are
   * counted in UTC, which moves a renewal a day when you subscribe near midnight IST.
   */
  timeZone?: string
}

export interface ChargeStep {
  at: Date
  amount: number
  kind: "today" | "first" | "step-up"
}

type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number; ms: number }

/** The wall-clock date and time of an instant in a zone. */
function wall(date: Date, timeZone: string): Wall {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(date)
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { y: n("year"), mo: n("month") - 1, d: n("day"), h: n("hour") % 24, mi: n("minute"), s: n("second"), ms: date.getUTCMilliseconds() }
}

/** The instant a wall-clock time happens in a zone (the later one when DST repeats it). */
function fromWall(w: Wall, timeZone: string) {
  const asUtc = Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s, w.ms)
  const offset = (t: number) => { const x = wall(new Date(t), timeZone); return Date.UTC(x.y, x.mo, x.d, x.h, x.mi, x.s, x.ms) - t }
  const first = asUtc - offset(asUtc)
  return new Date(asUtc - offset(first))
}

/** The day of the month an instant falls on in a zone (UTC without one). */
export function dayOfMonth(date: Date, timeZone?: string) {
  return timeZone ? wall(date, timeZone).d : date.getUTCDate()
}

/**
 * Adds whole periods, clamping the 31st to the last day of shorter months. Counts on the
 * calendar of `timeZone` when given (what the user sees), otherwise in UTC.
 */
export function addPeriods(date: Date, interval: ChargeInterval, count: number, timeZone?: string) {
  const w: Wall = timeZone
    ? wall(date, timeZone)
    : { y: date.getUTCFullYear(), mo: date.getUTCMonth(), d: date.getUTCDate(), h: date.getUTCHours(), mi: date.getUTCMinutes(), s: date.getUTCSeconds(), ms: date.getUTCMilliseconds() }
  if (interval === "day" || interval === "week") {
    const shifted = new Date(Date.UTC(w.y, w.mo, w.d + count * (interval === "week" ? 7 : 1)))
    w.y = shifted.getUTCFullYear(); w.mo = shifted.getUTCMonth(); w.d = shifted.getUTCDate()
  } else {
    const months = w.mo + count * (interval === "year" ? 12 : 1)
    const target = new Date(Date.UTC(w.y, months, 1))
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    w.y = target.getUTCFullYear(); w.mo = target.getUTCMonth(); w.d = Math.min(w.d, last)
  }
  return timeZone ? fromWall(w, timeZone) : new Date(Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s, w.ms))
}

/**
 * Works out what is charged when: today, the first real charge, any intro-to-full step-up,
 * the next renewal the user can still avoid and the cancel-by moment for it.
 */
export function planCharges(plan: RecurringPlan) {
  const count = plan.intervalCount ?? 1
  const trial = !!plan.trialEndsAt && plan.trialEndsAt > plan.now
  const first = plan.intro ? plan.intro.amount : plan.amount
  const start = trial ? plan.trialEndsAt! : plan.now
  const steps: ChargeStep[] = [{ at: plan.now, amount: trial ? plan.trialAmount ?? 0 : first, kind: "today" }]
  if (trial) steps.push({ at: start, amount: first, kind: "first" })
  const stepUpAt = plan.intro && plan.intro.amount !== plan.amount ? addPeriods(start, plan.interval, count * plan.intro.periods, plan.timeZone) : undefined
  if (stepUpAt) steps.push({ at: stepUpAt, amount: plan.amount, kind: "step-up" })
  const nextCharge = trial ? start : addPeriods(start, plan.interval, count, plan.timeZone)
  const cancelBy = new Date(nextCharge.getTime() - (plan.cancelNoticeHours ?? 24) * 3_600_000)
  return {
    trial,
    steps,
    /** The first charge after today: the trial's end, or the first renewal. */
    nextCharge,
    nextAmount: trial ? first : plan.intro && plan.intro.periods <= 1 ? plan.amount : first,
    cancelBy,
    /** True when the notice period swallows the whole trial or first period. */
    cancelClosed: cancelBy <= plan.now,
    stepUpAt,
    /** A renewal on the 29th–31st that will drift to month ends. */
    monthEnd: plan.interval !== "day" && plan.interval !== "week" && dayOfMonth(start, plan.timeZone) >= 29,
  }
}

const AMOUNT = /(?:₹|rs\.?|inr|\$|€|£)\s?([\d,]+(?:\.\d+)?)/gi

/** Where a subscribe button's own words disagree with the charge it triggers. */
export function auditChargeLabel(label: string, plan: { today: number; amounts: number[]; interval: ChargeInterval; intervalCount?: number }) {
  const issues: { kind: "free" | "amount" | "period"; said?: number }[] = []
  if (/\bfree\b/i.test(label) && plan.today > 0) issues.push({ kind: "free" })
  for (const match of label.matchAll(AMOUNT)) {
    const said = Number(match[1].replace(/,/g, ""))
    if (!plan.amounts.includes(said) && said !== plan.today) issues.push({ kind: "amount", said })
  }
  const saysMonthly = /\/\s?mo\b|\/\s?month|per month|monthly|a month/i.test(label)
  const billedMonthly = plan.interval === "month" && (plan.intervalCount ?? 1) === 1
  // A monthly-looking price on yearly billing is one mistake, not an amount mismatch too.
  if (saysMonthly && !billedMonthly) return [...issues.filter((issue) => issue.kind !== "amount"), { kind: "period" as const }]
  return issues
}
