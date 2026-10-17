// Bollard UI — event-overlap · MIT licence · https://bollard-ui.vercel.app/components/event-overlap

/** Conflict detection and free-slot search for event-overlap. Pure, so it runs on the server too. */

/** An event already on the calendar. */
export interface CalendarEvent {
  id: string
  title: string
  /** Instant for timed events; "YYYY-MM-DD" for all-day events. */
  start: Date | number | string
  /** Instant for timed events; for all-day events the day AFTER the last day ("YYYY-MM-DD", exclusive). */
  end: Date | number | string
  allDay?: boolean
  /** Shown as busy? Timed events default to busy, all-day events to free (as Google and Outlook do). */
  busy?: boolean
  location?: string
  /** IANA zone the event was set in, e.g. a flight booked in "Asia/Singapore". */
  timeZone?: string
}

/** The event being created or moved. */
export interface DraftEvent {
  start: Date | number
  end: Date | number
  location?: string
  /** IANA zone where it takes place, when that isn't yours. */
  timeZone?: string
}

export type ConflictKind = "overlap" | "travel" | "no-buffer" | "all-day" | "free"
export interface Conflict {
  event: CalendarEvent
  kind: ConflictKind
  /** Minutes of overlap, or the gap you have versus the gap you need. */
  minutes: number
  needed?: number
  /** The two places travel was needed between. */
  route?: [string, string]
}

export interface OverlapOptions {
  /** Minimum break between busy events, in minutes. */
  buffer?: number
  /** Minutes to travel between two locations, or nothing when unknown or not needed (online). */
  travelMinutes?: (from: string, to: string) => number | null | undefined
  /** Your zone. Defaults to the browser's. */
  timeZone?: string
}

export const MIN = 60_000
export const ms = (v: Date | number | string) => new Date(v).getTime()

/** Wall date ("YYYY-MM-DD") and minutes past midnight of an instant in a zone. */
export function wallTime(ts: number, timeZone?: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ts)
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}

/** Does an all-day event cover a date? `end` is exclusive; an end equal to the start still means one day. */
const coversDate = (e: CalendarEvent, date: string) => {
  const start = String(e.start).slice(0, 10)
  const end = String(e.end).slice(0, 10)
  return date >= start && (date < end || (end <= start && date === start))
}

/**
 * Everything the draft runs into: overlaps, back-to-back events with less than `buffer` minutes
 * between them, too little time to travel between two locations, and busy all-day events such as
 * leave. Free events are returned as `free` so they can be mentioned without counting as clashes.
 */
export function findConflicts(draft: DraftEvent, events: CalendarEvent[], { buffer = 10, travelMinutes, timeZone }: OverlapOptions = {}) {
  const s = ms(draft.start)
  const e = ms(draft.end)
  const days = new Set([wallTime(s, timeZone).date, wallTime(e - 1, timeZone).date])
  const out: Conflict[] = []
  for (const event of events) {
    if (event.allDay) {
      if ([...days].some((d) => coversDate(event, d))) out.push({ event, kind: event.busy ? "all-day" : "free", minutes: 0 })
      continue
    }
    const es = ms(event.start)
    const ee = ms(event.end)
    const busy = event.busy ?? true
    if (s < ee && es < e) {
      out.push({ event, kind: busy ? "overlap" : "free", minutes: Math.round((Math.min(e, ee) - Math.max(s, es)) / MIN) })
      continue
    }
    if (!busy) continue
    const before = ee <= s
    const gap = Math.round((before ? s - ee : es - e) / MIN)
    const [from, to] = before ? [event.location, draft.location] : [draft.location, event.location]
    const travel = from && to && from !== to ? (travelMinutes?.(from, to) ?? 0) : 0
    const needed = Math.max(buffer, travel)
    if (gap < needed) out.push({ event, kind: travel > buffer ? "travel" : "no-buffer", minutes: gap, needed, route: travel > buffer && from && to ? [from, to] : undefined })
  }
  const rank: Record<ConflictKind, number> = { overlap: 0, "all-day": 1, travel: 2, "no-buffer": 3, free: 4 }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || ms(a.event.start) - ms(b.event.start))
}

/**
 * The nearest start (same length) with no clash, keeping the buffer and travel time, inside working
 * hours and not in the past. Searches outward in `step`-minute moves, later before earlier, up to a week.
 */
export function nearestFreeSlot(
  draft: DraftEvent,
  events: CalendarEvent[],
  { workHours = [9, 18], step = 15, now, ...options }: OverlapOptions & { workHours?: [number, number]; step?: number; now?: number } = {},
) {
  const s = ms(draft.start)
  const length = ms(draft.end) - s
  const base = Math.round(s / (step * MIN)) * step * MIN
  const fits = (start: number) => {
    if (now !== undefined && start < now) return false
    const a = wallTime(start, options.timeZone)
    const b = wallTime(start + length, options.timeZone)
    if (a.date !== b.date && b.minutes !== 0) return false
    if (a.minutes < workHours[0] * 60 || (b.minutes || 1440) > workHours[1] * 60) return false
    return findConflicts({ ...draft, start, end: start + length }, events, options).every((c) => c.kind === "free")
  }
  for (let i = 1; i <= (7 * 1440) / step; i++) {
    for (const start of [base + i * step * MIN, base - i * step * MIN]) if (start !== s && fits(start)) return { start: new Date(start), end: new Date(start + length) }
  }
  return null
}
