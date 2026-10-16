"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, X } from "lucide-react"

import { cn } from "@/lib/utils"

const DAY = 86_400_000

export interface SavedPosition {
  /** Key of the item the reader was on. */
  key: string
  /** When it was saved, in ms. */
  at: number
}

/** Reads a saved position, ignoring anything malformed or older than `maxAge` ms. */
export function readPosition(storageKey: string, now: number, maxAge = 30 * DAY): SavedPosition | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as SavedPosition | null
    return saved && typeof saved.key === "string" && now - saved.at < maxAge ? saved : null
  } catch {
    return null
  }
}

export interface ResumeMarkerProps<T> extends Omit<React.ComponentProps<"div">, "children"> {
  /** Identifies this feed or document in localStorage, e.g. "handbook:v3". */
  storageKey: string
  /** Everything in the feed, in reading order. */
  items: T[]
  /** A stable key for each item; it's what gets saved. */
  getKey: (item: T) => string
  /** Renders one item. */
  renderItem: (item: T, index: number) => React.ReactNode
  /** How long the reader must rest on a spot before it's saved, in ms, so a quick flick isn't saved. */
  saveDelay?: number
  /** Saved positions older than this (ms) are ignored. */
  maxAge?: number
  /** Divider label above the item the reader stopped on. */
  markerLabel?: string
  /** Pill that scrolls to the saved spot. */
  jumpLabel?: string
  /** Pill shown briefly after a jump, undoing it. */
  backLabel?: string
  /** Accessible label of the button that dismisses the pill. */
  dismissLabel?: string
}

const pillClass =
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Brings readers back to where they stopped in a long feed or document
 * without ever moving the page on its own. It saves the item they rested on,
 * marks it "You were here" on return, and offers a jump (and a way back).
 * Glancing at the top on return doesn't overwrite the old spot: saving only
 * resumes once the reader jumps, dismisses, or scrolls past it themselves.
 */
export function ResumeMarker<T>({
  storageKey,
  items,
  getKey,
  renderItem,
  saveDelay = 1000,
  maxAge = 30 * DAY,
  markerLabel = "You were here",
  jumpLabel = "Jump to where you left off",
  backLabel = "Back to where you were",
  dismissLabel = "Dismiss",
  className,
  onScroll,
  ref,
  ...props
}: ResumeMarkerProps<T>) {
  const key = `bollard-ui:resume:${storageKey}`
  const [marker, setMarker] = React.useState<string>()
  const [pending, setPending] = React.useState(false)
  const [seen, setSeen] = React.useState(false)
  const [returnTo, setReturnTo] = React.useState<number>()
  const rootRef = React.useRef<HTMLDivElement>(null)
  const dividerRef = React.useRef<HTMLDivElement>(null)
  const pendingRef = React.useRef(false)
  const scrolled = React.useRef(false)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const markerIndex = marker === undefined ? -1 : items.findIndex((item) => getKey(item) === marker)

  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement)
  pendingRef.current = pending

  // On arrival, pick up the saved spot. The first item isn't worth a marker.
  // An effect event, so later item changes never move the marker.
  const restore = React.useEffectEvent(() => {
    const saved = readPosition(key, Date.now(), maxAge)
    const index = saved ? items.findIndex((item) => getKey(item) === saved.key) : -1
    if (saved && index > 0) {
      pendingRef.current = true
      setMarker(saved.key)
      setPending(true)
    }
  })
  React.useEffect(() => restore(), [key])

  const save = React.useCallback(() => {
    const root = rootRef.current
    // Only a reader who scrolled has a new spot; a pending marker isn't overwritten.
    if (!root || !scrolled.current || pendingRef.current) return
    scrolled.current = false
    const top = root.getBoundingClientRect().top
    const current = Array.from(root.querySelectorAll<HTMLElement>("[data-resume-key]")).find(
      (el) => el.getBoundingClientRect().bottom > top + 24,
    )
    if (current) localStorage.setItem(key, JSON.stringify({ key: current.dataset.resumeKey, at: Date.now() }))
  }, [key])

  // Leaving the page saves straight away instead of waiting for the dwell timer.
  React.useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current)
      save()
    }
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [save])

  // The marker counts as reached once it scrolls into view, by jump or by hand.
  React.useEffect(() => {
    const divider = dividerRef.current
    if (!divider) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setSeen(true)
        setPending(false)
      },
      { root: rootRef.current, threshold: 1 },
    )
    observer.observe(divider)
    return () => observer.disconnect()
  }, [markerIndex])

  React.useEffect(() => {
    if (returnTo === undefined) return
    const timer = setTimeout(() => setReturnTo(undefined), 6000)
    return () => clearTimeout(timer)
  }, [returnTo])

  const smooth = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth")

  const jump = () => {
    const root = rootRef.current
    const divider = dividerRef.current
    if (!root || !divider) return
    setReturnTo(root.scrollTop)
    setPending(false)
    root.scrollTo({ top: divider.offsetTop - 8, behavior: smooth() })
    const target = divider.nextElementSibling
    if (target instanceof HTMLElement) target.focus({ preventScroll: true })
  }

  const back = () => {
    rootRef.current?.scrollTo({ top: returnTo ?? 0, behavior: smooth() })
    setReturnTo(undefined)
  }

  const showJump = pending && markerIndex > 0
  const showBack = returnTo !== undefined

  return (
    <div
      ref={rootRef}
      data-slot="resume-marker"
      data-state={showJump ? "pending" : seen ? "resumed" : "reading"}
      className={cn("relative overflow-y-auto overscroll-contain", className)}
      onScroll={(event) => {
        scrolled.current = true
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(save, saveDelay)
        onScroll?.(event)
      }}
      {...props}
    >
      {items.map((item, index) => (
        <React.Fragment key={getKey(item)}>
          {index === markerIndex && (
            <div
              ref={dividerRef}
              role="separator"
              aria-label={markerLabel}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400"
            >
              <span className="shrink-0">{markerLabel}</span>
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 origin-left bg-amber-500/70 transition-transform duration-400 ease-out motion-reduce:transition-none",
                  seen ? "scale-x-100" : "scale-x-0",
                )}
              />
            </div>
          )}
          <div data-resume-key={getKey(item)} tabIndex={-1} className="outline-none">
            {renderItem(item, index)}
          </div>
        </React.Fragment>
      ))}

      <div className="pointer-events-none sticky bottom-0 h-0">
        <div
          aria-live="polite"
          className={cn(
            "absolute inset-x-0 bottom-3 flex justify-center px-3 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
            showJump || showBack ? "translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0",
          )}
        >
          {showBack ? (
            <button type="button" onClick={back} className={cn(pillClass, "pointer-events-auto border bg-popover shadow-md hover:bg-accent")}>
              <ArrowUp aria-hidden className="size-4" />
              {backLabel}
            </button>
          ) : (
            <span className="pointer-events-auto flex items-center rounded-full bg-primary text-primary-foreground shadow-md">
              <button type="button" onClick={jump} className={cn(pillClass, "pr-2 hover:bg-primary/90")}>
                <ArrowDown aria-hidden className="size-4" />
                {jumpLabel}
              </button>
              <button
                type="button"
                onClick={() => setPending(false)}
                aria-label={dismissLabel}
                title={dismissLabel}
                className="mr-1 grid size-6 place-items-center rounded-full outline-none transition-colors hover:bg-primary-foreground/15 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
