"use client"

// Bollard UI — stale-data-notice · MIT licence · https://bollard-ui.vercel.app/components/stale-data-notice

import * as React from "react"
import { History, LoaderCircle, RefreshCw, X } from "lucide-react"

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
  },
} as const

const MINUTE = 60_000

/** "18 minutes", "2 hours", "3 days". */
export function formatAge(ms: number) {
  const minutes = Math.floor(ms / MINUTE)
  if (minutes < 1) return "less than a minute"
  const [value, unit] =
    minutes < 60 ? [minutes, "minute"] : minutes < 1440 ? [Math.floor(minutes / 60), "hour"] : [Math.floor(minutes / 1440), "day"]
  return `${value} ${unit}${value === 1 ? "" : "s"}`
}

export interface DataAgeOptions {
  /** Data older than this (ms) counts as stale. */
  maxAge?: number
  /** Coming back to the tab after being away longer than this (ms) counts as stale. */
  awayAfter?: number
}

/**
 * Tracks how old a piece of data is and whether the user just came back to
 * it after a while. Use `stale` to gate risky actions such as Pay or Approve.
 */
export function useDataAge(updatedAt: Date | number | string, { maxAge = 10 * MINUTE, awayAfter = 5 * MINUTE }: DataAgeOptions = {}) {
  const updated = new Date(updatedAt).getTime()
  const [now, setNow] = React.useState<number>()
  const [returned, setReturned] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)

  // Fresh data clears both the "came back" flag and a dismissal.
  React.useEffect(() => {
    setReturned(false)
    setDismissed(false)
    setNow(Date.now())
  }, [updated])

  React.useEffect(() => {
    let hiddenAt = document.hidden ? Date.now() : 0
    const tick = () => setNow(Date.now())
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt && Date.now() - hiddenAt > awayAfter) {
        setReturned(true)
        setDismissed(false)
      }
      hiddenAt = 0
      tick()
    }
    tick()
    const id = setInterval(tick, 30_000)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [awayAfter])

  const age = now === undefined ? 0 : Math.max(0, now - updated)
  const stale = now !== undefined && (returned || age > maxAge)
  const dismiss = React.useCallback(() => setDismissed(true), [])
  return { stale, age, visible: stale && !dismissed, dismiss }
}

export interface StaleDataNoticeProps extends DataAgeOptions, Omit<React.ComponentProps<"div">, "children"> {
  /** When the data on screen was fetched. */
  updatedAt: Date | number | string
  /** Fetch fresh data. Return a promise to show progress; the notice hides once `updatedAt` moves. */
  onRefresh: () => void | Promise<void>
  /** Headline; `{age}` becomes "18 minutes". */
  message?: string
  /** What could be wrong now, e.g. "Prices may have changed." */
  consequence?: string
  /** Label of the refresh button. */
  refreshLabel?: string
  /** Label while refreshing. */
  refreshingLabel?: string
  /** Accessible label of the dismiss button. */
  dismissLabel?: string
  /** Shown when `onRefresh` rejects. */
  errorText?: string
}

/**
 * Stops people acting on numbers that quietly went out of date while the tab
 * sat in the background. Says how old the data is in plain words and offers a
 * one-tap refresh, without blocking anyone who just wants to keep reading.
 */
export function StaleDataNotice({
  updatedAt,
  onRefresh,
  maxAge,
  awayAfter,
  message = "This page is {age} old.",
  consequence = "Some details may have changed.",
  refreshLabel = "Refresh",
  refreshingLabel = "Refreshing…",
  dismissLabel = "Dismiss and keep the current data",
  errorText = "Couldn't refresh. Try again.",
  className,
  ...props
}: StaleDataNoticeProps) {
  const { age, visible, dismiss } = useDataAge(updatedAt, { maxAge, awayAfter })
  const [refreshing, setRefreshing] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const tone = tones.warning

  const refresh = async () => {
    if (refreshing) return
    setFailed(false)
    setRefreshing(true)
    try {
      await onRefresh()
    } catch {
      setFailed(true)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div data-slot="stale-data-notice" className={className} {...props}>
      {/* Announced once when it appears; the minute-by-minute age isn't re-read. */}
      <span role="status" className="sr-only">
        {visible ? consequence : ""}
      </span>
      {visible && (
        <div className={cn(bar, "rounded-lg border", tone.surface)}>
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
            <History aria-hidden className={cn("size-4 shrink-0", tone.icon)} />
            <p className="min-w-0 flex-1">
              <span className="font-medium">{message.replace("{age}", formatAge(age))}</span>{" "}
              <span className={tone.muted}>{consequence}</span>
              {failed && (
                <span role="alert" className="block text-xs font-medium text-red-700 dark:text-red-300">
                  {errorText}
                </span>
              )}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => void refresh()} disabled={refreshing} className={cn(action, tone.solid)}>
              {refreshing ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RefreshCw aria-hidden className="size-4" />}
              {refreshing ? refreshingLabel : refreshLabel}
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label={dismissLabel}
              title={dismissLabel}
              className={cn(action, "w-8 px-0 hover:bg-amber-500/15")}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
