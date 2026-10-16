"use client"

import * as React from "react"
import { CalendarCheck, TriangleAlert } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

const DAY = 86_400_000

/** Parses `YYYY-MM-DD` into a UTC midnight Date, or null when it isn't a real calendar date. */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  // Date.UTC treats years 0-99 as 1900-1999; setUTCFullYear keeps "0026" as year 26.
  const date = new Date(Date.UTC(2000, m - 1, d))
  date.setUTCFullYear(y)
  return date.getUTCDate() === d && date.getUTCMonth() === m - 1 ? date : null
}

/** Formats a UTC Date as `YYYY-MM-DD`. */
export const toIsoDate = (date: Date) =>
  `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`

function withYear(date: Date, year: number) {
  const next = new Date(date)
  next.setUTCFullYear(year)
  return next.getUTCDate() === date.getUTCDate() ? next : null
}

export interface DateCheck {
  /** Whole days from today (negative in the past). */
  days: number
  /** What looks wrong, if anything. */
  problem?: "year" | "past" | "future" | "weekend"
  /** A likely intended date. */
  fix?: Date
}

/** Checks a date against today for a year typo, the wrong side of today, or a weekend. */
export function checkDate(
  date: Date,
  today: Date,
  { expect, maxYearsAway = 10, warnWeekends = false }: { expect?: "future" | "past"; maxYearsAway?: number; warnWeekends?: boolean } = {}
): DateCheck {
  const days = Math.round((date.getTime() - today.getTime()) / DAY)
  const year = date.getUTCFullYear()
  const current = today.getUTCFullYear()
  const fits = (d: Date) => {
    const diff = d.getTime() - today.getTime()
    return Math.abs(d.getUTCFullYear() - current) <= maxYearsAway && (expect === "future" ? diff >= 0 : expect === "past" ? diff <= 0 : true)
  }
  if (Math.abs(year - current) > maxYearsAway) {
    const digits = String(year).padStart(4, "0")
    const candidates = [
      Number(digits.slice(0, -2) + digits.slice(-1) + digits.slice(-2, -1)), // 2062 → 2026
      Math.floor(current / 100) * 100 + (year % 100), // 1926 or 0026 → 2026
      Number(digits[0] + digits[2] + digits[1] + digits.slice(3)), // 2206 → 2026
    ]
    const fix = candidates
      .map((y) => withYear(date, y))
      .filter((d): d is Date => !!d && fits(d))
      .sort((a, b) => Math.abs(a.getTime() - today.getTime()) - Math.abs(b.getTime() - today.getTime()))[0]
    return { days, problem: "year", fix }
  }
  if (expect === "future" && days < 0) {
    // A classic in December: picking January but leaving the old year.
    const next = withYear(date, year + 1)
    return { days, problem: "past", fix: next && next.getTime() - today.getTime() < 366 * DAY ? next : undefined }
  }
  if (expect === "past" && days > 0) {
    const last = withYear(date, year - 1)
    return { days, problem: "future", fix: last && today.getTime() - last.getTime() < 366 * DAY ? last : undefined }
  }
  const weekday = date.getUTCDay()
  if (warnWeekends && (weekday === 0 || weekday === 6)) {
    return { days, problem: "weekend", fix: new Date(date.getTime() + (weekday === 6 ? 2 : 1) * DAY) }
  }
  return { days }
}

export interface DateSanityInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Helper text shown before a date is picked. */
  hint?: string
  /** Controlled value as `YYYY-MM-DD`, or `""`. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with the `YYYY-MM-DD` value (or `""`). */
  onValueChange?: (value: string) => void
  /** Warn when the date is on the wrong side of today: `future` for bookings, `past` for a date of birth. */
  expect?: "future" | "past"
  /** Dates more than this many years from today are treated as a likely year typo. */
  maxYearsAway?: number
  /** Warn when the date falls on a Saturday or Sunday. */
  warnWeekends?: boolean
  /** "Today" as `YYYY-MM-DD`. Defaults to the user's local date once mounted. */
  today?: string
  /** Locale for the weekday and dates in messages. */
  locale?: string
  /** Override any text. Templates: `{weekday}` and `{relative}` in `readback`, `{date}` in the fix labels. */
  messages?: Partial<DateSanityMessages>
}

export interface DateSanityMessages {
  past: string
  future: string
  weekend: string
  year: (year: number, yearsAway: number, ahead: boolean) => string
  /** The line under the field: "That's a {weekday}, {relative}." */
  readback: string
  /** Fix button for a weekend: "Move to {date}". */
  moveFix: string
  /** Fix button for the other warnings: "Use {date}". */
  useFix: string
}

/**
 * Pairs each digit of `to` with a digit of `from` so a transposed year can be animated:
 * "2062" → "2026" keeps the 2 and 0 in place and swaps the 6 and the 2.
 */
export function digitMoves(from: string, to: string): { digit: string; source: number }[] {
  // Digits already in the right place stay; the rest borrow an unused matching digit, or are new (negative source).
  const sources = to.split("").map((digit, at) => (from[at] === digit ? at : null))
  const used = new Set(sources.filter((i): i is number => i !== null))
  return to.split("").map((digit, at) => {
    let source = sources[at]
    if (source === null) {
      source = from.split("").findIndex((d, i) => d === digit && !used.has(i) && to[i] !== d)
      if (source < 0) source = -1 - at
      else used.add(source)
    }
    return { digit, source }
  })
}

/** The typed year, then its digits sliding into the corrected year. Purely visual. */
function YearSwap({ from, to }: { from: string; to: string }) {
  const reduce = useReducedMotion()
  const [swapped, setSwapped] = React.useState(false)
  React.useEffect(() => {
    setSwapped(false)
    const timer = setTimeout(() => setSwapped(true), reduce ? 0 : 450)
    return () => clearTimeout(timer)
  }, [from, to, reduce])
  const digits = swapped ? digitMoves(from, to) : from.split("").map((digit, source) => ({ digit, source }))
  return (
    <LayoutGroup id={`year-${from}-${to}`}>
      <span aria-hidden className="inline-flex font-mono tabular-nums" onMouseEnter={() => !reduce && setSwapped((v) => !v)}>
        <AnimatePresence initial={false} mode="popLayout">
          {digits.map(({ digit, source }, at) => {
            const moved = swapped && source !== at
            return (
              <motion.span
                key={source}
                layout={!reduce}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={cn("inline-block", moved && "rounded-sm bg-amber-300/50 dark:bg-amber-400/25")}
              >
                {digit}
              </motion.span>
            )
          })}
        </AnimatePresence>
      </span>
    </LayoutGroup>
  )
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 dark:[color-scheme:dark] data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A native date input that reads the date back to you ("That's a Sunday, in
 * 3 weeks") and catches the classic slips: a year typo like 2062 or 1926, a
 * booking in the past (or a birthday in the future), an accidental weekend.
 * Each warning comes with a one-tap fix; a transposed year shows its digits sliding into place.
 */
export function DateSanityInput({
  label = "Date",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  expect,
  maxYearsAway = 10,
  warnWeekends = false,
  today: todayProp,
  locale = "en-IN",
  messages,
  id,
  className,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: DateSanityInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [localToday, setLocalToday] = React.useState<string>()
  const [settled, setSettled] = React.useState(defaultValue)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const inputRef = React.useRef<HTMLInputElement>(null)
  const iso = value ?? inner

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    if (todayProp) return
    const now = new Date()
    setLocalToday(toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))))
  }, [todayProp])

  // Browsers emit partial years (0002, 0020...) while typing, so wait for a pause.
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(iso), 600)
    return () => clearTimeout(timer)
  }, [iso])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const date = settled === iso ? parseIsoDate(iso) : null
  const today = parseIsoDate(todayProp ?? localToday ?? "")
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts }).format(d)
  const long = (d: Date) => fmt(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" })

  let echo = ""
  let warning: { text: string; fix?: Date; fixLabel: string; years?: [string, string] } | null = null
  if (date && today) {
    const { days, problem, fix } = checkDate(date, today, { expect, maxYearsAway, warnWeekends })
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    const away = Math.abs(days)
    const relative =
      away < 14 ? rtf.format(days, "day")
      : away < 60 ? rtf.format(Math.round(days / 7), "week")
      : away < 730 ? rtf.format(Math.round(days / 30.44), "month")
      : rtf.format(Math.round(days / 365.25), "year")
    echo = fill(messages?.readback ?? "That's a {weekday}, {relative}.", { weekday: fmt(date, { weekday: "long" }), relative })
    if (problem) {
      const year = date.getUTCFullYear()
      const yearsAway = Math.abs(year - today.getUTCFullYear())
      const text = {
        year: messages?.year?.(year, yearsAway, days > 0) ?? `${year} is ${yearsAway} years ${days > 0 ? "from now" : "ago"}. Typo in the year?`,
        past: messages?.past ?? "This date is in the past.",
        future: messages?.future ?? "This date is in the future.",
        weekend: messages?.weekend ?? "That's a weekend, when most offices are closed.",
      }[problem]
      const fixText = problem === "weekend" ? (messages?.moveFix ?? "Move to {date}") : (messages?.useFix ?? "Use {date}")
      warning = {
        text,
        fix,
        fixLabel: fix ? fill(fixText, { date: long(fix) }) : "",
        years: problem === "year" && fix ? [String(year).padStart(4, "0"), String(fix.getUTCFullYear()).padStart(4, "0")] : undefined,
      }
    }
  }

  return (
    <div data-slot="date-sanity-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="date"
        value={iso}
        onChange={(event) => update(event.target.value)}
        onBlur={(event) => {
          setSettled(iso)
          onBlur?.(event)
        }}
        aria-describedby={cn(`${inputId}-status`, describedBy)}
        data-warning={warning ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="min-h-6 text-xs">
        {echo ? (
          <p className="flex gap-1.5 text-muted-foreground">
            <span className="flex h-6 shrink-0 items-center">
              <CalendarCheck aria-hidden className="size-3.5" />
            </span>
            <span className="py-1">{echo}</span>
          </p>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
        {warning && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{warning.text}</span>
              {warning.fix && (
                <button
                  type="button"
                  onClick={() => {
                    if (!warning?.fix) return
                    const next = toIsoDate(warning.fix)
                    update(next)
                    setSettled(next)
                    inputRef.current?.focus()
                  }}
                  className={fixClass}
                >
                  {warning.years && (
                    <>
                      <YearSwap from={warning.years[0]} to={warning.years[1]} />
                      <span aria-hidden className="text-amber-700/60 dark:text-amber-300/60">·</span>
                    </>
                  )}
                  {warning.fixLabel}
                </button>
              )}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
