"use client"

import * as React from "react"
import { Check, LoaderCircle } from "lucide-react"
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react"

import { cn } from "@/lib/utils"

const variants = {
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 [--fill:var(--primary-foreground)]",
  destructive:
    "bg-destructive text-white shadow-xs hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70 [--fill:white]",
  outline:
    "border bg-background text-foreground shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [--fill:var(--foreground)]",
} as const

const sizes = { default: "h-9 px-4", sm: "h-8 px-3" } as const

type Phase = "idle" | "holding" | "pending" | "confirmed"

export interface HoldToConfirmProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  /** Fires once the button has been held for the full duration. Return a promise to show a pending state. */
  onConfirm: () => void | Promise<void>
  /** How long the user must hold, in milliseconds. */
  duration?: number
  /** Visual intent. `destructive` is for delete and other irreversible actions. */
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  /** Shown briefly when someone clicks instead of holding, and read to screen readers. */
  holdHint?: string
  /** Label while an async `onConfirm` is running. */
  pendingLabel?: React.ReactNode
  /** Label shown for a moment after the action is confirmed. */
  confirmedLabel?: React.ReactNode
  /** Milliseconds before the button resets after confirming. 0 keeps it confirmed. */
  resetAfter?: number
  /**
   * Screen readers and switch access send a plain click and can't hold. Such a click arms the
   * button and a second one within a few seconds confirms, so the safeguard stays without locking anyone out.
   */
  confirmAgainLabel?: React.ReactNode
}

/**
 * A button that only fires after being pressed and held, so a stray click or
 * tap can't trigger a destructive action. Works with mouse, touch, pen and
 * keyboard (hold Space or Enter). Releasing early rewinds the fill, and a
 * plain click shows "Hold to confirm" in place so the user learns why
 * nothing happened, with a small shake that says "not like that". The fill
 * runs on a motion value and springs back when released, so a nervous user
 * sees the action visibly being called off. Screen reader and switch users,
 * who can only click, confirm with two clicks instead. The labels share one
 * grid cell, so the width never jumps. Reduced motion drops the shake,
 * spring and label slide.
 */
export function HoldToConfirm({
  onConfirm,
  duration = 1200,
  variant = "default",
  size = "default",
  holdHint = "Hold to confirm",
  pendingLabel = "Working…",
  confirmedLabel = "Done",
  resetAfter = 1600,
  confirmAgainLabel = "Press again",
  disabled,
  className,
  children,
  "aria-describedby": ariaDescribedBy,
  ...props
}: HoldToConfirmProps) {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [hinting, setHinting] = React.useState(false)
  const [armed, setArmed] = React.useState(false)
  const lastPressAt = React.useRef(-Infinity)
  const progress = useMotionValue(0)
  const run = React.useRef<AnimationPlaybackControls | null>(null)
  const pressedAt = React.useRef(0)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const hintId = React.useId()
  const reduce = useReducedMotion()

  const fire = async () => {
    if (typeof navigator !== "undefined") navigator.vibrate?.(15)
    setPhase("pending")
    try {
      await onConfirm()
      setPhase("confirmed")
    } catch {
      // The caller reports the error; the button just becomes usable again.
      setPhase("idle")
      progress.set(0)
    }
  }

  const begin = () => {
    if (disabled || phase === "pending" || phase === "confirmed") return
    run.current?.stop()
    setHinting(false)
    setArmed(false)
    setPhase("holding")
    pressedAt.current = performance.now()
    lastPressAt.current = pressedAt.current
    // Resume from wherever the rewind left off, at the same steady pace.
    const remaining = (1 - progress.get()) * duration
    run.current = animate(progress, 1, { duration: Math.max(0, remaining) / 1000, ease: "linear", onComplete: () => void fire() })
  }

  const release = () => {
    if (phase !== "holding") return
    if (progress.get() >= 1) return
    run.current?.stop()
    setPhase("idle")
    if (performance.now() - pressedAt.current < 250) {
      setHinting(true)
      // A short shake says "not like that" before the hint text explains it.
      if (!reduce && buttonRef.current) animate(buttonRef.current, { x: [0, -4, 4, -2, 0] }, { duration: 0.32 })
    }
    // The fill springs back, faster than it filled, so letting go reads as "called off".
    run.current = reduce ? (progress.set(0), null) : animate(progress, 0, { type: "spring", stiffness: 420, damping: 38 })
  }

  React.useEffect(() => {
    if (!hinting) return
    const timer = setTimeout(() => setHinting(false), 1500)
    return () => clearTimeout(timer)
  }, [hinting])

  React.useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])

  // A click that no press or held key came before is from assistive tech: arm first, confirm on the second.
  const assistiveClick = () => {
    if (disabled || phase !== "idle" || performance.now() - lastPressAt.current < 1000) return
    if (!armed) return setArmed(true)
    setArmed(false)
    void fire()
  }

  React.useEffect(() => {
    if (phase !== "confirmed" || resetAfter <= 0) return
    const timer = setTimeout(() => {
      setPhase("idle")
      progress.set(0)
    }, resetAfter)
    return () => clearTimeout(timer)
  }, [phase, resetAfter, progress])

  React.useEffect(() => () => run.current?.stop(), [])

  const isHoldKey = (key: string) => key === " " || key === "Enter"
  const shown =
    phase === "pending" ? "pending" : phase === "confirmed" ? "confirmed" : armed ? "armed" : hinting ? "hint" : "idle"

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-slot="hold-to-confirm"
        data-state={phase}
        disabled={disabled}
        aria-busy={phase === "pending" || undefined}
        aria-describedby={[hintId, ariaDescribedBy].filter(Boolean).join(" ")}
        onPointerDown={(event) => event.button === 0 && begin()}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(event) => event.preventDefault()}
        onClick={assistiveClick}
        onKeyDown={(event) => {
          if (!isHoldKey(event.key)) return
          event.preventDefault()
          lastPressAt.current = performance.now()
          if (!event.repeat) begin()
        }}
        onKeyUp={(event) => {
          if (!isHoldKey(event.key)) return
          lastPressAt.current = performance.now()
          release()
        }}
        onBlur={release}
        className={cn(
          "relative inline-flex shrink-0 touch-none select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        <motion.span
          aria-hidden
          className="absolute inset-0 origin-left bg-(--fill) opacity-20"
          style={{ scaleX: phase === "idle" || phase === "holding" ? progress : 1 }}
        />
        <span className="relative grid">
          {(["idle", "hint", "armed", "pending", "confirmed"] as const).map((key) => (
            <motion.span
              key={key}
              aria-hidden={shown !== key || undefined}
              initial={false}
              animate={{ opacity: shown === key ? 1 : 0, y: reduce || shown === key ? 0 : key === "idle" ? -6 : 6 }}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className={cn(
                "col-start-1 row-start-1 inline-flex items-center justify-center gap-2",
                shown !== key && "pointer-events-none",
              )}
            >
              {key === "idle" && children}
              {key === "hint" && holdHint}
              {key === "armed" && confirmAgainLabel}
              {key === "pending" && (
                <>
                  <LoaderCircle aria-hidden className="size-4 animate-spin" />
                  {pendingLabel}
                </>
              )}
              {key === "confirmed" && (
                <>
                  <Check aria-hidden className="size-4" />
                  {confirmedLabel}
                </>
              )}
            </motion.span>
          ))}
        </span>
      </button>
      {/* Outside the button, so the hint describes it instead of joining its name, and the status is announced. */}
      <span id={hintId} className="sr-only">
        {holdHint}
      </span>
      <span role="status" className="sr-only">
        {armed ? confirmAgainLabel : ""}
      </span>
    </>
  )
}
