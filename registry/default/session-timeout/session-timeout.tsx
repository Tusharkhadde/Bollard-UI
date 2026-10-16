"use client"

import * as React from "react"
import NumberFlow, { NumberFlowGroup } from "@number-flow/react"
import { LoaderCircle, LogOut, Timer } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

type Message = { type: "activity"; at: number } | { type: "signout" }

export interface SessionTimeoutProps extends Omit<React.ComponentProps<"dialog">, "children" | "open" | "onCancel" | "title"> {
  /** Idle time before the session ends, in ms. */
  timeout?: number
  /** How long before expiry the warning opens, in ms. */
  warnBefore?: number
  /** Extend the session on the server. Return a promise to show progress; throw to keep the warning. */
  onKeepAlive: () => void | Promise<void>
  /** Sign out now: the user chose to, or another tab signed out. */
  onSignOut: () => void
  /** Called when the idle time runs out. Defaults to `onSignOut`. */
  onExpire?: () => void
  /** BroadcastChannel name shared by every tab of the app. */
  channel?: string
  /** Seconds left at which screen readers hear the countdown. */
  announceAt?: number[]
  /** Pause tracking, e.g. while signed out. */
  disabled?: boolean
  title?: string
  description?: string
  stayLabel?: string
  signOutLabel?: string
  /** Read to screen readers; `{seconds}` is filled in. */
  announcement?: string
  /** Shown when `onKeepAlive` rejects. */
  errorText?: string
}

const ACTIVITY = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const

/** "1:05" for 65 s. */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/**
 * Warns before an idle session ends so nobody loses a half-filled form to a
 * silent logout. Activity in any tab keeps every tab alive, a backgrounded
 * tab can't wake up "alive" after it has expired, and screen readers hear the
 * countdown at a few moments instead of every second.
 */
export function SessionTimeout({
  timeout = 15 * 60_000,
  warnBefore = 60_000,
  onKeepAlive,
  onSignOut,
  onExpire,
  channel = "bollard-ui-session",
  announceAt = [60, 30, 10],
  disabled = false,
  title = "Still there?",
  description = "You'll be signed out for inactivity.",
  stayLabel = "Stay signed in",
  signOutLabel = "Sign out",
  announcement: announcementText = "Your session ends in {seconds} seconds.",
  errorText = "Couldn't extend your session. Try again.",
  className,
  ...props
}: SessionTimeoutProps) {
  const [left, setLeft] = React.useState<number>() // ms remaining, only while warning
  const [announcement, setAnnouncement] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const lastActive = React.useRef(0)
  const bus = React.useRef<BroadcastChannel | null>(null)
  const callbacks = React.useRef({ onSignOut, onExpire, announceAt, announcementText })
  const titleId = React.useId()
  const descriptionId = React.useId()
  const warning = left !== undefined
  const reduceMotion = useReducedMotion()

  React.useEffect(() => {
    callbacks.current = { onSignOut, onExpire, announceAt, announcementText }
  })

  const touch = React.useCallback((at = Date.now()) => {
    lastActive.current = at
    bus.current?.postMessage({ type: "activity", at } satisfies Message)
  }, [])

  React.useEffect(() => {
    if (disabled) return
    bus.current = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(channel)
    let warningOpen = false
    let spoken = -1
    touch()

    const check = () => {
      const remaining = lastActive.current + timeout - Date.now()
      if (remaining <= 0) {
        setLeft(undefined)
        setAnnouncement("")
        warningOpen = false
        lastActive.current = Infinity // stop checking until remounted
        bus.current?.postMessage({ type: "signout" } satisfies Message)
        ;(callbacks.current.onExpire ?? callbacks.current.onSignOut)()
        return
      }
      warningOpen = remaining <= warnBefore
      setLeft(warningOpen ? remaining : undefined)
      const seconds = Math.ceil(remaining / 1000)
      if (warningOpen && seconds !== spoken && (spoken === -1 || callbacks.current.announceAt.includes(seconds))) {
        spoken = seconds
        setAnnouncement(callbacks.current.announcementText.replace("{seconds}", String(seconds)))
      }
      if (!warningOpen && spoken !== -1) {
        spoken = -1
        setAnnouncement("")
      }
    }

    let throttled = 0
    const onActivity = () => {
      // The warning needs a deliberate answer, and an ended session stays ended.
      if (warningOpen || lastActive.current === Infinity || Date.now() - throttled < 1000) return
      throttled = Date.now()
      touch()
    }
    const onVisibility = () => {
      if (document.hidden) return
      check() // an expired background tab must not be revived by coming back to it
      onActivity()
    }
    if (bus.current) {
      bus.current.onmessage = (event: MessageEvent<Message>) => {
        if (event.data.type === "activity") {
          lastActive.current = Math.max(lastActive.current, event.data.at)
          check()
        } else {
          lastActive.current = Infinity
          setLeft(undefined)
          callbacks.current.onSignOut()
        }
      }
    }

    ACTIVITY.forEach((name) => window.addEventListener(name, onActivity, { passive: true, capture: true }))
    document.addEventListener("visibilitychange", onVisibility)
    const id = setInterval(check, 1000)
    return () => {
      clearInterval(id)
      ACTIVITY.forEach((name) => window.removeEventListener(name, onActivity, { capture: true }))
      document.removeEventListener("visibilitychange", onVisibility)
      bus.current?.close()
      bus.current = null
      setLeft(undefined) // disabling mid-warning must close it
      setFailed(false)
    }
  }, [channel, disabled, timeout, touch, warnBefore])

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (warning && !dialog.open) dialog.showModal()
    if (!warning && dialog.open) dialog.close()
  }, [warning])

  const stay = async () => {
    if (pending) return
    setFailed(false)
    setPending(true)
    try {
      await onKeepAlive()
      touch()
      setLeft(undefined)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  const signOut = () => {
    lastActive.current = Infinity
    setLeft(undefined)
    bus.current?.postMessage({ type: "signout" } satisfies Message)
    onSignOut()
  }

  const fraction = left === undefined ? 0 : Math.min(1, left / warnBefore)
  const seconds = left === undefined ? 0 : Math.max(0, Math.ceil(left / 1000))
  const urgent = warning && seconds <= 10

  return (
    <dialog
      ref={dialogRef}
      data-slot="session-timeout"
      data-urgent={urgent || undefined}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault() // Escape means "I'm still here", never a silent logout
        void stay()
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/50",
        className,
      )}
      {...props}
    >
      <div className="p-5">
        <div className="flex items-center gap-3">
          {/* The ring drains with the time left, so the deadline reads without counting digits. */}
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <svg aria-hidden viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
              <motion.circle
                cx="20"
                cy="20"
                r="18.5"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                className={urgent ? "stroke-red-500" : "stroke-amber-500"}
                initial={false}
                animate={{ pathLength: fraction }}
                transition={{ duration: reduceMotion ? 0 : 1, ease: "linear" }}
              />
            </svg>
            <motion.span
              className="flex"
              animate={urgent && !reduceMotion ? { rotate: [0, -12, 12, -8, 0] } : { rotate: 0 }}
              transition={urgent && !reduceMotion ? { duration: 0.5, repeat: Infinity, repeatDelay: 0.5 } : { duration: 0 }}
            >
              <Timer aria-hidden className="size-5" />
            </motion.span>
          </span>
          <div>
            <h2 id={titleId} className="font-medium">
              {title}
            </h2>
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <p
          aria-hidden
          className={cn(
            "mt-4 flex items-baseline justify-center text-4xl font-semibold tabular-nums transition-colors",
            urgent && "text-red-600 dark:text-red-400",
          )}
        >
          {warning && (
            <NumberFlowGroup>
              <NumberFlow value={Math.floor(seconds / 60)} trend={-1} animated={!reduceMotion} />
              <span>:</span>
              <NumberFlow
                value={seconds % 60}
                trend={-1}
                format={{ minimumIntegerDigits: 2 }}
                digits={{ 1: { max: 5 } }}
                animated={!reduceMotion}
              />
            </NumberFlowGroup>
          )}
        </p>
        <p className="sr-only" aria-live="assertive">
          {announcement}
        </p>
        {failed && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errorText}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t bg-muted/40 px-5 py-3">
        <button
          type="button"
          onClick={signOut}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <LogOut aria-hidden className="size-4" />
          {signOutLabel}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => void stay()}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {stayLabel}
        </button>
      </div>
    </dialog>
  )
}
