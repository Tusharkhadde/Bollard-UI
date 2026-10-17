"use client"

// Bollard UI — undo-toast · MIT licence · https://bollard-ui.vercel.app/components/undo-toast

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { CircleAlert, Undo2, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/**
 * Deferred actions with an undo window.
 *
 * Instead of asking "Are you sure?", do the thing optimistically and give the
 * user a few seconds to take it back. `onCommit` only runs once the window
 * closes (or the page is being left), so the real side effect never happens
 * if they undo.
 *
 *   undoable({
 *     message: "Invoice deleted",
 *     onUndo: () => restoreRow(id),
 *     onCommit: () => api.deleteInvoice(id),
 *   })
 *
 * If `onCommit` rejects, `onUndo` runs so the screen matches the server again, and
 * a toast says the action didn't go through. Commits fired by leaving the page
 * can't be awaited, so use `fetch(..., { keepalive: true })` or `sendBeacon` there.
 *
 * Motion explains each outcome: toasts spring in and the stack reflows
 * smoothly, an undone toast rewinds out to the left, a committed one settles
 * down and away, and a failed commit arrives with a shake. The seconds in the
 * ring roll down with NumberFlow. Reduced motion turns all of it into fades.
 */

export interface UndoableOptions {
  message: React.ReactNode
  /** Runs when the undo window closes without an undo. Put the real side effect here. A rejection rolls back with `onUndo`. */
  onCommit?: () => void | Promise<void>
  /** Runs when the user presses Undo (or Ctrl/⌘+Z). Restore your optimistic UI here. */
  onUndo?: () => void
  /** Length of the undo window in milliseconds. */
  duration?: number
  /** Shown when `onCommit` rejects. Defaults to the toaster's `failedText`. */
  failedMessage?: React.ReactNode
}

interface UndoItem extends UndoableOptions {
  id: number
  duration: number
  /** The commit failed and was rolled back; the toast now only reports it. */
  failed?: boolean
}

let items: UndoItem[] = []
let seq = 0
/** How each item left, so its exit animation can say "undone" or "done". */
const outcomes = new Map<number, "commit" | "undo">()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Settles an item exactly once, no matter how many paths try to settle it. */
function settle(id: number, outcome: "commit" | "undo") {
  const item = items.find((entry) => entry.id === id)
  if (!item || item.failed) return
  outcomes.set(id, outcome)
  items = items.filter((entry) => entry.id !== id)
  emit()
  if (outcome === "undo") return item.onUndo?.()
  let result: void | Promise<void>
  try {
    result = item.onCommit?.()
  } catch {
    result = Promise.reject()
  }
  // A failed commit puts the optimistic change back and says so, instead of failing silently.
  Promise.resolve(result).catch(() => {
    item.onUndo?.()
    items = [...items, { ...item, failed: true }]
    emit()
  })
}

/** Removes a failed-commit notice. */
function dismiss(id: number) {
  outcomes.set(id, "commit")
  items = items.filter((entry) => entry.id !== id)
  emit()
}

/** Queue a deferred action. Returns an id you can pass to `commitNow` or `undoNow`. */
export function undoable(options: UndoableOptions) {
  const id = ++seq
  items = [...items, { ...options, duration: options.duration ?? 5000, id }]
  emit()
  return id
}

/** Close the window early and run `onCommit`. */
export const commitNow = (id: number) => settle(id, "commit")
/** Take the action back and run `onUndo`. */
export const undoNow = (id: number) => settle(id, "undo")

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface ItemProps {
  /** The pending action. */
  item: UndoItem
  /** Label of the Undo button. */
  undoLabel: string
  /** Whether Ctrl/⌘+Z undoes the newest action. */
  hotkey: boolean
  /** Shown when a commit fails and is rolled back. */
  failedText: React.ReactNode
  /** Accessible label of the dismiss button. */
  dismissLabel: string
}

const spring = { type: "spring", stiffness: 520, damping: 38 } as const

/** Enter, reflow and outcome-specific exit for one toast. */
function Animated({ id, failed, children }: { id: number; failed?: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  React.useEffect(() => () => void outcomes.delete(id), [id])
  return (
    <motion.div
      layout={!reduce}
      className="w-full"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={reduce ? { opacity: 1 } : failed ? { opacity: 1, y: 0, scale: 1, x: [0, -6, 6, -3, 0] } : { opacity: 1, y: 0, scale: 1 }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : outcomes.get(id) === "undo"
            ? { opacity: 0, x: -40, transition: { duration: 0.2 } }
            : { opacity: 0, y: 10, scale: 0.96, transition: { duration: 0.2 } }
      }
      transition={spring}
    >
      {children}
    </motion.div>
  )
}

function UndoToastItem({ item, undoLabel, hotkey, failedText, dismissLabel }: ItemProps) {
  const [remaining, setRemaining] = React.useState(item.duration)
  const [paused, setPaused] = React.useState(false)
  const remainingRef = React.useRef(item.duration)

  React.useEffect(() => {
    if (paused || item.failed) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      // Frames stop while the tab is hidden; capping each step means time away doesn't eat the undo window.
      remainingRef.current = Math.max(0, remainingRef.current - Math.min(now - last, 100))
      last = now
      setRemaining(remainingRef.current)
      if (remainingRef.current === 0) settle(item.id, "commit")
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, item.id, item.failed])

  if (item.failed) {
    return (
      <div
        data-slot="undo-toast"
        data-state="failed"
        role="alert"
        className="pointer-events-auto flex w-full items-center gap-3 rounded-lg border border-red-500/40 bg-popover py-2 pr-2 pl-3 text-sm text-popover-foreground shadow-lg"
      >
        <CircleAlert aria-hidden className="size-5 shrink-0 text-red-600 dark:text-red-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-muted-foreground line-through">{item.message}</span>
          <span className="block">{item.failedMessage ?? failedText}</span>
        </span>
        <button
          type="button"
          onClick={() => dismiss(item.id)}
          aria-label={dismissLabel}
          className="grid size-8 shrink-0 place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      data-slot="undo-toast"
      data-state={paused ? "paused" : "running"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-lg border bg-popover py-2 pr-2 pl-3 text-sm text-popover-foreground shadow-lg"
    >
      <span className="relative grid size-6 shrink-0 place-items-center" aria-hidden>
        <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90">
          <circle cx="12" cy="12" r={RADIUS} className="fill-none stroke-muted" strokeWidth="2.5" />
          <circle
            cx="12"
            cy="12"
            r={RADIUS}
            className="fill-none stroke-foreground"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - remaining / item.duration)}
          />
        </svg>
        <NumberFlow value={Math.ceil(remaining / 1000)} trend={-1} className="text-[10px] font-semibold tabular-nums" />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.message}</span>
      <button
        type="button"
        aria-keyshortcuts={hotkey ? "Control+Z Meta+Z" : undefined}
        aria-label={typeof item.message === "string" ? `${undoLabel}: ${item.message}` : undefined}
        onClick={() => settle(item.id, "undo")}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Undo2 className="size-4" aria-hidden />
        {undoLabel}
      </button>
    </div>
  )
}

export interface UndoToasterProps extends React.ComponentProps<"section"> {
  /** Bind Ctrl+Z / ⌘+Z to undo the newest pending action. */
  hotkey?: boolean
  /** Label of each toast's undo button. */
  undoLabel?: string
  /** Shown when a commit fails and is rolled back. */
  failedText?: React.ReactNode
  /** Accessible label of the button that closes a failure notice. */
  dismissLabel?: string
}

/**
 * Renders pending undoable actions as toasts with a countdown ring. Render
 * once, near the root of your app. Hovering or focusing a toast pauses its
 * countdown, and leaving the page commits everything still pending, so
 * nothing is silently lost.
 */
export function UndoToaster({
  hotkey = true,
  undoLabel = "Undo",
  failedText = "That didn't go through, so it was put back.",
  dismissLabel = "Dismiss",
  className,
  "aria-label": ariaLabel = "Notifications",
  ...props
}: UndoToasterProps) {
  const list = React.useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  )

  React.useEffect(() => {
    if (!hotkey) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        const newest = items.filter((item) => !item.failed).at(-1)
        if (!newest) return
        event.preventDefault()
        settle(newest.id, "undo")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hotkey])

  React.useEffect(() => {
    const flush = () => {
      for (const item of [...items]) settle(item.id, "commit")
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [])

  return (
    // The live region exists before any toast mounts, so new messages are announced.
    <section
      data-slot="undo-toaster"
      aria-label={ariaLabel}
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-4",
        className,
      )}
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {list.map((item) => (
          <Animated key={`${item.id}${item.failed ? "-failed" : ""}`} id={item.id} failed={item.failed}>
            <UndoToastItem item={item} undoLabel={undoLabel} hotkey={hotkey} failedText={failedText} dismissLabel={dismissLabel} />
          </Animated>
        ))}
      </AnimatePresence>
    </section>
  )
}
