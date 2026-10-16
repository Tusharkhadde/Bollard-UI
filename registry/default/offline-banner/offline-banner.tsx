"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, LoaderCircle, RotateCcw, WifiOff } from "lucide-react"

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
  info: {
    surface: "border-sky-500/30 bg-background bg-linear-to-r from-sky-500/10 to-sky-500/10 text-sky-950 dark:text-sky-50",
    icon: "text-sky-600 dark:text-sky-400",
    muted: "text-sky-900/75 dark:text-sky-100/75",
    solid: "bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-400 dark:text-sky-950 dark:hover:bg-sky-300",
    outline: "border border-sky-700/25 hover:bg-sky-500/15 dark:border-sky-300/25",
  },
  success: {
    surface:
      "border-emerald-500/30 bg-background bg-linear-to-r from-emerald-500/10 to-emerald-500/10 text-emerald-950 dark:text-emerald-50",
    icon: "text-emerald-600 dark:text-emerald-400",
    muted: "text-emerald-900/75 dark:text-emerald-100/75",
    solid: "bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300",
    outline: "border border-emerald-700/25 hover:bg-emerald-500/15 dark:border-emerald-300/25",
  },
  danger: {
    surface: "border-red-500/30 bg-background bg-linear-to-r from-red-500/10 to-red-500/10 text-red-950 dark:text-red-50",
    icon: "text-red-600 dark:text-red-400",
    muted: "text-red-900/75 dark:text-red-100/75",
    solid: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300",
    outline: "border border-red-700/25 hover:bg-red-500/15 dark:border-red-300/25",
  },
} as const

export type OfflinePhase = "online" | "offline" | "syncing" | "synced" | "failed"

/** Picks the banner phase. It only leaves "online" after a real disconnect, so normal saves never flash it. */
export function nextOfflinePhase(previous: OfflinePhase, online: boolean, queued: number, failed: boolean): OfflinePhase {
  if (!online) return "offline"
  if (previous === "online") return "online"
  if (queued === 0) return "synced"
  return failed ? "failed" : "syncing"
}

/** Follows `navigator.onLine` and the online/offline events. SSR renders as online. */
export function useOnlineStatus() {
  return React.useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify)
      window.addEventListener("offline", notify)
      return () => {
        window.removeEventListener("online", notify)
        window.removeEventListener("offline", notify)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

export interface OfflineBannerProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Actions waiting to reach the server (from your outbox or mutation queue). */
  queued?: number
  /** Override detection, e.g. from your own health check. Omit to follow the browser. */
  online?: boolean
  /** Syncing the queue failed after reconnecting. Shows a Retry action. */
  syncFailed?: boolean
  /** Retry syncing the queue. */
  onRetry?: () => void
  /** How long "All changes synced" stays before the banner hides, in ms. */
  hideAfter?: number
  /** Warn before closing the tab while offline with queued actions that would be lost. */
  guardUnload?: boolean
  /** "3 changes". Override to name your items or translate. */
  formatCount?: (count: number) => string
  /** Message templates; `{count}` is replaced by `formatCount(queued)`. */
  offlineText?: string
  /** Shown offline when nothing is queued. */
  offlineEmptyText?: string
  /** Shown while queued changes sync. */
  syncingText?: string
  /** Shown once everything has synced. */
  syncedText?: string
  /** Shown when the sync fails. */
  failedText?: string
  /** Retry button text. */
  retryLabel?: string
}

const defaultCount = (count: number) => `${count} ${count === 1 ? "change" : "changes"}`

/**
 * A connection banner that keeps people from assuming their work went
 * through. Offline, it counts what's waiting; after reconnecting it stays up
 * until the queue has actually drained ("Back online · syncing 3 changes"),
 * not just until the network blinks back, then hides itself. If the sync
 * fails it says so and offers Retry instead of quietly disappearing.
 */
export function OfflineBanner({
  queued = 0,
  online: onlineProp,
  syncFailed = false,
  onRetry,
  hideAfter = 2500,
  guardUnload = true,
  formatCount = defaultCount,
  offlineText = "You're offline · {count} will sync when you reconnect",
  offlineEmptyText = "You're offline · changes will sync when you reconnect",
  syncingText = "Back online · syncing {count}",
  syncedText = "Back online · all changes synced",
  failedText = "Couldn't sync {count}",
  retryLabel = "Retry",
  className,
  ...props
}: OfflineBannerProps) {
  const browserOnline = useOnlineStatus()
  const online = onlineProp ?? browserOnline
  const [phase, setPhase] = React.useState<OfflinePhase>("online")

  React.useEffect(() => {
    setPhase((previous) => nextOfflinePhase(previous, online, queued, syncFailed))
  }, [online, queued, syncFailed])

  React.useEffect(() => {
    if (phase !== "synced") return
    const timer = setTimeout(() => setPhase("online"), hideAfter)
    return () => clearTimeout(timer)
  }, [phase, hideAfter])

  React.useEffect(() => {
    if (!guardUnload || online || queued === 0) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [guardUnload, online, queued])

  const visible = phase !== "online"
  const count = formatCount(queued)
  const fill = (template: string) => template.replace("{count}", count)
  const message = {
    online: "",
    offline: fill(queued > 0 ? offlineText : offlineEmptyText),
    syncing: fill(syncingText),
    synced: syncedText,
    failed: fill(failedText),
  }[phase]
  // Screen readers hear phase changes, not every tick of the counter.
  const announcement = {
    online: "",
    offline: fill(offlineEmptyText),
    syncing: fill(syncingText.replace(/\s*\{count\}/, "")),
    synced: syncedText,
    failed: fill(failedText),
  }[phase]
  const tone = tones[phase === "offline" ? "warning" : phase === "syncing" ? "info" : phase === "failed" ? "danger" : "success"]
  const Icon = { online: CircleCheck, offline: WifiOff, syncing: LoaderCircle, synced: CircleCheck, failed: CircleAlert }[phase]

  return (
    <div
      data-slot="offline-banner"
      data-state={phase}
      className={cn(
        "grid w-full transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none",
        visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
      {...props}
    >
      <span role="status" className="sr-only">
        {announcement}
      </span>
      <div className="min-h-0 overflow-hidden" inert={!visible}>
        <div className={cn(bar, "justify-center border-b px-4 text-center", tone.surface)}>
          <p className="min-w-0 tabular-nums">
            <Icon aria-hidden className={cn("mr-2 inline size-4 align-[-3px]", tone.icon, phase === "syncing" && "animate-spin")} />
            {message}
          </p>
          {phase === "failed" && onRetry && (
            <button type="button" onClick={onRetry} className={cn(action, tone.solid)}>
              <RotateCcw aria-hidden className="size-4" />
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
