"use client"

import * as React from "react"
import { TZDate } from "@date-fns/tz"
import NumberFlow, { NumberFlowGroup } from "@number-flow/react"
import { CalendarClock, CircleAlert, Clock, Moon, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzeShift, formatClock, formatLength, parseClock, type BreakRule, type ShiftSummary } from "./shift"

export { analyzeShift, formatClock, formatLength, parseClock, type BreakRule, type ParsedClock, type ShiftIssue, type ShiftSummary } from "./shift"

export interface ShiftValue {
  /** Start time as typed: 9, 9:30, 21:30, 9pm. */
  start: string
  /** End time as typed; 26:00-style next-day notation is accepted. */
  end: string
  /** Unpaid break in minutes. */
  breakMinutes: number
}

/**
 * Real minutes between the wall-clock start and end of a shift that begins on `date` in `timeZone`,
 * via @date-fns/tz. A 22:00–06:00 shift is 7 h on the night clocks spring forward and 9 h when they
 * fall back. Returns null for a bad date or zone.
 */
export function elapsedShiftMinutes(date: string, timeZone: string, start: number, end: number): number | null {
  const [y, m, d] = date.split("-").map(Number)
  if (![y, m, d].every(Number.isFinite)) return null
  const at = (minutes: number) => new TZDate(y, m - 1, d, 0, minutes, timeZone).getTime()
  const startAt = at(start)
  const endAt = at(end < start ? end + 1440 : end)
  const minutes = Math.round((endAt - startAt) / 60_000)
  return Number.isFinite(minutes) ? minutes : null
}

/** Default text for the DST note; `{wall}`, `{real}` and `{change}` are filled in. */
export const SHIFT_DST_MESSAGES = {
  forward: "Clocks go forward during this shift: {wall} on the clock is {real} worked.",
  back: "Clocks go back during this shift: {wall} on the clock is {real} worked.",
}

export interface ShiftTimeInputProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue"> {
  /** Group label. */
  label?: string
  /** Controlled value. */
  value?: ShiftValue
  /** Initial value when uncontrolled. */
  defaultValue?: ShiftValue
  /** Called on every change. */
  onValueChange?: (value: ShiftValue) => void
  /** Called with the worked-out shift, or null while a time can't be read. */
  onShiftChange?: (shift: ShiftSummary | null) => void
  /** Longer shifts are questioned. Default 12 h. */
  maxMinutes?: number
  /** Minimum break for long shifts; null turns it off. Default 30 min after 5 h. */
  breakRule?: BreakRule | null
  /** Read times back as 9:00 PM (true) or 21:00. */
  hour12?: boolean
  /** Label of the start-time input. */
  startLabel?: string
  /** Label of the end-time input. */
  endLabel?: string
  /** Label of the break input. */
  breakLabel?: string
  /** Shown after the length when the shift crosses midnight. */
  nextDayLabel?: string
  /** Day the shift starts, as YYYY-MM-DD. With `timeZone`, lengths count the real hours across a DST change. */
  date?: string
  /** IANA zone the shift is worked in, e.g. "Europe/London". */
  timeZone?: string
  /** Override the DST note (see `SHIFT_DST_MESSAGES`). */
  dstMessages?: Partial<typeof SHIFT_DST_MESSAGES>
}

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium whitespace-nowrap text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const segment = "absolute inset-y-0 rounded-full transition-[left,width,background-color,opacity] duration-300 ease-out motion-reduce:transition-none"
const pct = (minutes: number) => `${(minutes / 1440) * 100}%`

/**
 * A shift start/end field that gets the hours right. It reads 22:00–06:00 as an
 * 8 h shift ending the next day, asks whether 9:00–5:00 meant 5 PM (and whether
 * 10–6 is a day or a night shift) instead of logging 20 h, questions 0 h and
 * over-long shifts, and deducts the break, catching a break typed in hours.
 */
export function ShiftTimeInput({
  label = "Shift",
  value,
  defaultValue = { start: "", end: "", breakMinutes: 0 },
  onValueChange,
  onShiftChange,
  maxMinutes = 720,
  breakRule = { afterMinutes: 300, minBreakMinutes: 30 },
  hour12 = true,
  startLabel = "Start",
  endLabel = "End",
  breakLabel = "Break (min)",
  nextDayLabel = "ends next day",
  date,
  timeZone,
  dstMessages,
  className,
  ...props
}: ShiftTimeInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const id = React.useId()
  const shift = value ?? inner
  const start = parseClock(shift.start)
  const end = parseClock(shift.end)
  const wall = start && end ? analyzeShift(start, end, shift.breakMinutes, { maxMinutes, breakRule }) : null
  const real = wall && date && timeZone && wall.lengthMinutes > 0 ? elapsedShiftMinutes(date, timeZone, wall.start, wall.end) : null
  const dstDelta = wall && real !== null ? real - wall.lengthMinutes : 0
  // Across a DST change the worked time, not the clock difference, is what gets paid.
  const summary = wall && dstDelta ? { ...wall, lengthMinutes: real!, paidMinutes: Math.max(0, real! - shift.breakMinutes) } : wall
  const key = summary ? `${summary.start}-${summary.end}-${summary.paidMinutes}` : ""
  const changeRef = React.useRef(onShiftChange)
  const summaryRef = React.useRef(summary)
  React.useEffect(() => {
    changeRef.current = onShiftChange
    summaryRef.current = summary
  })
  React.useEffect(() => changeRef.current?.(summaryRef.current), [key])

  const update = (patch: Partial<ShiftValue>) => {
    const next = { ...shift, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const issues = summary?.issues ?? []
  const meridiem = issues.find((i) => i.kind === "meridiem")
  const flagged = (f: "start" | "end") => meridiem?.kind === "meridiem" && meridiem.options.some((o) => o.field === f)
  const readback = (text: string, parsed: ReturnType<typeof parseClock>, next = false) =>
    !text.trim() ? null : parsed ? `${formatClock(parsed.minutes, hour12)}${next ? " +1" : ""}` : "Can't read this time"
  const overnight = !!summary?.overnight
  const length = summary?.lengthMinutes ?? 0

  return (
    <fieldset data-slot="shift-time-input" className={cn("grid w-full max-w-sm min-w-0 gap-1.5", className)} {...props}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-[1fr_1fr_5.5rem] gap-2">
        {(["start", "end"] as const).map((f) => {
          const parsed = f === "start" ? start : end
          return (
            <div key={f} className="grid min-w-0 gap-1">
              <label htmlFor={`${id}-${f}`} className="text-xs text-muted-foreground">{f === "start" ? startLabel : endLabel}</label>
              <input
                id={`${id}-${f}`}
                autoComplete="off"
                inputMode="text"
                placeholder={f === "start" ? "9:00" : "17:30"}
                value={shift[f]}
                onChange={(e) => update({ [f]: e.target.value })}
                aria-invalid={(!!shift[f].trim() && !parsed) || undefined}
                aria-describedby={`${id}-${f}-readback ${id}-status`}
                data-warning={flagged(f) ? "" : undefined}
                className={field}
              />
              <span id={`${id}-${f}-readback`} className="min-h-4 text-xs text-muted-foreground tabular-nums">
                {readback(shift[f], parsed, f === "end" && overnight)}
              </span>
            </div>
          )
        })}
        <div className="grid min-w-0 gap-1">
          <label htmlFor={`${id}-break`} className="truncate text-xs text-muted-foreground">{breakLabel}</label>
          <input
            id={`${id}-break`}
            type="number"
            min={0}
            step={5}
            inputMode="numeric"
            value={shift.breakMinutes || ""}
            placeholder="0"
            onChange={(e) => update({ breakMinutes: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            aria-describedby={`${id}-status`}
            data-warning={issues.some((i) => i.kind.startsWith("break")) ? "" : undefined}
            className={field}
          />
          <span aria-hidden className="min-h-4" />
        </div>
      </div>

      <div aria-hidden className="mt-1 grid gap-1">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <span className={cn(segment, meridiem ? "bg-amber-500" : "bg-primary")} style={{ left: pct(summary?.start ?? 0), width: pct(overnight ? 1440 - summary!.start : length) }} />
          <span className={cn(segment, meridiem ? "bg-amber-500" : "bg-primary")} style={{ left: 0, width: pct(overnight ? summary!.end : 0), opacity: overnight ? 1 : 0 }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          {(hour12 ? ["12a", "6a", "12p", "6p", "12a"] : ["0", "6", "12", "18", "24"]).map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <div id={`${id}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {summary && length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1.5 py-1 text-sm">
            {overnight ? <Moon aria-hidden className="size-4 text-muted-foreground" /> : <Clock aria-hidden className="size-4 text-muted-foreground" />}
            <span className="font-medium tabular-nums" aria-label={formatLength(length)}>
              <NumberFlowGroup>
                {length >= 60 && <NumberFlow value={Math.floor(length / 60)} suffix=" h" />}
                {length % 60 > 0 && <NumberFlow value={length % 60} prefix={length >= 60 ? " " : ""} suffix=" min" />}
              </NumberFlowGroup>
            </span>
            {overnight && <span className="text-muted-foreground">{nextDayLabel}</span>}
            {shift.breakMinutes > 0 && summary.paidMinutes > 0 && (
              <span className="text-muted-foreground tabular-nums">· {formatLength(summary.paidMinutes)} after {formatLength(shift.breakMinutes)} break</span>
            )}
          </p>
        )}
        {dstDelta !== 0 && wall && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><CalendarClock aria-hidden className="size-3.5" /></span>
            <span className="py-1">
              {(dstDelta < 0 ? (dstMessages?.forward ?? SHIFT_DST_MESSAGES.forward) : (dstMessages?.back ?? SHIFT_DST_MESSAGES.back))
                .replace("{wall}", formatLength(wall.lengthMinutes))
                .replace("{real}", formatLength(length))
                .replace("{change}", formatLength(Math.abs(dstDelta)))}
            </span>
          </p>
        )}
        {issues.map((issue) => {
          const error = issue.kind === "zero" || issue.kind === "break-too-long"
          return (
            <p key={issue.kind} role={error ? "alert" : undefined} className={cn("flex gap-1.5", error ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
              <span className="flex h-6 shrink-0 items-center">{error ? <CircleAlert aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{issue.message}</span>
                {issue.kind === "meridiem" &&
                  issue.options.map((o) => (
                    <button key={o.field} type="button" onClick={() => update({ [o.field]: formatClock(o.minutes, false) })} className={fix}>
                      {o.field === "end" ? "End" : "Start"} {formatClock(o.minutes)} · {formatLength(o.length)}
                    </button>
                  ))}
                {issue.kind === "next-day-notation" && <button type="button" onClick={() => update({ end: formatClock(issue.fixMinutes, false) })} className={fix}>Use {formatClock(issue.fixMinutes, false)}</button>}
                {(issue.kind === "break-in-hours" || issue.kind === "break-missing") && (
                  <button type="button" onClick={() => update({ breakMinutes: issue.fixBreak })} className={fix}>Make it {formatLength(issue.fixBreak)}</button>
                )}
              </span>
            </p>
          )
        })}
      </div>
    </fieldset>
  )
}
