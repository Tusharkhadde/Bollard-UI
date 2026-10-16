"use client"

import * as React from "react"
import { ArrowLeftRight, CalendarRange, MoonStar, PartyPopper } from "lucide-react"

import { cn } from "@/lib/utils"

/** A date range as calendar dates ("2026-11-03"), never times, so time zones can't shift a day. */
export interface DateRange {
  start: string
  end: string
}

export interface Holiday {
  date: string
  name: string
}

const DAY = 86_400_000
const toTime = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}
const isDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(toTime(iso))
/** "2026-11-03" plus n days, in calendar days. */
export const addDays = (iso: string, n: number) => new Date(toTime(iso) + n * DAY).toISOString().slice(0, 10)
const weekday = (iso: string) => new Date(toTime(iso)).getUTCDay()

/** "Mon 3 Nov", or "Mon 3 Nov 2026" when asked. */
export function formatDay(iso: string, locale = "en-GB", withYear = false) {
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: withYear ? "numeric" : undefined, timeZone: "UTC" })
    .format(toTime(iso))
    .replace(",", "")
}

/**
 * Counts a range both ways: nights (check-out minus check-in, how stays are
 * billed) and days (inclusive, how leave is counted), plus the weekend days
 * and holidays inside it.
 */
export function measureRange({ start, end }: DateRange, { weekend = [0, 6], holidays = [] }: { weekend?: number[]; holidays?: Holiday[] } = {}) {
  const nights = Math.round((toTime(end) - toTime(start)) / DAY)
  const dates = Array.from({ length: Math.max(0, nights + 1) }, (_, i) => addDays(start, i))
  const off = dates.filter((d) => weekend.includes(weekday(d)) || holidays.some((h) => h.date === d))
  return { nights, days: nights + 1, dates, off, workingDays: dates.length - off.length, holidays: holidays.filter((h) => dates.includes(h.date)) }
}

/** Every sentence the component writes. `{…}` placeholders are filled in; counts use the singular/plural pairs. */
export const STAY_LENGTH_MESSAGES = {
  night: "{n} night", nights: "{n} nights",
  day: "{n} day", days: "{n} days",
  workingDay: "{n} working day", workingDays: "{n} working days",
  weekendDay: "{n} weekend day", weekendDays: "{n} weekend days",
  /** Joins the last two items of a list: "2 weekend days and Diwali". */
  and: " and ",
  endBeforeStart: "{end} is before {start}.",
  swap: "Swap dates",
  sameDay: "Same day in and out is 0 nights.",
  checkOut: "Check out {date}",
  daysNotNights: "That's {expected} days but {nights}.",
  makeNights: "Make it {expected} nights",
  leaveBothEnds: "{start} to {end} is {days} days off, counting both.",
  makeDays: "Make it {expected} days",
  lastNightOrLeaving: "Is {date} the morning you leave, or your last night?",
  lastNight: "Last night, out {date}",
  leaving: "Leaving {date}",
  includesOff: "Includes {what}: {workingDays} of leave.",
  onlyWorkingDays: "Only {start} – {end}",
  overHolidays: "Over {holidays}: check prices and opening.",
  stayAfter: "Last night {last}, out {end} morning",
  leaveAfter: "Back at work {date}",
}
export type StayLengthMessages = typeof STAY_LENGTH_MESSAGES

export interface StayLengthProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** "stay" counts nights between check-in and check-out; "leave" counts the days off, both inclusive. */
  mode?: "stay" | "leave"
  /** Controlled range. */
  value?: DateRange
  /** Initial range when uncontrolled. */
  defaultValue?: DateRange
  onValueChange?: (range: DateRange) => void
  /** The length the person asked for elsewhere ("7 nights" in search), to catch an off-by-one. */
  expected?: number
  /** Week days that aren't working days, 0 = Sunday. */
  weekend?: number[]
  /** Public holidays, from your calendar source. */
  holidays?: Holiday[]
  locale?: string
  startLabel?: string
  endLabel?: string
  /** Overrides any of the sentences in `STAY_LENGTH_MESSAGES`, e.g. to translate them. */
  messages?: Partial<StayLengthMessages>
}

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-2.5 text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 aria-invalid:border-destructive"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, k: string) => (k in values ? String(values[k]) : match))

/**
 * A date range that reads itself back ("Mon 3 Nov – Sun 9 Nov · 6 nights,
 * 7 days") and catches the off-by-one people make with stays and leave: an
 * end before the start, nights confused with days, a check-out that is
 * really the last night, and weekends or holidays that change what leave
 * costs, each with a one-tap fix.
 */
export function StayLength({
  mode = "stay",
  value,
  defaultValue = { start: "", end: "" },
  onValueChange,
  expected,
  weekend = [0, 6],
  holidays = [],
  locale = "en-GB",
  startLabel = mode === "stay" ? "Check-in" : "First day off",
  endLabel = mode === "stay" ? "Check-out" : "Last day off",
  messages,
  className,
  ...props
}: StayLengthProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [kept, setKept] = React.useState<string>()
  const range = value ?? inner
  const id = React.useId()
  const set = (next: DateRange) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const ready = isDate(range.start) && isDate(range.end)
  const m = ready ? measureRange(range, { weekend, holidays }) : null
  const year = ready && range.start.slice(0, 4) !== range.end.slice(0, 4)
  const day = (iso: string) => formatDay(iso, locale, year)
  const key = `${range.start}|${range.end}`
  const holidayNames = m?.holidays.map((h) => `${h.name} (${day(h.date)})`) ?? []
  const t = { ...STAY_LENGTH_MESSAGES, ...messages }
  const plural = (n: number, unit: "night" | "day" | "workingDay" | "weekendDay") => fill(n === 1 ? t[unit] : t[`${unit}s`], { n })
  const list = (items: string[]) => (items.length > 1 ? items.slice(0, -1).join(", ") + t.and + items[items.length - 1] : (items[0] ?? ""))

  type Issue = { icon: typeof MoonStar; text: string; fixLabel?: string; next?: DateRange; error?: boolean; keep?: string }
  let issue: Issue | null = null
  if (m && m.nights < 0) issue = { icon: ArrowLeftRight, error: true, text: fill(t.endBeforeStart, { end: endLabel, start: startLabel.toLowerCase() }), fixLabel: t.swap, next: { start: range.end, end: range.start } }
  else if (m && mode === "stay" && m.nights === 0) issue = { icon: MoonStar, error: true, text: t.sameDay, fixLabel: fill(t.checkOut, { date: day(addDays(range.start, 1)) }), next: { ...range, end: addDays(range.start, 1) } }
  else if (m && expected !== undefined && mode === "stay" && m.days === expected && m.nights !== expected)
    issue = { icon: MoonStar, text: fill(t.daysNotNights, { expected, nights: plural(m.nights, "night") }), fixLabel: fill(t.makeNights, { expected }), next: { ...range, end: addDays(range.start, expected) } }
  else if (m && expected !== undefined && mode === "leave" && m.nights === expected && m.days !== expected)
    issue = { icon: CalendarRange, text: fill(t.leaveBothEnds, { start: day(range.start), end: day(range.end), days: m.days }), fixLabel: fill(t.makeDays, { expected }), next: { ...range, end: addDays(range.start, expected - 1) } }
  else if (m && mode === "stay" && expected === undefined && m.days % 7 === 0 && kept !== key)
    // Mon–Sun reads as "a week", but it's 6 nights: ask whether the end is the morning they leave or the last night.
    issue = { icon: MoonStar, text: fill(t.lastNightOrLeaving, { date: day(range.end) }), fixLabel: fill(t.lastNight, { date: day(addDays(range.end, 1)) }), next: { ...range, end: addDays(range.end, 1) }, keep: fill(t.leaving, { date: day(range.end) }) }
  else if (m && mode === "leave" && m.off.length) {
    const lead = m.dates.findIndex((d) => !m.off.includes(d))
    const trail = [...m.dates].reverse().findIndex((d) => !m.off.includes(d))
    const trimmed = lead > 0 || trail > 0 ? { start: m.dates[Math.max(lead, 0)], end: m.dates[m.dates.length - 1 - Math.max(trail, 0)] } : undefined
    const weekendDays = m.off.length - m.holidays.length
    const what = list([weekendDays ? plural(weekendDays, "weekendDay") : "", ...holidayNames].filter(Boolean))
    issue = {
      icon: PartyPopper,
      text: fill(t.includesOff, { what, workingDays: plural(m.workingDays, "workingDay") }),
      fixLabel: trimmed && m.workingDays ? fill(t.onlyWorkingDays, { start: day(trimmed.start), end: day(trimmed.end) }) : undefined,
      next: trimmed,
    }
  } else if (m && mode === "stay" && holidayNames.length) issue = { icon: PartyPopper, text: fill(t.overHolidays, { holidays: list(holidayNames) }) }

  const readback = m && m.nights >= 0 && (mode === "stay" ? `${plural(m.nights, "night")}, ${plural(m.days, "day")}` : `${plural(m.days, "day")}, ${plural(m.workingDays, "workingDay")}`)
  // Leave ends with the next working day, skipping the weekend and holidays after it.
  let back = ready ? addDays(range.end, 1) : ""
  while (back && (weekend.includes(weekday(back)) || holidays.some((h) => h.date === back))) back = addDays(back, 1)
  const after = m && m.nights >= 0 && (mode === "stay" ? (m.nights > 0 ? fill(t.stayAfter, { last: day(addDays(range.end, -1)), end: day(range.end) }) : "") : fill(t.leaveAfter, { date: day(back) }))

  return (
    <div data-slot="stay-length" className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <style>{"@keyframes cui-stay-length-flash{from{background-color:color-mix(in oklab,var(--color-amber-400) 35%,transparent)}}"}</style>
      <div className="grid grid-cols-2 gap-3">
        {(["start", "end"] as const).map((part) => (
          <div key={part} className="grid min-w-0 gap-1.5">
            <label htmlFor={`${id}-${part}`} className="w-fit text-sm font-medium">{part === "start" ? startLabel : endLabel}</label>
            <input
              id={`${id}-${part}`}
              type="date"
              value={range[part]}
              min={part === "end" && mode === "stay" ? range.start || undefined : undefined}
              onChange={(e) => set({ ...range, [part]: e.target.value })}
              aria-invalid={issue?.error || undefined}
              aria-describedby={`${id}-read`}
              className={field}
            />
          </div>
        ))}
      </div>
      <div id={`${id}-read`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {readback && (
          <p className="text-sm">
            <span className="font-medium">{day(range.start)} – {day(range.end)}</span>{" "}
            <span key={readback} className="rounded-sm px-0.5 whitespace-nowrap text-muted-foreground motion-safe:animate-[cui-stay-length-flash_400ms_ease-out]">· {readback}</span>
          </p>
        )}
        {after && !issue?.error && <p className="text-muted-foreground">{after}</p>}
        {issue && (
          <p role={issue.error ? "alert" : undefined} className={cn("flex gap-1.5", issue.error ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
            <span className="flex h-6 shrink-0 items-center">
              <issue.icon aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{issue.text}</span>
              {issue.fixLabel && issue.next && (
                <button type="button" onClick={() => issue.next && set(issue.next)} className={cn(fix, issue.error && "border-destructive/40 text-destructive hover:bg-destructive/10 dark:text-destructive")}>
                  {issue.fixLabel}
                </button>
              )}
              {issue.keep && (
                <button type="button" onClick={() => setKept(key)} className={fix}>{issue.keep}</button>
              )}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
