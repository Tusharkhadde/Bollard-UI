"use client"

import * as React from "react"
import { ChevronDown, ClockAlert, LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCountdown, formatSkew, measureClockOffset, skewSeverity, type ClockOffset } from "./skew"

export * from "./skew"

/** Banner layout shared by every Bollard UI banner. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
const tones = {
  minor: {
    surface:
      "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    ghost: "px-2 hover:bg-amber-500/15",
  },
  major: {
    surface:
      "border-red-500/30 bg-background bg-linear-to-r from-red-500/10 to-red-500/10 text-red-950 dark:text-red-50",
    icon: "text-red-600 dark:text-red-400",
    muted: "text-red-900/75 dark:text-red-100/75",
    solid: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300",
    ghost: "px-2 hover:bg-red-500/15",
  },
} as const

/** Server time pinned to the monotonic clock, so fixing the device clock clears the warning by itself. */
interface Anchor {
  server: number
  perf: number
  uncertainty: number
}

const SkewContext = React.createContext<{ estimate: ClockOffset | null; significant: boolean }>({
  estimate: null,
  significant: false,
})

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

/** Ticks `Date.now()` corrected by the nearest `<ClockSkew>`. Undefined until mounted (SSR safe). */
export function useServerNow(interval = 1000) {
  const { estimate } = React.useContext(SkewContext)
  const [now, setNow] = React.useState<number>()
  React.useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [interval])
  return now === undefined ? undefined : now + (estimate?.offset ?? 0)
}

export interface CorrectedCountdownProps extends Omit<React.ComponentProps<"time">, "children"> {
  /** When it expires (server time). */
  to: Date | number | string
  /** Shown once it has expired. */
  expiredText?: string
  /** Screen-reader note when a correction is applied; `{skew}` and `{direction}` are filled in. */
  correctedText?: string
}

/** A countdown that runs on server time, and flashes once when a clock correction changes it. */
export function CorrectedCountdown({
  to,
  expiredText = "expired",
  correctedText = "Corrected: your device clock is {skew} {direction}.",
  className,
  ...props
}: CorrectedCountdownProps) {
  const { estimate, significant } = React.useContext(SkewContext)
  const now = useServerNow()
  const ref = React.useRef<HTMLTimeElement>(null)
  const target = new Date(to).getTime()

  React.useEffect(() => {
    if (!significant || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    ref.current?.animate(
      [
        { backgroundColor: "rgb(245 158 11 / 0.35)", transform: "scale(1.06)" },
        { backgroundColor: "transparent", transform: "none" },
      ],
      { duration: 400, easing: "ease-out" },
    )
  }, [significant])

  const left = now === undefined ? undefined : target - now
  return (
    <time
      ref={ref}
      data-slot="corrected-countdown"
      data-corrected={significant || undefined}
      dateTime={new Date(target).toISOString()}
      className={cn("rounded-sm px-0.5 tabular-nums", className)}
      {...props}
    >
      {left === undefined ? "–:––" : left <= 0 ? expiredText : formatCountdown(left)}
      {significant && estimate && (
        <span className="sr-only">
          {" "}
          {fill(correctedText, {
            skew: formatSkew(estimate.offset),
            direction: estimate.offset > 0 ? "behind" : "ahead",
          })}
        </span>
      )}
    </time>
  )
}

export interface ClockSkewProps extends React.ComponentProps<"div"> {
  /** Server time as of now, e.g. rendered into the page by the server. Wins over `measureUrl`. */
  serverTime?: Date | number | string
  /** How stale `serverTime` may be (network + render time), in ms. */
  serverTimeUncertainty?: number
  /** Same-origin URL to read the Date header from, e.g. "/api/health". Re-checked when the tab is shown again. */
  measureUrl?: string
  /** Smallest skew worth warning about, in ms. Default: one 30s TOTP step. */
  threshold?: number
  /** Called whenever the estimate changes (null until known). */
  onOffsetChange?: (estimate: ClockOffset | null) => void
  /** Templates: `{skew}` ("4 min 12 s") and `{direction}` ("behind"/"ahead"). */
  title?: string
  /** Explains the effect on authenticator codes. */
  otpText?: string
  /** Explains timers when the device is behind. */
  timersBehindText?: string
  /** Explains timers when the device is ahead. */
  timersAheadText?: string
  /** Explains the effect on secure sites. */
  secureSitesText?: string
  /** Steps for fixing the device clock. */
  fixText?: string
  /** Label for the device's time. */
  deviceLabel?: string
  /** Label for the actual time. */
  actualLabel?: string
  /** Text for the how-to-fix toggle. */
  howToFixLabel?: string
  /** Text for the check-again button. */
  checkAgainLabel?: string
  /** Text for the dismiss button. */
  dismissLabel?: string
}

/**
 * Catches a device clock that's wrong. It compares against server time, says
 * by how much and what will break because of it (authenticator codes, "expires
 * in" timers, secure sites), and corrects every `<CorrectedCountdown>` inside
 * it. Server time is pinned to the monotonic clock, so the warning clears on
 * its own the moment the user fixes their clock.
 */
export function ClockSkew({
  serverTime,
  serverTimeUncertainty = 1000,
  measureUrl,
  threshold = 30_000,
  onOffsetChange,
  title = "Your device clock is {skew} {direction}",
  otpText = "Codes from your authenticator app may be rejected.",
  timersBehindText = "Timers elsewhere would show {skew} more than you have. The ones here are corrected.",
  timersAheadText = "Timers elsewhere would show {skew} less than you have. The ones here are corrected.",
  secureSitesText = "Secure sites and sign-in links may refuse to work.",
  fixText = "Turn on “Set time automatically” in your device’s date and time settings. This message goes away once the clock is right.",
  deviceLabel = "This device",
  actualLabel = "Actual time",
  howToFixLabel = "How to fix",
  checkAgainLabel = "Check again",
  dismissLabel = "Got it",
  className,
  children,
  ...props
}: ClockSkewProps) {
  const [anchor, setAnchor] = React.useState<Anchor | null>(null)
  const [now, setNow] = React.useState(0)
  const [checking, setChecking] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)
  const fixId = React.useId()
  const serverMs = serverTime === undefined ? undefined : new Date(serverTime).getTime()

  const measure = React.useCallback(async () => {
    if (!measureUrl) return
    setChecking(true)
    try {
      const result = await measureClockOffset(measureUrl)
      if (result)
        setAnchor({ server: Date.now() + result.offset, perf: performance.now(), uncertainty: result.uncertainty })
    } catch {
      // Offline or blocked: keep the last estimate.
    } finally {
      setChecking(false)
    }
  }, [measureUrl])

  React.useEffect(() => {
    if (serverMs !== undefined) {
      setAnchor({ server: serverMs, perf: performance.now(), uncertainty: serverTimeUncertainty })
      return
    }
    void measure()
    const onVisible = () => document.visibilityState === "visible" && void measure()
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [serverMs, serverTimeUncertainty, measure])

  React.useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Re-derived every tick: if the wall clock jumps (the user fixed it), the offset follows.
  const estimate = React.useMemo<ClockOffset | null>(
    () =>
      anchor && now
        ? { offset: Math.round(anchor.server + performance.now() - anchor.perf - now), uncertainty: anchor.uncertainty }
        : null,
    [anchor, now],
  )
  const severity = estimate ? skewSeverity(estimate, threshold) : "none"
  const significant = severity !== "none"
  const offsetKey = estimate && significant ? Math.round(estimate.offset / 1000) : 0

  const onOffsetChangeRef = React.useRef(onOffsetChange)
  const estimateRef = React.useRef(estimate)
  React.useEffect(() => {
    onOffsetChangeRef.current = onOffsetChange
    estimateRef.current = estimate
  })
  // Report once per whole-second change, not every tick.
  React.useEffect(() => onOffsetChangeRef.current?.(estimateRef.current), [offsetKey, significant])

  const context = React.useMemo(() => ({ estimate, significant }), [estimate, significant])
  const tone = tones[severity === "major" ? "major" : "minor"]
  const values = estimate
    ? { skew: formatSkew(estimate.offset), direction: estimate.offset > 0 ? "behind" : "ahead" }
    : { skew: "", direction: "" }
  const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const consequences = [
    otpText,
    estimate && estimate.offset > 0 ? timersBehindText : timersAheadText,
    severity === "major" ? secureSitesText : null,
  ].filter(Boolean) as string[]

  return (
    <div data-slot="clock-skew" data-severity={severity} className={cn("flex flex-col gap-3", className)} {...props}>
      {significant && estimate && !dismissed && (
        <div
          role="region"
          aria-label={fill(title, values)}
          className={cn(
            "overflow-hidden rounded-lg border motion-safe:animate-[cui-clock-skew-in_250ms_ease-out]",
            tone.surface,
          )}
        >
          <style>{"@keyframes cui-clock-skew-in{from{opacity:0;transform:translateY(-4px)}}"}</style>
          <div className={bar}>
            <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
              <ClockAlert aria-hidden className={cn("size-4 shrink-0", tone.icon)} />
              <p className="min-w-0 flex-1 font-medium" aria-live="polite">
                {fill(title, values)}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={fixId}
                onClick={() => setOpen((v) => !v)}
                className={cn(action, tone.ghost)}
              >
                {howToFixLabel}
                <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
              </button>
              <button type="button" onClick={() => setDismissed(true)} className={cn(action, tone.solid)}>
                {dismissLabel}
              </button>
            </div>
          </div>
          <div className="space-y-2 px-3 pb-2.5 text-sm">
            <dl className="grid grid-cols-2 gap-2 tabular-nums">
              {[
                [deviceLabel, now, "line-through decoration-current/40"],
                [actualLabel, now + estimate.offset, "font-semibold"],
              ].map(([label, ms, emphasis]) => (
                <div
                  key={label as string}
                  className="rounded-md border border-current/10 bg-background/60 px-2.5 py-1.5"
                >
                  <dt className={cn("text-xs", tone.muted)}>{label}</dt>
                  <dd className={cn("text-sm whitespace-nowrap", emphasis as string)}>{clock(ms as number)}</dd>
                </div>
              ))}
            </dl>
            <ul className={cn("list-disc space-y-0.5 pl-4 text-xs", tone.muted)}>
              {consequences.map((text) => (
                <li key={text}>{fill(text, values)}</li>
              ))}
            </ul>
            <div id={fixId} hidden={!open} className="space-y-2 border-t border-current/10 pt-2 text-xs">
              <p>{fixText}</p>
              {measureUrl && serverMs === undefined && (
                <button
                  type="button"
                  onClick={() => void measure()}
                  disabled={checking}
                  className={cn(action, tone.ghost, "h-7 border border-current/20 px-2.5 text-xs")}
                >
                  {checking && <LoaderCircle aria-hidden className="size-3.5 animate-spin" />}
                  {checkAgainLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <SkewContext.Provider value={context}>{children}</SkewContext.Provider>
    </div>
  )
}
