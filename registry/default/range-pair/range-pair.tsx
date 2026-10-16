"use client"

import * as React from "react"
import { ArrowLeftRight, ArrowRight, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const DAY = 86_400_000

export type RangeKind = "number" | "date"

/** Both ends as typed: numbers as text, dates as `YYYY-MM-DD`. Empty string means not set. */
export interface RangeValue {
  from: string
  to: string
}

/** Reads one end: a number, or a `YYYY-MM-DD` date as UTC milliseconds. */
export function readRangeEnd(kind: RangeKind, text: string): number | null {
  if (!text.trim()) return null
  if (kind === "number") {
    const n = Number(text.replace(/[,\s]/g, ""))
    return Number.isFinite(n) ? n : null
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Date(time).getUTCDate() === Number(match[3]) ? time : null
}

const shiftYear = (iso: string, year: number) => `${String(year).padStart(4, "0")}${iso.slice(4)}`

export interface RangeCheck {
  /** `to - from`, in the field's units (days for dates). */
  span: number
  problem?: "reversed" | "empty" | "huge"
  /** The likelier repair: next year for a Dec → Jan range, the year typo for a huge one, a dropped zero. */
  fix?: RangeValue
  /** Which end `fix` changes. */
  fixSide?: "from" | "to"
}

/**
 * Checks a range: reversed ends, an empty range (equal ends with an exclusive
 * end), and a span over `maxSpan`, with a repair when one is likely.
 */
export function checkRange(
  kind: RangeKind,
  value: RangeValue,
  { maxSpan, exclusiveEnd = false }: { maxSpan?: number; exclusiveEnd?: boolean } = {}
): RangeCheck | null {
  const a = readRangeEnd(kind, value.from)
  const b = readRangeEnd(kind, value.to)
  if (a === null || b === null) return null
  const unit = kind === "date" ? DAY : 1
  const span = (b - a) / unit
  const fits = (from: number, to: number) => to >= from && (maxSpan === undefined || (to - from) / unit <= maxSpan)

  if (span < 0) {
    // 28 Dec → 3 Jan in the same year almost always means January of next year.
    if (kind === "date") {
      const to = shiftYear(value.to, Number(value.from.slice(0, 4)) + 1)
      const next = readRangeEnd(kind, to)
      if (next !== null && fits(a, next) && next - a < a - b) return { span, problem: "reversed", fix: { ...value, to }, fixSide: "to" }
    }
    return { span, problem: "reversed" }
  }
  if (span === 0 && exclusiveEnd) return { span, problem: "empty" }
  if (maxSpan === undefined || span <= maxSpan) return { span }

  if (kind === "date" && value.from.slice(0, 4) !== value.to.slice(0, 4)) {
    const to = shiftYear(value.to, Number(value.from.slice(0, 4)))
    const from = shiftYear(value.from, Number(value.to.slice(0, 4)))
    const toTime = readRangeEnd(kind, to)
    const fromTime = readRangeEnd(kind, from)
    if (toTime !== null && fits(a, toTime)) return { span, problem: "huge", fix: { ...value, to }, fixSide: "to" }
    if (fromTime !== null && fits(fromTime, b)) return { span, problem: "huge", fix: { ...value, from }, fixSide: "from" }
  }
  if (kind === "number" && b % 10 === 0 && fits(a, b / 10)) return { span, problem: "huge", fix: { ...value, to: String(b / 10) }, fixSide: "to" }
  return { span, problem: "huge" }
}

export interface RangePairProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Numbers or dates. */
  kind?: RangeKind
  /** Legend for the pair. */
  label?: string
  /** Labels of the two ends. Default "Min"/"Max" for numbers, "From"/"To" for dates. */
  fromLabel?: string
  /** Label for the end of the range. */
  toLabel?: string
  /** Controlled ends. */
  value?: RangeValue
  /** Initial ends when uncontrolled. */
  defaultValue?: RangeValue
  /** Called whenever either end changes. */
  onValueChange?: (value: RangeValue) => void
  /** Spans above this (days for dates) get a "longer than expected" warning. */
  maxSpan?: number
  /** The end is not part of the range (hotel nights, `[from, to)`), so equal ends mean it's empty. */
  exclusiveEnd?: boolean
  /** BCP 47 locale for numbers and dates. */
  locale?: string
  /** Pause in ms before checking while typing. */
  delay?: number
  /** Shown when the ends are reversed. */
  reversedMessage?: string
  /** Shown when an exclusive range is empty. */
  emptyMessage?: string
  /** Receives the formatted span, e.g. "1 year 31 days" or "49,500". */
  hugeMessage?: (span: string) => string
  /** Button text to swap the ends. */
  swapLabel?: string
  /** Fix button text; receives which end changes and its formatted new value. */
  fixLabel?: (side: "from" | "to", value: string) => string
  /** Readback of the span; receives it formatted. */
  spanText?: (span: string) => string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs tabular-nums transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 dark:[color-scheme:dark] data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A from/to (or min/max) pair that catches a reversed range with a one-tap swap,
 * and knows the classic date slip: 28 Dec → 3 Jan in the same year, fixed by
 * moving the end into next year rather than swapping. It also warns when equal
 * ends leave an exclusive range empty, and when the span is huge (a year typo,
 * an extra zero), and reads the span back so the size of the range is obvious.
 */
export function RangePair({
  kind = "number",
  label,
  fromLabel = kind === "date" ? "From" : "Min",
  toLabel = kind === "date" ? "To" : "Max",
  value,
  defaultValue = { from: "", to: "" },
  onValueChange,
  maxSpan,
  exclusiveEnd = false,
  locale = "en-IN",
  delay = 700,
  reversedMessage = kind === "date" ? "This ends before it starts." : "The max is lower than the min.",
  emptyMessage = "Both ends are the same, so nothing falls in this range.",
  hugeMessage = (span) => `That's ${span}, longer than expected.`,
  swapLabel = "Swap",
  fixLabel = (side, v) => (kind === "date" ? `${side === "to" ? "End" : "Start"} ${v}` : `Use ${v}`),
  spanText = (span) => (kind === "date" ? span : `Range of ${span}`),
  className,
  ...props
}: RangePairProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const range = value ?? inner
  const key = `${range.from}|${range.to}`
  const [settled, setSettled] = React.useState(key)
  const fromRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(key), delay)
    return () => clearTimeout(timer)
  }, [key, delay])

  const update = (next: RangeValue) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const apply = (next: RangeValue) => {
    update(next)
    setSettled(`${next.from}|${next.to}`)
    fromRef.current?.focus()
  }

  const check = settled === key ? checkRange(kind, range, { maxSpan, exclusiveEnd }) : null
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(n)
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(readRangeEnd("date", iso) ?? 0)
  const days = (n: number) => {
    const count = Math.abs(n) + (exclusiveEnd ? 0 : 1)
    const years = Math.floor(count / 365)
    const rest = count % 365
    const part = (v: number, word: string) => `${num(v)} ${word}${v === 1 ? "" : "s"}`
    return years ? [part(years, "year"), rest ? part(rest, "day") : ""].filter(Boolean).join(" ") : part(count, exclusiveEnd ? "night" : "day")
  }
  const spanString = check ? (kind === "date" ? days(check.span) : num(Math.abs(check.span))) : ""

  const message = !check?.problem
    ? ""
    : check.problem === "reversed" ? reversedMessage : check.problem === "empty" ? emptyMessage : hugeMessage(spanString)
  const fixValue = check?.fix && check.fixSide ? check.fix[check.fixSide] : ""
  const flagged = (side: "from" | "to") =>
    check?.problem === "reversed" || check?.problem === "empty" || (check?.problem === "huge" && (check.fixSide ?? "to") === side)

  const end = (side: "from" | "to", text: string, ref?: React.Ref<HTMLInputElement>) => (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={`${autoId}-${side}`} className="w-fit text-sm font-medium">
        {text}
      </label>
      <input
        ref={ref}
        id={`${autoId}-${side}`}
        type={kind === "date" ? "date" : "text"}
        inputMode={kind === "number" ? "decimal" : undefined}
        autoComplete="off"
        value={range[side]}
        onChange={(event) => update({ ...range, [side]: event.target.value })}
        onBlur={() => setSettled(key)}
        aria-describedby={`${autoId}-status`}
        data-warning={flagged(side) ? "" : undefined}
        className={fieldClass}
      />
    </div>
  )

  return (
    <fieldset data-slot="range-pair" className={cn("@container grid w-full min-w-0 max-w-sm gap-1.5", className)} {...props}>
      {label && <legend className="mb-1.5 text-sm font-medium">{label}</legend>}
      <div className="grid gap-3 @xs:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @xs:items-end">
        {end("from", fromLabel, fromRef)}
        <span aria-hidden className="hidden h-9 items-center text-muted-foreground @xs:flex">
          {check?.problem === "reversed" ? <ArrowLeftRight className="size-4 text-amber-600 dark:text-amber-400" /> : <ArrowRight className="size-4" />}
        </span>
        {end("to", toLabel)}
      </div>
      <div id={`${autoId}-status`} aria-live="polite" className="min-h-6 text-xs">
        {message ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{message}</span>
              {check?.fix && (
                <button type="button" onClick={() => check.fix && apply(check.fix)} className={fixClass}>
                  {fixLabel(check.fixSide ?? "to", kind === "date" ? date(fixValue) : num(Number(fixValue)))}
                </button>
              )}
              {check?.problem === "reversed" && (
                <button type="button" onClick={() => apply({ from: range.to, to: range.from })} className={fixClass}>
                  <ArrowLeftRight aria-hidden className="size-3.5" />
                  {swapLabel}
                </button>
              )}
            </span>
          </p>
        ) : check ? (
          <p className="py-1 text-muted-foreground tabular-nums">
            {spanText(spanString)}
            {kind === "date" && ` · ${date(range.from)} → ${date(range.to)}`}
          </p>
        ) : null}
      </div>
    </fieldset>
  )
}
