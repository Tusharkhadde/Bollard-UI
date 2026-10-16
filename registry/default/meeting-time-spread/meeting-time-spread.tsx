"use client"

import * as React from "react"
import { tzOffset } from "@date-fns/tz"
import { Clock, HeartHandshake, Moon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { dayBounds, kindestSlot, localParts, meetingPart, type Attendee, type DayPart, type PastMeeting } from "./spread"

export { dayBounds, dayPartAt, kindestSlot, localParts, meetingPart, painCounts, scoreSlot, type Attendee, type DayPart, type KindestSlot, type PastMeeting } from "./spread"

export const MEETING_TIME_SPREAD_MESSAGES = {
  label: "Meeting start",
  parts: { night: "night", early: "before work", working: "working", late: "after work", weekend: "weekend" } satisfies Record<DayPart, string>,
  allGood: "Everyone is in working hours",
  atNight: "{count} at night|{count} at night",
  outOfHours: "{count} out of hours|{count} out of hours",
  dayBefore: "day before",
  dayAfter: "next day",
  kindest: "Kindest slot",
  use: "Use {time}",
  isKindest: "This is the kindest slot for this day.",
  noNight: "Nobody at night.",
  nights: "{names} at night: no slot avoids it.",
  ooh: "{names} out of hours.|{names} out of hours.",
  spares: "Spares {name}, who took the last {count} out of hours.|Spares {name}, who took the last {count} out of hours.",
  gap: "{name} is {now} from you this week, usually {usual}: clocks changed on one side only.",
}

type Messages = Omit<typeof MEETING_TIME_SPREAD_MESSAGES, "parts"> & { parts: Record<DayPart, string> }

export interface MeetingTimeSpreadProps extends Omit<React.ComponentProps<"div">, "children" | "defaultValue"> {
  /** Everyone invited. The first is treated as you unless `timeZone` says otherwise. */
  attendees: Attendee[]
  /** The calendar day being planned, "YYYY-MM-DD", in `timeZone`. */
  date: string
  /** Your zone: the slider's axis. Defaults to the first attendee's. */
  timeZone?: string
  /** Meeting length in minutes. Default 30. */
  duration?: number
  /** Slider step in minutes. Default 30. */
  step?: number
  /** Controlled start instant (epoch ms). */
  value?: number
  /** Initial start instant when uncontrolled. Defaults to 09:00 in `timeZone`. */
  defaultValue?: number
  /** Called with the chosen start instant (epoch ms). */
  onValueChange?: (start: number) => void
  /** Earlier meetings of this series; out-of-hours turns are rotated away from whoever took the last ones. */
  history?: PastMeeting[]
  /** BCP 47 locale for times and dates. Default "en-GB". */
  locale?: string
  /** Override any visible string, including day-part names. */
  messages?: Partial<Omit<Messages, "parts">> & { parts?: Partial<Record<DayPart, string>> }
}

const fill = (t: string, v: Record<string, string | number>) =>
  (t.includes("|") ? t.split("|")[Number(v.count) === 1 ? 0 : 1] : t).replace(/\{(\w+)\}/g, (k, key: string) => String(v[key] ?? k))
const CELL: Record<DayPart, string> = {
  working: "bg-emerald-500/70 dark:bg-emerald-500/60",
  early: "bg-amber-400/60 dark:bg-amber-400/45",
  late: "bg-amber-400/60 dark:bg-amber-400/45",
  weekend: "bg-violet-400/50 dark:bg-violet-400/40",
  night: "bg-slate-700 dark:bg-slate-600/70",
}
const TEXT: Record<DayPart, string> = {
  working: "text-emerald-700 dark:text-emerald-400",
  early: "text-amber-700 dark:text-amber-400",
  late: "text-amber-700 dark:text-amber-400",
  weekend: "text-violet-700 dark:text-violet-300",
  night: "text-red-700 dark:text-red-400",
}
const list = (names: string[], locale: string) => {
  try {
    return new Intl.ListFormat(locale, { type: "conjunction" }).format(names)
  } catch {
    return names.join(", ")
  }
}
const hrs = (min: number) => `${Math.abs(min) / 60}h`

/**
 * Stops a recurring meeting always landing at 3 AM for the same person. A slider sets the start in your
 * zone while every attendee's own day runs underneath (night, before work, working, after work, weekend,
 * a day ahead or behind, DST from the tz database). "Kindest slot" avoids night first, then puts the
 * fewest people out of hours, then rotates the pain away from whoever took the last ones ("Spares Sam").
 */
export function MeetingTimeSpread({
  attendees, date, timeZone, duration = 30, step = 30, value: valueProp, defaultValue, onValueChange, history, locale = "en-GB",
  messages, className, ...props
}: MeetingTimeSpreadProps) {
  const m: Messages = { ...MEETING_TIME_SPREAD_MESSAGES, ...messages, parts: { ...MEETING_TIME_SPREAD_MESSAGES.parts, ...messages?.parts } }
  const zone = timeZone ?? attendees[0]?.timeZone ?? "UTC"
  const { start: dayStart, end: dayEnd } = dayBounds(date, zone)
  const stepMs = Math.max(5, step) * 60_000
  const slots = Math.max(1, Math.floor((dayEnd - dayStart) / stepMs))
  const [inner, setInner] = React.useState(() => defaultValue ?? dayStart + 9 * 3_600_000)
  const raw = valueProp ?? inner
  const index = Math.min(slots - 1, Math.max(0, Math.round(((Number.isFinite(raw) ? raw : dayStart) - dayStart) / stepMs)))
  const start = dayStart + index * stepMs
  const reduce = useReducedMotion()
  const sliderRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()
  const [status, setStatus] = React.useState("")

  const set = (next: number) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
  }

  const fmt = React.useCallback(
    (at: number, tz: string) => {
      try {
        return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(at)
      } catch {
        return new Date(at).toISOString().slice(11, 16)
      }
    },
    [locale],
  )

  const grid = React.useMemo(
    () => attendees.map((a) => Array.from({ length: slots }, (_, i) => meetingPart(dayStart + i * stepMs, Math.max(5, step), a))),
    [attendees, slots, dayStart, stepMs, step],
  )
  const kind = React.useMemo(
    () => kindestSlot({ date, timeZone: zone, attendees, durationMin: duration, stepMin: step, history, near: start }),
    // `start` only breaks ties between equally kind slots; recomputing on every drag would make the suggestion chase the slider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, zone, attendees, duration, step, history],
  )
  const rows = attendees.map((a) => {
    const part = meetingPart(start, duration, a)
    const here = localParts(start, zone).date
    const there = localParts(start, a.timeZone).date
    const gap = (d: number) => (tzOffset(a.timeZone, new Date(d)) || 0) - (tzOffset(zone, new Date(d)) || 0)
    const gapNow = gap(start)
    // "Usual" is the gap both in mid-January and mid-July. Only when those agree (both sides keep the same
    // clock rules) and this week differs did the clocks change on one side only. A pair whose gap simply
    // changes with the seasons (London and Kolkata) never gets the note.
    const year = new Date(start).getUTCFullYear()
    const jan = gap(Date.UTC(year, 0, 15))
    const jul = gap(Date.UTC(year, 6, 15))
    return { a, part, shift: there < here ? -1 : there > here ? 1 : 0, gapNow, gapUsual: jan === jul && gapNow !== jan ? jan : null }
  })
  const night = rows.filter((r) => r.part === "night")
  const out = rows.filter((r) => r.part !== "working")
  const summary = night.length ? fill(m.atNight, { count: night.length }) : out.length ? fill(m.outOfHours, { count: out.length }) : m.allGood
  const end = start + duration * 60_000
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: zone }).format(dayStart)
  const valueText = `${fmt(start, zone)}–${fmt(end, zone)}. ${summary}. ${rows.map((r) => `${r.a.name} ${fmt(start, r.a.timeZone)} ${m.parts[r.part]}`).join(", ")}`
  const kindParts = kind ? attendees.filter((a) => kind.parts[a.id] !== "working") : []
  const kindNight = kindParts.filter((a) => kind?.parts[a.id] === "night").map((a) => a.name)
  const kindOoh = kindParts.filter((a) => kind?.parts[a.id] !== "night").map((a) => a.name)

  React.useEffect(() => {
    const t = setTimeout(() => setStatus(summary), 700)
    return () => clearTimeout(t)
  }, [summary])

  const left = `${(index / slots) * 100}%`
  const width = `${Math.min(100 - (index / slots) * 100, (duration * 60_000 * 100) / (dayEnd - dayStart))}%`

  return (
    <div data-slot="meeting-time-spread" data-state={night.length ? "night" : out.length ? "out-of-hours" : "clear"} className={cn("grid w-full min-w-0 gap-3 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={`${id}-slider`} className="font-medium tabular-nums">
          <span className="sr-only">{m.label}: </span>
          {dateLabel} · {fmt(start, zone)}–{fmt(end, zone)}
        </label>
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", night.length ? TEXT.night : out.length ? TEXT.late : TEXT.working)}>
          {night.length ? <Moon aria-hidden className="size-3.5" /> : <Clock aria-hidden className="size-3.5" />}
          {summary}
        </span>
      </div>

      <div className="grid gap-2">
        {rows.map(({ a, part, shift }, r) => (
          <div key={a.id} className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-baseline justify-between gap-2 text-xs">
              <span className="truncate">
                <span className="font-medium">{a.name}</span>
                {a.place && <span className="text-muted-foreground"> · {a.place}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {fmt(start, a.timeZone)}
                {shift !== 0 && <span className="text-muted-foreground"> · {shift < 0 ? m.dayBefore : m.dayAfter}</span>}
                <span className={cn("font-medium", TEXT[part])}> · {m.parts[part]}</span>
              </span>
            </div>
            <div aria-hidden className="relative h-3">
              <div className="flex h-full overflow-hidden rounded-sm">
                {grid[r].map((p, i) => (
                  <span key={i} className={cn("h-full flex-1 border-r border-background/40 last:border-r-0", CELL[p])} />
                ))}
              </div>
              <motion.span
                className="absolute -inset-y-1 min-w-2 rounded-sm bg-foreground/15 ring-2 ring-foreground"
                initial={false}
                animate={{ left, width }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            </div>
          </div>
        ))}
      </div>

      <input
        ref={sliderRef}
        id={`${id}-slider`}
        type="range"
        min={0}
        max={slots - 1}
        step={1}
        value={index}
        aria-valuetext={valueText}
        onChange={(e) => set(dayStart + Number(e.target.value) * stepMs)}
        className="h-5 w-full cursor-pointer accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-full"
      />
      <div aria-hidden className="-mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        {[0, 6, 12, 18].map((h) => (
          <span key={h}>{fmt(dayStart + h * 3_600_000, zone)}</span>
        ))}
        <span>24:00</span>
      </div>

      {rows.filter((r) => r.gapUsual !== null).slice(0, 1).map((r) => (
        <p key={r.a.id} className="text-xs text-muted-foreground">
          {fill(m.gap, { name: r.a.name, now: hrs(r.gapNow), usual: hrs(r.gapUsual ?? 0) })}
        </p>
      ))}

      {kind && (
        <div className="grid gap-1.5 rounded-md border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium">
              <HeartHandshake aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
              {m.kindest}: <span className="tabular-nums">{fmt(kind.start, zone)}</span>
            </p>
            {kind.start !== start && (
              <button
                type="button"
                onClick={() => {
                  set(kind.start)
                  requestAnimationFrame(() => sliderRef.current?.focus())
                }}
                className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {fill(m.use, { time: fmt(kind.start, zone) })}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {kindNight.length ? fill(m.nights, { names: list(kindNight, locale) }) : m.noNight}{" "}
            {kindOoh.length > 0 && fill(m.ooh, { names: list(kindOoh, locale), count: kindOoh.length })}{" "}
            {kind.spares && fill(m.spares, { name: kind.spares.attendee.name, count: kind.spares.count })}
          </p>
          {kind.start === start && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{m.isKindest}</p>}
        </div>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
