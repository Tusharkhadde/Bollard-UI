"use client"

// Bollard UI — two-step-button · MIT licence · https://bollard-ui.vercel.app/components/two-step-button

import * as React from "react"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const variants = {
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  destructive:
    "bg-destructive text-white shadow-xs hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70",
  outline:
    "border bg-background text-foreground shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
} as const

const sizes = { default: "h-9 px-4", sm: "h-8 px-3" } as const

type Phase = "idle" | "armed" | "pending" | "confirmed"

export interface TwoStepButtonProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  /** Runs on the confirming click. Return a promise to show a pending state until it settles. */
  onConfirm: () => void | Promise<void>
  /** How long the button stays armed, in milliseconds. */
  timeout?: number
  /** Second clicks sooner than this (ms) are ignored as an accidental double-click. */
  guard?: number
  /** Visual intent of the idle button. The armed state is always destructive. */
  variant?: keyof typeof variants
  /** Size of the button. */
  size?: keyof typeof sizes
  /** Label while armed. */
  armedLabel?: React.ReactNode
  /** Read to screen readers when the button arms. */
  armedHint?: string
  /** Label while an async `onConfirm` is running. */
  pendingLabel?: React.ReactNode
  /** Label shown for a moment after the action is confirmed. */
  confirmedLabel?: React.ReactNode
  /** Milliseconds before the button resets after confirming. 0 keeps it confirmed. */
  resetAfter?: number
}

/**
 * An inline "are you sure?" without a modal. The first click arms the button
 * and a timer bar drains; a second click inside the window confirms. It
 * disarms on timeout, blur or Escape, and ignores a second click that lands
 * within `guard` ms, so a double-click (or a held Enter key) can't arm and
 * confirm in one motion. All labels share one grid cell, so the button never
 * changes width and the second click lands where the first one did.
 */
export function TwoStepButton({
  onConfirm,
  timeout = 3000,
  guard = 300,
  variant = "destructive",
  size = "default",
  armedLabel = "Click again to confirm",
  armedHint = "Press again to confirm, or Escape to cancel.",
  pendingLabel = "Working…",
  confirmedLabel = "Done",
  resetAfter = 1600,
  disabled,
  className,
  children,
  onBlur,
  onKeyDown,
  ...props
}: TwoStepButtonProps) {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [draining, setDraining] = React.useState(false)
  const armedAt = React.useRef(0)

  // Start the drain two frames after arming, once the full bar has painted, so the transition runs.
  React.useEffect(() => {
    if (phase !== "armed") {
      setDraining(false)
      return
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setDraining(true))
    })
    const timer = setTimeout(() => setPhase("idle"), timeout)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [phase, timeout])

  React.useEffect(() => {
    if (phase !== "confirmed" || resetAfter <= 0) return
    const timer = setTimeout(() => setPhase("idle"), resetAfter)
    return () => clearTimeout(timer)
  }, [phase, resetAfter])

  const handleClick = async () => {
    if (disabled || phase === "pending" || phase === "confirmed") return
    if (phase === "idle") {
      armedAt.current = performance.now()
      setPhase("armed")
      return
    }
    if (performance.now() - armedAt.current < guard) return
    setPhase("pending")
    try {
      await onConfirm()
      setPhase("confirmed")
    } catch {
      // The caller reports the error; the button just becomes usable again.
      setPhase("idle")
    }
  }

  const disarm = () => setPhase((current) => (current === "armed" ? "idle" : current))

  return (
    <>
      <button
        type="button"
        data-slot="two-step-button"
        data-state={phase}
        disabled={disabled}
        aria-busy={phase === "pending" || undefined}
        onClick={() => void handleClick()}
        onBlur={(event) => {
          disarm()
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && phase === "armed") {
            event.preventDefault()
            disarm()
          }
          // A held Enter fires a click on every auto-repeat; only the first press counts.
          if (event.key === "Enter" && event.repeat) event.preventDefault()
          onKeyDown?.(event)
        }}
        className={cn(
          "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
          phase === "idle" || phase === "confirmed"
            ? variants[variant]
            : cn(variants.destructive, variant === "outline" && "border border-transparent"),
          sizes[size],
          className,
        )}
        {...props}
      >
        <span className="grid">
          {(["idle", "armed", "pending", "confirmed"] as const).map((key) => (
            <span
              key={key}
              aria-hidden={phase !== key || undefined}
              className={cn(
                "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
                phase !== key && "invisible",
              )}
            >
              {key === "idle" && children}
              {key === "armed" && armedLabel}
              {key === "pending" && (
                <>
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                  {pendingLabel}
                </>
              )}
              {key === "confirmed" && confirmedLabel}
            </span>
          ))}
        </span>
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1 origin-left bg-white/70 ease-linear"
          style={{
            opacity: phase === "armed" ? 1 : 0,
            transform: `scaleX(${draining ? 0 : 1})`,
            transitionProperty: draining ? "transform" : "none",
            transitionDuration: `${timeout}ms`,
          }}
        />
      </button>
      <span aria-live="polite" className="sr-only">
        {phase === "armed" ? armedHint : ""}
      </span>
    </>
  )
}
