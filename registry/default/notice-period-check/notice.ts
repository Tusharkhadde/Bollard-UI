// Bollard UI — notice-period-check · MIT licence · https://bollard-ui.vercel.app/components/notice-period-check

/** Pure date logic for notice periods. Dates are "YYYY-MM-DD" strings; days are counted in UTC so time zones never shift them. */

export interface Holiday { date: string; name: string }

export interface NoticePolicy {
  /** How long the notice is, in `unit`s. */
  length: number
  unit: "days" | "weeks" | "months"
  /** For `unit: "days"`: count every day ("calendar") or only working days ("working"). Default "calendar". */
  counting?: "calendar" | "working"
  /**
   * When the notice starts. "next-day" (default) is the usual reading when a contract is silent: in the UK
   * notice "usually runs from the start of the day after you handed your notice in" (gov.uk, Acas).
   * Many Indian employers count the resignation day as day one: use "same-day".
   */
  startsOn?: "next-day" | "same-day"
  /** Month arithmetic when the day doesn't exist in the target month (31 Jan + 1 month): "clamp" → 28 Feb (default), "overflow" → 3 Mar. */
  monthEnd?: "clamp" | "overflow"
  /** If the last day is a weekend or holiday: keep it, or move the last working day to the working day before or after. Default "previous". */
  offDay?: "keep" | "previous" | "next"
  /** Days of the week that are off, 0 = Sunday. Default Saturday and Sunday. */
  weekend?: number[]
  /** IANA zone where HR dates the resignation, e.g. "America/New_York". Defaults to the employee's zone. */
  timeZone?: string
  /** Emails that arrive at or after this hour (HR's zone) count as received the next day. */
  cutoffHour?: number
  /** Unpaid leave during notice pushes the last day out, day for day. Default true. */
  unpaidExtends?: boolean
  /** Leave balance may be set off against the notice to leave earlier. Default false. */
  leaveSetOff?: boolean
  /** Notice-pay buyout for days not served: monthly pay and how a day's pay is worked out (÷30, ÷26 or ÷ days in that month). */
  buyout?: { monthly: number; divisor?: 30 | 26 | "month" }
}

export interface NoticeInput {
  /** When the resignation was sent, "YYYY-MM-DDTHH:mm" on the employee's clock. A bare date means start of day. */
  sentAt: string
  /** The last day the employee would like, if earlier than the notice allows (early release / buyout). */
  requestedLastDay?: string
  /** Leave days to set off against the notice. */
  leaveToUse?: number
  /** Unpaid (loss-of-pay) days taken during the notice. */
  unpaidDays?: number
}

export type NoticeIssue =
  | { kind: "invalid" }
  | { kind: "timezone"; local: string; hr: string; zone: string }
  | { kind: "cutoff"; hour: number; date: string }
  | { kind: "monthEnd"; used: string; other: string; day: number }
  | { kind: "offDay"; date: string; reason: string; moved?: string }
  | { kind: "unpaid"; days: number; from: string; to: string }
  | { kind: "leaveNotAllowed"; days: number }
  | { kind: "leaveTooMuch"; days: number; max: number }
  | { kind: "requestBeforeStart"; date: string }
  | { kind: "requestOff"; date: string; reason: string; fix: string }
  | { kind: "short"; days: number; amount?: number; leaveCover?: number }

export interface NoticeResult {
  /** The date HR counts the resignation from. */
  resigned: string
  /** First day of notice. */
  start: string
  /** Where the notice ends by the contract. */
  contractEnd: string
  /** Last working day after holidays, unpaid leave and leave set-off. */
  lastDay: string
  /** Last day on the payroll (may be after `lastDay` when the notice ends on a weekend). */
  employedUntil: string
  issues: NoticeIssue[]
}

const DAY = 86_400_000
const MAX_SPAN = 2 * 366

/** "2026-01-31" → days since epoch, or null for anything that isn't a real date. */
export function dayOf(iso: unknown): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "").trim())
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3])
  const d = new Date(t)
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t / DAY : null
}
export const isoOf = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)

/** Adds months to a day. "clamp" keeps 31 Jan + 1 → 28/29 Feb; "overflow" rolls into March like JavaScript's Date. */
export function addMonths(day: number, months: number, mode: "clamp" | "overflow" = "clamp"): number {
  const d = new Date(day * DAY)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + months
  const dom = d.getUTCDate()
  if (mode === "overflow") return Date.UTC(y, m, dom) / DAY
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return Date.UTC(y, m, Math.min(dom, last)) / DAY
}

/** Offset of `zone` from UTC in minutes at instant `ms`. Falls back to 0 for an unknown zone. */
function offsetMinutes(ms: number, zone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(ms)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute")) - Math.floor(ms / 60_000) * 60_000) / 60_000
  } catch {
    return 0
  }
}

/** Wall-clock time in `zone` → UTC ms. Two passes handle DST edges. */
export function zonedToUtc(local: string, zone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(local ?? "").trim())
  if (!m || dayOf(local) === null) return null
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))
  let ms = wall - offsetMinutes(wall, zone) * 60_000
  ms = wall - offsetMinutes(ms, zone) * 60_000
  return ms
}

/** UTC ms → { day, hour } on the wall clock in `zone`. */
export function wallIn(ms: number, zone: string) {
  const shifted = ms + offsetMinutes(ms, zone) * 60_000
  return { day: Math.floor(shifted / DAY), hour: new Date(shifted).getUTCHours() }
}

export interface NoticeOptions {
  /** Employee's zone, where `sentAt` was written. */
  timeZone?: string
  holidays?: Holiday[]
  /** Leave days available to set off. */
  leaveBalance?: number
}

/** Works out the last working day and everything that can move it. Never throws; bad input gives `invalid`. */
export function checkNotice(input: NoticeInput | null | undefined, policy: NoticePolicy | null | undefined, options: NoticeOptions = {}): NoticeResult | { issues: [{ kind: "invalid" }] } {
  const invalid = { issues: [{ kind: "invalid" as const }] as [{ kind: "invalid" }] }
  const length = Math.floor(Number(policy?.length))
  if (!input || !policy || !Number.isFinite(length) || length <= 0 || length > 400) return invalid
  const zone = options.timeZone || "UTC"
  const hrZone = policy.timeZone || zone
  const sentMs = zonedToUtc(input.sentAt, zone)
  if (sentMs === null) return invalid

  const weekend = new Set(policy.weekend ?? [0, 6])
  const holidays = new Map<number, string>()
  for (const h of Array.isArray(options.holidays) ? options.holidays : []) {
    const d = dayOf(h?.date)
    if (d !== null) holidays.set(d, String(h?.name ?? ""))
  }
  const offReason = (d: number) => holidays.get(d) ?? (weekend.has(new Date(d * DAY).getUTCDay()) ? "weekend" : null)
  const isWorking = (d: number) => offReason(d) === null
  const stepWorking = (from: number, dir: 1 | -1) => {
    let d = from
    for (let i = 0; i < 60 && !isWorking(d); i++) d += dir
    return d
  }
  const addWorking = (from: number, n: number, dir: 1 | -1 = 1) => {
    let d = from
    for (let left = n, guard = 0; left > 0 && guard < MAX_SPAN; guard++) {
      d += dir
      if (isWorking(d)) left--
    }
    return d
  }

  const issues: NoticeIssue[] = []
  const local = wallIn(sentMs, zone)
  const hr = wallIn(sentMs, hrZone)
  let resigned = hr.day
  if (hrZone !== zone && hr.day !== local.day) issues.push({ kind: "timezone", local: isoOf(local.day), hr: isoOf(hr.day), zone: hrZone })
  const cutoff = policy.cutoffHour
  if (typeof cutoff === "number" && cutoff >= 0 && cutoff < 24 && hr.hour >= cutoff && /T|\s\d/.test(input.sentAt)) {
    resigned += 1
    issues.push({ kind: "cutoff", hour: cutoff, date: isoOf(resigned) })
  }

  const sameDay = policy.startsOn === "same-day"
  const start = sameDay ? resigned : resigned + 1
  let contractEnd: number
  if (policy.unit === "months") {
    const mode = policy.monthEnd ?? "clamp"
    // Next-day start: notice ends on the same date n months on (resign 15 Jan → 15 Feb), or the month's last day
    // when that date doesn't exist (31 Jan → 28 Feb). Same-day start: the day before that date (15 Jan → 14 Feb);
    // when it doesn't exist the month runs to its last day (31 Mar → 30 Apr), it isn't cut a day short.
    const end = (m: "clamp" | "overflow") => {
      const target = addMonths(resigned, length, m)
      if (!sameDay) return target
      const clamped = m === "clamp" && new Date(target * DAY).getUTCDate() !== new Date(resigned * DAY).getUTCDate()
      return clamped ? target : target - 1
    }
    contractEnd = end(mode)
    const other = end(mode === "clamp" ? "overflow" : "clamp")
    if (other !== contractEnd) issues.push({ kind: "monthEnd", used: isoOf(contractEnd), other: isoOf(other), day: new Date(resigned * DAY).getUTCDate() })
  } else if (policy.unit === "weeks") {
    contractEnd = start + length * 7 - 1
  } else if (policy.counting === "working") {
    contractEnd = addWorking(start - 1, length)
  } else {
    contractEnd = start + length - 1
  }

  let employedUntil = contractEnd
  let lastDay = contractEnd
  const unpaid = Math.max(0, Math.min(366, Math.floor(Number(input.unpaidDays) || 0)))
  if (unpaid && policy.unpaidExtends !== false) {
    const from = lastDay
    lastDay = policy.counting === "working" ? addWorking(lastDay, unpaid) : lastDay + unpaid
    employedUntil = lastDay
    issues.push({ kind: "unpaid", days: unpaid, from: isoOf(from), to: isoOf(lastDay) })
  }

  const reason = offReason(lastDay)
  if (reason && (policy.offDay ?? "previous") !== "keep") {
    const moved = stepWorking(lastDay, policy.offDay === "next" ? 1 : -1)
    issues.push({ kind: "offDay", date: isoOf(lastDay), reason, moved: isoOf(moved) })
    lastDay = moved
    employedUntil = Math.max(employedUntil, moved)
  } else if (reason) {
    issues.push({ kind: "offDay", date: isoOf(lastDay), reason })
  }

  const leave = Math.max(0, Math.min(366, Math.floor(Number(input.leaveToUse) || 0)))
  const balance = Math.max(0, Math.floor(Number(options.leaveBalance ?? Infinity)))
  if (leave && !policy.leaveSetOff) issues.push({ kind: "leaveNotAllowed", days: leave })
  else if (leave > balance) issues.push({ kind: "leaveTooMuch", days: leave, max: balance })
  else if (leave) {
    lastDay = stepWorking(addWorking(lastDay, leave, -1), -1)
    employedUntil = lastDay
  }

  const requested = dayOf(input.requestedLastDay)
  if (input.requestedLastDay && requested === null) issues.push({ kind: "invalid" })
  if (requested !== null && requested < start) issues.push({ kind: "requestBeforeStart", date: isoOf(requested) })
  else if (requested !== null && requested < lastDay) {
    const why = offReason(requested)
    if (why) issues.push({ kind: "requestOff", date: isoOf(requested), reason: why, fix: isoOf(stepWorking(requested, 1)) })
    const days = lastDay - requested
    const pay = Number(policy.buyout?.monthly)
    let amount: number | undefined
    if (Number.isFinite(pay) && pay > 0) {
      const divisor = policy.buyout?.divisor ?? 30
      amount = 0
      for (let d = requested + 1; d <= lastDay; d++) {
        const inMonth = new Date(Date.UTC(new Date(d * DAY).getUTCFullYear(), new Date(d * DAY).getUTCMonth() + 1, 0)).getUTCDate()
        if (divisor === 26 && !isWorking(d)) continue
        amount += pay / (divisor === "month" ? inMonth : divisor)
      }
      amount = Math.round(amount)
    }
    const spare = policy.leaveSetOff ? Math.max(0, (Number.isFinite(balance) ? balance : 0) - leave) : 0
    const workingShort = Array.from({ length: days }, (_, i) => requested + 1 + i).filter(isWorking).length
    issues.push({ kind: "short", days, amount, leaveCover: spare && workingShort ? Math.min(spare, workingShort) + leave : undefined })
  }

  return { resigned: isoOf(resigned), start: isoOf(start), contractEnd: isoOf(contractEnd), lastDay: isoOf(lastDay), employedUntil: isoOf(employedUntil), issues }
}
