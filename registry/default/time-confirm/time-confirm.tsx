"use client"

import * as React from "react"
import { TZDate, tzOffset } from "@date-fns/tz"
import { Clock, TriangleAlert } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

type Parsed = { hour: number; minute: number } | { hour12: number; minute: number } | null

/** Reads "2:30 pm", "14:30", "1430", "9", "12a", "noon" and "midnight". Hours 1–12 with no AM/PM stay ambiguous. */
export function parseTime(text: string, assume24h = false): Parsed {
  const t = text.trim().toLowerCase()
  if (t === "noon") return { hour: 12, minute: 0 }
  if (t === "midnight") return { hour: 0, minute: 0 }
  const m = t.match(/^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(a|p|am|pm|a\.m\.|p\.m\.)?$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2] ?? 0)
  if (minute > 59) return null
  if (m[3]) {
    if (hour < 1 || hour > 12) return null
    return { hour: (hour % 12) + (m[3].startsWith("p") ? 12 : 0), minute }
  }
  if (hour > 23) return null
  if (assume24h || hour === 0 || hour > 12 || m[1].length === 2 && m[1].startsWith("0")) return { hour, minute }
  return { hour12: hour, minute }
}

const pad = (n: number) => String(n).padStart(2, "0")

/** The wall-clock date and time an instant shows in a zone (via @date-fns/tz). */
function wallClock(ts: number, timeZone: string) {
  const d = new TZDate(ts, timeZone)
  return { date: `${String(d.getFullYear()).padStart(4, "0")}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hour: d.getHours(), minute: d.getMinutes() }
}

/**
 * Converts a wall time in `timeZone` to an instant with @date-fns/tz, and reports DST gaps and repeats.
 * A skipped time moves forward by the size of the gap (2:30 → 3:30), like Temporal's "compatible" mode;
 * a repeated time starts on its first occurrence and `second` is the later one. Works for 30-minute shifts too.
 */
export function zonedInstant(date: string, hour: number, minute: number, timeZone: string) {
  const [y, mo, d] = date.split("-").map(Number)
  const ts = new TZDate(y, mo - 1, d, hour, minute, timeZone).getTime()
  if (!Number.isFinite(ts)) return { ts: NaN, skipped: false, repeated: false, first: NaN, second: NaN }
  const matches = (t: number) => {
    const w = wallClock(t, timeZone)
    return w.date === date && w.hour === hour && w.minute === minute
  }
  const skipped = !matches(ts)
  // How far the clocks went back around this time, if they did.
  const fallBack = (tzOffset(timeZone, new Date(ts - 21_600_000)) - tzOffset(timeZone, new Date(ts + 21_600_000))) * 60_000
  const earlier = fallBack > 0 && matches(ts - fallBack)
  const later = fallBack > 0 && !earlier && matches(ts + fallBack)
  return { ts, skipped, repeated: earlier || later, first: earlier ? ts - fallBack : ts, second: later ? ts + fallBack : ts }
}

const city = (zone: string) => zone.split("/").pop()?.replace(/_/g, " ") ?? zone

/** Spells a 24-hour time out with its part of day, e.g. "9:00 PM, Tue night". */
export function describeTime(hour: number, minute: number, weekday: string) {
  const clock = `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`
  if (minute === 0 && hour === 12) return `${clock} (noon)`
  if (minute === 0 && hour === 0) return `${clock} (midnight, start of ${weekday})`
  if (hour < 5) return `${clock}, early ${weekday} morning`
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night"
  return `${clock}, ${weekday} ${part}`
}

const weekdayOf = (date: string) => {
  const at = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  return Number.isFinite(at) ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(at) : ""
}

export interface TimeConfirmProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. The entry zone's city is added after it. */
  label?: string
  /** Helper text shown under the field while it is empty. */
  hint?: string
  /** The calendar day this time is on, as YYYY-MM-DD. Needed for weekday and DST math. */
  date: string
  /** IANA zone the time is entered in, e.g. "Asia/Kolkata". */
  timeZone: string
  /** Up to 3 more IANA zones to show the same moment in. */
  zones?: string[]
  /** Treat bare hours like "9" as 24-hour time instead of asking AM or PM. */
  assume24h?: boolean
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the field's text on every change. */
  onValueChange?: (value: string) => void
  /** Called with "HH:mm" and the UTC instant whenever the moment changes (also on mount and when `date` or `timeZone` change), or `null` while it's ambiguous. */
  onTimeChange?: (time: { time: string; instant: string } | null) => void
  /** Warning shown until AM or PM is picked. */
  pickMessage?: string
  /** Warning shown when the text isn't a time. */
  invalidMessage?: string
  /** Spells a time out, e.g. "9:00 PM, Tue night". Override to translate. */
  describe?: (hour: number, minute: number, weekday: string) => string
  /** `{time}` is the typed time and `{saved}` the real one after the clocks jump. */
  skippedText?: string
  /** `{time}` is the time that happens twice; `{which}` is `firstLabel` or `secondLabel`. */
  repeatedText?: string
  /** Label of the first occurrence of a repeated time. */
  firstLabel?: string
  /** Label of the second occurrence of a repeated time. */
  secondLabel?: string
  /** Label of the fix that switches to the other occurrence or the real time; `{time}` is filled in. */
  useLabel?: string
  /** Flag for a time on the next day in another zone. */
  nextDayLabel?: string
  /** Flag for a time on the previous day in another zone. */
  previousDayLabel?: string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium whitespace-nowrap text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

function Warning({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className="py-1">{children}</span>{action}</span>
    </p>
  )
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m)
const shortTime = (hour: number, minute: number) => `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`

/**
 * A time field that never guesses between AM and PM. It asks when "9" or "12" could mean two
 * things, spells the answer back ("12:00 AM (midnight, start of Tue)"), catches times the
 * clocks skip or repeat on a DST change with a one-tap fix, and shows the same moment in other
 * zones, flagging when it lands on a different day there.
 */
export function TimeConfirm({
  label = "Time",
  hint,
  date,
  timeZone,
  zones = [],
  assume24h = false,
  value,
  defaultValue = "",
  onValueChange,
  onTimeChange,
  pickMessage = "Pick AM or PM so nobody shows up 12 hours off.",
  invalidMessage = "Try a time like 9:30 am, 21:30 or noon.",
  describe = describeTime,
  skippedText = "{time} doesn't exist that day: the clocks spring forward, so it would really be {saved}.",
  repeatedText = "{time} happens twice that day as the clocks fall back. Using the {which} one.",
  firstLabel = "first",
  secondLabel = "second",
  useLabel = "Use {time}",
  nextDayLabel = "next day",
  previousDayLabel = "previous day",
  placeholder = "e.g. 2:30 pm or 14:30",
  id,
  className,
  onBlur,
  "aria-describedby": describedBy,
  ...props
}: TimeConfirmProps) {
  const reduce = useReducedMotion()
  const [inner, setInner] = React.useState(defaultValue)
  // Choices belong to the text they were made for, so a new value (typed or set by the parent) clears them.
  const [choice, setChoice] = React.useState<{ text: string; meridiem?: "am" | "pm"; second?: boolean }>({ text: "" })
  const [touched, setTouched] = React.useState(defaultValue !== "")
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const weekday = weekdayOf(date)
  const mine = choice.text === text ? choice : { text }
  const meridiem = mine.meridiem ?? null

  const parsed = parseTime(text, assume24h)
  const ambiguous = parsed && "hour12" in parsed ? parsed : null
  const resolved = !parsed ? null : "hour" in parsed ? parsed : meridiem ? { hour: (parsed.hour12 % 12) + (meridiem === "pm" ? 12 : 0), minute: parsed.minute } : null
  const moment = resolved && zonedInstant(date, resolved.hour, resolved.minute, timeZone)
  const picked = moment ? (moment.repeated ? (mine.second ? moment.second : moment.first) : moment.ts) : null
  const ts = picked !== null && Number.isFinite(picked) ? picked : null
  const invalid = touched && text.trim() !== "" && !parsed
  const saved = moment?.skipped && ts !== null ? wallClock(ts, timeZone) : null

  const report = React.useRef(onTimeChange)
  React.useEffect(() => {
    report.current = onTimeChange
  })
  const key = resolved && ts !== null ? `${pad(resolved.hour)}:${pad(resolved.minute)}|${ts}` : ""
  React.useEffect(() => {
    const [time, instant] = key.split("|")
    report.current?.(key ? { time, instant: new Date(Number(instant)).toISOString() } : null)
  }, [key])

  const setText = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const pick = (option: "am" | "pm") => setChoice({ text, meridiem: option })

  return (
    <div data-slot="time-confirm" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label} <span className="font-normal text-muted-foreground">· {city(timeZone)}</span>
      </label>
      <input
        id={inputId}
        type="text"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={cn(`${inputId}-hint`, describedBy)}
        data-warning={invalid || (ambiguous && !meridiem) || moment?.skipped ? "" : undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => {
          setTouched(true)
          onBlur?.(event)
        }}
        className={fieldClass}
        {...props}
      />
      {ambiguous && (
        <LayoutGroup id={`${inputId}-meridiem`}>
        <div role="radiogroup" aria-label={`${ambiguous.hour12}:${pad(ambiguous.minute)} in the morning or evening?`} className="grid grid-cols-2 gap-1.5">
          {(["am", "pm"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              data-option={option}
              aria-checked={meridiem === option}
              tabIndex={meridiem === option || (!meridiem && option === "am") ? 0 : -1}
              onClick={() => pick(option)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
                event.preventDefault()
                const other = option === "am" ? "pm" : "am"
                pick(other)
                event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-option="${other}"]`)?.focus()
              }}
              className={cn(
                "relative isolate min-h-9 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                meridiem === option ? "border-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {meridiem === option && (
                <motion.span
                  layoutId={reduce ? undefined : "pick"}
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-[5px] bg-primary"
                />
              )}
              {describe((ambiguous.hour12 % 12) + (option === "pm" ? 12 : 0), ambiguous.minute, weekday)}
            </button>
          ))}
        </div>
        </LayoutGroup>
      )}
      <div id={`${inputId}-hint`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {invalid && <Warning>{invalidMessage}</Warning>}
        {ambiguous && !meridiem && <Warning>{pickMessage}</Warning>}
        {resolved && moment && ts !== null && (
          <>
            <p className="flex items-center gap-1.5 py-1 text-muted-foreground">
              <Clock aria-hidden className="size-3.5 shrink-0" />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`${resolved.hour}:${resolved.minute}`}
                  initial={reduce ? false : { opacity: 0, y: resolved.hour >= 12 ? 8 : -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: resolved.hour >= 12 ? -8 : 8 }}
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                  className="font-semibold text-foreground"
                >
                  {describe(resolved.hour, resolved.minute, weekday)}
                </motion.span>
              </AnimatePresence>
            </p>
            {saved && (
              <Warning
                action={
                  <button type="button" className={fixClass} onClick={() => setText(shortTime(saved.hour, saved.minute).toLowerCase())}>
                    {fill(useLabel, { time: shortTime(saved.hour, saved.minute) })}
                  </button>
                }
              >
                {fill(skippedText, { time: shortTime(resolved.hour, resolved.minute), saved: shortTime(saved.hour, saved.minute) })}
              </Warning>
            )}
            {moment.repeated && (
              <Warning
                action={
                  <button type="button" className={fixClass} onClick={() => setChoice({ ...mine, second: !mine.second })}>
                    {fill(useLabel, { time: `${mine.second ? firstLabel : secondLabel} ${shortTime(resolved.hour, resolved.minute)}` })}
                  </button>
                }
              >
                {fill(repeatedText, { time: shortTime(resolved.hour, resolved.minute), which: mine.second ? secondLabel : firstLabel })}
              </Warning>
            )}
            {zones.length > 0 && (
              <ul className="divide-y rounded-md border">
                {zones.slice(0, 3).map((zone) => {
                  const there = wallClock(ts, zone)
                  const shift = there.date === date ? "" : there.date > date ? nextDayLabel : previousDayLabel
                  const shown = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", hour: "numeric", minute: "2-digit" }).format(ts)
                  return (
                    <li key={zone} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                      <span className="truncate text-muted-foreground">{city(zone)}</span>
                      <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                        {shown}
                        {shift && <motion.span key={`${ts}-${zone}`} initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }} className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{shift}</motion.span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
        {!text && hint && <p className="py-1 text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
