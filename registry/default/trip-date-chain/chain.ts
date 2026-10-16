// Bollard UI — trip-date-chain · MIT licence · https://bollard-ui.vercel.app/components/trip-date-chain

import { tzOffset } from "@date-fns/tz"
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns"

/** A flight or train. Times are local wall-clock times as printed on the ticket: "YYYY-MM-DDTHH:mm". */
export interface TripLeg {
  id: string
  label: string
  depart: string
  arrive: string
  /** IANA zones (optional). With both, the leg's real duration is shown and impossible times are caught. */
  departTz?: string
  arriveTz?: string
}

/** A hotel or rental. Dates are "YYYY-MM-DD"; the stay covers the nights from checkIn up to the night before checkOut. */
export interface TripStay {
  id: string
  name: string
  checkIn: string
  checkOut: string
}

/** A one-tap fix: new dates for one stay. */
export interface StayFix {
  stayId: string
  checkIn?: string
  checkOut?: string
}

export type TripProblem =
  | { kind: "arrivalNight"; legId: string; nights: string[]; stayId?: string; fix?: StayFix }
  | { kind: "paidBeforeArrival"; legId: string; nights: string[]; stayId: string; fix: StayFix }
  | { kind: "paidAfterDeparture"; legId: string; nights: string[]; stayId: string; fix: StayFix }
  | { kind: "paidInAir"; nights: string[]; stayId: string; fix?: StayFix }
  | { kind: "gap"; nights: string[]; fix?: StayFix }
  | { kind: "double"; nights: string[]; stayIds: [string, string]; fix: StayFix }
  | { kind: "legOrder"; legId: string }
  | { kind: "connection"; legId: string; nextId: string; minutes: number }
  | { kind: "nightDeparture"; legId: string; evening: string }

export interface ParsedTime {
  date: string
  hour: number
  minute: number
}

/** Reads "YYYY-MM-DDTHH:mm" (seconds and a space instead of T are fine). Null for anything else. */
export function parseLocal(raw: unknown): ParsedTime | null {
  if (typeof raw !== "string") return null
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/)
  if (!m || !parseDay(m[1])) return null
  const hour = Number(m[2])
  const minute = Number(m[3])
  return hour < 24 && minute < 60 ? { date: m[1], hour, minute } : null
}

export function parseDay(raw: unknown): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = parseISO(raw)
  return isValid(d) ? d : null
}

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd")
export const shiftDay = (key: string, n: number) => {
  const d = parseDay(key)
  return d ? dayKey(addDays(d, n)) : key
}
const nightsBetween = (from: string, to: string) => {
  const a = parseDay(from)
  const b = parseDay(to)
  if (!a || !b) return []
  const n = Math.min(366, differenceInCalendarDays(b, a))
  return Array.from({ length: Math.max(0, n) }, (_, i) => dayKey(addDays(a, i)))
}

/** The real instant of a local time in a zone, or null without a valid zone. */
export function instantOf(t: ParsedTime, tz?: string): number | null {
  if (!tz) return null
  const [y, mo, d] = t.date.split("-").map(Number)
  const naive = Date.UTC(y, mo - 1, d, t.hour, t.minute)
  try {
    const off = tzOffset(tz, new Date(naive))
    if (!Number.isFinite(off)) return null
    return naive - tzOffset(tz, new Date(naive - off * 60000)) * 60000
  } catch {
    return null
  }
}

/** First night you need a bed after landing: landing in the small hours means the room has to start the night before. */
export const firstNightAfter = (arrive: ParsedTime, earlyHours: number) => shiftDay(arrive.date, arrive.hour < earlyHours ? -1 : 0)
/** Last night you sleep before leaving: a small-hours departure means you leave for the airport the evening before. */
export const lastNightBefore = (depart: ParsedTime, earlyHours: number) => shiftDay(depart.date, depart.hour < earlyHours ? -2 : -1)

const runs = (nights: string[]) => {
  const sorted = [...new Set(nights)].sort()
  const out: string[][] = []
  sorted.forEach((n) => {
    const last = out.at(-1)
    if (last && shiftDay(last.at(-1)!, 1) === n) last.push(n)
    else out.push([n])
  })
  return out
}

/**
 * Checks a trip night by night: every night between landing and the next take-off needs exactly one bed.
 * Pure, so it can run on a server. `earlyHours` (default 6): a time before this hour belongs to the previous night.
 * `minConnectionMinutes` (default 60): with zones on both ends, a shorter gap between landing and the next take-off is flagged.
 */
export function checkTrip(legsIn: TripLeg[], staysIn: TripStay[], earlyHours = 6, minConnectionMinutes = 60): TripProblem[] {
  const legs = (legsIn ?? [])
    .map((l) => ({ leg: l, d: parseLocal(l?.depart), a: parseLocal(l?.arrive) }))
    .filter((x): x is { leg: TripLeg; d: ParsedTime; a: ParsedTime } => !!x.d && !!x.a)
    .sort((x, y) => (x.leg.depart < y.leg.depart ? -1 : 1))
  const stays = (staysIn ?? []).filter((s) => s && parseDay(s.checkIn) && parseDay(s.checkOut) && s.checkIn < s.checkOut).slice(0, 50)
  const problems: TripProblem[] = []

  legs.forEach(({ leg, d, a }) => {
    const di = instantOf(d, leg.departTz)
    const ai = instantOf(a, leg.arriveTz)
    if (di != null && ai != null && ai <= di) problems.push({ kind: "legOrder", legId: leg.id })
  })
  // A connection shorter than the minimum (or one that leaves before you land). Needs the zones of both ends.
  legs.forEach(({ leg, a }, i) => {
    const next = legs[i + 1]
    if (!next) return
    const ai = instantOf(a, leg.arriveTz)
    const ni = instantOf(next.d, next.leg.departTz)
    if (ai == null || ni == null) return
    const minutes = Math.round((ni - ai) / 60000)
    if (minutes < minConnectionMinutes) problems.push({ kind: "connection", legId: leg.id, nextId: next.leg.id, minutes })
  })

  const byNight = new Map<string, string[]>()
  stays.forEach((s) => nightsBetween(s.checkIn, s.checkOut).forEach((n) => byNight.set(n, [...(byNight.get(n) ?? []), s.id])))
  const stayNights = [...byNight.keys()].sort()
  const lastStayNight = stayNights.at(-1)

  // Nights that need a bed: from each landing to the next take-off (or the last booked night after the final leg).
  type Segment = { from: string; to: string; arrival?: string; departure?: string }
  const segments: Segment[] = []
  if (legs.length && stayNights[0] && stayNights[0] <= lastNightBefore(legs[0].d, earlyHours)) segments.push({ from: stayNights[0], to: lastNightBefore(legs[0].d, earlyHours), departure: legs[0].leg.id })
  legs.forEach(({ leg, a, d }, i) => {
    const from = firstNightAfter(a, earlyHours)
    const next = legs[i + 1]
    // After the final leg, only stays booked from that leg onward count (an outbound-only trip); otherwise you're home.
    const ahead = stays.filter((s) => s.checkIn >= d.date).flatMap((s) => nightsBetween(s.checkIn, s.checkOut)).sort().at(-1)
    const to = next ? lastNightBefore(next.d, earlyHours) : ahead && ahead >= from ? ahead : null
    if (to && to >= from) segments.push({ from, to, arrival: leg.id, departure: next?.leg.id })
  })
  if (!legs.length && stayNights.length) segments.push({ from: stayNights[0], to: lastStayNight! })

  const needed = new Set(segments.flatMap((s) => [s.from, ...nightsBetween(s.from, s.to), s.to]))
  const stayOn = (night: string) => stays.find((s) => s.checkIn <= night && s.checkOut > night)

  // Missing nights: right after landing, or a hole between two stays.
  runs([...needed].filter((n) => !byNight.has(n))).forEach((run) => {
    const seg = segments.find((s) => s.from === run[0] && s.arrival)
    const after = stayOn(shiftDay(run.at(-1)!, 1))
    const before = stayOn(shiftDay(run[0], -1))
    if (seg?.arrival) problems.push({ kind: "arrivalNight", legId: seg.arrival, nights: run, stayId: after?.id, fix: after && { stayId: after.id, checkIn: run[0] } })
    else problems.push({ kind: "gap", nights: run, fix: before ? { stayId: before.id, checkOut: shiftDay(run.at(-1)!, 1) } : after ? { stayId: after.id, checkIn: run[0] } : undefined })
  })

  // Nights paid twice.
  runs(stayNights.filter((n) => (byNight.get(n) ?? []).length > 1)).forEach((run) => {
    const [aId, bId] = byNight.get(run[0])!
    const [a, b] = [stays.find((s) => s.id === aId)!, stays.find((s) => s.id === bId)!].sort((x, y) => (x.checkIn < y.checkIn ? -1 : 1))
    const fix = a.checkIn < run[0] ? { stayId: a.id, checkOut: run[0] } : { stayId: b.id, checkIn: shiftDay(run.at(-1)!, 1) }
    problems.push({ kind: "double", nights: run, stayIds: [a.id, b.id], fix })
  })

  // Nights paid but not slept in: before landing, after leaving for the airport, or in the air.
  if (legs.length)
    runs(stayNights.filter((n) => !needed.has(n))).forEach((run) => {
      const s = stayOn(run[0])!
      const seg = segments.find((g) => shiftDay(run.at(-1)!, 1) === g.from && g.arrival)
      const prev = segments.find((g) => shiftDay(g.to, 1) === run[0] && g.departure)
      if (seg?.arrival && s.checkIn === run[0]) problems.push({ kind: "paidBeforeArrival", legId: seg.arrival, nights: run, stayId: s.id, fix: { stayId: s.id, checkIn: seg.from } })
      else if (prev?.departure && stayOn(run.at(-1)!)?.checkOut === shiftDay(run.at(-1)!, 1)) problems.push({ kind: "paidAfterDeparture", legId: prev.departure, nights: run, stayId: s.id, fix: { stayId: s.id, checkOut: run[0] } })
      else problems.push({ kind: "paidInAir", nights: run, stayId: s.id })
    })

  legs.forEach(({ leg, d }) => {
    if (d.hour < earlyHours) problems.push({ kind: "nightDeparture", legId: leg.id, evening: shiftDay(d.date, -1) })
  })
  return problems
}

/** Applies a fix to a list of stays, returning a new list. */
export function applyFix(stays: TripStay[], fix: StayFix): TripStay[] {
  return stays.map((s) => (s.id === fix.stayId ? { ...s, ...(fix.checkIn && { checkIn: fix.checkIn }), ...(fix.checkOut && { checkOut: fix.checkOut }) } : s))
}
