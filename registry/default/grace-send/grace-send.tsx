"use client"

import * as React from "react"
import { Check, LoaderCircle, Send } from "lucide-react"

import { cn } from "@/lib/utils"

const RADIUS = 6.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const button =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

type Phase = "idle" | "counting" | "pending" | "sent"

export interface GraceSendProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The irreversible action. Runs only after the grace window. Return a promise to show a pending state. */
  onSend: () => void | Promise<void>
  /** Called when the user cancels inside the window. */
  onCancel?: () => void
  /** Length of the grace window, in milliseconds. */
  delay?: number
  /** Idle button content. */
  children?: React.ReactNode
  /** Disables the button. */
  disabled?: boolean
  /** Templates: `{s}` is the whole seconds left. */
  countdownLabel?: string
  /** Helper text under the button. */
  hint?: string
  /** Cancel button text during the countdown. */
  cancelLabel?: string
  /** Text of the button that skips the wait. */
  sendNowLabel?: string
  /** Shown while onSend's promise is pending. */
  pendingLabel?: string
  /** Shown after onSend resolves. */
  sentLabel?: string
  /** Announced when the user cancels. */
  cancelledText?: string
  /** Shown when onSend rejects. */
  failedText?: string
  /** Milliseconds the "Sent" state shows before resetting. 0 keeps it. */
  resetAfter?: number
}

/**
 * A Send button with a built-in change-of-mind window, like Gmail's Undo
 * Send but before anything leaves. Pressing it starts a short countdown with
 * a draining ring; Cancel, Escape (from anywhere on the page) or closing the
 * tab (which warns first) stops it, and "Send now" skips the wait. The timer
 * runs off a deadline, so a throttled background tab can't stretch or skip
 * it, and clicks in the first 400 ms are ignored so a double-click on Send
 * can't cancel or "send now" by mistake.
 */
export function GraceSend({
  onSend,
  onCancel,
  delay = 5000,
  children = (
    <>
      <Send aria-hidden className="size-4" /> Send
    </>
  ),
  disabled,
  countdownLabel = "Sending in {s}s",
  hint = "Press Escape to cancel.",
  cancelLabel = "Cancel",
  sendNowLabel = "Send now",
  pendingLabel = "Sending…",
  sentLabel = "Sent",
  cancelledText = "Cancelled. Nothing was sent.",
  failedText = "Couldn't send. Nothing went out, so you can try again.",
  resetAfter = 2000,
  className,
  ...props
}: GraceSendProps) {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [left, setLeft] = React.useState(delay)
  const [note, setNote] = React.useState<"cancelled" | "failed">()
  const [reduced, setReduced] = React.useState(false)
  const deadline = React.useRef(0)
  const startedAt = React.useRef(0)
  const sendRef = React.useRef<HTMLButtonElement>(null)
  const cancelRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => setReduced(matchMedia("(prefers-reduced-motion: reduce)").matches), [])

  const fire = React.useCallback(async () => {
    setPhase("pending")
    try {
      await onSend()
      setPhase("sent")
    } catch {
      setNote("failed")
      setPhase("idle")
    }
  }, [onSend])

  const cancel = React.useCallback(() => {
    setPhase("idle")
    setNote("cancelled")
    onCancel?.()
    requestAnimationFrame(() => sendRef.current?.focus())
  }, [onCancel])

  React.useEffect(() => {
    if (phase !== "counting") return
    const tick = () => {
      const remaining = deadline.current - performance.now()
      if (remaining > 0) return setLeft(remaining)
      clearInterval(id)
      void fire()
    }
    const id = setInterval(tick, 100)
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      cancel()
    }
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    document.addEventListener("keydown", onKey)
    window.addEventListener("beforeunload", onLeave)
    return () => {
      clearInterval(id)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("beforeunload", onLeave)
    }
  }, [phase, fire, cancel])

  React.useEffect(() => {
    if (phase !== "sent" || resetAfter <= 0) return
    const timer = setTimeout(() => setPhase("idle"), resetAfter)
    return () => clearTimeout(timer)
  }, [phase, resetAfter])

  const start = () => {
    startedAt.current = performance.now()
    deadline.current = startedAt.current + delay
    setLeft(delay)
    setNote(undefined)
    setPhase("counting")
    requestAnimationFrame(() => cancelRef.current?.focus())
  }
  const settled = () => performance.now() - startedAt.current > 400
  const seconds = Math.max(1, Math.ceil(left / 1000))
  // With reduced motion the ring steps once a second instead of draining smoothly.
  const shown = reduced ? (seconds * 1000) / delay : left / delay

  return (
    <div data-slot="grace-send" data-state={phase} className={cn("inline-flex flex-col items-start", className)} {...props}>
      {phase === "counting" ? (
        <div role="group" aria-label={countdownLabel.replace("{s}", String(seconds))} className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 items-center gap-2 rounded-md bg-primary/10 px-3 text-sm font-medium tabular-nums">
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 -rotate-90">
              <circle cx="8" cy="8" r={RADIUS} className="fill-none stroke-foreground/15" strokeWidth="2" />
              <circle
                cx="8"
                cy="8"
                r={RADIUS}
                className="fill-none stroke-foreground transition-[stroke-dashoffset] duration-100 ease-linear motion-reduce:transition-none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - shown)}
              />
            </svg>
            {countdownLabel.replace("{s}", String(seconds))}
          </span>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => settled() && cancel()}
            onKeyDown={(event) => event.key === "Enter" && event.repeat && event.preventDefault()}
            className={cn(button, "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50")}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => settled() && void fire()}
            className={cn(button, "px-2 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline")}
          >
            {sendNowLabel}
          </button>
        </div>
      ) : (
        <button
          ref={sendRef}
          type="button"
          disabled={disabled}
          aria-busy={phase === "pending" || undefined}
          onClick={() => phase === "idle" && start()}
          className={cn(button, "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 aria-busy:cursor-progress")}
        >
          {phase === "pending" ? (
            <>
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> {pendingLabel}
            </>
          ) : phase === "sent" ? (
            <>
              <Check aria-hidden className="size-4" /> {sentLabel}
            </>
          ) : (
            children
          )}
        </button>
      )}
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {phase === "counting" && (
          <span className="mt-1.5 block">
            <span className="sr-only">{countdownLabel.replace("{s}", String(Math.round(delay / 1000)))}. </span>
            {hint}
          </span>
        )}
        {phase === "idle" && note === "cancelled" && <span className="mt-1.5 block">{cancelledText}</span>}
        {phase === "sent" && <span className="sr-only">{sentLabel}</span>}
      </p>
      {phase === "idle" && note === "failed" && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {failedText}
        </p>
      )}
    </div>
  )
}
