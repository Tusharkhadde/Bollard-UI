"use client"

import * as React from "react"
import { AlarmClock, CalendarClock, CircleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")

function wall(ts: number, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ts)
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) }
}

/** The instant a wall time in `timeZone` happens (DST-safe). */
export function zonedInstant(date: string, hour: number, minute: number, timeZone: string) {
  const naive = Date.parse(`${date}T${pad(hour)}:${pad(minute)}Z`)
  let ts = naive
  for (let i = 0; i < 2; i++) {
    const w = wall(ts, timeZone)
    ts = naive - (Date.parse(`${w.date}T${pad(w.hour)}:${pad(w.minute)}Z`) - ts)
  }
  return ts
}

/**
 * Resolves a deadline to an instant. A bare "2026-10-15" means the END of that day in the
 * owner's zone (11:59 PM), not midnight UTC, which is how `new Date("2026-10-15")` reads it.
 */
export function resolveDeadline(due: Date | number | string, ownerTimeZone: string) {
  if (typeof due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(due)) return { ts: zonedInstant(due, 23, 59, ownerTimeZone), dateOnly: true }
  return { ts: new Date(due).getTime(), dateOnly: false }
}

/** "in 30 hours", "in 2 days", "3 hours ago". Rounds toward the deadline so time left is never overstated. */
export function relativeDeadline(ms: number, locale = "en-GB") {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" })
  const abs = Math.abs(ms)
  const sign = ms < 0 ? -1 : 1
  if (abs < 90 * 60_000) return rtf.format(sign * Math.max(1, Math.floor(abs / 60_000)), "minute")
  if (abs < 48 * 3_600_000) return rtf.format(sign * Math.floor(abs / 3_600_000), "hour")
  return rtf.format(sign * Math.floor(abs / 86_400_000), "day")
}

const dayLabel = (date: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(Date.parse(`${date}T12:00Z`))
const prevDate = (date: string) => new Date(Date.parse(`${date}T12:00Z`) - 86_400_000).toISOString().slice(0, 10)

/** "5:00 PM" for English locales (the original format); the locale's own clock, such as "17:00", otherwise. */
function clockTime(ts: number, timeZone: string, locale: string, hour12?: boolean) {
  const w = wall(ts, timeZone)
  if (hour12 ?? /^en\b/i.test(locale)) {
    if (/^en\b/i.test(locale)) return `${w.hour % 12 || 12}:${pad(w.minute)} ${w.hour < 12 ? "AM" : "PM"}`
    return new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(ts)
  }
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ts)
}

export interface DeadlineTimeOptions {
  /** Word used for 00:00. Defaults to "midnight". */
  midnightLabel?: string
  /** Force a 12- or 24-hour clock. Defaults to 12-hour for English locales and the locale's clock otherwise. */
  hour12?: boolean
}

/**
 * A wall time with no "12:00 AM": midnight is written as the end of the day before it
 * ("Wed 14 Oct, midnight"), so nobody reads it as the morning of the day after.
 */
export function formatDeadlineTime(ts: number, timeZone: string, locale = "en-GB", { midnightLabel = "midnight", hour12 }: DeadlineTimeOptions = {}) {
  const w = wall(ts, timeZone)
  const midnight = w.hour === 0 && w.minute === 0
  const endOfDay = midnight || (w.hour === 23 && w.minute === 59)
  const date = midnight ? prevDate(w.date) : w.date
  const time = midnight ? midnightLabel : clockTime(ts, timeZone, locale, hour12)
  return { date, day: dayLabel(date, locale), time, midnight, endOfDay }
}

/** "IST", "BST", "EDT" where a real abbreviation exists, "AoE" for UTC−12, otherwise "GMT+4". */
export function zoneAbbreviation(ts: number, timeZone: string) {
  if (timeZone === "Etc/GMT+12") return "AoE"
  const names = ["en-US", "en-IN", "en-GB", "en-AU"].map(
    (l) => new Intl.DateTimeFormat(l, { timeZone, timeZoneName: "short" }).formatToParts(ts).find((p) => p.type === "timeZoneName")?.value ?? "",
  )
  return names.find((n) => !/^(GMT|UTC)/.test(n)) ?? names[0]
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

export interface DeadlineProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The deadline instant, or a bare "YYYY-MM-DD" meaning the end of that day for the owner. */
  due: Date | number | string
  /** IANA zone the deadline was set in, e.g. "Europe/London". "Etc/GMT+12" is Anywhere on Earth. */
  ownerTimeZone: string
  /** Name for the owner's zone. Defaults to its city, or "AoE". */
  ownerPlace?: string
  /** Viewer's zone. Defaults to the browser's. */
  viewerTimeZone?: string
  /** Fixed "now" for previews and tests. Defaults to a live clock. */
  now?: Date | number
  /** Turns amber when less than this many ms are left. */
  urgentWithin?: number
  /** What is due, e.g. "Proposal". */
  label?: string
  /** Number, date and clock formatting locale. English locales use a 12-hour clock, others their own. */
  locale?: string
  /** Force a 12- or 24-hour clock regardless of `locale`. */
  hour12?: boolean
  /** Templates: `{relative}`, `{day}` and `{place}` are filled in. */
  dueText?: string
  overdueText?: string
  midnightText?: string
  endOfDayLabel?: string
  /** The owner's time, after yours. `{time}` and `{place}` are filled in; `{day}` too when the date differs. */
  ownerTimeText?: string
  /** Same as `ownerTimeText` when the owner's date differs from yours. */
  ownerDayTimeText?: string
  /** Word used for 00:00. */
  midnightLabel?: string
}

/**
 * Stops a deadline being missed by a time-zone slip or a misread midnight. It shows time left and
 * the exact moment in your zone and the owner's ("Due in 2 days · Thu 15 Oct, 5:00 PM IST ·
 * 12:30 PM in London"), never writes "12:00 AM", reads a bare date as end of day for the owner,
 * and turns amber when it's close and red once it's overdue.
 */
export function Deadline({
  due,
  ownerTimeZone,
  ownerPlace = ownerTimeZone === "Etc/GMT+12" ? "AoE" : ownerTimeZone.split("/").pop()?.replace(/_/g, " "),
  viewerTimeZone,
  now: fixedNow,
  urgentWithin = 24 * 3_600_000,
  label,
  locale = "en-GB",
  dueText = "Due {relative}",
  overdueText = "Overdue · {relative}",
  midnightText = "Midnight in {place} means the end of {day}, not the start.",
  endOfDayLabel = "End of day",
  ownerTimeText = "{time} in {place}",
  ownerDayTimeText = "{day}, {time} in {place}",
  midnightLabel = "midnight",
  hour12,
  className,
  ...props
}: DeadlineProps) {
  const [liveNow, setLiveNow] = React.useState<number>()
  const [zone, setZone] = React.useState(viewerTimeZone)

  React.useEffect(() => {
    setZone(viewerTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
    if (fixedNow !== undefined) return
    setLiveNow(Date.now())
    const id = setInterval(() => setLiveNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [fixedNow, viewerTimeZone])

  const { ts, dateOnly } = resolveDeadline(due, ownerTimeZone)
  const now = fixedNow !== undefined ? new Date(fixedNow).getTime() : liveNow
  const left = now === undefined ? null : ts - now
  const tone = left === null ? "normal" : left < 0 ? "overdue" : left < urgentWithin ? "urgent" : "normal"
  const owner = formatDeadlineTime(ts, ownerTimeZone, locale, { midnightLabel, hour12 })
  const viewer = zone ? formatDeadlineTime(ts, zone, locale, { midnightLabel, hour12 }) : null
  const place = ownerPlace ?? ownerTimeZone
  const sameZone = !zone || wall(ts, zone).hour === wall(ts, ownerTimeZone).hour && wall(ts, zone).date === wall(ts, ownerTimeZone).date
  const Icon = tone === "overdue" ? CircleAlert : tone === "urgent" ? AlarmClock : CalendarClock
  const primary = viewer ?? owner

  return (
    <div
      data-slot="deadline"
      data-state={tone}
      className={cn(
        "grid w-full max-w-sm gap-0.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
        tone === "normal" && "bg-card",
        tone === "urgent" && "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-50",
        tone === "overdue" && "border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-50",
        className,
      )}
      {...props}
    >
      <p className="flex min-h-6 items-start gap-2 font-medium" role={tone === "overdue" ? "alert" : undefined}>
        <Icon
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0",
            tone === "normal" && "text-muted-foreground",
            tone === "urgent" && "text-amber-600 dark:text-amber-400",
            tone === "overdue" && "text-red-600 dark:text-red-400",
          )}
        />
        <span className="flex min-w-0 flex-wrap gap-x-2">
          {label && <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>}
          {left !== null && (
            <span className={cn("tabular-nums", label && tone === "normal" && "text-muted-foreground")}>
              {fill(left < 0 ? overdueText : dueText, { relative: relativeDeadline(left, locale) })}
            </span>
          )}
        </span>
      </p>
      <p className="flex flex-wrap items-center gap-x-1.5 pl-6 tabular-nums">
        <time dateTime={new Date(ts).toISOString()}>
          {primary.day}, {primary.time} {zone && zoneAbbreviation(ts, zone)}
        </time>
        {!sameZone && (
          <span className={tone === "normal" ? "text-muted-foreground" : "opacity-75"}>
            <span aria-hidden>· </span>
            {fill(owner.date !== viewer?.date ? ownerDayTimeText : ownerTimeText, { day: owner.day, time: owner.time, place })}
          </span>
        )}
        {(owner.endOfDay || dateOnly) && (
          <span className="rounded-sm border border-current/20 px-1 text-xs leading-4.5">{endOfDayLabel}</span>
        )}
      </p>
      {owner.midnight && (
        <p className={cn("pl-6 text-xs", tone === "normal" ? "text-muted-foreground" : "opacity-75")}>{fill(midnightText, { place, day: owner.day })}</p>
      )}
    </div>
  )
}
