"use client"

import * as React from "react"
import { BatteryCharging, BatteryLow, BatteryWarning, PlugZap } from "lucide-react"

import { cn } from "@/lib/utils"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
/** Banner tones, identical across Bollard UI banners. */
const tones = {
  warning: {
    surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
    fill: "bg-amber-500",
  },
  success: {
    surface:
      "border-emerald-500/30 bg-background bg-linear-to-r from-emerald-500/10 to-emerald-500/10 text-emerald-950 dark:text-emerald-50",
    icon: "text-emerald-600 dark:text-emerald-400",
    muted: "text-emerald-900/75 dark:text-emerald-100/75",
    solid: "bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300",
    outline: "border border-emerald-700/25 hover:bg-emerald-500/15 dark:border-emerald-300/25",
    fill: "bg-emerald-500",
  },
  danger: {
    surface: "border-red-500/30 bg-background bg-linear-to-r from-red-500/10 to-red-500/10 text-red-950 dark:text-red-50",
    icon: "text-red-600 dark:text-red-400",
    muted: "text-red-900/75 dark:text-red-100/75",
    solid: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300",
    outline: "border border-red-700/25 hover:bg-red-500/15 dark:border-red-300/25",
    fill: "bg-red-500",
  },
} as const

export interface BatteryReading {
  /** Charge from 0 to 1. */
  level: number
  charging: boolean
  /** Seconds until empty as the system estimates it; `Infinity` when it can't tell. */
  dischargingTime: number
}

export type BatteryVerdict = "ok" | "low" | "tight" | "short"

export interface BatteryOptions {
  /** Charge at which the device is treated as gone (OS shutdown, low-power throttling). */
  reserve?: number
  /** Below this charge, warn when no time estimate is available. */
  lowLevel?: number
  /** A runway shorter than duration × margin is "tight". */
  margin?: number
  /** How much harder the task works the device than now, e.g. 1.5 for a video call. */
  drainFactor?: number
  /** Measured drain in charge per ms, used when the system gives no estimate. */
  drainRate?: number
}

/**
 * Whether a task of `duration` ms finishes before the battery reaches `reserve`.
 * Uses the system estimate first, then a measured drain rate, then the bare level.
 * `covers` is the share of the task the battery would get through.
 */
export function assessBattery(reading: BatteryReading, duration: number, options: BatteryOptions = {}) {
  const { reserve = 0.05, lowLevel = 0.2, margin = 1.25, drainFactor = 1, drainRate } = options
  if (reading.charging) return { verdict: "ok" as BatteryVerdict }
  const usable = Math.max(0, reading.level - reserve)
  const fromSystem = Number.isFinite(reading.dischargingTime) && reading.dischargingTime > 0 && reading.level > 0
  const raw = fromSystem ? (reading.dischargingTime * 1000 * usable) / reading.level : drainRate ? usable / drainRate : undefined
  if (raw === undefined) return { verdict: (reading.level <= lowLevel ? "low" : "ok") as BatteryVerdict }
  const runway = raw / drainFactor
  const verdict: BatteryVerdict = runway < duration ? "short" : runway < duration * margin ? "tight" : "ok"
  return { verdict, runway, covers: Math.min(1, runway / duration) }
}

/** "45 min", "1 h 20 min". */
export function formatMinutes(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
}

interface BatteryManagerLike extends EventTarget, BatteryReading {}
const batteryEvents = ["chargingchange", "levelchange", "dischargingtimechange"] as const

/** Live battery reading plus a drain rate measured between level changes. `supported` is undefined until known. */
export function useBattery() {
  const [state, setState] = React.useState<{ supported?: boolean; reading?: BatteryReading; drainRate?: number }>({})

  React.useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }
    if (!nav.getBattery) return setState({ supported: false })
    let manager: BatteryManagerLike | undefined
    let cancelled = false
    const changes: { at: number; level: number }[] = []
    const update = (event?: Event) => {
      if (!manager) return
      if (manager.charging) changes.length = 0
      else if (event?.type === "levelchange") changes.push({ at: performance.now(), level: manager.level })
      if (changes.length > 6) changes.shift()
      const [first, last] = [changes[0], changes[changes.length - 1]]
      const drainRate = first && last && last.at > first.at ? (first.level - last.level) / (last.at - first.at) : undefined
      const { level, charging, dischargingTime } = manager
      setState({ supported: true, reading: { level, charging, dischargingTime }, drainRate: drainRate && drainRate > 0 ? drainRate : undefined })
    }
    nav.getBattery().then(
      (found) => {
        if (cancelled) return
        manager = found
        batteryEvents.forEach((type) => found.addEventListener(type, update))
        update()
      },
      () => !cancelled && setState({ supported: false }),
    )
    return () => {
      cancelled = true
      batteryEvents.forEach((type) => manager?.removeEventListener(type, update))
    }
  }, [])
  return state
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

export interface LowBatteryGuardProps extends Omit<React.ComponentProps<"div">, "children">, Omit<BatteryOptions, "drainRate"> {
  /** What the user is about to start, e.g. "the export". */
  task: string
  /** How long the task usually takes, in minutes. */
  minutes: number
  /** Override the browser reading (tests, native shells, SSR hydration). */
  battery?: BatteryReading
  /** Start the task. Enables "Start anyway" and "Start when plugged in". */
  onProceed?: () => void
  /** Shown when this browser can't read the battery (Safari, Firefox). Nothing by default. */
  fallback?: React.ReactNode
  /** How long "Charging · safe to start" stays after plugging in, in ms. */
  hideAfter?: number
  /** Templates: `{task}` (lower case reads best, e.g. "the export"), `{level}`, `{runway}`, `{duration}` are filled in. */
  shortTitle?: string
  /** Title when the runway is close to the task's length. */
  tightTitle?: string
  /** Title when the battery won't last. */
  lowTitle?: string
  /** Title while charging. */
  chargingTitle?: string
  /** Title after the task starts on plug-in. */
  startedTitle?: string
  /** Title while waiting for a charger. */
  armedTitle?: string
  /** Detail line under the title. */
  detailText?: string
  /** Detail line when the battery won't last. */
  lowDetailText?: string
  /** Label for the battery runway. */
  runwayLabel?: string
  /** Label for the task's length. */
  durationLabel?: string
  /** Button text to start once plugged in. */
  startWhenPluggedLabel?: string
  /** Button text to start now. */
  startAnywayLabel?: string
  /** Button text to stop waiting. */
  cancelLabel?: string
}

/**
 * Stops a long upload, export, call or exam dying halfway on a flat battery.
 * Before it starts, it compares the battery's runway (to a safety reserve, not
 * 0%) with how long the task takes, draws where the battery would cut it off,
 * and offers "Start when plugged in", which starts the task the moment a
 * charger is connected. It stays silent when the task will finish anyway.
 */
export function LowBatteryGuard({
  task,
  minutes,
  battery,
  onProceed,
  fallback = null,
  hideAfter = 3000,
  reserve,
  lowLevel,
  margin,
  drainFactor,
  shortTitle = "Battery will run out before {task} finishes",
  tightTitle = "Battery is cutting it close for {task}",
  lowTitle = "Battery at {level} and not charging",
  chargingTitle = "Charging · safe to start {task}",
  startedTitle = "Charging · {task} started",
  armedTitle = "Plug in and {task} starts by itself",
  detailText = "{level} lasts about {runway}, {task} needs about {duration}",
  lowDetailText = "Plug in to be safe: {task} needs about {duration}",
  runwayLabel = "Battery ~{runway}",
  durationLabel = "Done in ~{duration}",
  startWhenPluggedLabel = "Start when plugged in",
  startAnywayLabel = "Start anyway",
  cancelLabel = "Cancel",
  className,
  ...props
}: LowBatteryGuardProps) {
  const live = useBattery()
  const reading = battery ?? live.reading
  const [armed, setArmed] = React.useState(false)
  const [autoStarted, setAutoStarted] = React.useState(false)
  const [phase, setPhase] = React.useState<"idle" | "warned" | "charging">("idle")
  const [drawn, setDrawn] = React.useState(false)
  const duration = minutes * 60_000
  const result = reading ? assessBattery(reading, duration, { reserve, lowLevel, margin, drainFactor, drainRate: live.drainRate }) : undefined
  const risky = result !== undefined && result.verdict !== "ok"

  React.useEffect(() => {
    if (risky) setPhase("warned")
    else if (reading?.charging) setPhase((previous) => (previous === "warned" ? "charging" : previous))
  }, [risky, reading?.charging])

  // A charger arriving while armed starts the task: the one-tap fix.
  React.useEffect(() => {
    if (!armed || !reading?.charging) return
    setArmed(false)
    setAutoStarted(true)
    onProceed?.()
  }, [armed, reading?.charging, onProceed])

  React.useEffect(() => {
    if (phase !== "charging") return
    const timer = setTimeout(() => setPhase("idle"), hideAfter)
    return () => clearTimeout(timer)
  }, [phase, hideAfter])

  // Grow the runway bar from zero once, so the cut-off point is noticed.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(risky))
    return () => cancelAnimationFrame(frame)
  }, [risky])

  if (battery === undefined && live.supported === false) return <>{fallback}</>
  if (!reading || (!risky && phase !== "charging")) return null

  const charging = phase === "charging" && !risky
  const verdict = result?.verdict ?? "ok"
  const values = {
    task,
    level: `${Math.round(reading.level * 100)}%`,
    runway: result?.runway === undefined ? "" : formatMinutes(result.runway),
    duration: formatMinutes(duration),
  }
  const tone = tones[charging ? "success" : verdict === "short" ? "danger" : "warning"]
  const Icon = charging ? BatteryCharging : armed ? PlugZap : verdict === "short" ? BatteryWarning : BatteryLow
  const title = charging ? (autoStarted ? startedTitle : chargingTitle) : armed ? armedTitle : { ok: "", low: lowTitle, tight: tightTitle, short: shortTitle }[verdict]

  return (
    <div data-slot="low-battery-guard" data-state={charging ? "charging" : verdict} className={cn("overflow-hidden rounded-lg border", tone.surface, className)} {...props}>
      <div className={bar}>
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon, armed && "motion-safe:animate-pulse")} />
          <div className="min-w-0 flex-1" role="status">
            <p className="font-medium">{fill(title, values)}</p>
            {!charging && (
              <p className={cn("text-xs tabular-nums", tone.muted)}>
                {fill(result?.runway === undefined ? lowDetailText : detailText, values)}
              </p>
            )}
          </div>
        </div>
        {onProceed && !charging && (
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {armed ? (
              <button type="button" onClick={() => setArmed(false)} className={cn(action, tone.outline)}>
                {cancelLabel}
              </button>
            ) : (
              <>
                <button type="button" onClick={onProceed} className={cn(action, tone.outline)}>
                  {startAnywayLabel}
                </button>
                <button type="button" onClick={() => setArmed(true)} className={cn(action, tone.solid)}>
                  <PlugZap aria-hidden className="size-4" />
                  {startWhenPluggedLabel}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {result?.runway !== undefined && (
        <div className="px-3 pb-2.5">
          <div
            role="img"
            aria-label={`${fill(runwayLabel, values)}, ${fill(durationLabel, values)}`}
            className="relative h-1.5 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(239_68_68/0.35)_4px_6px)] bg-red-500/10"
          >
            <div
              className={cn("h-full rounded-full transition-[width] duration-400 ease-out motion-reduce:transition-none", tone.fill)}
              style={{ width: `${drawn ? (result.covers ?? 0) * 100 : 0}%` }}
            />
          </div>
          <div className={cn("mt-1 flex justify-between gap-3 text-xs tabular-nums", tone.muted)} aria-hidden>
            <span>{fill(runwayLabel, values)}</span>
            <span>{fill(durationLabel, values)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
