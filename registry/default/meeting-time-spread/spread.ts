// Bollard UI — meeting-time-spread · MIT licence · https://bollard-ui.vercel.app/components/meeting-time-spread

/**
 * Pure helpers for meeting-time-spread: what part of their day a meeting lands in for each attendee
 * (tz database via @date-fns/tz, so DST is right), and the kindest slot in a day. Safe on the server.
 */
import { TZDate } from "@date-fns/tz"

export type DayPart = "night" | "early" | "working" | "late" | "weekend"

export interface Attendee {
  /** Stable id, used to match past meetings. */
  id: string
  name: string
  /** Where they are, shown beside the name, e.g. "New York". */
  place?: string
  /** IANA zone, e.g. "America/Los_Angeles". */
  timeZone: string
  /** Working hours in local time, 24h. Default 9–17.5 (half hours allowed). */
  workStart?: number
  workEnd?: number
  /** Local weekdays off, 0 = Sunday. Default [0, 6]; use [5, 6] for a Friday–Saturday weekend. */
  weekend?: number[]
}

export interface PastMeeting {
  /** Start instant (epoch ms or ISO string). */
  start: number | string
  /** Attendee ids who were there; everyone when left out. */
  attendees?: string[]
}

/** Night is before 07:00 or from 22:00 local. */
export const NIGHT_START = 22
export const NIGHT_END = 7
const RANK: Record<DayPart, number> = { working: 0, early: 1, late: 1, weekend: 2, night: 3 }

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Local wall clock of an instant in a zone. Falls back to UTC for an unknown zone. */
export function localParts(at: number, timeZone: string) {
  const d = new TZDate(at, validZone(timeZone) ? timeZone : "UTC")
  return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, weekday: d.getDay(), hour: d.getHours() + d.getMinutes() / 60, minutes: d.getHours() * 60 + d.getMinutes() }
}

/** Which part of their day one instant is for an attendee. */
export function dayPartAt(at: number, a: Attendee): DayPart {
  const { weekday, hour } = localParts(at, a.timeZone)
  if (hour < NIGHT_END || hour >= NIGHT_START) return "night"
  if ((a.weekend ?? [0, 6]).includes(weekday)) return "weekend"
  if (hour < (a.workStart ?? 9)) return "early"
  if (hour >= (a.workEnd ?? 17.5)) return "late"
  return "working"
}

/** The worst part of their day a meeting touches, start to end. */
export function meetingPart(start: number, durationMin: number, a: Attendee): DayPart {
  const a1 = dayPartAt(start, a)
  const a2 = dayPartAt(start + Math.max(1, durationMin) * 60_000 - 60_000, a)
  return RANK[a2] > RANK[a1] ? a2 : a1
}

/** Midnight and the next midnight of a calendar date in a zone (a DST day is 23 or 25 hours). */
export function dayBounds(date: string, timeZone: string) {
  const [y, m, d] = (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "1970-01-01").split("-").map(Number)
  const tz = validZone(timeZone) ? timeZone : "UTC"
  return { start: new TZDate(y, m - 1, d, 0, 0, tz).getTime(), end: new TZDate(y, m - 1, d + 1, 0, 0, tz).getTime() }
}

/** How many past meetings each attendee took outside their working hours. */
export function painCounts(history: PastMeeting[] = [], attendees: Attendee[], durationMin = 30) {
  const pain = new Map<string, number>()
  for (const past of history) {
    const at = typeof past.start === "number" ? past.start : Date.parse(past.start)
    if (!Number.isFinite(at)) continue
    for (const a of attendees) {
      if (past.attendees && !past.attendees.includes(a.id)) continue
      if (meetingPart(at, durationMin, a) !== "working") pain.set(a.id, (pain.get(a.id) ?? 0) + 1)
    }
  }
  return pain
}

export interface SlotScore {
  start: number
  parts: Record<string, DayPart>
  night: number
  outOfHours: number
  /** Past pain carried by the people this slot puts out of hours; lower spares those who took the last ones. */
  burden: number
}

export function scoreSlot(start: number, durationMin: number, attendees: Attendee[], pain: Map<string, number>): SlotScore {
  const parts: Record<string, DayPart> = {}
  let night = 0
  let outOfHours = 0
  let burden = 0
  for (const a of attendees) {
    const p = meetingPart(start, durationMin, a)
    parts[a.id] = p
    if (p === "night") night++
    if (p !== "working") {
      outOfHours++
      burden += pain.get(a.id) ?? 0
    }
  }
  return { start, parts, night, outOfHours, burden }
}

export interface KindestSlot extends SlotScore {
  /** The attendee this choice spares because they took the most recent out-of-hours meetings, if any. */
  spares?: { attendee: Attendee; count: number }
}

/**
 * The kindest start in a day: nobody at night first, then the fewest people out of hours, then rotate the
 * pain (out-of-hours goes to those who've had it least), then the slot closest to `near`.
 */
export function kindestSlot(opts: {
  date: string
  timeZone: string
  attendees: Attendee[]
  durationMin?: number
  stepMin?: number
  history?: PastMeeting[]
  near?: number
}): KindestSlot | null {
  const { attendees } = opts
  if (!attendees.length) return null
  const duration = Math.max(5, opts.durationMin ?? 30)
  const step = Math.max(5, opts.stepMin ?? 30)
  const { start, end } = dayBounds(opts.date, opts.timeZone)
  const pain = painCounts(opts.history, attendees, duration)
  const near = Number.isFinite(opts.near) ? (opts.near as number) : start + 12 * 3_600_000
  const slots: SlotScore[] = []
  for (let t = start; t + duration * 60_000 <= end; t += step * 60_000) slots.push(scoreSlot(t, duration, attendees, pain))
  const cmp = (a: SlotScore, b: SlotScore) =>
    a.night - b.night || a.outOfHours - b.outOfHours || a.burden - b.burden || Math.abs(a.start - near) - Math.abs(b.start - near)
  const best = [...slots].sort(cmp)[0]
  if (!best) return null
  // Who did rotating spare? Someone with past pain who works in `best` but an equally good slot (same night
  // and out-of-hours count) would have put out of hours.
  let spares: KindestSlot["spares"]
  for (const a of [...attendees].sort((x, y) => (pain.get(y.id) ?? 0) - (pain.get(x.id) ?? 0))) {
    const count = pain.get(a.id) ?? 0
    if (!count || best.parts[a.id] !== "working") continue
    if (slots.some((s) => s.night === best.night && s.outOfHours === best.outOfHours && s.parts[a.id] !== "working")) {
      spares = { attendee: a, count }
      break
    }
  }
  return { ...best, spares }
}
