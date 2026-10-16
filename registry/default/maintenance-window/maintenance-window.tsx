"use client"

// Bollard UI — maintenance-window · MIT licence · https://bollard-ui.vercel.app/components/maintenance-window

import * as React from "react"
import { CalendarClock, CircleCheck, Hourglass, Lock } from "lucide-react"

import { cn } from "@/lib/utils"

type When = Date | string | number
export type MaintenancePhase = "scheduled" | "soon" | "active" | "over"

const ms = (when: When) => new Date(when).getTime()

/** Where `now` sits relative to the window; "soon" starts `soonMs` before it. */
export function maintenancePhase(start: When, end: When, now: number, soonMs = 60 * 60_000): MaintenancePhase {
  if (now >= ms(end)) return "over"
  if (now >= ms(start)) return "active"
  return ms(start) - now <= soonMs ? "soon" : "scheduled"
}

/** "2 days", "1 h 12 min", "18 min", "4 min 05 s": coarse when far, to the second when close. */
export function formatCountdown(remaining: number) {
  const s = Math.max(0, Math.ceil(remaining / 1000))
  if (s >= 172_800) return `${Math.floor(s / 86_400)} days`
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
  if (s >= 600) return `${Math.ceil(s / 60)} min`
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`
}

/** The window in the reader's own time zone, crossing midnight correctly: "Tue 14 Oct, 2:00 – 2:30 am IST". */
export function formatWindow(start: When, end: When, locale?: string, timeZone?: string) {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone })
  return format.formatRange ? format.formatRange(new Date(start), new Date(end)) : `${format.format(new Date(start))} – ${format.format(new Date(end))}`
}

/** Minutes a task started now would still be running once maintenance begins (0 when it finishes in time). */
export function minutesCutOff(start: When, now: number, estimateMinutes: number) {
  const overlap = now + estimateMinutes * 60_000 - ms(start)
  return ms(start) > now && overlap > 0 ? Math.ceil(overlap / 60_000) : 0
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

interface Ctx { start: When; end: When; now: number; phase: MaintenancePhase; endTime: string }
const MaintenanceContext = React.createContext<Ctx | null>(null)

export interface MaintenanceWindowProps extends React.ComponentProps<"div"> {
  /** When maintenance begins. */
  start: When
  /** When it is expected to end. */
  end: When
  /** Locale for dates; defaults to the browser's. */
  locale?: string
  /** Time zone for display; defaults to the reader's own. */
  timeZone?: string
  /** How long before the start the banner turns into a countdown, in minutes. */
  soonMinutes?: number
  /** True while the wrapped form holds unsaved changes; during the window a reload is then warned about. */
  hasUnsavedChanges?: boolean
  /** Templates: `{window}`, `{countdown}`, `{start}`, `{end}` are filled in. */
  scheduledText?: string
  /** Template shown when the window is close. */
  soonText?: string
  /** Template shown during the window. */
  activeText?: string
  /** Shown after the window ends. */
  overText?: string
  /** Accessible label for the dismiss button. */
  dismissLabel?: string
}

const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"

/**
 * Announces planned downtime in the reader's own time zone with a countdown that sharpens as it
 * nears, warns before a long task that would be cut off (see MaintenanceTaskButton), and during the
 * window disables the wrapped form's fields (a disabled fieldset) without unmounting it, so unsaved
 * work stays put. Your server is not made read-only by this; enforce that on the backend.
 */
export function MaintenanceWindow({
  start,
  end,
  locale,
  timeZone,
  soonMinutes = 60,
  hasUnsavedChanges = false,
  scheduledText = "Scheduled maintenance {window} · in {countdown}",
  soonText = "Maintenance starts in {countdown}, at {start}. Editing pauses until {end}.",
  activeText = "Maintenance until {end} · {countdown} left. Editing is paused in this form; your unsaved changes stay in this tab, so don't reload.",
  overText = "Maintenance is over. Your changes are still here; save when ready.",
  dismissLabel = "Got it",
  className,
  children,
  ...props
}: MaintenanceWindowProps) {
  const [now, setNow] = React.useState<number>()
  const [sawWindow, setSawWindow] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const phase = now === undefined ? "scheduled" : maintenancePhase(start, end, now, soonMinutes * 60_000)
  React.useEffect(() => {
    if (phase === "active") setSawWindow(true)
  }, [phase])

  React.useEffect(() => {
    if (phase !== "active" || !hasUnsavedChanges) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [phase, hasUnsavedChanges])

  const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone })
  const endTime = clock.format(new Date(end))
  const values = {
    window: formatWindow(start, end, locale, timeZone),
    countdown: now === undefined ? "" : formatCountdown((phase === "active" ? ms(end) : ms(start)) - now),
    end: endTime,
    start: clock.format(new Date(start)),
  }
  const progress = now === undefined ? 0 : phase === "active" ? (now - ms(start)) / (ms(end) - ms(start)) : 1 - (ms(start) - now) / (soonMinutes * 60_000)
  const warning = phase === "soon" || phase === "active"
  const Icon = phase === "active" ? Lock : phase === "soon" ? Hourglass : CalendarClock

  return (
    <MaintenanceContext.Provider value={now === undefined ? null : { start, end, now, phase, endTime }}>
      <div data-slot="maintenance-window" data-phase={phase} className={cn("grid gap-3", className)} {...props}>
        {now !== undefined && !(phase === "over" && (!sawWindow || dismissed)) && (
          <div
            role="status"
            className={cn(
              "overflow-hidden rounded-lg border transition-colors",
              warning ? "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50"
                : phase === "over" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-50" : "bg-muted/50",
            )}
          >
            <div className={bar}>
              {phase === "over" ? <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                : <Icon aria-hidden className={cn("size-4 shrink-0", warning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />}
              <p className="min-w-0 flex-1 basis-56 font-medium tabular-nums">
                {fill(phase === "active" ? activeText : phase === "soon" ? soonText : phase === "over" ? overText : scheduledText, values)}
              </p>
              {phase === "over" && (
                <button type="button" onClick={() => setDismissed(true)} className="inline-flex h-8 shrink-0 items-center rounded-md border border-emerald-700/25 px-3 text-sm font-medium transition-colors hover:bg-emerald-500/15 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-emerald-300/25">
                  {dismissLabel}
                </button>
              )}
            </div>
            {warning && (
              <div aria-hidden className="h-1 bg-amber-500/15">
                <div className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
              </div>
            )}
          </div>
        )}
        <fieldset disabled={phase === "active"} data-readonly={phase === "active" ? "" : undefined} className="min-w-0 transition-opacity data-readonly:opacity-75">
          {children}
        </fieldset>
      </div>
    </MaintenanceContext.Provider>
  )
}

export interface MaintenanceTaskButtonProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  /** How long the task usually takes, in minutes. */
  estimateMinutes: number
  /** Starts the task. */
  onStart: () => void
  /** Warning when the task would still be running at the start. `{estimate}`, `{countdown}`, `{end}` are filled in. */
  cutOffText?: string
  /** Label once the user has been warned. */
  anywayLabel?: string
}

/** A start button for long jobs (exports, imports, uploads) that warns when maintenance would cut the job off. Place inside MaintenanceWindow. */
export function MaintenanceTaskButton({
  estimateMinutes,
  onStart,
  cutOffText = "This takes about {estimate} min, but maintenance starts in {countdown} and would cut it off. Start after {end} to be safe.",
  anywayLabel = "Start anyway",
  className,
  children,
  ...props
}: MaintenanceTaskButtonProps) {
  const ctx = React.useContext(MaintenanceContext)
  const hintId = React.useId()
  const cutOff = ctx ? minutesCutOff(ctx.start, ctx.now, estimateMinutes) : 0
  return (
    <div data-slot="maintenance-task-button" className="grid justify-items-start gap-1.5">
      <button
        type="button"
        onClick={onStart}
        aria-describedby={cutOff ? hintId : undefined}
        className={cn(
          "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          cutOff ? "border border-amber-500/50 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200" : "bg-primary text-primary-foreground hover:bg-primary/90",
          className,
        )}
        {...props}
      >
        {cutOff ? anywayLabel : children}
      </button>
      <p id={hintId} aria-live="polite" className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        {ctx && cutOff > 0 && (
          <>
            <Hourglass aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {fill(cutOffText, { estimate: String(estimateMinutes), countdown: formatCountdown(ms(ctx.start) - ctx.now), end: ctx.endTime })}
          </>
        )}
      </p>
    </div>
  )
}
