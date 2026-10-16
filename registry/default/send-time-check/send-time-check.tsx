"use client"

import * as React from "react"
import { TZDate, tzOffset } from "@date-fns/tz"
import { addDays, format, startOfDay } from "date-fns"
import { CalendarClock, Clock, Moon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/** Weekends that aren't Saturday–Sunday, by IANA zone (0 = Sunday). Everything else defaults to [6, 0]. */
const WEEKENDS: Record<string, number[]> = {
  ...Object.fromEntries(
    ["Asia/Riyadh", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat", "Asia/Baghdad", "Asia/Amman", "Asia/Aden",
      "Asia/Jerusalem", "Asia/Tel_Aviv", "Africa/Cairo", "Africa/Algiers", "Africa/Khartoum", "Asia/Dhaka"].map((z) => [z, [5, 6]]),
  ),
  "Asia/Tehran": [5], "Africa/Djibouti": [5], "Africa/Mogadishu": [5], "Asia/Kathmandu": [6], "Asia/Brunei": [5, 0],
}

/** The usual weekend days for a zone: Friday–Saturday in Riyadh, Saturday in Kathmandu, else Saturday–Sunday. */
export const weekendFor = (timeZone: string) => WEEKENDS[timeZone] ?? [6, 0]

/** Wall-clock date, weekday and time an instant shows in `timeZone` (tz database via @date-fns/tz). */
export function wallClock(ts: number, timeZone: string) {
  const d = new TZDate(ts, timeZone)
  return { date: format(d, "yyyy-MM-dd"), weekday: d.getDay(), hour: d.getHours(), minute: d.getMinutes() }
}

/** The instant a wall time in `timeZone` happens. An hour a DST change skips moves forward to the first real time. */
export function zonedTime(date: string, hour: number, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number)
  return new TZDate(y, m - 1, d, hour, 0, timeZone).getTime()
}

export interface Holiday {
  /** The recipient's local date, YYYY-MM-DD. */
  date: string
  /** Name to show, e.g. "Diwali". */
  name: string
}

export interface SendTimeOptions {
  /** Working hours in the recipient's zone, [start, end) in 24h hours. */
  workHours?: [number, number]
  /** Hours counted as night, [from, until), e.g. [22, 7]. */
  nightHours?: [number, number]
  weekend?: number[]
  holidays?: Holiday[]
}

/** Why `now` is a bad moment for the recipient, and the next start of their working day. */
export function checkSendTime(now: number, timeZone: string, { workHours = [9, 18], nightHours = [22, 7], weekend, holidays = [] }: SendTimeOptions = {}) {
  const off = weekend ?? weekendFor(timeZone)
  const free = (date: string, weekday: number) => off.includes(weekday) || holidays.some((h) => h.date === date)
  const w = wallClock(now, timeZone)
  const hours = w.hour + w.minute / 60
  const holiday = holidays.find((h) => h.date === w.date)
  const reason = holiday ? "holiday" : off.includes(w.weekday) ? "weekend" : hours >= nightHours[0] || hours < nightHours[1] ? "night" : hours < workHours[0] || hours >= workHours[1] ? "after-hours" : null
  if (!reason) return { reason, local: w, holiday, next: null }
  // Today's start if it's still ahead and a working day, otherwise the next working day's start.
  let day = startOfDay(new TZDate(now, timeZone))
  for (let i = 0; i < 21; i++) {
    if (!free(format(day, "yyyy-MM-dd"), day.getDay()) && (i > 0 || hours < workHours[0])) break
    day = addDays(day, 1)
  }
  return { reason, local: w, holiday, next: zonedTime(format(day, "yyyy-MM-dd"), workHours[0], timeZone) }
}

const clock = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
const dayName = (ts: number, timeZone: string, weekday: "short" | "long") => new Intl.DateTimeFormat("en-GB", { weekday, timeZone }).format(ts)
const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

export interface SendTimeCheckProps extends SendTimeOptions, Omit<React.ComponentProps<"div">, "children"> {
  /** Recipient's name, e.g. "Priya". */
  recipient: string
  /** Recipient's IANA zone, e.g. "Europe/London". */
  timeZone: string
  /** Where they are. Defaults to the zone's city. */
  place?: string
  /** Fixed "now" for previews and tests. Defaults to a live clock. */
  now?: Date | number
  /** Your zone, used to show the suggestion in your time too. Defaults to the browser's. */
  senderTimeZone?: string
  /** Called with the suggested instant when the user picks "Schedule for …". */
  onSchedule?: (at: Date) => void
  /** The Send / Schedule buttons this check sits next to. */
  children?: React.ReactNode
  /** Templates: `{name}`, `{place}`, `{time}`, `{day}` and `{holiday}` are filled in. */
  okText?: string
  /** Shown when it's night where the recipient is. */
  nightText?: string
  /** Shown outside their working hours. */
  afterHoursText?: string
  /** Shown on their weekend. */
  weekendText?: string
  /** Shown on a holiday you passed. */
  holidayText?: string
  /** Template for the fix button: `{when}`. */
  scheduleLabel?: string
  /** Template for your-time hint: `{time}`. */
  yourTimeText?: string
  /** Show the recipient's day as a 24-hour strip with their working hours and where the message would land. */
  showDay?: boolean
}

/**
 * Stops a 2 AM ping. Next to a Send button it shows the recipient's local time and warns when
 * it's night, their weekend (Friday–Saturday in Riyadh, not just Sat–Sun) or a holiday you pass in,
 * with a one-tap "Schedule for" the start of their next working day, also shown in your time.
 * A strip of their day shows night and working hours with a dot for "now"; hovering or focusing
 * the fix glides the dot to the slot it picks, so the reason and the fix read at a glance.
 * Zone maths runs on the tz database through @date-fns/tz.
 */
export function SendTimeCheck({
  recipient,
  timeZone,
  place = timeZone.split("/").pop()?.replace(/_/g, " "),
  now: fixedNow,
  senderTimeZone,
  onSchedule,
  workHours,
  nightHours,
  weekend,
  holidays,
  okText = "It's {time} for {name} in {place}.",
  nightText = "It's {time} for {name} in {place}.",
  afterHoursText = "It's {time} for {name} in {place}, after their working hours.",
  weekendText = "It's {day} {time} for {name} in {place}, their weekend.",
  holidayText = "It's {holiday} for {name} in {place}.",
  scheduleLabel = "Schedule for {when}",
  yourTimeText = "{time} your time",
  showDay = true,
  className,
  children,
  ...props
}: SendTimeCheckProps) {
  const [liveNow, setLiveNow] = React.useState<number>()
  const [ownZone, setOwnZone] = React.useState(senderTimeZone)
  const [previewing, setPreviewing] = React.useState(false)
  const reduceMotion = useReducedMotion()

  React.useEffect(() => {
    setOwnZone(senderTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
    if (fixedNow !== undefined) return
    setLiveNow(Date.now())
    const id = setInterval(() => setLiveNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [fixedNow, senderTimeZone])

  const fixed = fixedNow !== undefined ? new Date(fixedNow).getTime() : undefined
  const now = fixed !== undefined && Number.isFinite(fixed) ? fixed : liveNow
  // An unknown zone (typo, retired name) shows nothing rather than a wrong time.
  const knownZone = Number.isFinite(tzOffset(timeZone, new Date(0)))
  const check = now === undefined || !knownZone ? null : checkSendTime(now, timeZone, { workHours, nightHours, weekend, holidays })
  const values = check && now !== undefined
    ? { name: recipient, place: place ?? timeZone, time: clock(check.local.hour, check.local.minute), day: dayName(now, timeZone, "long"), holiday: check.holiday?.name ?? "" }
    : null
  const text = !check || !values ? "" : fill(
    { holiday: holidayText, weekend: weekendText, night: nightText, "after-hours": afterHoursText }[check.reason ?? ""] ?? okText,
    values,
  )
  const next = check?.next ?? null
  const nextLocal = next === null ? null : wallClock(next, timeZone)
  const sameDay = nextLocal && check && nextLocal.date === check.local.date
  const when = next === null || !nextLocal ? "" : `${sameDay ? "" : `${dayName(next, timeZone, "short")} `}${clock(nextLocal.hour, nextLocal.minute)}`
  const mine = next !== null && ownZone && ownZone !== timeZone ? wallClock(next, ownZone) : null
  const Icon = check?.reason === "night" ? Moon : check?.reason ? CalendarClock : Clock
  React.useEffect(() => setPreviewing(false), [timeZone, now])

  // The recipient's day as a strip: night shaded, working hours marked, and a dot for "now" that
  // glides to the suggested slot while the Schedule button is hovered or focused.
  const [workStart, workEnd] = workHours ?? [9, 18]
  const [nightFrom, nightUntil] = nightHours ?? [22, 7]
  const pct = (h: number) => `${(Math.min(24, Math.max(0, h)) / 24) * 100}%`
  const nowHour = check ? check.local.hour + check.local.minute / 60 : 0
  const atSlot = previewing && next !== null && nextLocal
  const dot = atSlot ? nextLocal.hour + nextLocal.minute / 60 : nowHour
  const workday = check?.reason !== "weekend" && check?.reason !== "holiday"
  const day = showDay && check && (
    <div aria-hidden className="relative mt-1 mb-4 h-4 select-none">
      <div className="absolute inset-x-0 top-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <span className="absolute inset-y-0 left-0 bg-indigo-500/30 dark:bg-indigo-400/30" style={{ width: pct(nightUntil) }} />
        <span className="absolute inset-y-0 right-0 bg-indigo-500/30 dark:bg-indigo-400/30" style={{ left: pct(nightFrom) }} />
        {(workday || atSlot) && (
          <span className="absolute inset-y-0 bg-emerald-500/50 dark:bg-emerald-400/45" style={{ left: pct(workStart), width: `${((workEnd - workStart) / 24) * 100}%` }} />
        )}
      </div>
      <motion.span
        className={cn(
          "absolute top-0 size-4 -translate-x-1/2 rounded-full border-2 border-background shadow-sm",
          atSlot ? "bg-emerald-600 dark:bg-emerald-400" : check.reason ? "bg-amber-500" : "bg-foreground",
        )}
        initial={false}
        animate={{ left: pct(dot), scale: atSlot && !reduceMotion ? [1, 1.25, 1] : 1 }}
        transition={reduceMotion ? { duration: 0 } : { left: { type: "spring", stiffness: 260, damping: 26 }, scale: { duration: 0.35 } }}
      />
      <motion.span
        className={cn("absolute top-5 -translate-x-1/2 text-[10px] whitespace-nowrap tabular-nums", atSlot ? "font-medium text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}
        initial={false}
        animate={{ left: `clamp(1.5rem, ${pct(dot)}, calc(100% - 1.5rem))` }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
      >
        {atSlot ? when : values?.time}
      </motion.span>
    </div>
  )

  return (
    <div data-slot="send-time-check" data-state={check?.reason ?? "ok"} className={cn("grid gap-1.5", className)} {...props}>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      <div aria-live="polite" className="min-h-6 text-xs">
        {values && (
          <p className={cn("flex gap-1.5", check?.reason ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
            <span className="flex h-6 shrink-0 items-center">
              <Icon aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1 tabular-nums">{text}</span>
              {next !== null && (
                <span className="flex flex-wrap items-center gap-x-2">
                  <button
                    type="button"
                    onClick={() => onSchedule?.(new Date(next))}
                    onPointerEnter={() => setPreviewing(true)}
                    onPointerLeave={(event) => event.currentTarget !== document.activeElement && setPreviewing(false)}
                    onFocus={() => setPreviewing(true)}
                    onBlur={() => setPreviewing(false)}
                    className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {fill(scheduleLabel, { when })}
                  </button>
                  {mine && (
                    <span className="text-muted-foreground tabular-nums">
                      {fill(yourTimeText, {
                        time: `${mine.date !== nextLocal?.date ? `${dayName(next, ownZone!, "short")} ` : ""}${clock(mine.hour, mine.minute)}`,
                      })}
                    </span>
                  )}
                </span>
              )}
            </span>
          </p>
        )}
      </div>
      {day}
    </div>
  )
}
