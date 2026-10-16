"use client"

import * as React from "react"
import { ArrowRight, Check, LoaderCircle } from "lucide-react"
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react"

import { cn } from "@/lib/utils"

const variants = {
  default: { thumb: "bg-primary text-primary-foreground", fill: "bg-primary/15" },
  destructive: { thumb: "bg-destructive text-white dark:bg-destructive/60", fill: "bg-destructive/15" },
  outline: { thumb: "border bg-background text-foreground dark:border-input dark:bg-input", fill: "bg-foreground/10" },
} as const

// The thumb sits 3px inside the bordered track on every side.
const sizes = { default: "h-12 [--thumb:2.5rem]", sm: "h-10 [--thumb:2rem]" } as const

type Phase = "idle" | "pending" | "confirmed"

export interface SlideToConfirmProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Runs once the thumb reaches the end. Return a promise to show a pending state; a rejection slides it back. */
  onConfirm: () => void | Promise<void>
  /** Text shown in the track, and the slider's accessible name. */
  label?: string
  /** Text shown while an async `onConfirm` is running. */
  pendingLabel?: string
  /** Text shown once confirmed. */
  confirmedLabel?: string
  /** How far (0 to 1) the thumb must travel before it counts. */
  threshold?: number
  /** Milliseconds before resetting after confirm. 0 keeps it confirmed. */
  resetAfter?: number
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  disabled?: boolean
}

/**
 * A "slide to confirm" control for payments, sends and other deliberate
 * actions: a tap, a stray swipe or a pocket press can't fire it, because the
 * thumb has to travel the whole track. Drag with mouse or touch, or focus the
 * thumb and use the arrow keys (End jumps to the end, Escape lets go).
 * The thumb is a real motion drag with no momentum, so a flick stops where the
 * finger stops instead of coasting to "confirmed"; an early release springs
 * back, a tap nudges the thumb forward and back to show which way to slide,
 * and a failed confirm slides back with a shake. A light sheen runs across
 * the label as a "slide me" cue. Reduced motion keeps it all, minus the
 * springs, nudge and sheen.
 */
export function SlideToConfirm({
  onConfirm,
  label = "Slide to confirm",
  pendingLabel = "Working…",
  confirmedLabel = "Done",
  threshold = 0.9,
  resetAfter = 0,
  variant = "default",
  size = "default",
  disabled,
  className,
  ...props
}: SlideToConfirmProps) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const thumbRef = React.useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const [max, setMax] = React.useState(0)
  const [thumb, setThumb] = React.useState(0)
  const [percent, setPercent] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const [phase, setPhase] = React.useState<Phase>("idle")
  const reduce = useReducedMotion()
  const fillWidth = useTransform(x, (v) => v + thumb + 6)
  const labelOpacity = useTransform(x, (v) => (max > 0 ? Math.max(0, 1 - (v / max) * 1.4) : 1))
  useMotionValueEvent(x, "change", (v) => setPercent(max > 0 ? Math.round((v / max) * 100) : 0))

  React.useLayoutEffect(() => {
    const track = trackRef.current
    const knob = thumbRef.current
    if (!track || !knob) return
    const measure = () => {
      setThumb(knob.offsetWidth)
      setMax(Math.max(0, track.clientWidth - knob.offsetWidth - 6))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [size])

  const slideTo = (target: number, bounce = 0.25) =>
    reduce ? x.set(target) : void animate(x, target, { type: "spring", bounce, duration: 0.45 })

  const finish = async (position: number) => {
    if (max <= 0 || position < max * threshold) return slideTo(0)
    slideTo(max, 0)
    setPhase("pending")
    try {
      await onConfirm()
      setPhase("confirmed")
    } catch {
      // The caller reports the error; the thumb slides back with a shake so the user can try again.
      setPhase("idle")
      slideTo(0)
      if (!reduce && trackRef.current) animate(trackRef.current, { x: [0, -5, 5, -3, 0] }, { duration: 0.35 })
    }
  }

  React.useEffect(() => {
    if (phase !== "confirmed" || resetAfter <= 0) return
    const timer = setTimeout(() => {
      setPhase("idle")
      slideTo(0, 0)
    }, resetAfter)
    return () => clearTimeout(timer)
  }, [phase, resetAfter])

  const locked = disabled || phase !== "idle"
  const text = phase === "pending" ? pendingLabel : phase === "confirmed" ? confirmedLabel : label
  const Icon = phase === "pending" ? LoaderCircle : phase === "confirmed" ? Check : ArrowRight

  const letGo = () => {
    setDragging(false)
    slideTo(0)
  }

  /** A tap (no drag) nudges the thumb along the track and back: "this way". */
  const nudge = () => {
    if (locked || reduce || x.get() > 2) return
    animate(x, [0, Math.min(36, max * 0.2), 0], { duration: 0.6, ease: "easeInOut" })
  }

  return (
    <div
      ref={trackRef}
      data-slot="slide-to-confirm"
      data-state={phase}
      className={cn(
        "relative w-full max-w-xs touch-pan-y select-none overflow-hidden rounded-full border bg-muted dark:bg-input/30",
        sizes[size],
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <motion.div aria-hidden className={cn("absolute inset-y-0 left-0 rounded-full", variants[variant].fill)} style={{ width: fillWidth }} />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 grid place-items-center truncate pr-3 pl-[calc(var(--thumb)+10px)] text-sm font-medium text-muted-foreground"
        style={{ opacity: phase === "idle" ? labelOpacity : 1 }}
      >
        {phase === "idle" && !disabled && !reduce && !dragging ? (
          // A soft shine runs through the label left to right, the way to slide.
          <motion.span
            className="bg-[linear-gradient(100deg,var(--muted-foreground)_40%,var(--foreground)_50%,var(--muted-foreground)_60%)] bg-size-[250%_100%] bg-clip-text text-transparent"
            initial={{ backgroundPositionX: "100%" }}
            animate={{ backgroundPositionX: ["100%", "0%"] }}
            transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
          >
            {text}
          </motion.span>
        ) : (
          text
        )}
      </motion.span>
      <span aria-live="polite" className="sr-only">
        {phase === "idle" ? "" : text}
      </span>
      <motion.div
        ref={thumbRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={phase === "idle" ? `${percent}%` : text}
        aria-disabled={locked || undefined}
        drag={locked ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0.04}
        // No momentum: a flick stops where the finger stops, it never coasts to the end.
        dragMomentum={false}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => {
          setDragging(false)
          void finish(x.get())
        }}
        onTap={nudge}
        onKeyDown={(event) => {
          if (locked) return
          const step = max / 10
          const end = max * threshold
          const at = x.get()
          // A held arrow key stops just short of the end; confirming takes one more deliberate press.
          const forward = () =>
            at + step < end ? slideTo(at + step, 0) : event.repeat ? slideTo(Math.max(at, end - 1), 0) : void finish(max)
          const back = () => slideTo(Math.max(0, at - step), 0)
          const keys: Record<string, () => void> = {
            ArrowRight: forward,
            ArrowUp: forward,
            ArrowLeft: back,
            ArrowDown: back,
            Home: () => slideTo(0),
            End: () => void finish(max),
            Escape: letGo,
          }
          const action = keys[event.key]
          if (!action) return
          event.preventDefault()
          action()
        }}
        className={cn(
          "absolute top-[3px] left-[3px] grid size-(--thumb) touch-none place-items-center rounded-full shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          variants[variant].thumb,
          locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
        style={{ x }}
        whileTap={locked || reduce ? undefined : { scale: 0.94 }}
      >
        <Icon aria-hidden className={cn("size-4.5", phase === "pending" && "animate-spin")} />
      </motion.div>
    </div>
  )
}
