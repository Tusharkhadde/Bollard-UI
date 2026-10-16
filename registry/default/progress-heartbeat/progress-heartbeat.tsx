"use client"

// Bollard UI — progress-heartbeat · MIT licence · https://bollard-ui.vercel.app/components/progress-heartbeat

import * as React from "react"
import { CircleCheck, RotateCcw, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ProgressSample {
  /** ms timestamp. */
  t: number
  v: number
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]

/**
 * A time-left range in seconds from recent samples, or null while there's too
 * little to go on. The slow end counts the time since the last sample, so the
 * range widens on its own when progress stops instead of counting down to nothing.
 */
export function estimateEta(samples: ProgressSample[], max: number, now: number): { low: number; high: number } | null {
  const recent = samples.filter((s, i) => i >= samples.length - 3 || now - s.t <= 60_000)
  if (recent.length < 3 || recent[recent.length - 1].t - recent[0].t < 3000) return null
  const rates = recent.slice(1).map((s, i) => (s.v - recent[i].v) / Math.max(1, s.t - recent[i].t)).sort((a, b) => a - b)
  const last = recent[recent.length - 1]
  const open = (last.v - recent[0].v) / Math.max(1, now - recent[0].t)
  const fast = quantile(rates, 0.8)
  const slow = Math.min(quantile(rates, 0.2), open)
  const remaining = Math.max(0, max - last.v)
  if (fast <= 0) return null
  return { low: remaining / fast / 1000, high: slow > 0 ? remaining / slow / 1000 : Infinity }
}

const unit = (s: number, up: boolean) => {
  const r = up ? Math.ceil : Math.floor
  if (s < 60) return { n: Math.max(5, r(s / 5) * 5), u: "s" }
  if (s < 5400) return { n: Math.max(1, r(s / 60)), u: "min" }
  return { n: Math.max(1, r(s / 3600)), u: "h" }
}

/** "About 2 min left", "2–5 min left", "40 s – 2 min left", "More than 3 min left": rounded outward, never falsely precise. */
export function formatEta({ low, high }: { low: number; high: number }) {
  if (high < 10) return "A few seconds left"
  const a = unit(low, false)
  if (!Number.isFinite(high) || high > low * 6) return `More than ${a.n} ${a.u} left`
  const b = unit(high, true)
  if (a.u === b.u) return a.n === b.n ? `About ${a.n} ${a.u} left` : `${a.n}–${b.n} ${a.u} left`
  return `${a.n} ${a.u} – ${b.n} ${b.u} left`
}

/** "40s", "2m 05s", "1h 03m". */
export function formatSince(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface ProgressHeartbeatProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** What is running, e.g. "Exporting 12,480 rows". */
  label: string
  /** Work done so far, 0 to `max`. */
  value: number
  /** Total work. */
  max?: number
  /** True only once the operation has really finished; the bar never shows 100% before. */
  done?: boolean
  /** Change this whenever the job proves it's alive without advancing (a ping, a log line). */
  heartbeat?: number | string
  /** When the job last advanced (ms), e.g. from the server after a reload. */
  lastProgressAt?: number
  /** When the job started (ms). Enables "Done in 3m 12s"; without it the component can't know. */
  startedAt?: number
  /** Seconds without any heartbeat before the job counts as stalled. */
  stallAfter?: number
  /** Shows a Retry action while stalled. */
  onRetry?: () => void
  /** Shows a Cancel action while stalled. */
  onCancel?: () => void
  /** Templates: `{since}` and `{eta}` are filled in. */
  stalledText?: string
  /** Shown when the job is alive but not advancing. */
  slowText?: string
  /** Shown while there's too little data for a time-left range. */
  estimatingText?: string
  /** Shown while holding at 99%. */
  finishingText?: string
  /** Shown when the job reports done. */
  doneText?: string
  /** Retry button text. */
  retryLabel?: string
  /** Cancel button text. */
  cancelLabel?: string
}

/**
 * Progress for long operations that never lies about being alive. It tells
 * working from stalled (no heartbeat for `stallAfter` seconds → "No progress
 * for 40s" with Retry), shows a time-left range that widens when the pace is
 * uncertain instead of a countdown that jumps, and caps the bar at 99% until
 * the job says it is done.
 */
export function ProgressHeartbeat({
  label,
  value,
  max = 100,
  done = false,
  heartbeat,
  lastProgressAt,
  startedAt,
  stallAfter = 30,
  onRetry,
  onCancel,
  stalledText = "No progress for {since}",
  slowText = "Still working · no progress for {since}",
  estimatingText = "Estimating time left…",
  finishingText = "Finishing up…",
  doneText = "Done",
  retryLabel = "Retry",
  cancelLabel = "Cancel",
  className,
  ...props
}: ProgressHeartbeatProps) {
  const [now, setNow] = React.useState<number>()
  const [samples, setSamples] = React.useState<ProgressSample[]>([])
  const [progressAt, setProgressAt] = React.useState<number>()
  const [heartbeatAt, setHeartbeatAt] = React.useState<number>()
  const dotRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const t = Date.now()
    setSamples((prev) => (prev.length && value >= prev[prev.length - 1].v ? [...prev, { t, v: value }].slice(-120) : [{ t, v: value }]))
    setProgressAt((prev) => (prev === undefined && lastProgressAt !== undefined ? lastProgressAt : t))
    setNow(t)
  }, [value]) // lastProgressAt only seeds the first sample; the effect below keeps it in sync.

  React.useEffect(() => {
    if (lastProgressAt !== undefined) setProgressAt(lastProgressAt)
  }, [lastProgressAt])

  // Only a real change counts as a heartbeat (not the mount, not StrictMode's second run).
  const lastBeat = React.useRef(heartbeat)
  React.useEffect(() => {
    if (lastBeat.current === heartbeat) return
    lastBeat.current = heartbeat
    setHeartbeatAt(Date.now())
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      dotRef.current?.animate([{ transform: "scale(1.9)", opacity: 0.5 }, { transform: "scale(1)", opacity: 1 }], { duration: 300, easing: "ease-out" })
  }, [heartbeat])

  React.useEffect(() => {
    setNow(Date.now())
    if (done) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [done])

  const ready = now !== undefined && progressAt !== undefined
  const beatAt = Math.max(progressAt ?? 0, heartbeatAt ?? 0)
  const sinceBeat = ready ? now - beatAt : 0
  const sinceProgress = ready ? now - progressAt : 0
  const stalled = ready && !done && sinceBeat >= stallAfter * 1000
  const slow = ready && !done && !stalled && sinceProgress >= stallAfter * 1000
  const finishing = !done && value >= max
  const percent = done ? 100 : Math.min(99, Math.floor((Math.max(0, value) / max) * 100))
  const eta = ready && !done && !finishing ? estimateEta(samples, max, now) : null
  const since = formatSince(stalled ? sinceBeat : sinceProgress)

  const status = done
    ? startedAt !== undefined && now !== undefined ? `${doneText} in ${formatSince(now - startedAt)}` : doneText
    : stalled ? fill(stalledText, { since })
    : finishing ? finishingText
    : slow ? fill(slowText, { since })
    : eta ? formatEta(eta)
    : estimatingText
  // Screen readers hear state changes, not a counter ticking every second.
  const announce = done ? doneText : stalled ? fill(stalledText, { since: `${stallAfter} seconds` }) : slow ? fill(slowText, { since: `${stallAfter} seconds` }) : ""

  return (
    <div data-slot="progress-heartbeat" data-state={done ? "done" : stalled ? "stalled" : slow ? "slow" : "working"} className={cn("grid w-full max-w-sm gap-1.5 text-sm", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%, ${status}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-300 motion-safe:ease-out",
            done ? "bg-emerald-600 dark:bg-emerald-500" : stalled ? "bg-amber-500 dark:bg-amber-400" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className={cn("flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs", stalled ? "text-amber-700 dark:text-amber-400" : done ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 tabular-nums">
          {done ? (
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
          ) : stalled ? (
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <span aria-hidden className="grid size-3.5 shrink-0 place-items-center">
              <span ref={dotRef} className="size-1.5 rounded-full bg-emerald-500" />
            </span>
          )}
          <span className="truncate">{status}</span>
        </span>
        {stalled && (onRetry || onCancel) && (
          <span className="flex gap-1.5">
            {onCancel && (
              <button type="button" onClick={onCancel} className={cn(button, "hover:bg-amber-500/10")}>
                {cancelLabel}
              </button>
            )}
            {onRetry && (
              <button type="button" onClick={onRetry} className={cn(button, "border border-amber-700/25 text-amber-950 hover:bg-amber-500/15 dark:border-amber-300/25 dark:text-amber-50")}>
                <RotateCcw aria-hidden className="size-3.5" />
                {retryLabel}
              </button>
            )}
          </span>
        )}
      </div>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  )
}
