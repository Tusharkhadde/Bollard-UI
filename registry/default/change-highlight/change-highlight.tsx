"use client"

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

export type ChangeValue = number | string
export type ChangeDirection = "up" | "down" | "changed" | "same"

/** Numbers move up or down; anything else (a status, a label) just "changed". */
export function changeDirection(from: ChangeValue, to: ChangeValue): ChangeDirection {
  if (Object.is(from, to)) return "same"
  if (typeof from === "number" && typeof to === "number") return to > from ? "up" : "down"
  return "changed"
}

/** Whether a move is good news, bad news or neither, given which way is good. */
export function changeTone(direction: ChangeDirection, goodDirection: "up" | "down" | "none" = "up") {
  if (direction === "same") return "none" as const
  if (direction === "changed" || goodDirection === "none") return "neutral" as const
  return direction === goodDirection ? ("good" as const) : ("bad" as const)
}

const tones = {
  good: { text: "text-emerald-700 dark:text-emerald-400", tint: "bg-emerald-500/12", flash: "bg-emerald-500/35" },
  bad: { text: "text-red-700 dark:text-red-400", tint: "bg-red-500/12", flash: "bg-red-500/35" },
  neutral: { text: "text-amber-700 dark:text-amber-400", tint: "bg-amber-500/12", flash: "bg-amber-500/35" },
  none: { text: "", tint: "", flash: "" },
}
const glyph = { up: "▲", down: "▼", changed: "●", same: "" }
/** Never flash more than once a second, far under WCAG 2.3.1's three-flashes limit. */
const FLASH_GAP = 1000

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

export interface ChangeHighlightProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The live value. Numbers get a direction; strings are shown as "changed". */
  value: ChangeValue
  /** Formats a value for display, e.g. as currency. */
  format?: (value: ChangeValue) => string
  /** Which way is good news: "up" (default, ▲ green), "down" (▼ green, e.g. latency) or "none". */
  goodDirection?: "up" | "down" | "none"
  /** How long the arrow and tint stay after a change, in ms. */
  holdMs?: number
  /** Turns on "changed since your last visit": the last value you saw is kept in localStorage under this key. */
  storageKey?: string
  /** Announce changes to screen readers (politely). Off by default so busy tables don't chatter. */
  announce?: boolean
  /** Templates: `{value}` is filled in. */
  previousLabel?: string
  /** Text introducing changes since the last visit. */
  sinceVisitLabel?: string
  /** Accessible label for the dismiss button. */
  dismissLabel?: string
  /** Word for an increase. */
  upLabel?: string
  /** Word for a decrease. */
  downLabel?: string
  /** Word for a non-numeric change. */
  changedLabel?: string
}

/**
 * Stops a live update from going unnoticed. When the value changes it flashes once
 * (coalesced to one flash a second, skipped under reduced motion), keeps a ▲/▼ and a
 * tint for a few seconds, and shows the previous value on hover or focus. With
 * `storageKey` it also tells a returning visitor what moved while they were away.
 */
export function ChangeHighlight({
  value,
  format = String,
  goodDirection = "up",
  holdMs = 3000,
  storageKey,
  announce = false,
  previousLabel = "Was {value}",
  sinceVisitLabel = "was {value} at your last visit",
  dismissLabel = "Mark as seen",
  upLabel = "up",
  downLabel = "down",
  changedLabel = "changed",
  className,
  ...props
}: ChangeHighlightProps) {
  const [change, setChange] = React.useState<{ from: ChangeValue; count: number }>()
  const [fresh, setFresh] = React.useState(false)
  const [visitFrom, setVisitFrom] = React.useState<ChangeValue>()
  const last = React.useRef(value)
  const lastFlash = React.useRef(-Infinity)
  const flashRef = React.useRef<HTMLSpanElement>(null)
  const tipId = React.useId()

  // Last-visit mode: compare with what this browser last saw.
  React.useEffect(() => {
    if (!storageKey) return
    try {
      const stored = localStorage.getItem(storageKey)
      const seen = stored === null ? null : (JSON.parse(stored) as ChangeValue)
      if (seen === null) localStorage.setItem(storageKey, JSON.stringify(last.current))
      else if (!Object.is(seen, last.current)) setVisitFrom(seen)
    } catch {
      // Storage blocked or corrupt: the live highlight still works.
    }
  }, [storageKey])

  React.useEffect(() => {
    const from = last.current
    if (Object.is(from, value)) return
    last.current = value
    setChange((c) => ({ from, count: (c?.count ?? 0) + 1 }))
    setFresh(true)
    // A value the user is watching right now counts as seen, unless an older change is still unacknowledged.
    if (storageKey && visitFrom === undefined && document.visibilityState === "visible") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {}
    }
  }, [value, storageKey, visitFrom])

  // Runs after the new tone is rendered, so the flash takes the right colour.
  React.useEffect(() => {
    if (!change) return
    const now = performance.now()
    if (now - lastFlash.current > FLASH_GAP && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lastFlash.current = now
      flashRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: "ease-out" })
    }
    const timer = setTimeout(() => setFresh(false), holdMs)
    return () => clearTimeout(timer)
  }, [change, holdMs])

  const markSeen = () => {
    setVisitFrom(undefined)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {}
    }
  }

  const words = { up: upLabel, down: downLabel, changed: changedLabel, same: "" }
  const direction = change ? changeDirection(change.from, value) : "same"
  const tone = tones[changeTone(direction, goodDirection)]
  const visitDirection = visitFrom === undefined ? "same" : changeDirection(visitFrom, value)
  const visitTone = tones[changeTone(visitDirection, goodDirection)]
  const live = change && direction !== "same" ? `${words[direction]} to ${format(value)}, ${fill(previousLabel, { value: format(change.from) }).toLowerCase()}` : ""

  return (
    <span data-slot="change-highlight" data-state={fresh ? direction : "idle"} className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)} {...props}>
      <span className="group relative inline-flex">
        <span
          tabIndex={change ? 0 : undefined}
          aria-describedby={change ? tipId : undefined}
          className={cn(
            "relative inline-flex items-center gap-1 rounded-sm px-1 whitespace-nowrap tabular-nums outline-none motion-safe:transition-colors motion-safe:duration-300 focus-visible:ring-[3px] focus-visible:ring-ring/50",
            fresh && tone.tint,
          )}
        >
          <span ref={flashRef} aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-sm opacity-0", tone.flash)} />
          <span className="relative">{format(value)}</span>
          {fresh && direction !== "same" && (
            <span aria-hidden className={cn("relative text-[0.7em] leading-none", tone.text)}>
              {glyph[direction]}
            </span>
          )}
          {fresh && direction !== "same" && <span className="sr-only">{words[direction]}</span>}
        </span>
        {change && (
          <span
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-has-[:focus-visible]:block"
          >
            {fill(previousLabel, { value: format(change.from) })}
          </span>
        )}
      </span>
      {visitFrom !== undefined && visitDirection !== "same" && (
        <span className={cn("inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border border-current/20 py-0.5 pr-0.5 pl-2 text-xs", visitTone.text, visitTone.tint)}>
          <span aria-hidden>{glyph[visitDirection]}</span>
          <span className="sr-only">{words[visitDirection]}. </span>
          {fill(sinceVisitLabel, { value: format(visitFrom) })}
          <button
            type="button"
            onClick={markSeen}
            aria-label={dismissLabel}
            title={dismissLabel}
            className="grid size-5 shrink-0 place-items-center rounded-sm outline-none transition-colors hover:bg-current/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      )}
      {announce && (
        <span aria-live="polite" className="sr-only">
          {live}
        </span>
      )}
    </span>
  )
}
