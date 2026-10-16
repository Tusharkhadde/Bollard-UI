"use client"

// Bollard UI — schedule-readback · MIT licence · https://bollard-ui.vercel.app/components/schedule-readback

import * as React from "react"
import { CalendarClock, CircleAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { cronWarnings, describeCron, nextRuns, parseCron, type CronSchedule, type CronWarning } from "./cron"

export { cronWarnings, describeCron, nextRuns, parseCron } from "./cron"
export type { CronSchedule, CronWarning } from "./cron"

export interface ScheduleReadbackProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled cron expression. */
  value?: string
  /** Initial expression when uncontrolled. */
  defaultValue?: string
  /** Called with the expression on every change, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** Zone the scheduler runs in (servers and CI are often "UTC"). Defaults to the viewer's zone. */
  timeZone?: string
  /** Zone the run times are shown in. Defaults to the viewer's browser zone. */
  displayTimeZone?: string
  /** How many upcoming runs to list. */
  count?: number
  /** Compute runs after this moment instead of now (useful for tests and docs). */
  from?: Date | number
  /** Heading of the run list; `{count}` and `{zone}` (a short name like "GMT+5:30") are filled in. */
  runsLabel?: string
  /** Shown when the schedule has no upcoming runs. */
  noRunsText?: string
  /** Locale for run times and "in 25 min". */
  locale?: string
  /** Replaces the plain-English readback, e.g. with `cronstrue.toString(expression, { locale })`. */
  describe?: (schedule: CronSchedule, expression: string) => string
  /** Rewrites a warning's text; `warning.id` says which check fired. */
  formatWarning?: (warning: CronWarning) => string
  /** Rewrites a parse error; `field` is the 0-based field index when one is to blame. */
  formatError?: (error: string, field?: number) => string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** "in 25 min", "in 3 hr", "in 2 days", in the given locale. */
function fromNow(time: number, now: number, locale?: string) {
  const relative = new Intl.RelativeTimeFormat(locale, { style: "short" })
  const minutes = Math.max(1, Math.round((time - now) / 60_000))
  if (minutes < 60) return relative.format(minutes, "minute")
  if (minutes < 48 * 60) return relative.format(Math.round(minutes / 60), "hour")
  return relative.format(Math.round(minutes / 1440), "day")
}

/**
 * A cron field that reads the schedule back before it ships. It says what the
 * expression means in plain English, lists the next runs in the viewer's own
 * time zone (and the scheduler's, when it differs), and catches the classics:
 * "* * * * *" firing every minute, day-of-month OR day-of-week, the 31st
 * skipping months, 30 February never arriving and uneven steps like
 * every 7 minutes.
 */
export function ScheduleReadback({
  label = "Schedule",
  value,
  defaultValue = "",
  onValueChange,
  timeZone,
  displayTimeZone,
  count = 5,
  from,
  runsLabel = "Next {count} runs · your time ({zone})",
  noRunsText = "No upcoming runs.",
  locale = "en-GB",
  describe,
  formatWarning,
  formatError,
  id,
  className,
  ref,
  ...props
}: ScheduleReadbackProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [clock, setClock] = React.useState<{ now: number; zone: string }>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const expression = value ?? inner

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  // Time and zone are only known in the browser; tick each minute so "next run" stays true.
  React.useEffect(() => {
    const tick = () => setClock({ now: Date.now(), zone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    tick()
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const parsed = React.useMemo(() => parseCron(expression), [expression])
  const viewerZone = displayTimeZone ?? clock?.zone
  const schedulerZone = timeZone ?? viewerZone
  const start = from === undefined ? clock?.now : new Date(from).getTime()
  const runs = React.useMemo(
    () => (parsed.ok && start !== undefined && schedulerZone ? nextRuns(parsed.schedule, start, count, schedulerZone) : []),
    [parsed, start, count, schedulerZone],
  )
  const warnings = parsed.ok ? cronWarnings(parsed.schedule) : []
  const dual = schedulerZone !== viewerZone
  // Short, readable zone name ("GMT+5:30", "PDT") instead of an IANA id that may be a legacy alias.
  const zoneName = (zone?: string) =>
    zone === "UTC" ? "UTC" : new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(start ?? 0).find((p) => p.type === "timeZoneName")?.value
  const format = (date: Date, zone?: string, withDay = true) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit",
      ...(withDay ? { weekday: "short", day: "numeric", month: "short" } : {}),
    }).format(date)
  const showError = !parsed.ok && expression.trim() !== ""

  return (
    <div data-slot="schedule-readback" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="0 9 * * 1-5"
        value={expression}
        onChange={(event) => update(event.target.value)}
        aria-invalid={showError || undefined}
        aria-describedby={`${inputId}-readback`}
        data-warning={warnings.length ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-readback`} className="grid gap-1.5 text-xs">
        {showError ? (
          <p role="alert" className="flex items-start gap-1.5 py-1 text-destructive">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {formatError ? formatError(parsed.error, parsed.field) : parsed.error}
          </p>
        ) : parsed.ok ? (
          <p aria-live="polite" className="flex items-start gap-1.5 py-1 text-sm text-foreground">
            <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span data-slot="schedule-readback-text">{describe ? describe(parsed.schedule, expression) : describeCron(parsed.schedule)}</span>
          </p>
        ) : null}
        <div aria-live="polite" className="grid gap-1.5 empty:hidden">
          {warnings.map((warning) => (
            <p key={warning.id} data-warning-id={warning.id} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center">
                <TriangleAlert aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{formatWarning ? formatWarning(warning) : warning.message}</span>
                {warning.fixes?.map((fix) => (
                  <button
                    key={fix.expression}
                    type="button"
                    onClick={() => {
                      update(fix.expression)
                      inputRef.current?.focus()
                    }}
                    aria-label={`${fix.label}: ${fix.expression}`}
                    className={fixClass}
                  >
                    {fix.label}
                  </button>
                ))}
              </span>
            </p>
          ))}
        </div>
        {parsed.ok && start !== undefined && (
          <div className="mt-1.5 rounded-md border bg-muted/40 px-3 py-2">
            <p className="mb-1 text-muted-foreground" title={viewerZone}>
              {runsLabel.replace("{count}", String(count)).replace("{zone}", zoneName(viewerZone) ?? "")}
            </p>
            {runs.length ? (
              <ol className="grid gap-0.5 font-mono tabular-nums">
                {runs.map((run, index) => (
                  <li key={run.getTime()} className="flex items-baseline justify-between gap-3">
                    <span>
                      {format(run, viewerZone)}
                      {index === 0 && clock && <span className="ml-2 font-sans text-muted-foreground">{fromNow(run.getTime(), start, locale)}</span>}
                    </span>
                    {dual && (
                      <span className="text-muted-foreground">
                        {format(run, schedulerZone, false)} {zoneName(schedulerZone)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{noRunsText}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
