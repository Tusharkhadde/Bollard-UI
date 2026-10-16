/** Pure helpers for DstShiftNotice. Uses only Intl, so the real tz database decides every clock change. */

export type DstRepeat = "daily" | "weekdays" | "weekly" | "fortnightly"

export interface DstAttendee {
  /** Stable key. Falls back to the name. */
  id?: string
  /** Who this is: "Priya", "Pune team". */
  name: string
  /** IANA zone, e.g. "Asia/Kolkata". */
  timeZone: string
  /** People this row stands for. Defaults to 1. */
  count?: number
}

export interface DstSeries {
  /** First meeting as wall time in `timeZone`: "2026-10-20T09:00". */
  start: string
  /** The zone the series is saved in (usually the organiser's). */
  timeZone: string
  repeat?: DstRepeat
  /** Meetings to look ahead. Clamped to 1–260. */
  count?: number
}

export interface ClockChange {
  timeZone: string
  /** Epoch ms of the change. */
  at: number
  /** Minutes the clocks moved (+60 forward, -60 back). */
  delta: number
}

export interface ShiftRun {
  /** Meeting instants in this run (epoch ms). */
  instants: number[]
  /** Minutes the attendee's local time moved against the first meeting. */
  shift: number
  /** Local minutes after midnight during the run. */
  local: number
  /** -1, 0 or 1 when the move crosses midnight for the attendee. */
  dayShift: number
  /** True when the moved time falls outside the working hours given. */
  afterHours: boolean
  /** The clock change that starts this run. */
  cause?: ClockChange
}

export interface AttendeeShift {
  attendee: DstAttendee
  /** Local minutes after midnight people are used to: the last meeting's time (skipping an odd week out), else the first upcoming one. */
  usual: number
  /** A meeting at the usual time, for formatting it. */
  usualAt: number
  runs: ShiftRun[]
}

export interface SeriesAnalysis {
  anchor: string
  instants: number[]
  attendees: AttendeeShift[]
  /** People (sum of counts) whose local time moves at least once. */
  affectedPeople: number
  /** Attendees whose zone could not be read. */
  invalid: DstAttendee[]
}

const MINUTE = 60_000
const DAY = 86_400_000
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
    formatters.set(timeZone, f)
  }
  return f
}

/** True when Intl knows the zone. */
export function isValidZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone.trim() || timeZone.length > 64) return false
  try {
    formatterFor(timeZone)
    return true
  } catch {
    return false
  }
}

/** Wall-clock parts of an instant in a zone. */
export function wallParts(instant: number, timeZone: string) {
  const p: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(instant)) if (part.type !== "literal") p[part.type] = Number(part.value)
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute }
}

/** The zone's UTC offset in minutes at an instant (IST is +330). */
export function offsetAt(instant: number, timeZone: string) {
  const w = wallParts(instant, timeZone)
  return Math.round((Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - Math.floor(instant / MINUTE) * MINUTE) / MINUTE)
}

/** Epoch ms for a wall time in a zone. A time the clocks skip lands just after the jump. */
export function zonedToInstant(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = guess - offsetAt(guess, timeZone) * MINUTE
  const second = offsetAt(first, timeZone)
  return guess - second * MINUTE
}

/** Reads "2026-10-20T09:00" (seconds and a trailing Z or offset are ignored). Null for anything else. */
export function parseWall(value: unknown) {
  if (typeof value !== "string") return null
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(value.replace(/^\uFEFF/, ""))
  if (!m) return null
  const [year, month, day, hour, minute] = m.slice(1).map(Number)
  const check = new Date(Date.UTC(year, month - 1, day))
  if (hour > 23 || minute > 59 || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return { year, month, day, hour, minute }
}

/** Instants of the series in `timeZone`, starting at the first meeting at or after `from`. */
function occurrences(wall: NonNullable<ReturnType<typeof parseWall>>, timeZone: string, repeat: DstRepeat, count: number, from: number) {
  const step = repeat === "fortnightly" ? 14 : repeat === "weekly" ? 7 : 1
  const out: number[] = []
  let date = Date.UTC(wall.year, wall.month - 1, wall.day)
  // Skip whole past periods quickly, then walk.
  const behind = Math.floor((from - date) / DAY / step) - 1
  if (behind > 0) date += behind * step * DAY
  for (let guard = 0; out.length < count && guard < count * 3 + 400; guard++, date += step * DAY) {
    const d = new Date(date)
    if (repeat === "weekdays" && (d.getUTCDay() === 0 || d.getUTCDay() === 6)) continue
    const instant = zonedToInstant(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), wall.hour, wall.minute, timeZone)
    if (instant >= from - MINUTE) out.push(instant)
  }
  return out
}

/** Finds when a zone's offset changed between two instants (to the minute). */
function findChange(a: number, b: number, timeZone: string): ClockChange | undefined {
  const before = offsetAt(a, timeZone)
  const after = offsetAt(b, timeZone)
  if (before === after) return undefined
  let lo = a
  let hi = b
  while (hi - lo > MINUTE) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (offsetAt(mid, timeZone) === before) lo = mid
    else hi = mid
  }
  return { timeZone, at: hi, delta: after - before }
}

/**
 * Works out, for each attendee, which meetings of a recurring series move on their clock when it is
 * kept fixed in `anchor` ("UTC" or an IANA zone), against the time they are used to from recent meetings.
 */
export function analyzeSeries(series: DstSeries, attendees: DstAttendee[], anchor: string, options: { now?: number; workStart?: number; workEnd?: number } = {}): SeriesAnalysis | null {
  const wall = parseWall(series?.start)
  if (!wall || !isValidZone(series.timeZone) || !isValidZone(anchor)) return null
  const repeat: DstRepeat = ["daily", "weekdays", "weekly", "fortnightly"].includes(series.repeat as string) ? (series.repeat as DstRepeat) : "weekly"
  const count = Math.min(260, Math.max(1, Math.floor(Number(series.count) || 26)))
  const now = Number.isFinite(options.now) ? (options.now as number) : -Infinity
  const workStart = (options.workStart ?? 8) * 60
  const workEnd = (options.workEnd ?? 19) * 60

  const [first] = occurrences(wall, series.timeZone, repeat, 1, now)
  if (first === undefined) return null
  // The time people know comes from the meetings they actually had (in the zone the series ran in) over
  // the last five weeks, so checking during the week or two between the EU and US changes doesn't call
  // the odd week "usual". Five weeks outvotes the longest gap (three weeks in spring).
  const lookback = repeat === "fortnightly" ? 42 : 35
  const past = Number.isFinite(now) ? occurrences(wall, series.timeZone, repeat, 40, first - lookback * DAY).filter((i) => i < first - MINUTE) : []
  const soon = occurrences(wall, series.timeZone, repeat, 30, first).filter((i) => i < first + 21 * DAY)
  // Re-express the series in the anchor zone, keeping the first meeting where it is.
  const aw = wallParts(first, anchor)
  const instants = occurrences({ ...aw }, anchor, repeat, count, first)

  const valid = (Array.isArray(attendees) ? attendees : []).filter((a): a is DstAttendee => !!a && typeof a.name === "string")
  const invalid = valid.filter((a) => !isValidZone(a.timeZone))
  const localMinutes = (instant: number, tz: string) => {
    const w = wallParts(instant, tz)
    return w.hour * 60 + w.minute
  }
  /**
   * The time from the last meeting, unless it was the odd one out: it differs from the most common
   * time of the last five weeks and a meeting in the next three weeks goes back to that common time.
   */
  const usualFor = (tz: string) => {
    const last = past[past.length - 1]
    if (last === undefined) return { usual: localMinutes(first, tz), usualAt: first }
    const tally = new Map<number, { n: number; at: number }>()
    for (const instant of past) {
      const m = localMinutes(instant, tz)
      tally.set(m, { n: (tally.get(m)?.n ?? 0) + 1, at: instant })
    }
    const [common, best] = [...tally].sort((a, b) => b[1].n - a[1].n || b[1].at - a[1].at)[0]
    const lastMinutes = localMinutes(last, tz)
    return lastMinutes !== common && soon.some((i) => localMinutes(i, tz) === common) ? { usual: common, usualAt: best.at } : { usual: lastMinutes, usualAt: last }
  }

  const shifts = valid
    .filter((a) => isValidZone(a.timeZone))
    .map((attendee): AttendeeShift => {
      const { usual, usualAt } = usualFor(attendee.timeZone)
      const runs: ShiftRun[] = []
      instants.forEach((instant, i) => {
        // Wall-clock difference folded into ±12 h, so a move across midnight reads as ±1 h, not 23 h.
        const shift = ((((localMinutes(instant, attendee.timeZone) - usual) % 1440) + 2160) % 1440) - 720
        const last = runs[runs.length - 1]
        const contiguous = last && last.instants[last.instants.length - 1] === instants[i - 1]
        if (!shift) return
        if (contiguous && last.shift === shift) {
          last.instants.push(instant)
          return
        }
        const raw = usual + shift
        const local = ((raw % 1440) + 1440) % 1440
        const prev = instants[i - 1] ?? past[past.length - 1] ?? first
        runs.push({
          instants: [instant],
          shift,
          local,
          dayShift: raw < 0 ? -1 : raw >= 1440 ? 1 : 0,
          afterHours: local < workStart || local >= workEnd,
          cause: findChange(prev, instant, attendee.timeZone) ?? findChange(prev, instant, anchor),
        })
      })
      return { attendee, usual, usualAt, runs }
    })

  return {
    anchor,
    instants,
    attendees: shifts,
    affectedPeople: shifts.filter((s) => s.runs.length).reduce((sum, s) => sum + Math.max(1, Math.floor(Number(s.attendee.count) || 1)), 0),
    invalid,
  }
}

/** "America/New_York" → "New York". */
export function zoneCity(timeZone: string) {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC"
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ")
}
