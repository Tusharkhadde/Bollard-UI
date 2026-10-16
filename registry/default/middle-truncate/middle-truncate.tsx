"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Splits into user-perceived characters so emoji and accents are never cut in half. */
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

/** The tail that must survive: a file extension like ".pdf", otherwise 4 characters. */
const defaultTail = (text: string) => Math.max(4, text.match(/\.[a-z0-9]{1,5}$/i)?.[0].length ?? 0)

/** Keeps `keep` characters split between head and tail, never giving the tail less than `minTail`. */
function slice(chars: string[], keep: number, minTail: number, ellipsis: string) {
  if (keep >= chars.length) return chars.join("")
  const tail = Math.min(keep, Math.max(minTail, Math.floor(keep / 2)))
  return chars.slice(0, keep - tail).join("") + ellipsis + chars.slice(chars.length - tail).join("")
}

/** Character-count version for places without layout, e.g. "0x71C7656E…976F". */
export function middleTruncate(text: string, maxChars: number, ellipsis = "…") {
  const chars = graphemes(text)
  return slice(chars, Math.max(0, maxChars - 1), Math.min(defaultTail(text), maxChars - 1), ellipsis)
}

export interface MiddleTruncateProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The full text. It stays available to copy, `title` and screen readers. */
  value: string
  /** Characters always kept at the end. Defaults to the file extension, or 4. */
  minTail?: number
  /** Marker inserted where text is removed. */
  ellipsis?: string
}

/**
 * Truncates in the middle so the part that tells items apart stays visible:
 * invoice_2026_…_final_v3.pdf, 0x71C7…976F. Fits the real rendered width
 * (ResizeObserver plus canvas text measurement), shows the full value on
 * hover, and copies and announces the full text, never the ellipsis.
 */
export function MiddleTruncate({ value, minTail, ellipsis = "…", className, onCopy, ...props }: MiddleTruncateProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = React.useState(value)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const context = document.createElement("canvas").getContext("2d")
    if (!context) return
    const chars = graphemes(value)
    const tail = Math.min(minTail ?? defaultTail(value), chars.length)
    let frame = 0

    const fit = () => {
      const style = getComputedStyle(element)
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      if ("letterSpacing" in context) context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing
      const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + 0.5
      const fits = (text: string) => context.measureText(text).width <= available
      if (fits(value)) return setDisplay(value)
      // Binary search for the most characters that fit around the ellipsis.
      let [lo, hi] = [0, chars.length - 1]
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        if (fits(slice(chars, mid, tail, ellipsis))) lo = mid
        else hi = mid - 1
      }
      setDisplay(slice(chars, lo, tail, ellipsis))
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    void document.fonts?.ready.then(schedule)
    fit()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, minTail, ellipsis])

  return (
    <span
      ref={ref}
      data-slot="middle-truncate"
      title={display === value ? undefined : value}
      onCopy={(event) => {
        onCopy?.(event)
        // Copying the visible text would paste the ellipsis; hand over the real value instead.
        if (event.defaultPrevented || display === value) return
        event.preventDefault()
        event.clipboardData.setData("text/plain", value)
      }}
      className={cn("relative block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap", className)}
      {...props}
    >
      {display === value ? (
        value
      ) : (
        <>
          <span aria-hidden>{display}</span>
          <span className="sr-only">{value}</span>
        </>
      )}
    </span>
  )
}
