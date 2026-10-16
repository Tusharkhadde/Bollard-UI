"use client"

import * as React from "react"
import { ArrowRight, Gauge, OctagonAlert, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

const DAY = 86_400_000

type Time = Date | number | string
const ms = (time: Time) => new Date(time).getTime()

export interface QuotaForecast {
  /** Share of the limit used, 0–1 (can exceed 1). */
  ratio: number
  /** Share of the period gone by: where usage would sit at an even pace. */
  pace: number
  /** Share of the limit used by the reset if the current rate holds. Null while it's too early to tell. */
  projected: number | null
  /** When the limit is reached at the current rate, if that's before the reset. */
  runOutAt: number | null
  /** `early`: too little of the period has passed to trust a rate. */
  status: "early" | "on-track" | "runs-out" | "out"
}

/**
 * Projects usage to the end of the period from the average rate so far. It
 * stays quiet until `minElapsed` of the period has passed, because a rate
 * from the first few hours is mostly noise.
 */
export function forecastQuota({
  used,
  limit,
  periodStart,
  resetsAt,
  now,
  minElapsed = 0.1,
}: {
  used: number
  limit: number
  periodStart: Time
  resetsAt: Time
  now: Time
  minElapsed?: number
}): QuotaForecast {
  const start = ms(periodStart)
  const end = ms(resetsAt)
  const at = ms(now)
  const ratio = limit > 0 ? used / limit : 1
  const pace = Math.min(1, Math.max(0, (at - start) / (end - start)))
  if (used >= limit) return { ratio, pace, projected: ratio, runOutAt: at, status: "out" }
  if (pace < minElapsed || used <= 0) return { ratio, pace, projected: null, runOutAt: null, status: "early" }
  const rate = used / (at - start)
  const runOutAt = at + (limit - used) / rate
  const projected = (used + rate * (end - at)) / limit
  return runOutAt < end
    ? { ratio, pace, projected, runOutAt, status: "runs-out" }
    : { ratio, pace, projected, runOutAt: null, status: "on-track" }
}

/** Tone from both the fill and the forecast: 58% used can still be a warning if it runs out before the reset. */
export function quotaTone(
  forecast: QuotaForecast,
  now: Time,
  { warnAt = 0.8, dangerAt = 0.95, urgentWithin = 3 * DAY } = {},
): "ok" | "warning" | "danger" {
  const { ratio, runOutAt, status } = forecast
  if (status === "out" || ratio >= dangerAt) return "danger"
  if (runOutAt !== null && runOutAt - ms(now) < urgentWithin) return "danger"
  return ratio >= warnAt || status === "runs-out" ? "warning" : "ok"
}

const tones = {
  ok: { fill: "bg-emerald-600 dark:bg-emerald-500", text: "text-muted-foreground", stripe: "text-emerald-600/35 dark:text-emerald-400/35" },
  warning: { fill: "bg-amber-500 dark:bg-amber-400", text: "text-amber-700 dark:text-amber-400", stripe: "text-amber-500/45 dark:text-amber-400/40" },
  danger: { fill: "bg-red-600 dark:bg-red-500", text: "text-red-700 dark:text-red-400", stripe: "text-red-600/40 dark:text-red-400/40" },
} as const

const fixClass =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-current/30 px-2 font-medium transition-colors hover:bg-current/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

export interface QuotaForecastProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** What is metered, e.g. "API calls". */
  label: string
  /** Amount used so far this period. */
  used: number
  /** The plan's limit for the period. */
  limit: number
  /** When the current period started. */
  periodStart: Time
  /** When usage resets. */
  resetsAt: Time
  /** The current time. Defaults to the clock, read after mount so SSR stays stable. */
  now?: Time
  /** Formats amounts, e.g. bytes as "18.2 GB". */
  formatValue?: (value: number) => string
  /** Locale for dates and numbers. */
  locale?: string
  /** Plain words for what happens at the limit, e.g. "New calls get a 429 error until {reset}." */
  atLimit?: string
  /** Fix offered once it's a warning, e.g. "Add credits". */
  actionLabel?: string
  /** Runs the fix, e.g. opens the upgrade dialog. */
  onAction?: () => void
  /** Share of the limit (0–1) where the tone turns amber. */
  warnAt?: number
  /** Share of the limit (0–1) where the tone turns red. */
  dangerAt?: number
  /** Templates. `{date}`, `{reset}`, `{days}` and `{percent}` are filled in. */
  runsOutText?: string
  onTrackText?: string
  earlyText?: string
  outText?: string
}

/**
 * A usage meter that warns before you hit the limit, not at it. It projects
 * the current rate to the reset ("At this pace you'll run out Thu 22 Oct"),
 * shades the projected usage and an even-pace tick on the bar, turns amber or
 * red on the forecast as well as the fill, and says what happens at the limit.
 */
export function QuotaForecast({
  label,
  used,
  limit,
  periodStart,
  resetsAt,
  now,
  formatValue,
  locale = "en-GB",
  atLimit,
  actionLabel,
  onAction,
  warnAt,
  dangerAt,
  runsOutText = "At this pace you'll run out {date}, {days} before it resets.",
  onTrackText = "On pace for about {percent}% by the reset on {reset}.",
  earlyText = "Too early to forecast. Resets {reset}.",
  outText = "You've reached the limit. It resets {reset}.",
  className,
  ...props
}: QuotaForecastProps) {
  const [clock, setClock] = React.useState<number>()
  const [grown, setGrown] = React.useState(false)
  const at = now === undefined ? clock : ms(now)

  React.useEffect(() => {
    if (now !== undefined) return
    setClock(Date.now())
    const id = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [now])

  // Grow the bar from empty once after mount so the eye catches how full it is.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const number = (value: number) => (formatValue ? formatValue(value) : value.toLocaleString(locale))
  const day = (time: number) =>
    new Date(time).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })

  const forecast = at === undefined ? null : forecastQuota({ used, limit, periodStart, resetsAt, now: at })
  const tone = forecast && at !== undefined ? quotaTone(forecast, at, { warnAt, dangerAt }) : "ok"
  const style = tones[tone]
  const daysLeft = forecast?.runOutAt ? Math.max(1, Math.round((ms(resetsAt) - forecast.runOutAt) / DAY)) : 0
  const values = {
    reset: day(ms(resetsAt)),
    date: forecast?.runOutAt ? day(forecast.runOutAt) : "",
    days: `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`,
    percent: String(Math.round((forecast?.projected ?? 0) * 100)),
  }
  const message = forecast
    ? fill({ out: outText, "runs-out": runsOutText, "on-track": onTrackText, early: earlyText }[forecast.status], values)
    : ""
  const Icon = forecast?.status === "out" ? OctagonAlert : forecast?.status === "runs-out" ? TrendingUp : Gauge
  const width = (ratio: number) => `${Math.min(1, Math.max(0, ratio)) * 100}%`
  const ratio = forecast?.ratio ?? used / limit

  return (
    <div data-slot="quota-forecast" data-tone={tone} className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{number(used)}</span> of {number(limit)}
        </span>
      </div>

      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${Math.round(ratio * 100)}% used. ${message}`}
        className="relative h-2 overflow-hidden rounded-full bg-muted"
      >
        {forecast?.projected != null && forecast.status !== "out" && (
          <div
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,currentColor_0_3px,transparent_3px_6px)] transition-[width,color] duration-400 ease-out motion-reduce:transition-none",
              style.stripe,
            )}
            style={{ width: grown ? width(forecast.projected) : 0 }}
          />
        )}
        <div
          aria-hidden
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-400 ease-out motion-reduce:transition-none", style.fill)}
          style={{ width: grown ? width(ratio) : 0 }}
        />
        {forecast && forecast.status !== "early" && (
          <div aria-hidden title="Even pace" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground/50" style={{ left: width(forecast.pace) }} />
        )}
      </div>

      <div className={cn("mt-0.5 grid min-h-5 gap-1 text-xs transition-colors", style.text)}>
        <p aria-live="polite" className="flex gap-1.5">
          {message && <Icon aria-hidden className="mt-px size-3.5 shrink-0" />}
          <span className={cn(tone !== "ok" && "font-medium")}>{message}</span>
        </p>
        {(atLimit || (tone !== "ok" && actionLabel)) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-5">
            {atLimit && <span className={cn(tone === "ok" && "text-muted-foreground")}>{fill(atLimit, values)}</span>}
            {tone !== "ok" && actionLabel && onAction && (
              <button type="button" onClick={onAction} className={fixClass}>
                {actionLabel}
                <ArrowRight aria-hidden className="size-3" />
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
