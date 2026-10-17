"use client"

// Bollard UI — swipe-delete-row · MIT licence · https://bollard-ui.vercel.app/components/swipe-delete-row

import * as React from "react"
import { Trash2, Undo2 } from "lucide-react"
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react"

import { cn } from "@/lib/utils"

/** iOS-style rubber band: the further past a limit you drag, the less the row follows. */
export function rubberBand(distance: number, dimension: number, constant = 0.55) {
  if (dimension <= 0) return 0
  return (1 - 1 / ((distance * constant) / dimension + 1)) * dimension
}

const fill = (template: string, item: string) => template.replace(/\{item\}/g, item)

export interface SwipeDeleteRowProps extends Omit<React.ComponentProps<"div">, "onDrag"> {
  /** Name of the thing in the row, used in labels: "Invoice #1042". */
  itemLabel: string
  /** Fires once the undo window closes (or the row unmounts while it's open). Remove the item here. */
  onDelete: () => void
  /** Fires when the user undoes a delete. */
  onUndo?: () => void
  /** How far (0 to 1 of the row's width) a swipe must travel before release deletes. */
  threshold?: number
  /** Swipes that cross the line faster than this (ms from touch-down) are treated as accidental flicks. */
  minSwipeMs?: number
  /** How long Undo stays available, in milliseconds. */
  undoFor?: number
  /** Templates: `{item}` is filled in. */
  deleteLabel?: string
  /** Shown when releasing will delete. */
  releaseText?: string
  /** Shown after the row is deleted. */
  deletedText?: string
  /** Label of the Undo button. */
  undoLabel?: string
  /** Shown when a flick was too fast to count. */
  tooFastText?: string
}

/**
 * A list row with swipe-left-to-delete that's hard to trigger by accident.
 * The row follows 1:1 up to a visible line, then resists like a rubber band;
 * the trash icon grows and the red fills as you approach it. Releasing early
 * springs back. Vertical drags are left to the page's scroll, and a fast flick
 * across the line is ignored (with a hint) because only distance commits,
 * never velocity. A trash button does the same for keyboard and screen reader
 * users, and every delete keeps an Undo before `onDelete` fires.
 * The row rides a motion value: an early release springs back with the
 * finger's own velocity, a delete throws the row off the edge and the Undo
 * bar slides in under it, and Undo springs the row back in from the left, so
 * the user sees exactly where their item went and came back from. Reduced
 * motion swaps all of it for instant moves.
 */
export function SwipeDeleteRow({
  itemLabel,
  onDelete,
  onUndo,
  threshold = 0.4,
  minSwipeMs = 160,
  undoFor = 5000,
  deleteLabel = "Delete {item}",
  releaseText = "Release to delete",
  deletedText = "Deleted {item}",
  undoLabel = "Undo",
  tooFastText = "Too quick. Drag past the line to delete.",
  className,
  children,
  ...props
}: SwipeDeleteRowProps) {
  const rowRef = React.useRef<HTMLDivElement>(null)
  const undoRef = React.useRef<HTMLButtonElement>(null)
  const gesture = React.useRef<{ id: number; x: number; y: number; t: number; axis?: "x" | "y" } | null>(null)
  const offset = useMotionValue(0)
  const [width, setWidth] = React.useState(0)
  const [armed, setArmed] = React.useState(false)
  const [restored, setRestored] = React.useState(false)
  const reduce = useReducedMotion()
  const [dragging, setDragging] = React.useState(false)
  const [phase, setPhase] = React.useState<"idle" | "leaving" | "deleted">("idle")
  const [height, setHeight] = React.useState<number>()
  const [hint, setHint] = React.useState(false)
  const [draining, setDraining] = React.useState(false)
  const committed = React.useRef(false)
  const phaseRef = React.useRef(phase)
  const deleteRef = React.useRef(onDelete)
  React.useEffect(() => {
    deleteRef.current = onDelete
  })

  const line = width * threshold
  const lineRef = React.useRef(line)
  React.useLayoutEffect(() => {
    lineRef.current = line
  })
  const progress = useTransform(offset, (v) => (lineRef.current > 0 ? Math.min(1, Math.max(0, -v / lineRef.current)) : 0))
  const backdrop = useTransform(progress, (p) =>
    p >= 1 ? "var(--destructive)" : `color-mix(in oklab, var(--destructive) ${Math.round(p * 45)}%, var(--muted))`,
  )
  const iconScale = useTransform(progress, (p) => (p >= 1 ? 1.15 : 0.6 + p * 0.4))
  useMotionValueEvent(progress, "change", (p) => setArmed(p >= 1))

  /** Spring the row home, carrying the finger's velocity so it feels thrown back, not reset. */
  const springBack = () =>
    reduce ? offset.set(0) : void animate(offset, 0, { type: "spring", stiffness: 520, damping: 34, velocity: offset.getVelocity() })

  const remove = (fromKeyboard: boolean) => {
    setHeight(rowRef.current?.offsetHeight)
    setDragging(false)
    setPhase("leaving")
    const done = () => {
      setPhase("deleted")
      if (fromKeyboard) requestAnimationFrame(() => undoRef.current?.focus())
    }
    if (reduce) return done()
    animate(offset, -(rowRef.current?.offsetWidth ?? 400), { duration: 0.2, ease: "easeIn", onComplete: done })
  }

  const commit = React.useCallback(() => {
    if (committed.current) return
    committed.current = true
    deleteRef.current()
  }, [])

  // Commit after the undo window...
  React.useEffect(() => {
    phaseRef.current = phase
    if (phase !== "deleted") return
    committed.current = false
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setDraining(true))
    })
    const timer = setTimeout(commit, undoFor)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      setDraining(false)
    }
  }, [phase, undoFor, commit])

  // ...or straight away if the row goes away while Undo is still showing.
  React.useEffect(() => () => void (phaseRef.current === "deleted" && commit()), [commit])

  React.useEffect(() => {
    if (!hint) return
    const timer = setTimeout(() => setHint(false), 2200)
    return () => clearTimeout(timer)
  }, [hint])

  const undo = () => {
    // The row comes back in from the edge it left by, then springs into place.
    offset.set(reduce ? 0 : -(width || 320))
    setArmed(false)
    setRestored(true)
    setPhase("idle")
    if (!reduce) animate(offset, 0, { type: "spring", stiffness: 380, damping: 32 })
    onUndo?.()
  }

  // Focus follows the restored row's trash button, so keyboard users land where they were.
  React.useEffect(() => {
    if (!restored || phase !== "idle") return
    setRestored(false)
    rowRef.current?.querySelector<HTMLButtonElement>("button[data-trash]")?.focus({ preventScroll: true })
  }, [restored, phase])

  const end = () => {
    const g = gesture.current
    gesture.current = null
    if (!dragging || !g) return
    setDragging(false)
    if (!armed) return springBack()
    if (performance.now() - g.t < minSwipeMs) {
      setHint(true)
      return springBack()
    }
    remove(false)
  }

  if (phase === "deleted") {
    return (
      <div data-slot="swipe-delete-row" data-state="deleted" className={className} {...props}>
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-dashed bg-muted/50 px-3 text-sm"
          style={{ minHeight: height }}
        >
          <p role="status" className="min-w-0 flex-1 truncate text-muted-foreground">
            {fill(deletedText, itemLabel)}
          </p>
          <button
            ref={undoRef}
            type="button"
            onClick={undo}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
          >
            <Undo2 aria-hidden className="size-4" /> {undoLabel}
          </button>
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-foreground/25 ease-linear motion-reduce:hidden"
            style={{ transform: `scaleX(${draining ? 0 : 1})`, transition: draining ? `transform ${undoFor}ms linear` : "none" }}
          />
        </motion.div>
      </div>
    )
  }

  return (
    <div data-slot="swipe-delete-row" data-state={armed ? "armed" : phase} className={className} {...props}>
      <div className="relative overflow-hidden rounded-lg border bg-card">
        <motion.div
          aria-hidden
          className={cn("absolute inset-0 flex items-center justify-end gap-2 pr-4 text-sm font-medium", armed ? "text-white" : "text-muted-foreground")}
          style={{ backgroundColor: backdrop }}
        >
          <motion.span initial={false} animate={{ opacity: armed ? 1 : 0, x: armed || reduce ? 0 : 8 }} transition={{ duration: 0.15 }}>
            {releaseText}
          </motion.span>
          <motion.span className="grid shrink-0 place-items-center" style={{ scale: iconScale }}>
            <Trash2 className="size-5" />
          </motion.span>
          {dragging && !armed && (
            <span className="absolute inset-y-2 border-l-2 border-dashed border-current opacity-50" style={{ right: line }} />
          )}
        </motion.div>
        <motion.div
          ref={rowRef}
          className="relative flex touch-pan-y select-none items-center gap-3 bg-card px-3 py-2.5"
          style={{ x: offset }}
          onPointerDown={(event) => {
            if (event.button !== 0 || phase !== "idle" || (event.target as HTMLElement).closest("button,a,input")) return
            gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now() }
            setWidth(event.currentTarget.offsetWidth)
          }}
          onPointerMove={(event) => {
            const g = gesture.current
            if (!g || g.id !== event.pointerId) return
            const dx = event.clientX - g.x
            const dy = event.clientY - g.y
            if (!g.axis) {
              if (Math.hypot(dx, dy) < 8) return
              // Mostly-vertical movement is a scroll: let go and never claim it.
              g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y"
              if (g.axis === "y") return void (gesture.current = null)
              event.currentTarget.setPointerCapture(event.pointerId)
              setDragging(true)
            }
            const next = dx > 0 ? rubberBand(dx, width) * 0.3 : -(-dx <= line ? -dx : line + rubberBand(-dx - line, width - line))
            if (next <= -line && offset.get() > -line && typeof navigator !== "undefined") navigator.vibrate?.(10)
            offset.set(next)
          }}
          onPointerUp={end}
          onPointerCancel={() => {
            gesture.current = null
            setDragging(false)
            springBack()
          }}
        >
          <div className="min-w-0 flex-1">{children}</div>
          <button
            type="button"
            data-trash
            aria-label={fill(deleteLabel, itemLabel)}
            onClick={(event) => remove(event.detail === 0)}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </motion.div>
      </div>
      <p aria-live="polite" className="text-xs text-amber-700 empty:hidden dark:text-amber-400">
        {hint && <span className="mt-1.5 block">{tooFastText}</span>}
      </p>
    </div>
  )
}
