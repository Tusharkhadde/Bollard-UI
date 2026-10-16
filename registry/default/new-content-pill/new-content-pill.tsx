"use client"

import * as React from "react"
import { ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Splits a newest-first list into items still held back above the reader and
 * items on screen. Anything before the first item already shown is new.
 */
export function splitArrivals<T>(items: T[], getKey: (item: T) => string, shown: ReadonlySet<string>) {
  const first = items.findIndex((item) => shown.has(getKey(item)))
  return first > 0 ? { queued: items.slice(0, first), visible: items.slice(first) } : { queued: [] as T[], visible: items }
}

const fill = (template: string, count: number) => template.replace("{count}", String(count))

export interface NewContentPillProps<T> extends Omit<React.ComponentProps<"div">, "children"> {
  /** The live list, newest first. New items arrive at the start. */
  items: T[]
  /** A stable key for each item. */
  getKey: (item: T) => string
  /** Renders one item. */
  renderItem: (item: T, index: number) => React.ReactNode
  /** Pill text. `{count}` is filled in. */
  label?: string
  /** Pill text for a single new item. */
  labelOne?: string
  /** Within this many pixels of the top counts as "at the top", where new items go straight in. */
  topThreshold?: number
  /**
   * What scrolls. "self" (default) makes this element the scroll box. "window" is for feeds where the whole
   * page scrolls; a function returns another scrolling ancestor (an app shell's main panel).
   */
  scrollTarget?: "self" | "window" | (() => HTMLElement | null)
  /** Height of a sticky header over the feed when the page or an ancestor scrolls. The pill sits below it. */
  topOffset?: number
}

const KEYFRAMES = `@keyframes cui-new-content-pill-arrive{from{opacity:.3;transform:translateY(-6px);background-color:color-mix(in oklab,var(--color-amber-500) 18%,transparent)}to{opacity:1;transform:none;background-color:transparent}}`

/**
 * Stops live feeds shoving content down under the reader's finger. New items
 * are held above the reader behind a "5 new posts" pill that inserts them and
 * scrolls up on tap. They go straight in only when the reader is already at
 * the top and isn't mid-press, so even a tap that's landing can't hit the wrong post.
 */
export function NewContentPill<T>({
  items,
  getKey,
  renderItem,
  label = "{count} new posts",
  labelOne = "1 new post",
  topThreshold = 8,
  scrollTarget = "self",
  topOffset = 0,
  className,
  onPointerDown,
  onScroll,
  ref,
  ...props
}: NewContentPillProps<T>) {
  const [shown, setShown] = React.useState(() => new Set(items.map(getKey)))
  const [fresh, setFresh] = React.useState<ReadonlySet<string>>(new Set())
  const [pressing, setPressing] = React.useState(false)
  const [announced, setAnnounced] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLButtonElement>(null)
  const scrollUp = React.useRef(false)
  const lastCount = React.useRef(0)
  const self = scrollTarget === "self"
  const scroller = React.useCallback(() => (scrollTarget === "self" ? rootRef.current : scrollTarget === "window" ? null : scrollTarget()), [scrollTarget])
  /** How far the reader is below the top of the feed, in px. */
  const depth = React.useCallback(() => {
    const root = rootRef.current
    if (!root) return Infinity
    if (scrollTarget === "self") return root.scrollTop
    const box = scroller()
    return (box ? box.getBoundingClientRect().top : 0) + topOffset - root.getBoundingClientRect().top
  }, [scrollTarget, scroller, topOffset])

  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement)

  const { queued, visible } = splitArrivals(items, getKey, shown)
  const count = queued.length
  const text = fill(count === 1 ? labelOne : label, count)
  const queuedKeys = queued.map(getKey).join("\n")
  // Keep the last count on the pill while it fades out after a tap.
  const pillText = React.useRef(text)
  if (count) pillText.current = text

  const reveal = React.useCallback((keys: string[], scroll: boolean) => {
    scrollUp.current = scroll
    setShown((current) => new Set([...current, ...keys]))
    setFresh(new Set(keys))
  }, [])

  // At the top and not pressing anything: new items can go straight in.
  React.useEffect(() => {
    const root = rootRef.current
    if (!queuedKeys || !root || pressing || depth() > topThreshold) return
    reveal(queuedKeys.split("\n"), false)
  }, [queuedKeys, pressing, topThreshold, reveal, depth])

  // Scrolling back up to the top by hand lets held posts in, as if the pill had been tapped.
  const onReaderScroll = () => {
    if (count && !pressing && depth() <= topThreshold) reveal(queued.map(getKey), false)
  }
  const latestScroll = React.useRef(onReaderScroll)
  latestScroll.current = onReaderScroll
  React.useEffect(() => {
    if (scrollTarget === "self") return
    const target: HTMLElement | Window = scroller() ?? window
    const listener = () => latestScroll.current()
    target.addEventListener("scroll", listener, { passive: true })
    return () => target.removeEventListener("scroll", listener)
  }, [scrollTarget, scroller])

  // A press holds insertions until just after it ends. The release listener is
  // attached in the handler itself, so even a very quick tap can't be missed.
  const releaseTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  React.useEffect(() => () => clearTimeout(releaseTimer.current), [])
  const hold = () => {
    clearTimeout(releaseTimer.current)
    setPressing(true)
    const release = () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
      releaseTimer.current = setTimeout(() => setPressing(false), 300)
    }
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
  }

  // After a tap on the pill, go to the top and put focus on the newest item.
  React.useLayoutEffect(() => {
    const root = rootRef.current
    if (!scrollUp.current || !root) return
    scrollUp.current = false
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    if (self) root.scrollTo({ top: 0, behavior })
    else {
      // Bring the feed's top under the sticky header, scrolling the page or ancestor rather than the feed.
      const box = scroller()
      const by = -depth()
      if (by < 0) (box ?? window).scrollBy({ top: by, behavior })
    }
    root.querySelector<HTMLElement>("[data-feed-key]")?.focus({ preventScroll: true })
  }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps

  // A count that grows while the pill is up gets a small pop; announcements wait for a burst to settle.
  React.useEffect(() => {
    if (count > lastCount.current && lastCount.current > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pillRef.current?.animate({ scale: [1, 1.08, 1] }, { duration: 200, easing: "ease-out" })
    }
    lastCount.current = count
    const timer = setTimeout(() => setAnnounced(count ? text : ""), 800)
    return () => clearTimeout(timer)
  }, [count, text])

  return (
    <div
      ref={rootRef}
      data-slot="new-content-pill"
      data-state={count ? "queued" : "live"}
      data-scroll={self ? "self" : "outer"}
      className={cn("relative", self && "overflow-y-auto overscroll-contain", className)}
      onPointerDown={(event) => {
        hold()
        onPointerDown?.(event)
      }}
      onScroll={(event) => {
        onScroll?.(event)
        if (self) onReaderScroll()
      }}
      {...props}
    >
      <style>{KEYFRAMES}</style>
      <div className="pointer-events-none sticky top-0 z-10 h-0" style={topOffset ? { top: topOffset } : undefined}>
        <div
          className={cn(
            "absolute inset-x-0 top-2 flex justify-center transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
            count ? "translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0",
          )}
        >
          <button
            ref={pillRef}
            type="button"
            onClick={() => reveal(queued.map(getKey), true)}
            className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-md outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowUp aria-hidden className="size-4" />
            {pillText.current}
          </button>
        </div>
      </div>
      <span role="status" className="sr-only">
        {announced}
      </span>
      {visible.map((item, index) => {
        const key = getKey(item)
        return (
          <div
            key={key}
            data-feed-key={key}
            tabIndex={-1}
            className={cn("outline-none", fresh.has(key) && "motion-safe:animate-[cui-new-content-pill-arrive_400ms_ease-out]")}
          >
            {renderItem(item, index)}
          </div>
        )
      })}
    </div>
  )
}
