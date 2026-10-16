"use client"

import * as React from "react"
import { Hourglass, LoaderCircle, TrafficCone } from "lucide-react"

import { cn } from "@/lib/utils"
import { jitterAfter, readRateLimit, type RateLimitInfo, type RateLimitResponse } from "./rate-limit"

export * from "./rate-limit"

interface Lockout {
  info: RateLimitInfo
  /** performance.now() deadline, immune to the wall clock being changed. */
  deadline: number
  total: number
}

const fill = (template: string, values: Record<string, string | number | undefined>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/** 65_000 → "1:05". */
const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

const per = (seconds?: number) =>
  !seconds
    ? ""
    : seconds === 60
      ? "minute"
      : seconds === 3600
        ? "hour"
        : seconds === 86_400
          ? "day"
          : `${seconds} seconds`

export interface RetryAfterProps extends Omit<React.ComponentProps<"button">, "onClick" | "children"> {
  /** Sends the request. Resolve with the Response (or `{ status, headers }`); a 429/503 starts the wait. */
  onAction: () => unknown
  /** Button label, e.g. "Send message". */
  children: React.ReactNode
  /** Start already limited, e.g. when the page loaded after a 429. */
  defaultResponse?: RateLimitResponse
  /** Retry by itself when the wait ends (with jitter, never early). */
  autoRetry?: boolean
  /** Automatic retries before handing control back to the user. */
  maxAutoRetries?: number
  /** What is being limited, used when the server doesn't name its policy ("messages"). */
  noun?: string
  /** Called on every 429/503 with what was parsed. */
  onRateLimit?: (info: RateLimitInfo) => void
  /** Templates. `{time}` is the countdown, `{at}` when it will send, `{reset}` when the server's limit resets, `{limit}`, `{noun}`, `{per}` describe the limit. */
  waitingLabel?: string
  /** Button label while the request runs. */
  pendingLabel?: string
  /** Explains a 429 (too many requests). */
  tooManyText?: string
  /** Explains a 503 (service busy). */
  busyText?: string
  /** Names the limit that was hit, when headers say. */
  limitText?: string
  /** Reassures that the user's input was kept. */
  keptText?: string
  /** Says an automatic retry is scheduled. */
  autoText?: string
  /** Announced when the wait is over. */
  readyText?: string
  /** Shown when automatic retries are used up. */
  exhaustedText?: string
  /** Shown when the user keeps clicking during the wait. */
  spamText?: string
  /** Says when the retry will be sent. */
  sendingAtText?: string
  /** Label of the button that cancels the automatic retry. */
  cancelAutoLabel?: string
  /** Shown when the request fails for another reason. */
  errorText?: string
  /** Class for the wrapper holding the button and its explanation. */
  className?: string
}

/**
 * A send button for rate-limited APIs. On 429/503 it reads Retry-After (seconds
 * or a date, measured against the server's own Date header) and the RateLimit
 * headers, says which limit was hit and when it resets, counts down, and
 * retries by itself with jitter. Clicks during the wait never reach the server,
 * so impatience can't extend the lockout, and the form around it stays as is.
 */
export function RetryAfter({
  onAction,
  children,
  defaultResponse,
  autoRetry = true,
  maxAutoRetries = 3,
  noun = "requests",
  onRateLimit,
  waitingLabel = "Retry in {time}",
  pendingLabel = "Sending…",
  tooManyText = "Too many attempts. You can try again in {time}.",
  busyText = "The service is busy right now. Try again in {time}.",
  limitText = "The limit is {limit} {noun} per {per}. It resets at {reset}.",
  keptText = "Nothing you typed is lost.",
  autoText = "We’ll send it automatically.",
  readyText = "You can send again now.",
  exhaustedText = "Still limited after several tries. Wait a little, then send again.",
  spamText = "No need to click: extra tries can make the wait longer.",
  sendingAtText = "Sending at {at}.",
  cancelAutoLabel = "Don’t send automatically",
  errorText = "That didn’t go through. Try again.",
  className,
  disabled,
  ...props
}: RetryAfterProps) {
  const [lockout, setLockout] = React.useState<Lockout | null>(null)
  const [now, setNow] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const [auto, setAuto] = React.useState(autoRetry)
  const [retries, setRetries] = React.useState(0)
  const [spam, setSpam] = React.useState(false)
  const [error, setError] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const hintId = React.useId()

  const limit = React.useCallback(
    (response: unknown, attempt: number) => {
      const info = readRateLimit(response, attempt)
      if (!info) return false
      const wait = jitterAfter(info.waitMs)
      setLockout({ info, deadline: performance.now() + wait, total: wait })
      setNow(performance.now())
      onRateLimit?.(info)
      return true
    },
    [onRateLimit],
  )

  const initial = React.useRef(defaultResponse)
  React.useEffect(() => {
    if (initial.current) limit(initial.current, 0)
  }, [limit])

  const remaining = lockout ? Math.max(0, lockout.deadline - now) : 0
  const waiting = remaining > 0

  React.useEffect(() => {
    if (!lockout || !waiting) return
    const timer = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(timer)
  }, [lockout, waiting])

  const run = React.useCallback(
    async (automatic: boolean) => {
      setPending(true)
      setError(false)
      setSpam(false)
      try {
        const result = await onAction()
        const attempt = automatic ? retries + 1 : 0
        setRetries(attempt)
        if (!limit(result, attempt)) setLockout(null)
      } catch {
        setError(true)
      } finally {
        setPending(false)
      }
    },
    [onAction, limit, retries],
  )

  const runRef = React.useRef(run)
  React.useEffect(() => {
    runRef.current = run
  })
  const exhausted = retries >= maxAutoRetries
  const autoDue = !!lockout && !waiting && auto && !exhausted && !pending
  React.useEffect(() => {
    if (autoDue) void runRef.current(true)
  }, [autoDue])

  // Leaving now would drop the queued send.
  React.useEffect(() => {
    if (!waiting || !auto) return
    const guard = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [waiting, auto])

  const info = lockout?.info
  const clockAt = (ms: number) =>
    new Date(Date.now() + ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  // The server's reset excludes our jitter; the send time includes it.
  const at = waiting ? clockAt(remaining) : ""
  const resetAt = waiting && lockout ? clockAt(Math.max(0, remaining - (lockout.total - lockout.info.waitMs))) : ""
  const values = {
    time: formatClock(remaining),
    at,
    reset: resetAt,
    limit: info?.limit,
    noun: info?.policy && info.policy !== "default" ? info.policy : noun,
    per: per(info?.windowSeconds),
  }

  const handleClick = () => {
    if (pending || disabled) return
    if (waiting) {
      setSpam(true)
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        buttonRef.current?.animate(
          [{ translate: "0" }, { translate: "-4px" }, { translate: "4px" }, { translate: "-2px" }, { translate: "0" }],
          { duration: 300, easing: "ease-out" },
        )
      return
    }
    void run(false)
  }

  const shown = pending ? "pending" : waiting ? "waiting" : "idle"
  const inert = waiting || pending || disabled

  return (
    <div
      data-slot="retry-after"
      data-state={lockout ? (waiting ? "waiting" : "ready") : "idle"}
      className={cn("grid gap-2", className)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-disabled={inert || undefined}
        aria-busy={pending || undefined}
        aria-describedby={lockout ? hintId : undefined}
        onClick={handleClick}
        className={cn(
          "inline-flex h-9 items-center justify-center justify-self-start rounded-md bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground tabular-nums shadow-xs outline-none transition-[color,background-color,box-shadow,opacity] hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50",
          inert && "cursor-not-allowed opacity-50 hover:bg-primary",
          pending && "cursor-progress",
        )}
        {...props}
      >
        {/* Labels share one grid cell so the button keeps its width while counting down. */}
        <span className="grid">
          {(["idle", "waiting", "pending"] as const).map((key) => (
            <span
              key={key}
              aria-hidden={shown !== key || undefined}
              className={cn(
                "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
                shown !== key && "invisible",
              )}
            >
              {key === "idle" && children}
              {key === "waiting" && (
                <>
                  <Hourglass aria-hidden className="size-4" />
                  {fill(waitingLabel, { time: lockout ? formatClock(remaining || lockout.total) : "0:00" })}
                </>
              )}
              {key === "pending" && (
                <>
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                  {pendingLabel}
                </>
              )}
            </span>
          ))}
        </span>
      </button>

      {lockout && (waiting || exhausted || !auto) && (
        <div
          id={hintId}
          className="overflow-hidden rounded-md border border-amber-500/30 bg-amber-500/10 text-sm text-amber-950 dark:text-amber-50"
        >
          <div className="flex gap-2 px-3 py-2">
            <TrafficCone aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium" aria-live="polite">
                {waiting
                  ? fill(info?.status === 503 ? busyText : tooManyText, values)
                  : exhausted
                    ? exhaustedText
                    : readyText}
              </p>
              <p className="text-xs text-amber-900/75 dark:text-amber-100/75">
                {waiting && info?.limit && info.windowSeconds ? `${fill(limitText, values)} ` : ""}
                {waiting ? `${keptText} ${auto && !exhausted ? autoText : ""}` : exhausted ? keptText : ""}
              </p>
              {spam && waiting && (
                <p aria-live="assertive" className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {spamText} {auto && !exhausted && fill(sendingAtText, values)}
                </p>
              )}
              {waiting && auto && !exhausted && (
                <button
                  type="button"
                  onClick={() => setAuto(false)}
                  className="rounded-sm text-xs underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {cancelAutoLabel}
                </button>
              )}
            </div>
          </div>
          {waiting && (
            <div className="h-1 bg-amber-500/15">
              <div
                className="h-full bg-amber-500 transition-[width] duration-300 ease-linear motion-reduce:transition-none"
                style={{ width: `${(remaining / lockout.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {errorText}
        </p>
      )}
    </div>
  )
}
