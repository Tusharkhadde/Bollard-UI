"use client"

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronDown, CircleAlert, CircleCheck, LoaderCircle, Pause, Play, RotateCcw, Square } from "lucide-react"

import { cn } from "@/lib/utils"

type Status = "queued" | "running" | "done" | "failed"
type Phase = "idle" | "running" | "pausing" | "paused" | "stopping" | "stopped" | "finished"

const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/** Failure reasons grouped and sorted by how often they happened. */
export function groupFailures(reasons: string[]) {
  const counts = new Map<string, number>()
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }))
}

export interface BulkRunnerProps<T> extends Omit<React.ComponentProps<"div">, "children"> {
  /** Everything the operation will touch. */
  items: T[]
  /** Processes one item. Throw (or reject) with an Error whose message is the reason it failed. */
  run: (item: T, signal: AbortSignal) => Promise<void>
  /** Name shown for an item in the failure list. Defaults to `String(item)`. */
  getLabel?: (item: T) => string
  /** How many items run at once. */
  concurrency?: number
  /** Start as soon as it mounts instead of showing a Start button. */
  autoStart?: boolean
  /** Heading, e.g. "Email 500 users". */
  title: string
  /** Past tense for finished items: "emailed", "deleted". */
  doneVerb?: string
  /** What the operation didn't do to items it never reached: "were not emailed". */
  untouchedText?: string
  /** Start button text. */
  startLabel?: string
  /** Pause button text. */
  pauseLabel?: string
  /** Resume button text. */
  resumeLabel?: string
  /** Stop button text. */
  stopLabel?: string
  /** Retry-failed button text ({failed} is filled in). */
  retryLabel?: string
  /** Templates: `{done}`, `{failed}`, `{left}`, `{total}`, `{inflight}`, `{verb}` and `{untouched}` are filled in. */
  pausingText?: string
  /** Shown while in-flight items finish after Stop. */
  stoppingText?: string
  /** Shown when the job was stopped. */
  stoppedText?: string
  /** Shown when every item has run. */
  finishedText?: string
}

/**
 * Progress for long bulk jobs that never leaves you guessing what happened.
 * Live done / failed / remaining counts; Pause and Stop let in-flight items
 * finish rather than cutting them off half-done, and Stop then says exactly
 * how many were done, failed and never touched. Failures are grouped by
 * reason and "Retry failed" re-runs only those. The bar's leading edge only
 * ever moves forward: a retried item stays counted until its new result
 * lands, so successes grow into the failed segment instead of the bar jumping back.
 * The counts roll with NumberFlow (digits tick instead of flickering), the
 * bar segments spring, and each new failure reason slides into the summary,
 * so a growing problem is noticed while the job is still running. Reduced
 * motion shows the same numbers without the animation.
 */
export function BulkRunner<T>({
  items,
  run,
  getLabel = String,
  concurrency = 4,
  autoStart = false,
  title,
  doneVerb = "done",
  untouchedText = "were not touched",
  startLabel = "Start",
  pauseLabel = "Pause",
  resumeLabel = "Resume",
  stopLabel = "Stop",
  retryLabel = "Retry {failed} failed",
  pausingText = "Pausing after {inflight} in progress finish…",
  stoppingText = "Stopping after {inflight} in progress finish…",
  stoppedText = "Stopped. {done} {verb}, {failed} failed, {left} {untouched}.",
  finishedText = "Finished. {done} {verb}, {failed} failed.",
  className,
  ...props
}: BulkRunnerProps<T>) {
  const status = React.useRef<Status[]>([])
  const reasons = React.useRef<Map<number, string>>(new Map())
  const queue = React.useRef<number[]>([])
  const inflight = React.useRef(0)
  const mode = React.useRef<"run" | "pause" | "stop">("run")
  const controller = React.useRef<AbortController | null>(null)
  const front = React.useRef(0)
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [, render] = React.useReducer((n: number) => n + 1, 0)
  const [showFailures, setShowFailures] = React.useState(false)
  const reduce = useReducedMotion()
  const spring = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 220, damping: 32 } as const)

  const settle = React.useCallback(() => {
    if (inflight.current > 0) return
    if (mode.current === "pause") setPhase("paused")
    else if (mode.current === "stop") setPhase("stopped")
    // A retry after Stop still leaves the never-started items untouched, so it ends as "stopped".
    else if (queue.current.length === 0) setPhase(status.current.includes("queued") ? "stopped" : "finished")
  }, [])

  const pump = React.useCallback(() => {
    while (mode.current === "run" && inflight.current < concurrency && queue.current.length > 0) {
      const index = queue.current.shift()!
      status.current[index] = "running"
      inflight.current++
      const signal = controller.current!.signal
      run(items[index], signal)
        .then(() => {
          if (signal.aborted) return
          status.current[index] = "done"
          reasons.current.delete(index)
        })
        .catch((error: unknown) => {
          if (signal.aborted) return
          status.current[index] = "failed"
          reasons.current.set(index, error instanceof Error && error.message ? error.message : "Unknown error")
        })
        .finally(() => {
          if (signal.aborted) return
          inflight.current--
          render()
          pump()
          settle()
        })
    }
    render()
  }, [concurrency, items, run, settle])

  const start = React.useCallback(
    (indices: number[]) => {
      controller.current ??= new AbortController()
      queue.current = indices
      mode.current = "run"
      setPhase("running")
      pump()
    },
    [pump],
  )

  React.useEffect(() => {
    status.current = items.map(() => "queued")
    reasons.current = new Map()
    front.current = 0
    if (autoStart) start(items.map((_, index) => index))
    return () => {
      controller.current?.abort()
      controller.current = null
      queue.current = []
      inflight.current = 0
    }
  }, [items, autoStart, start])

  const halt = (next: "pause" | "stop") => {
    mode.current = next
    setPhase(inflight.current > 0 ? (next === "pause" ? "pausing" : "stopping") : next === "pause" ? "paused" : "stopped")
  }

  const total = items.length
  const done = status.current.filter((s) => s === "done").length
  const failedIndices = status.current.flatMap((s, index) => (s === "failed" ? [index] : []))
  const failed = failedIndices.length
  const left = total - done - failed
  // Retried items keep their "failed" count until they finish, so the edge can't recede; the max() is a backstop.
  front.current = Math.max(front.current, total ? (done + failed) / total : 0)
  const doneShare = total ? Math.min(done / total, front.current) : 0
  const values = { done, failed, left, total, inflight: inflight.current, verb: doneVerb, untouched: untouchedText }
  const busy = phase === "running" || phase === "pausing" || phase === "stopping"
  const groups = groupFailures(failedIndices.map((index) => reasons.current.get(index) ?? ""))
  const summary =
    phase === "pausing" ? pausingText : phase === "stopping" ? stoppingText : phase === "stopped" ? stoppedText : phase === "finished" ? finishedText : ""

  return (
    <div data-slot="bulk-runner" data-state={phase} className={cn("w-full space-y-3 rounded-lg border bg-card p-3 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        {busy ? (
          <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : phase === "finished" && failed === 0 ? (
          <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : null}
        <p className="min-w-0 flex-1 basis-40 font-medium">{title}</p>
        <div className="ml-auto flex gap-2">
          {phase === "idle" && (
            <button type="button" className={action} onClick={() => start(items.map((_, index) => index))}>
              <Play aria-hidden className="size-4" /> {startLabel}
            </button>
          )}
          {phase === "running" && (
            <button type="button" className={action} onClick={() => halt("pause")}>
              <Pause aria-hidden className="size-4" /> {pauseLabel}
            </button>
          )}
          {phase === "paused" && (
            <button type="button" className={action} onClick={() => start(queue.current)}>
              <Play aria-hidden className="size-4" /> {resumeLabel}
            </button>
          )}
          {(phase === "running" || phase === "paused" || phase === "pausing") && (
            <button type="button" className={cn(action, "text-red-700 dark:text-red-400")} onClick={() => halt("stop")}>
              <Square aria-hidden className="size-3.5" /> {stopLabel}
            </button>
          )}
          {(phase === "stopped" || phase === "finished") && failed > 0 && (
            <button type="button" className={action} onClick={() => start(failedIndices)}>
              <RotateCcw aria-hidden className="size-4" /> {fill(retryLabel, values)}
            </button>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done + failed}
        aria-valuetext={`${done} ${doneVerb}, ${failed} failed, ${left} remaining of ${total}`}
        className="flex h-2 overflow-hidden rounded-full bg-muted"
      >
        <motion.span className="h-full bg-emerald-500" initial={false} animate={{ width: `${doneShare * 100}%` }} transition={spring} />
        <motion.span className="h-full bg-red-500" initial={false} animate={{ width: `${(front.current - doneShare) * 100}%` }} transition={spring} />
      </div>

      <dl className="grid grid-cols-3 gap-1.5 tabular-nums">
        {[
          [doneVerb, done, "text-emerald-700 dark:text-emerald-400"],
          ["failed", failed, "text-red-700 dark:text-red-400"],
          ["remaining", left, "text-foreground"],
        ].map(([label, count, tone]) => (
          <div key={label} className="min-w-0 rounded-md bg-muted/60 px-2 py-1.5">
            <dt className="text-xs text-muted-foreground first-letter:uppercase">{label}</dt>
            {/* The progressbar's valuetext carries these for screen readers; the rolling digits are visual. */}
            <dd className={cn("text-base font-semibold", tone)}>
              <NumberFlow value={count as number} willChange />
            </dd>
          </div>
        ))}
      </dl>

      <p aria-live="polite" className={cn("empty:hidden", phase === "stopped" ? "font-medium" : "text-muted-foreground")}>
        {summary && fill(summary, values)}
      </p>

      {failed > 0 && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5">
          <button
            type="button"
            aria-expanded={showFailures}
            onClick={() => setShowFailures((value) => !value)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-red-800 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-red-300"
          >
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-0.5">
              <AnimatePresence initial={false}>
                {groups.map((group) => (
                  // Each new reason slides in; counts roll as more items hit it.
                  <motion.span
                    key={group.reason}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    <NumberFlow value={group.count} /> × {group.reason}
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", showFailures && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showFailures && (
              <motion.ul
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="max-h-40 overflow-auto border-t border-red-500/20 px-2.5 py-1.5 text-xs"
              >
                {failedIndices.map((index) => (
                  <li key={index} className="flex justify-between gap-3 py-0.5">
                    <span className="truncate">{getLabel(items[index])}</span>
                    <span className="shrink-0 text-muted-foreground">{reasons.current.get(index)}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
