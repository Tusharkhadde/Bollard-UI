"use client"

import * as React from "react"
import { CalendarClock, CircleCheck, LoaderCircle, MoonStar } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzeSeries, isValidZone, zoneCity, type DstAttendee, type DstSeries, type ShiftRun } from "./dst"

export { analyzeSeries, isValidZone, offsetAt, parseWall, wallParts, zoneCity, zonedToInstant, type AttendeeShift, type ClockChange, type DstAttendee, type DstRepeat, type DstSeries, type SeriesAnalysis, type ShiftRun } from "./dst"

/** Every visible string. `{…}` placeholders are filled in. */
export const DST_SHIFT_MESSAGES = {
  title: "Daylight saving moves this meeting for some people",
  titleNone: "Everyone keeps the same local time",
  summary: "{people} of {total} people will see it at a different time in the next {count} meetings.",
  summaryNone: "No clock change moves the next {count} meetings for anyone.",
  people: "{count} people",
  usual: "usually {time}",
  oneDate: "{date}",
  range: "{from} – {to} · {count} meetings",
  earlier: "{time}, {amount} earlier",
  later: "{time}, {amount} later",
  nextDay: "next day",
  dayBefore: "day before",
  afterHours: "outside working hours",
  hour: "1 hour",
  hours: "{n} hours",
  minutes: "{n} min",
  causeBack: "Clocks go back in {place} on {date}.",
  causeForward: "Clocks go forward in {place} on {date}.",
  unchanged: "Unchanged: {names}",
  invalid: "Couldn't read the time zone for {names}.",
  legend: "Keep the meeting fixed to",
  zoneOption: "{place} time",
  utcOption: "UTC",
  moves: "{count} people move",
  movesNone: "No one moves",
  current: "Current",
  fewest: "Fewest moves",
  keep: "Keep as is",
  apply: "Fix to {place}",
  saved: "Saved. The series now follows {place}.",
  kept: "Kept on {place}.",
  saveError: "Couldn't save the change. Try again.",
}

export type DstShiftMessages = typeof DST_SHIFT_MESSAGES

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const headcount = (a: DstAttendee) => Math.max(1, Math.floor(Number(a.count) || 1))

export interface DstShiftNoticeProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> {
  /** The recurring meeting: first start as wall time, its zone, repeat rule and how many meetings to check. */
  series: DstSeries
  /** Who attends and from which zone. */
  attendees: DstAttendee[]
  /** Controlled anchor zone ("UTC" or IANA). */
  value?: string
  /** Initial anchor when uncontrolled. Defaults to the series' own zone. */
  defaultValue?: string
  /** Called when another anchor is picked. */
  onValueChange?: (anchor: string) => void
  /** Anchors to offer. Defaults to the series' zone and UTC. */
  anchors?: string[]
  /** Place names for zones when the city in the IANA name isn't right, e.g. { "Asia/Kolkata": "India" }. */
  zoneLabels?: Record<string, string>
  /** Saves the chosen anchor for the whole series. May return a Promise. */
  onApply?: (anchor: string) => void | Promise<void>
  /** "Now" in epoch ms, for deterministic rendering. Past meetings are skipped. */
  now?: number
  /** Working hours in local time, as whole hours. Moves outside them are flagged. */
  workingHours?: [number, number]
  /** Locale for dates and times. */
  locale?: string
  /** Any visible string. */
  messages?: Partial<DstShiftMessages>
}

/**
 * Stops a recurring meeting quietly moving by an hour for part of the team when daylight saving
 * starts or ends on different dates (the US and EU change weeks apart; India never does). It lists
 * each attendee's affected dates with the new local time and the clock change behind it, and lets
 * the organiser fix the series to their own zone, UTC or another zone, showing who moves under each.
 */
export function DstShiftNotice({ series, attendees, value, defaultValue, onValueChange, anchors, zoneLabels, onApply, now, workingHours = [8, 19], locale, messages, className, ...props }: DstShiftNoticeProps) {
  const t = { ...DST_SHIFT_MESSAGES, ...messages }
  const home = isValidZone(series?.timeZone) ? series.timeZone : "UTC"
  const [inner, setInner] = React.useState(defaultValue ?? home)
  const anchor = value ?? inner
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState<{ ok: boolean; text: string }>()
  const anchorRef = React.useRef(anchor)
  anchorRef.current = anchor
  const titleId = React.useId()

  const options = Array.from(new Set((anchors ?? [home, "UTC"]).filter(isValidZone)))
  if (!options.includes(anchor) && isValidZone(anchor)) options.push(anchor)
  const opts = { now, workStart: workingHours[0], workEnd: workingHours[1] }
  const results = options.map((zone) => ({ zone, analysis: analyzeSeries(series, attendees, zone, opts) }))
  const analysis = results.find((r) => r.zone === anchor)?.analysis ?? null
  const fewest = Math.min(...results.map((r) => r.analysis?.affectedPeople ?? Infinity))

  const city = (zone: string) => zoneLabels?.[zone] ?? zoneCity(zone)
  const place = (zone: string) => (zone === "UTC" || zone === "Etc/UTC" ? t.utcOption : fill(t.zoneOption, { place: city(zone) }))
  const time = (instant: number, zone: string) => new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(instant)
  const date = (instant: number, zone: string) => new Intl.DateTimeFormat(locale, { timeZone: zone, day: "numeric", month: "short" }).format(instant)
  const sunday = (instant: number, zone: string) => new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: "short", day: "numeric", month: "short" }).format(instant)
  const amount = (minutes: number) => (minutes === 60 ? t.hour : minutes % 60 === 0 ? fill(t.hours, { n: minutes / 60 }) : fill(t.minutes, { n: minutes }))

  const pick = (zone: string) => {
    if (value === undefined) setInner(zone)
    onValueChange?.(zone)
    setStatus(undefined)
  }

  const apply = async () => {
    if (!onApply || saving) return
    const chosen = anchor
    setSaving(true)
    setStatus(undefined)
    try {
      await onApply(chosen)
      // A different anchor picked while saving makes this result stale.
      if (anchorRef.current === chosen) setStatus({ ok: true, text: fill(chosen === home ? t.kept : t.saved, { place: place(chosen) }) })
    } catch {
      if (anchorRef.current === chosen) setStatus({ ok: false, text: t.saveError })
    } finally {
      setSaving(false)
    }
  }

  if (!analysis) return null
  const total = analysis.attendees.reduce((sum, s) => sum + headcount(s.attendee), 0)
  const moved = analysis.attendees.filter((s) => s.runs.length)
  const still = analysis.attendees.filter((s) => !s.runs.length)

  const describeRun = (run: ShiftRun, zone: string) => {
    const first = run.instants[0]
    const last = run.instants[run.instants.length - 1]
    const when = run.instants.length === 1 ? fill(t.oneDate, { date: date(first, zone) }) : fill(t.range, { from: date(first, zone), to: date(last, zone), count: run.instants.length })
    const what = fill(run.shift < 0 ? t.earlier : t.later, { time: time(first, zone), amount: amount(Math.abs(run.shift)) })
    return { when, what }
  }

  return (
    <section data-slot="dst-shift-notice" data-state={moved.length ? "shifts" : "ok"} aria-labelledby={titleId} className={cn("grid w-full max-w-md min-w-0 gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground shadow-xs", moved.length && "border-amber-500/50", className)} {...props}>
      <span aria-live="polite" className="sr-only">{status?.ok ? status.text : ""}</span>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", moved.length ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>
          {moved.length ? <CalendarClock aria-hidden className="size-4" /> : <CircleCheck aria-hidden className="size-4" />}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h3 id={titleId} className="font-medium break-words">{moved.length ? t.title : t.titleNone}</h3>
          <p className="break-words text-muted-foreground">
            {moved.length ? fill(t.summary, { people: analysis.affectedPeople, total, count: analysis.instants.length }) : fill(t.summaryNone, { count: analysis.instants.length })}
          </p>
        </div>
      </div>

      {moved.length > 0 && (
        <ul className="grid gap-2">
          {moved.map(({ attendee, runs, usualAt }) => (
            <li key={attendee.id ?? attendee.name} className="grid min-w-0 gap-1.5 rounded-md border p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-medium break-words">
                  {attendee.name}
                  {headcount(attendee) > 1 && <span className="font-normal text-muted-foreground"> · {fill(t.people, { count: headcount(attendee) })}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{fill(t.usual, { time: time(usualAt, attendee.timeZone) })}</span>
              </p>
              <ul className="grid gap-1.5">
                {runs.map((run) => {
                  const { when, what } = describeRun(run, attendee.timeZone)
                  return (
                    <li key={run.instants[0]} className="grid gap-0.5 text-xs">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-medium tabular-nums">{when}</span>
                        <span className="text-amber-700 dark:text-amber-400">
                          {what}
                          {run.dayShift !== 0 && ` (${run.dayShift > 0 ? t.nextDay : t.dayBefore})`}
                        </span>
                        {run.afterHours && (
                          <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                            <MoonStar aria-hidden className="size-3.5" />
                            {t.afterHours}
                          </span>
                        )}
                      </span>
                      {run.cause && (
                        <span className="text-muted-foreground">
                          {fill(run.cause.delta < 0 ? t.causeBack : t.causeForward, { place: city(run.cause.timeZone), date: sunday(run.cause.at, run.cause.timeZone) })}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {(still.length > 0 || analysis.invalid.length > 0) && (
        <div className="grid gap-0.5 text-xs text-muted-foreground">
          {still.length > 0 && <p className="break-words">{fill(t.unchanged, { names: still.map((s) => s.attendee.name).join(", ") })}</p>}
          {analysis.invalid.length > 0 && <p className="break-words">{fill(t.invalid, { names: analysis.invalid.map((a) => a.name).join(", ") })}</p>}
        </div>
      )}

      {options.length > 1 && (
        <fieldset className="grid min-w-0 gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{t.legend}</legend>
          {results.map(({ zone, analysis: a }) => {
            const count = a?.affectedPeople ?? 0
            return (
              <label key={zone} className={cn("flex min-w-0 cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50", zone === anchor ? "border-primary/60 bg-accent" : "hover:bg-accent/50")}>
                <input type="radio" name={titleId} value={zone} checked={zone === anchor} onChange={() => pick(zone)} disabled={!a} className="mt-0.5 size-4 shrink-0 accent-primary outline-none" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-medium break-words">{place(zone)}</span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{count ? fill(t.moves, { count }) : t.movesNone}</span>
                    {zone === home && <span>{t.current}</span>}
                    {a && count === fewest && results.filter((r) => r.analysis?.affectedPeople === fewest).length < results.length && <span className="font-medium text-emerald-700 dark:text-emerald-400">{t.fewest}</span>}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
      )}

      {onApply && (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {status && (
            <p role={status.ok ? undefined : "alert"} className={cn("mr-auto text-xs break-words", status.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{status.text}</p>
          )}
          <button type="button" onClick={apply} disabled={saving} aria-busy={saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60">
            {saving && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {anchor === home ? t.keep : fill(t.apply, { place: place(anchor) })}
          </button>
        </div>
      )}
    </section>
  )
}
