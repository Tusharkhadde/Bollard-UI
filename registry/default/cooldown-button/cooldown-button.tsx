"use client"

import * as React from "react"
import { Hourglass, LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface CooldownState {
  /** Successful attempts so far. */
  attempts: number
  /** Epoch ms when the button unlocks again. */
  until: number
}

const storageKey = (id: string) => `bollard-ui:cooldown:${id}`

function readState(id: string): CooldownState | null {
  try {
    const raw = sessionStorage.getItem(storageKey(id))
    return raw ? (JSON.parse(raw) as CooldownState) : null
  } catch {
    return null
  }
}

function writeState(id: string, state: CooldownState) {
  try {
    sessionStorage.setItem(storageKey(id), JSON.stringify(state))
  } catch {
    // Storage can be full or blocked; the in-memory cooldown still applies.
  }
}

/** Forget a cooldown, e.g. once the user has verified and the flow restarts. */
export function clearCooldown(id: string) {
  try {
    sessionStorage.removeItem(storageKey(id))
  } catch {
    // Nothing to clear.
  }
}

/** Seconds to wait after the nth attempt (1-based). The last step repeats. */
export const cooldownFor = (attempts: number, steps: number[]) => steps[Math.min(attempts, steps.length) - 1] ?? 0

/** 65_000 → "1:05". */
export const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70",
  outline:
    "border bg-background text-foreground hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
} as const
const sizes = { default: "h-9 px-4", sm: "h-8 px-3" } as const
const DEFAULT_COOLDOWNS = [30, 60, 120]

export interface CooldownButtonProps extends Omit<React.ComponentProps<"button">, "id" | "onClick"> {
  /** Stable key for this action ("resend-otp:+91…"). The cooldown is stored under it for the tab's session. */
  id: string
  /** Runs on click. Return a promise; a rejection doesn't count as an attempt. */
  onAction: () => void | Promise<void>
  /** Seconds to wait after each attempt. The last value repeats for later attempts. */
  cooldowns?: number[]
  /** Attempts allowed before the button locks for the session. */
  maxAttempts?: number
  /** Treat mount as the first attempt (the code was sent when the page opened). */
  startCoolingDown?: boolean
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  /** Label while cooling down, given the remaining time ("0:42"). */
  waitingLabel?: (remaining: string) => React.ReactNode
  /** Label while `onAction` is running. */
  pendingLabel?: React.ReactNode
  /** Why the user has to wait, shown under the button during the cooldown. */
  reason?: React.ReactNode
  /** Attempts left, shown once the button is ready again or when few are left. */
  attemptsLabel?: (left: number, max: number) => React.ReactNode
  /** Read to screen readers when the cooldown ends. */
  readyAnnouncement?: string
  /** Shown once every attempt is used. */
  exhaustedMessage?: React.ReactNode
  /** Fallback when `onAction` rejects without an Error message. */
  errorMessage?: string
  /** Class for the wrapper that holds the button and its hint. */
  className?: string
}

/**
 * For "Resend code", "Retry" and other actions that cost something each time.
 * Each attempt waits longer (30s, 60s, 120s…), the cooldown survives a page
 * refresh because it lives in sessionStorage as an absolute deadline, and the
 * button locks with a clear message once the attempts run out. It stays
 * focusable while waiting (aria-disabled), so keyboard users keep their place.
 */
export function CooldownButton({
  id,
  onAction,
  cooldowns = DEFAULT_COOLDOWNS,
  maxAttempts = 5,
  startCoolingDown = false,
  variant = "outline",
  size = "default",
  children,
  waitingLabel = (remaining) => `Resend in ${remaining}`,
  pendingLabel = "Sending…",
  reason = "We just sent it. Give it a moment to arrive.",
  attemptsLabel = (left, max) => `${left} of ${max} tries left.`,
  readyAnnouncement = "You can try again now.",
  exhaustedMessage = "You've reached the limit for this session. Contact support if it still hasn't arrived.",
  errorMessage = "That didn't go through. Try again.",
  className,
  ...props
}: CooldownButtonProps) {
  const [state, setState] = React.useState<CooldownState | null>(null)
  const [now, setNow] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const hintId = React.useId()

  // Kept in a ref so an inline `cooldowns={[…]}` array doesn't re-run the restore effect.
  const cooldownsRef = React.useRef(cooldowns)
  React.useEffect(() => {
    cooldownsRef.current = cooldowns
  })

  const commit = React.useCallback(
    (attempts: number) => {
      const next = { attempts, until: Date.now() + cooldownFor(attempts, cooldownsRef.current) * 1000 }
      writeState(id, next)
      setState(next)
      setNow(Date.now())
    },
    [id],
  )

  // Restore after hydration; until then the button stays inert so a fast click can't slip through.
  React.useEffect(() => {
    const saved = readState(id)
    if (saved) {
      setState(saved)
      setNow(Date.now())
    } else if (startCoolingDown) commit(1)
    else setState({ attempts: 0, until: 0 })
  }, [id, startCoolingDown, commit])

  const exhausted = !!state && state.attempts >= maxAttempts
  const remaining = state && !exhausted ? Math.max(0, state.until - now) : 0
  const waiting = remaining > 0

  // Tick against the stored deadline, so a throttled background tab can't drift.
  React.useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [waiting])

  const inert = !state || waiting || exhausted || pending
  const left = maxAttempts - (state?.attempts ?? 0)
  const shown = pending ? "pending" : waiting ? "waiting" : "idle"

  const handleClick = async () => {
    if (inert || !state) return
    setError(undefined)
    setPending(true)
    try {
      await onAction()
      commit(state.attempts + 1)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : errorMessage)
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-slot="cooldown-button" className={cn("inline-flex flex-col items-start gap-1.5", className)}>
      <button
        type="button"
        data-state={exhausted ? "exhausted" : shown}
        aria-disabled={inert || undefined}
        aria-busy={pending || undefined}
        aria-describedby={hintId}
        onClick={() => void handleClick()}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium whitespace-nowrap tabular-nums shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress",
          variants[variant],
          sizes[size],
          inert && !pending && "cursor-not-allowed opacity-50",
        )}
        {...props}
      >
        {/* All labels share one grid cell, so the button keeps its width as it counts down. */}
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
                  {waitingLabel(formatClock(remaining || cooldownFor(maxAttempts, cooldowns) * 1000))}
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
      <p id={hintId} className="text-xs text-muted-foreground empty:hidden">
        {exhausted ? (
          exhaustedMessage
        ) : waiting ? (
          <>
            {reason}
            {left <= 2 && <> {attemptsLabel(left, maxAttempts)}</>}
          </>
        ) : state && state.attempts > 0 ? (
          attemptsLabel(left, maxAttempts)
        ) : null}
      </p>
      <span aria-live="polite" className="sr-only">
        {state && !waiting && !exhausted && state.attempts > 0 ? readyAnnouncement : ""}
      </span>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
