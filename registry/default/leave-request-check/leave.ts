// Bollard UI — leave-request-check · MIT licence · https://bollard-ui.vercel.app/components/leave-request-check

/** Which part of a day is taken. "half" is a half day with no half chosen yet. */
export type DayPart = "full" | "morning" | "afternoon" | "half"

export interface LeaveRequest {
  /** First day, YYYY-MM-DD. */
  start: string
  /** Last day, YYYY-MM-DD. Same as start for one day. */
  end: string
  startPart: DayPart
  /** Ignored when start and end are the same day. */
  endPart: DayPart
}

export interface Holiday { date: string; name: string }
export interface TeamAbsence { name: string; start: string; end: string }

export interface LeavePolicy {
  /**
   * Sandwich rule: weekends and/or holidays that fall between two leave days are charged as leave.
   * A company rule, not a law. For "workers" covered by India's OSH Code 2020 (in force since 21 Nov 2025),
   * s.32(1)(iv) says the opposite: "any holidays falling between the leave availed by such worker (in a calendar
   * year or prefixed or suffixed holiday) shall be excluded from the period of leave so availed". Most state
   * Shops & Establishments Acts say the same (e.g. Maharashtra 2017, s.18(9)).
   */
  sandwich?: boolean | { weekends?: boolean; holidays?: boolean }
  /** Days of the week that are off, 0 = Sunday. */
  weekend?: number[]
}

export type DayKind = "leave" | "half" | "weekend" | "holiday" | "sandwich"
export interface LeaveDay { date: string; day: number; kind: DayKind; holiday?: string; team: string[] }

const DAY = 86_400_000
const MAX_DAYS = 370

/** "2026-10-24" → days since epoch (UTC), or null for anything that isn't a real date. */
export function dayNumber(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim())
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3])
  const d = new Date(t)
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t / DAY : null
}
export const isoOf = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)

export interface LeaveCount {
  days: LeaveDay[]
  calendarDays: number
  /** Working days taken, halves counted as 0.5. */
  workingDays: number
  /** What the balance is charged: working days plus sandwiched days. */
  cost: number
  sandwiched: LeaveDay[]
  holidays: LeaveDay[]
  /** First working moment after the leave. */
  back: { date: string; afternoon: boolean } | null
}

/** Counts a request day by day. Null when the dates are missing, invalid, reversed or absurdly long. */
export function countLeave(req: LeaveRequest, holidays: Holiday[] = [], team: TeamAbsence[] = [], policy: LeavePolicy = {}): LeaveCount | null {
  const a = dayNumber(req.start), b = dayNumber(req.end)
  if (a === null || b === null || b < a || b - a >= MAX_DAYS) return null
  const weekend = policy.weekend ?? [0, 6]
  const holidayOn = new Map<number, string>()
  for (const h of Array.isArray(holidays) ? holidays : []) {
    const d = dayNumber(h?.date)
    if (d !== null) holidayOn.set(d, String(h.name ?? ""))
  }
  const away = (Array.isArray(team) ? team : []).map((p) => ({ name: String(p?.name ?? ""), a: dayNumber(p?.start), b: dayNumber(p?.end) }))
  const offDay = (d: number) => holidayOn.has(d) || weekend.includes(new Date(d * DAY).getUTCDay())
  const single = a === b
  const days: LeaveDay[] = []
  for (let d = a; d <= b; d++) {
    const part = d === a ? req.startPart : d === b && !single ? req.endPart : "full"
    const holiday = holidayOn.get(d)
    const kind: DayKind = holiday !== undefined ? "holiday" : offDay(d) ? "weekend" : part === "full" ? "leave" : "half"
    const off = away.filter((p) => p.a !== null && p.b !== null && p.a <= d && d <= p.b).map((p) => p.name)
    days.push({ date: isoOf(d), day: d, kind, holiday, team: off })
  }
  const s = policy.sandwich
  const sw = { weekends: s === true || (typeof s === "object" && !!s.weekends), holidays: s === true || (typeof s === "object" && !!s.holidays) }
  const taken = days.filter((d) => d.kind === "leave" || d.kind === "half")
  const first = taken[0]?.day, last = taken[taken.length - 1]?.day
  const sandwiched: LeaveDay[] = []
  if (first !== undefined && last !== undefined) {
    for (const d of days) {
      if (d.day > first && d.day < last && ((d.kind === "weekend" && sw.weekends) || (d.kind === "holiday" && sw.holidays))) {
        d.kind = "sandwich"
        sandwiched.push(d)
      }
    }
  }
  const workingDays = taken.reduce((n, d) => n + (d.kind === "half" ? 0.5 : 1), 0)
  const endPart = single ? req.startPart : req.endPart
  let back: LeaveCount["back"] = null
  if (endPart === "morning" && !offDay(b)) back = { date: isoOf(b), afternoon: true }
  else for (let d = b + 1; d < b + 60; d++) if (!offDay(d)) { back = { date: isoOf(d), afternoon: false }; break }
  return { days, calendarDays: b - a + 1, workingDays, cost: workingDays + sandwiched.length, sandwiched, holidays: days.filter((d) => d.holiday !== undefined), back }
}

export type LeaveIssue =
  | { kind: "invalid" }
  | { kind: "reversed" }
  | { kind: "startsOff"; date: string; fix: string }
  | { kind: "endsOff"; date: string; fix: string }
  | { kind: "allOff" }
  | { kind: "whichHalf"; end: "start" | "end"; date: string }
  | { kind: "gap"; end: "start" | "end"; date: string }
  | { kind: "sandwich"; days: LeaveDay[]; cost: number; without: number }
  | { kind: "overBalance"; cost: number; balance: number; fitEnd: string | null }
  | { kind: "team"; names: string[]; busiest: number; date: string; overLimit: boolean }

export interface CheckOptions { holidays?: Holiday[]; team?: TeamAbsence[]; policy?: LeavePolicy; balance?: number; teamLimit?: number }

/** Every way this request may not mean what the person thinks, in the order to fix them. */
export function checkLeave(req: LeaveRequest, { holidays = [], team = [], policy = {}, balance, teamLimit }: CheckOptions = {}): LeaveIssue[] {
  const a = dayNumber(req.start), b = dayNumber(req.end)
  if (!req.start || !req.end) return []
  if (a === null || b === null || b - a >= MAX_DAYS) return [{ kind: "invalid" }]
  if (b < a) return [{ kind: "reversed" }]
  const count = countLeave(req, holidays, team, policy)
  if (!count) return [{ kind: "invalid" }]
  const issues: LeaveIssue[] = []
  const working = count.days.filter((d) => d.kind === "leave" || d.kind === "half")
  if (!working.length) return [{ kind: "allOff" }]
  const firstWork = working[0], lastWork = working[working.length - 1]
  if (firstWork.day !== a) issues.push({ kind: "startsOff", date: req.start, fix: firstWork.date })
  if (lastWork.day !== b) issues.push({ kind: "endsOff", date: req.end, fix: lastWork.date })
  const single = a === b
  // A part of a day that's already off means nothing, so it's only questioned on a working day.
  if (firstWork.day === a) {
    if (req.startPart === "half") issues.push({ kind: "whichHalf", end: "start", date: req.start })
    else if (!single && req.startPart === "morning") issues.push({ kind: "gap", end: "start", date: req.start })
  }
  if (!single && lastWork.day === b) {
    if (req.endPart === "half") issues.push({ kind: "whichHalf", end: "end", date: req.end })
    else if (req.endPart === "afternoon") issues.push({ kind: "gap", end: "end", date: req.end })
  }
  if (count.sandwiched.length) issues.push({ kind: "sandwich", days: count.sandwiched, cost: count.cost, without: count.workingDays })
  if (typeof balance === "number" && Number.isFinite(balance) && count.cost > balance) {
    let fitEnd: string | null = null
    for (let d = b - 1; d >= a; d--) {
      const c = countLeave({ ...req, end: isoOf(d), endPart: "full" }, holidays, team, policy)
      const lastDay = c?.days[c.days.length - 1]
      if (c && c.cost <= balance && c.cost > 0 && lastDay && (lastDay.kind === "leave" || lastDay.kind === "half")) { fitEnd = isoOf(d); break }
    }
    issues.push({ kind: "overBalance", cost: count.cost, balance, fitEnd })
  }
  const clash = count.days.filter((d) => d.team.length && (d.kind === "leave" || d.kind === "half"))
  if (clash.length) {
    const busiest = clash.reduce((x, d) => (d.team.length > x.team.length ? d : x))
    const names = [...new Set(clash.flatMap((d) => d.team))]
    issues.push({ kind: "team", names, busiest: busiest.team.length, date: busiest.date, overLimit: typeof teamLimit === "number" && busiest.team.length + 1 > teamLimit })
  }
  return issues
}
