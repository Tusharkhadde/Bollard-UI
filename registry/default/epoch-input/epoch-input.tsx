"use client"

// Bollard UI — epoch-input · MIT licence · https://bollard-ui.vercel.app/components/epoch-input

import * as React from "react"
import { Check, CircleAlert, CircleCheck, Clock, Copy, Info, TriangleAlert } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { checkTimestamp, cleanTimestamp, readTimestamp, toUnit, type EpochUnit, type TimestampIssue } from "@/registry/default/epoch-input/epoch"

export { checkTimestamp, cleanTimestamp, excelToMs, formatOffset, readIso, readNumber, readTimestamp, toUnit, wallToInstant, zoneOffset, type EpochUnit, type ReadingKind, type TimestampIssue, type TimestampIssueKind, type TimestampOptions, type TimestampReading } from "@/registry/default/epoch-input/epoch"

export const EPOCH_INPUT_MESSAGES = {
  label: "Timestamp",
  placeholder: "1760400000 or 2026-10-14T09:00:00Z",
  readback: "What it means",
  when: "When",
  utc: "UTC",
  readAs: "Read as",
  copy: "Copy {format}",
  copied: "Copied",
  seconds: "seconds",
  milliseconds: "milliseconds",
  iso: "ISO",
  "read-s": "Unix seconds ({digits} digits)",
  "read-ms": "Unix milliseconds ({digits} digits)",
  "read-us": "Unix microseconds ({digits} digits)",
  "read-ns": "Unix nanoseconds ({digits} digits)",
  "read-excel": "Excel / Sheets date serial",
  "read-filetime": "Windows FILETIME (100 ns since 1601)",
  "read-ticks": ".NET ticks (100 ns since year 1)",
  "read-iso": "ISO 8601 date",
  ok: "Reads the same everywhere.",
  toFix: "{count} to fix",
  toReview: "{count} to review",
  invalid: "“{value}” isn't a timestamp or an ISO date (like 2026-10-14T09:00:00Z).",
  "impossible-date": "{value} doesn't exist. Some browsers roll it into the next month, others reject it.",
  implausible: "{value} isn't a time between {min} and {max} in seconds, milliseconds, microseconds or nanoseconds.",
  "wrong-unit": "This is in {found}, but the field stores {expected}. Saved as is, it means {asIs}.",
  "wrong-unit-far": "This is in {found}, but the field stores {expected}. Saved as is, it's a date no system can show.",
  excel: "{value} looks like a spreadsheet date serial ({date}), not a Unix timestamp.",
  filetime: "That's a Windows FILETIME ({date}), not a Unix timestamp.",
  ticks: "That's a .NET DateTime tick count ({date}), not a Unix timestamp.",
  "no-offset": "No time zone. JavaScript reads this as the viewer's local time, most servers and databases as UTC ({utc}), so it lands at different moments.",
  "date-only": "A date with no time is read as midnight UTC, which is {local} in {zone}.",
  y2038: "Past 03:14:07 UTC on 19 Jan 2038: a signed 32-bit time (MySQL TIMESTAMP, older C time_t) can't hold it.",
  cleaned: "Separators, quotes or a trailing n came along. Store just {value}.",
  "near-1970": "{value} reads as {date}, moments after the 1970 epoch. That's rarely a real timestamp: is it a year, a date or the wrong unit?",
  "fix-convert": "Use {value}",
  "fix-utc": "It's UTC (add Z)",
  "fix-local": "It's {zone} time ({offset})",
  "fix-clean": "Clean it",
}
export type EpochInputMessages = typeof EPOCH_INPUT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { error: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { error: CircleAlert, warning: TriangleAlert, info: Info }
const fixClass = (error: boolean) =>
  cn(
    "inline-flex min-h-6 items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )

function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

function formatter(locale: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" })
  } catch {
    return new Intl.DateTimeFormat(locale, { timeZone: "UTC", dateStyle: "medium", timeStyle: "long" })
  }
}

function relative(ms: number, now: number, locale: string) {
  const diff = ms - now
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31_557_600_000], ["month", 2_629_800_000], ["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000]]
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  for (const [unit, size] of steps) if (Math.abs(diff) >= size) return format.format(Math.round(diff / size), unit)
  return format.format(Math.round(diff / 1000), "second")
}

export interface EpochInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every edit or fix. */
  onValueChange?: (value: string) => void
  /** Called with the instant it reads as, in ms, or null when it can't be read. */
  onTimestampChange?: (ms: number | null) => void
  /** The unit the field stores. A value in another unit is flagged with a one-tap conversion. */
  unit?: EpochUnit
  /** Years a real value falls in. Defaults to 1970–2100. */
  range?: [number, number]
  /** Flag values a signed 32-bit time can't hold (after 19 Jan 2038 03:14:07 UTC). */
  int32?: boolean
  /** Time zone to read the value back in. Defaults to the device's. */
  timeZone?: string
  /** Locale for dates. */
  locale?: string
  /** Clock for "in 3 days" and for picking the likeliest unit, in ms. Defaults to the time the component mounted. */
  now?: number
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string. `{found}`, `{expected}`, `{asIs}` and the other placeholders are filled in. */
  messages?: Partial<EpochInputMessages>
}

/**
 * A Unix timestamp field that reads the value back as a date in your zone
 * and UTC, and catches the mix-ups that store the wrong moment:
 * milliseconds pasted where seconds belong (year 57,754 for 1760400000000), microseconds and
 * nanoseconds, spreadsheet serials, Windows FILETIME and .NET ticks, ISO
 * strings with no time zone, date-only strings read as UTC midnight,
 * impossible dates and values past the 2038 limit of 32-bit time.
 */
export function EpochInput({ value, defaultValue = "", onValueChange, onTimestampChange, unit, range, int32, timeZone, locale = "en-GB", now, label, messages, id, className, ref, "aria-describedby": describedBy, ...props }: EpochInputProps) {
  const t = { ...EPOCH_INPUT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const reduce = useReducedMotion()
  const [inner, setInner] = React.useState(defaultValue)
  const text = String(value ?? inner ?? "")
  const [device, setDevice] = React.useState<{ zone: string; now: number }>()
  React.useEffect(() => setDevice({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", now: Date.now() }), [])
  const zone = timeZone ?? device?.zone ?? "UTC"
  const clock = now ?? device?.now
  const [copied, setCopied] = React.useState<string>()
  const input = React.useRef<HTMLInputElement>(null)
  const list = React.useRef<HTMLUListElement>(null)
  const refocus = React.useRef<number | null>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => input.current as HTMLInputElement)

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const describe = React.useMemo(() => {
    const format = formatter(locale, zone)
    return (ms: number) => format.format(new Date(ms))
  }, [locale, zone])
  const options = React.useMemo(() => ({ unit, range, int32, timeZone: zone, now: clock ?? Date.UTC(2026, 0, 1) }), [unit, range, int32, zone, clock])
  const reading = React.useMemo(() => readTimestamp(text, options), [text, options])
  const issues = React.useMemo(() => checkTimestamp(text, options, describe), [text, options, describe])
  const errors = issues.filter((issue) => issue.severity === "error").length
  const counted = issues.filter((issue) => issue.severity !== "info").length
  const summary = !text.trim() ? "" : counted ? [errors && fill(t.toFix, { count: errors }), counted - errors && fill(t.toReview, { count: counted - errors })].filter(Boolean).join(" · ") : reading ? t.ok : ""
  const announced = useSettled(summary)

  const instant = reading?.ms ?? null
  const onInstant = React.useRef(onTimestampChange)
  onInstant.current = onTimestampChange
  React.useEffect(() => onInstant.current?.(instant), [instant])
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    ;(buttons[Math.min(refocus.current, buttons.length - 1)] ?? input.current)?.focus()
    refocus.current = null
  }, [text])
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(undefined), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const fix = (next: string, button: HTMLElement) => {
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    update(next)
  }
  const copy = async (format: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(format)
    } catch {
      setCopied(undefined)
    }
  }
  const message = (issue: TimestampIssue) => fill(issue.kind === "wrong-unit" && !issue.detail.asIs ? t["wrong-unit-far"] : t[issue.kind], issue.detail)
  const digits = cleanTimestamp(text).replace(/^[+-]/, "").split(".")[0].length
  const readAs = reading ? fill(reading.kind === "epoch" ? t[`read-${reading.unit as EpochUnit}`] : t[`read-${reading.kind}`], { digits }) : ""
  const formats: [string, string][] = reading
    ? [
        [t.seconds, toUnit(reading.ms, "s")],
        [t.milliseconds, toUnit(reading.ms, "ms")],
        [t.iso, new Date(reading.ms).toISOString()],
      ]
    : []

  return (
    <div data-slot="epoch-input" className={cn("grid w-full max-w-md min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm", className)}>
      <label htmlFor={inputId} className="flex w-fit items-center gap-1.5 font-medium">
        <Clock aria-hidden className="size-4 text-muted-foreground" />
        {t.label}
      </label>
      <input
        ref={input}
        id={inputId}
        value={text}
        onChange={(event) => update(event.target.value)}
        placeholder={t.placeholder}
        inputMode="text"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        aria-invalid={errors > 0 || undefined}
        aria-describedby={[describedBy, `${inputId}-status`].filter(Boolean).join(" ")}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...props}
      />
      <span role="status" className="sr-only">
        {announced}
      </span>
      {reading && (
        <section aria-labelledby={`${inputId}-readback`} className="mt-1.5 grid gap-1.5 rounded-md border bg-muted/40 p-3 text-xs">
          <h3 id={`${inputId}-readback`} className="sr-only">
            {t.readback}
          </h3>
          {/* After a unit fix the date visibly travels from the wrong century to the right one. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={reading.ms}
              initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -10, filter: "blur(2px)" }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="text-sm font-medium tabular-nums"
            >
              {describe(reading.ms)}
            </motion.p>
          </AnimatePresence>
          <dl className="grid grid-cols-[minmax(0,4.5rem)_minmax(0,1fr)] gap-x-2 gap-y-1 text-muted-foreground">
            {zone !== "UTC" && (
              <>
                <dt>{t.utc}</dt>
                <dd className="tabular-nums">{formatter(locale, "UTC").format(new Date(reading.ms))}</dd>
              </>
            )}
            {clock !== undefined && (
              <>
                <dt>{t.when}</dt>
                <dd>{relative(reading.ms, clock, locale)}</dd>
              </>
            )}
            <dt>{t.readAs}</dt>
            <dd>{readAs}</dd>
          </dl>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {formats.map(([format, content]) => (
              <button key={format} type="button" onClick={() => copy(format, content)} title={content} className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
                {copied === format ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                {copied === format ? t.copied : fill(t.copy, { format })}
              </button>
            ))}
          </div>
        </section>
      )}
      <div id={`${inputId}-status`} className="mt-1.5 grid gap-1.5 text-xs">
        {summary && (
          <span className={cn("flex items-center gap-1.5", counted ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {counted ? <TriangleAlert aria-hidden className={cn("size-3.5", errors ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} /> : <CircleCheck aria-hidden className="size-3.5" />}
            {summary}
          </span>
        )}
        {issues.length > 0 && (
          <ul ref={list} className="grid gap-1.5">
            {issues.map((issue, index) => {
              const Icon = icons[issue.severity]
              return (
                <li key={`${issue.kind}-${index}`} className={cn("flex gap-1.5", tones[issue.severity])}>
                  <span className="flex h-6 shrink-0 items-center">
                    <Icon aria-hidden className="size-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="py-1 [overflow-wrap:anywhere]">{message(issue)}</span>
                    {issue.fixes.map((next) => (
                      <button key={next.next} type="button" data-fix="" onClick={(event) => fix(next.next, event.currentTarget)} className={fixClass(issue.severity === "error")}>
                        {fill(t[next.label as keyof EpochInputMessages] ?? next.label, next.detail ?? {})}
                      </button>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
