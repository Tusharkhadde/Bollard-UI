"use client"

// Bollard UI — do-not-close · MIT licence · https://bollard-ui.vercel.app/components/do-not-close

import * as React from "react"
import { CircleAlert, CircleCheck, Hourglass, RotateCcw } from "lucide-react"

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

export type OperationStatus = "idle" | "active" | "done" | "error"

export type ProgressSample = { at: number; progress: number }

/** "a few seconds left", "about 25 s left", "about 3 min left". */
export function formatEta(ms: number) {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 10) return "a few seconds left"
  if (seconds < 60) return `about ${Math.ceil(seconds / 5) * 5} s left`
  return `about ${Math.ceil(seconds / 60)} min left`
}

/**
 * Time left from the rate across `samples` (oldest first), measured up to
 * `now` so a stall slows the estimate instead of freezing it. `stalled` when
 * nothing moved for a whole window; `ms` is undefined until there's enough data.
 */
export function estimateRemaining(samples: ProgressSample[], now: number, windowMs: number) {
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (!first || !last) return { stalled: false }
  const stalled = now - last.at > windowMs
  const rate = (last.progress - first.progress) / (now - first.at)
  const enough = now - first.at > 1500 && rate > 0
  return { stalled, ms: enough && !stalled ? (1 - last.progress) / rate : undefined }
}

function useEta(progress: number | undefined, active: boolean, windowMs: number) {
  const samples = React.useRef<ProgressSample[]>([])
  const [eta, setEta] = React.useState<{ ms?: number; stalled: boolean }>({ stalled: false })

  React.useEffect(() => {
    samples.current = []
    setEta({ stalled: false })
  }, [active])

  React.useEffect(() => {
    if (active && progress !== undefined) samples.current.push({ at: Date.now(), progress })
  }, [active, progress])

  React.useEffect(() => {
    if (!active) return
    const update = () => {
      const now = Date.now()
      const list = samples.current
      while (list.length > 1 && now - list[1].at > windowMs) list.shift()
      setEta(estimateRemaining(list, now, windowMs))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [active, windowMs])

  return eta
}

export interface DoNotCloseProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** `active` while the operation runs. `idle` renders nothing. */
  status: OperationStatus
  /** 0 to 1. Leave undefined when progress is unknown. */
  progress?: number
  /** What is happening, e.g. "Processing your payment". */
  label: string
  /** Shown when finished, e.g. "Payment confirmed". */
  doneLabel?: string
  /** What went wrong, shown in the `error` state. */
  error?: string
  /** Shows a Retry action in the `error` state. */
  onRetry?: () => void
  /** Headlines per state; `{label}` is filled in. */
  activeTitle?: string
  /** Heading shown when it is safe to close. */
  doneTitle?: string
  /** Heading shown when the work failed. */
  errorTitle?: string
  /** Retry button text. */
  retryLabel?: string
  /** Shown when progress has stalled. */
  stalledText?: string
  /** Shown while the time left is being estimated. */
  estimatingText?: string
  /** Prefix added to the tab title while active. */
  titlePrefix?: string
  /** Prefix shown in the tab title when it finished while the user was in another tab. */
  doneTitlePrefix?: string
  /** Rolling window for the time-left estimate, in ms. */
  etaWindow?: number
}

/**
 * Keeps people from closing the tab in the middle of something that must
 * finish: a payment, an upload, a migration. It warns on close, marks the tab
 * title so it's recognisable from any other tab, shows an honest time-left
 * estimate, and says "Safe to close" the moment it's true, even in the title
 * of a tab the user has wandered away from.
 */
export function DoNotClose({
  status,
  progress,
  label,
  doneLabel = "All done",
  error,
  onRetry,
  activeTitle = "Don't close or refresh this tab",
  doneTitle = "Safe to close",
  errorTitle = "{label} didn't finish",
  retryLabel = "Retry",
  stalledText = "taking longer than usual",
  estimatingText = "estimating time left",
  titlePrefix = "⏳ Don't close · ",
  doneTitlePrefix = "✓ Safe to close · ",
  etaWindow = 8000,
  className,
  ...props
}: DoNotCloseProps) {
  const active = status === "active"
  const eta = useEta(progress, active, etaWindow)
  const baseTitle = React.useRef("")

  React.useEffect(() => {
    if (!active) return
    baseTitle.current = document.title.replace(titlePrefix, "")
    document.title = titlePrefix + baseTitle.current
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.title = baseTitle.current
    }
  }, [active, titlePrefix])

  // Finished while the user was in another tab: say so in the title until they come back.
  React.useEffect(() => {
    if (status !== "done" || !document.hidden || !baseTitle.current) return
    const original = baseTitle.current
    const marked = doneTitlePrefix + original
    document.title = marked
    const restore = () => {
      if (document.title === marked) document.title = original
    }
    const onVisibility = () => !document.hidden && restore()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      restore()
    }
  }, [status, doneTitlePrefix])

  const percent = progress === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress)) * 100)
  const timeLeft = eta.stalled ? stalledText : eta.ms !== undefined ? formatEta(eta.ms) : percent !== undefined ? estimatingText : undefined
  const title = { idle: "", active: activeTitle, done: doneTitle, error: errorTitle.replace("{label}", label) }[status]
  const tone = tones[status === "done" ? "success" : status === "error" ? "danger" : "warning"]
  const Icon = status === "done" ? CircleCheck : status === "error" ? CircleAlert : Hourglass

  return (
    <>
      {/* Only state changes are announced, never the ticking estimate. */}
      <span role="status" className="sr-only">
        {status === "error" ? "" : title}
      </span>
      {status !== "idle" && (
        <div
          data-slot="do-not-close"
          data-state={status}
          className={cn("overflow-hidden rounded-lg border", tone.surface, className)}
          {...props}
        >
          <div className={bar}>
            <Icon aria-hidden className={cn("size-4 shrink-0", tone.icon, active && "animate-pulse")} />
            <div className="min-w-0 flex-1" role={status === "error" ? "alert" : undefined}>
              <p className="font-medium">{title}</p>
              <p className={cn("text-xs", tone.muted)}>
                {active ? label : status === "done" ? doneLabel : error}
                {active && (percent !== undefined || timeLeft) && (
                  <span className="tabular-nums">
                    {percent !== undefined && ` · ${percent}%`}
                    {timeLeft && ` · ${timeLeft}`}
                  </span>
                )}
              </p>
            </div>
            {status === "error" && onRetry && (
              <button type="button" onClick={onRetry} className={cn(action, tone.solid)}>
                <RotateCcw aria-hidden className="size-4" />
                {retryLabel}
              </button>
            )}
          </div>
          {active && (
            <div
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={percent === undefined ? "In progress" : `${percent}%${timeLeft ? `, ${timeLeft}` : ""}`}
              className="h-1 bg-amber-500/15"
            >
              <div
                className={cn(
                  "h-full bg-amber-500 transition-[width] duration-500 motion-reduce:transition-none",
                  percent === undefined && "w-1/3 animate-pulse",
                )}
                style={percent === undefined ? undefined : { width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
