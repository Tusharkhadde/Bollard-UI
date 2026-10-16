"use client"

import * as React from "react"
import { Check, CircleAlert, Copy, Eraser, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** Zero-width, BOM, no-break space, soft hyphen, bidi controls and tag characters: invisible but copied. */
const HIDDEN = "\\u200B-\\u200D\\u2060\\uFEFF\\u00AD\\u202A-\\u202E\\u2066-\\u2069\\u{E0000}-\\u{E007F}"
const INVISIBLE = new RegExp(`[${HIDDEN}\\u00A0]`, "gu")
const STRIP = new RegExp(`[${HIDDEN}]`, "gu")
const SPLIT = new RegExp(`([${HIDDEN}\\u00A0])`, "u")
const MARKERS: Record<string, string> = { " ": "␣", "\n": "⏎", "\t": "⇥", "\u00A0": "⍽", "\u200B": "∅", "\uFEFF": "∅" }

/** "₹1,23,456.50" → "123456.50", "4242 4242 4242 4242" → "4242424242424242". Other text is returned unchanged. */
export function toPlainText(value: string) {
  const t = value.trim()
  if (!/\d/.test(t) || !/^[+\-−]?[₹$€£¥]?\s?[\d\s,.'’_]+%?$/.test(t)) return value
  const sign = /^[-−]/.test(t) ? "-" : t.startsWith("+") ? "+" : ""
  let body = t.replace(/[^\d.]/g, "")
  if (body.split(".").length > 2) body = body.replace(/\./g, "")
  return sign + body
}

/** Trims the ends, drops zero-width characters and turns no-break spaces into plain spaces. */
export function cleanCopyText(value: string) {
  return value.trim().replace(STRIP, "").replace(/\u00A0/g, " ")
}

/** What's wrong with a value before it hits the clipboard, e.g. "1 leading and 1 trailing whitespace". */
export function describeCopyProblems(value: string) {
  const leading = value.length - value.trimStart().length
  const trailing = value.trim() ? value.length - value.trimEnd().length : 0
  const invisible = (value.match(INVISIBLE) ?? []).length
  const whitespace = [leading > 0 && `${leading} leading`, trailing > 0 && `${trailing} trailing`].filter(Boolean).join(" and ")
  return [whitespace && `${whitespace} whitespace`, invisible > 0 && `${invisible} invisible character${invisible === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(", ")
}

function middle(text: string, max: number) {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  const head = Math.ceil((max - 1) / 2)
  return `${chars.slice(0, head).join("")}…${chars.slice(chars.length - (max - 1 - head)).join("")}`
}

/** Renders leading/trailing whitespace and invisible characters as visible markers. */
function Visible({ text }: { text: string }) {
  const lead = text.match(/^\s*/)![0]
  const trail = text.length > lead.length ? text.match(/\s*$/)![0] : ""
  const core = text.slice(lead.length, text.length - trail.length)
  const mark = (ws: string) =>
    ws && (
      <span className="rounded-sm bg-amber-200/70 px-px text-amber-900 dark:bg-amber-500/30 dark:text-amber-100">
        {Array.from(ws, (c) => MARKERS[c] ?? "·").join("")}
      </span>
    )
  return (
    <>
      {mark(lead)}
      {core.split(SPLIT).map((part, i) => (
        <React.Fragment key={i}>{i % 2 ? mark(part) : part}</React.Fragment>
      ))}
      {mark(trail)}
    </>
  )
}

export interface CopyConfirmProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onClick" | "onCopy"> {
  /** The exact value to copy. */
  value: string
  /** Accessible name when the button has no visible text, e.g. "Copy account number". */
  label?: string
  /** How to turn a formatted value into plain text. Defaults to stripping number formatting. */
  toPlain?: (value: string) => string
  /** Longest preview before it is truncated in the middle. */
  previewLength?: number
  /** Called with the text that actually landed on the clipboard. */
  onCopy?: (text: string) => void
  /** Heading of the confirmation. */
  copiedLabel?: string
  /** Shown instead of copying an empty value. */
  emptyLabel?: string
  /** Shown when the browser blocks clipboard access. */
  blockedLabel?: string
  /** Button that re-copies without stray whitespace or invisible characters. */
  cleanLabel?: string
  /** Toggle that switches between plain and formatted copy. */
  plainLabel?: string
  /** Note beside "Copied" when the plain version was copied. */
  asPlainLabel?: string
  /** Lead-in to the list of problems, e.g. "Includes 1 trailing whitespace". */
  includesLabel?: string
}

/**
 * A copy button whose feedback shows exactly what landed on the clipboard,
 * refuses to copy an empty value, flags stray whitespace and invisible
 * characters with a one-tap clean copy, and copies formatted numbers as
 * plain text (1,23,456 → 123456) with a toggle back. Native button props
 * and `className` go to the button.
 */
export function CopyConfirm({
  value,
  children,
  label = "Copy",
  toPlain = toPlainText,
  previewLength = 32,
  onCopy,
  copiedLabel = "Copied",
  emptyLabel = "Nothing to copy. The value is empty.",
  blockedLabel = "Couldn't copy. Your browser blocked clipboard access.",
  cleanLabel = "Copy cleaned",
  plainLabel = "Copy as plain text",
  asPlainLabel = "as plain text",
  includesLabel = "Includes",
  className,
  ...props
}: CopyConfirmProps) {
  const [copied, setCopied] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string>()
  const [asPlain, setAsPlain] = React.useState(true)
  const [paused, setPaused] = React.useState(false)
  const [shift, setShift] = React.useState(0)
  const feedbackRef = React.useRef<HTMLSpanElement>(null)
  const feedbackId = React.useId()
  const plain = toPlain(value)
  const formatted = plain !== value
  const problems = describeCopyProblems(value)
  const warn = copied !== null && copied === value && problems !== ""
  const open = copied !== null || !!error

  const close = () => {
    setCopied(null)
    setError(undefined)
    setPaused(false)
  }

  // Auto-dismiss, held while the pointer or focus is inside so "Copy cleaned" can't vanish mid-reach.
  React.useEffect(() => {
    if (!open || paused) return
    const timer = setTimeout(() => {
      setCopied(null)
      setError(undefined)
    }, warn ? 6000 : 2200)
    return () => clearTimeout(timer)
  }, [open, paused, warn, copied, error])

  // Nudge the feedback sideways so it stays inside the viewport on narrow screens.
  React.useLayoutEffect(() => {
    const el = feedbackRef.current
    if (!open || !el) return setShift(0)
    // Subtract any shift already applied, so we measure from the unshifted spot.
    const base = el.getBoundingClientRect().left - (new DOMMatrixReadOnly(getComputedStyle(el).transform).m41 || 0)
    const width = el.firstElementChild?.getBoundingClientRect().width ?? 0
    setShift(Math.max(8 - base, Math.min(0, window.innerWidth - 8 - (base + width))))
  }, [open, copied, error])

  const write = async (text: string) => {
    if (!text.trim()) {
      setCopied(null)
      return setError(emptyLabel)
    }
    try {
      await navigator.clipboard.writeText(text)
      setError(undefined)
      setCopied(text)
      onCopy?.(text)
    } catch {
      setCopied(null)
      setError(blockedLabel)
    }
  }

  const copyDefault = (usePlain = asPlain) => write(formatted && usePlain ? plain : value)

  return (
    <span
      data-slot="copy-confirm"
      className="relative inline-flex"
      onKeyDown={(event) => event.key === "Escape" && open && close()}
    >
      <button
        type="button"
        aria-label={children ? undefined : label}
        aria-describedby={open ? feedbackId : undefined}
        onClick={() => void copyDefault()}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-2 rounded-md border bg-background text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
          children ? "px-3" : "w-8",
          className
        )}
        {...props}
      >
        {copied !== null ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {children}
      </button>

      <span
        ref={feedbackRef}
        id={feedbackId}
        aria-live="polite"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setPaused(false)}
        style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        className="absolute top-full left-0 z-50 mt-1.5"
      >
        {error && (
          <span className="flex w-max max-w-72 items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950 shadow-md dark:border-red-900 dark:bg-red-950 dark:text-red-50">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
            {error}
          </span>
        )}
        {copied !== null && (
          <span className="flex w-max max-w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md">
            <span className="flex items-center gap-2 font-medium">
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              {copiedLabel}
              {formatted && copied === plain && <span className="font-normal text-muted-foreground">{asPlainLabel}</span>}
            </span>
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs break-all whitespace-pre-wrap" title={copied}>
              <Visible text={middle(copied, previewLength)} />
            </code>
            {warn && (
              <span className="flex flex-col items-start gap-2">
                <span className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {includesLabel} {problems}
                </span>
                <button
                  type="button"
                  onClick={() => void write(cleanCopyText(value))}
                  className="inline-flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Eraser className="size-4" aria-hidden />
                  {cleanLabel}
                </button>
              </span>
            )}
            {formatted && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={asPlain}
                  onChange={(event) => {
                    setAsPlain(event.target.checked)
                    void copyDefault(event.target.checked)
                  }}
                  className="size-3.5 accent-(--primary)"
                />
                {plainLabel} ({middle(plain, 18)})
              </label>
            )}
          </span>
        )}
      </span>
    </span>
  )
}
