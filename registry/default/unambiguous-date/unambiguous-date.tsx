"use client"

import * as React from "react"
import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type DateOrder = "DMY" | "MDY" | "YMD"

export interface DateReading {
  order: DateOrder
  /** Local midnight of the calendar date. */
  date: Date
  /** `YYYY-MM-DD`, ready for `<time dateTime>` or an API. */
  iso: string
}

export interface ParsedDate {
  input: string
  /** Every valid calendar reading of the input. Empty when it isn't a numeric date. */
  readings: DateReading[]
  /** True when the input reads as two different dates. */
  ambiguous: boolean
}

const pad = (n: number) => String(n).padStart(2, "0")
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function makeReading(order: DateOrder, year: number, month: number, day: number): DateReading | null {
  const date = new Date(year, month - 1, day)
  // Rejects 31/02 and friends, which Date would silently roll into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return { order, date, iso: toIso(date) }
}

/**
 * Reads a numeric date string every way it could be meant. `03/10/2026`
 * returns both 3 Oct (DD/MM) and 10 Mar (MM/DD); `25/12/2026` returns one;
 * `2026-10-03` is year-first and is read as a local calendar date (not UTC
 * midnight, which shows as the day before west of Greenwich). Two-digit
 * years map to 1951–2050.
 */
export function parseAmbiguousDate(input: string): ParsedDate {
  const text = input.trim()
  const ymd = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (ymd) {
    const reading = makeReading("YMD", +ymd[1], +ymd[2], +ymd[3])
    return { input, readings: reading ? [reading] : [], ambiguous: false }
  }
  const parts = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/)
  if (!parts) return { input, readings: [], ambiguous: false }
  const [a, b, rawYear] = [+parts[1], +parts[2], +parts[3]]
  const year = parts[3].length === 2 ? (rawYear > 50 ? 1900 : 2000) + rawYear : rawYear
  const readings = [makeReading("DMY", year, b, a), makeReading("MDY", year, a, b)].filter(
    (r): r is DateReading => r !== null,
  )
  const unique = readings.filter((r, i) => readings.findIndex((o) => o.iso === r.iso) === i)
  return { input, readings: unique, ambiguous: unique.length > 1 }
}

/** "3 Oct 2026", always day, worded month, year, whatever the locale's usual order. */
export function formatUnambiguous(date: Date, locale = "en", weekday = false) {
  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: weekday ? "short" : undefined,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
  return `${weekday ? `${get("weekday")}, ` : ""}${get("day")} ${get("month")} ${get("year")}`
}

function relativeDays(date: Date, now: Date, locale: string) {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((start(date) - start(now)) / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const abs = Math.abs(days)
  if (abs < 14) return rtf.format(days, "day")
  if (abs < 60) return rtf.format(Math.round(days / 7), "week")
  if (abs < 730) return rtf.format(Math.round(days / 30.44), "month")
  return rtf.format(Math.round(days / 365.25), "year")
}

/** The pressed button unmounts once a choice is made or undone, so move focus to its counterpart. */
function refocus(from: HTMLElement, selector: string) {
  const root = from.closest("[data-slot=unambiguous-date]")
  requestAnimationFrame(() => root?.querySelector<HTMLElement>(selector)?.focus())
}

const READING_NAMES: Record<DateOrder, string> = { DMY: "day/month", MDY: "month/day", YMD: "year-month-day" }

export interface UnambiguousDateProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** A Date, an ISO string, or a numeric string like "03/10/2026". */
  value: Date | string
  /** Which reading to show first when a numeric string is ambiguous. */
  prefer?: "DMY" | "MDY"
  /** Reference time for "in 5 days". Defaults to the client clock after mount. */
  now?: Date
  /** Locale for month and relative wording. The day-month-year order is fixed. */
  locale?: string
  /** Prefix the weekday: "Sat, 3 Oct 2026". */
  showWeekday?: boolean
  /** Called when the user picks a reading for an ambiguous input, or with `null` when they undo it. */
  onResolve?: (reading: DateReading | null) => void
  /**
   * The reading already chosen for this source, e.g. the order a whole CSV column was confirmed in.
   * When set, ambiguous values use it without asking. Pair with `onResolve` to remember a choice.
   */
  order?: "DMY" | "MDY" | null
  /** Shown when the value isn't a date. */
  invalidMessage?: string
  /** `{order}` is a reading name. */
  readAsText?: string
  changeLabel?: string
  /** `{input}` and `{date}` are filled in. */
  alsoText?: string
  /** Names of each reading, e.g. `{ DMY: "day/month" }`. */
  readingNames?: Partial<Record<DateOrder, string>>
}

/**
 * Shows a date so it can't be misread across locales: the month as a word,
 * the distance from today, and a machine-readable `<time>`. When the input
 * is a numeric string that reads two ways (03/10/2026), it says so and lets
 * the user pick the right reading in one tap.
 */
export function UnambiguousDate({
  value,
  prefer = "DMY",
  now,
  locale = "en",
  showWeekday = false,
  onResolve,
  order,
  invalidMessage = "isn’t a date",
  readAsText = "read as {order}",
  changeLabel = "change",
  alsoText = "“{input}” could also mean {date}.",
  readingNames,
  className,
  ...props
}: UnambiguousDateProps) {
  // The client clock is read after mount so server and client render the same markup.
  const [clientNow, setClientNow] = React.useState<Date | null>(null)
  // A choice belongs to the text it was made for, so typing a new value clears it without an effect.
  const [choice, setChoice] = React.useState<{ input: string; order: DateOrder } | null>(null)
  const clock = now ?? clientNow

  React.useEffect(() => {
    if (now) return
    setClientNow(new Date())
    const timer = setInterval(() => setClientNow(new Date()), 3_600_000)
    return () => clearInterval(timer)
  }, [now])

  const parsed = typeof value === "string" ? parseAmbiguousDate(value) : null
  const controlled = order !== undefined
  const chosen = controlled ? order : choice && choice.input === value ? choice.order : null
  const readingName = { ...READING_NAMES, ...readingNames }

  const readings = parsed?.readings ?? []
  const fallback = typeof value === "string" ? new Date(value) : value
  const reading = readings.find((r) => r.order === chosen) ?? readings.find((r) => r.order === prefer) ?? readings[0]
  const date = reading?.date ?? fallback

  if (Number.isNaN(date.getTime())) {
    return (
      <span data-slot="unambiguous-date" aria-live="polite" className={cn("text-sm text-destructive", className)} {...props}>
        “{String(value)}” {invalidMessage}
      </span>
    )
  }

  const warn = !!parsed?.ambiguous && !chosen
  // Say how the input was read whenever it wasn't the reading people expect by default.
  const readAs = reading && reading.order !== "YMD" && (chosen !== null || reading.order !== prefer)
  const alternative = readings.find((r) => r !== reading)
  const full = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date)

  return (
    <span data-slot="unambiguous-date" className={cn("inline-flex flex-col items-start gap-1.5", className)} {...props}>
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        <time dateTime={reading?.iso ?? toIso(date)} title={full} className="font-medium tabular-nums">
          {formatUnambiguous(date, locale, showWeekday)}
        </time>
        {clock && <span className="text-sm text-muted-foreground">{relativeDays(date, clock, locale)}</span>}
        {readAs && (
          <span className="text-xs text-muted-foreground">
            {readAsText.replace("{order}", readingName[reading.order])}
            {chosen && parsed?.ambiguous && (
              <>
                {" · "}
                <button
                  type="button"
                  data-change=""
                  onClick={(event) => {
                    refocus(event.currentTarget, "[data-reading]")
                    setChoice(null)
                    onResolve?.(null)
                  }}
                  className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {changeLabel}
                </button>
              </>
            )}
          </span>
        )}
      </span>
      <span aria-live="polite">
        {warn && alternative && reading && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            <span>
              {alsoText.replace("{input}", parsed.input).replace("{date}", formatUnambiguous(alternative.date, locale))}
            </span>
            {[reading, alternative].map((r) => (
              <button
                key={r.order}
                type="button"
                data-reading={r.order}
                onClick={(event) => {
                  refocus(event.currentTarget, "[data-change]")
                  setChoice({ input: parsed.input, order: r.order })
                  onResolve?.(r)
                }}
                className="rounded border border-amber-300 bg-background px-1.5 py-0.5 font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-800"
              >
                {formatUnambiguous(r.date, locale)} ({readingName[r.order]})
              </button>
            ))}
          </span>
        )}
      </span>
    </span>
  )
}
