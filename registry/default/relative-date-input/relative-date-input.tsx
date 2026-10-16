"use client"

import * as React from "react"
import { differenceInCalendarDays } from "date-fns"
import { CalendarCheck, CalendarSearch, PencilLine } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { fromIsoDay, readRelativeDate, toIsoDay, type DateReading, type Day } from "./relative-date"

export { fromIsoDay, readRelativeDate, toIsoDay, type DateReading, type Day, type RelativeDateOptions, type RelativeDateResult } from "./relative-date"

/** Every visible string. `{text}`, `{date}` and `{relative}` are filled in where noted. */
export const RELATIVE_DATE_MESSAGES = {
  placeholder: "next Fri, in 2 weeks, the 15th, 23 Oct…",
  /** `{text}`: shown while a phrase has two readings. */
  ambiguous: "“{text}” can mean two dates. Which one?",
  /** `{date}`, `{relative}` */
  readback: "{date} · {relative}",
  unreadable: "Try “next Fri”, “in 2 weeks”, “the 15th” or “23 Oct”.",
  numeric: "Write the month as a word (5 Jun), so it can't be read as 6 May.",
  /** `{date}`: rewrites the field so the next reader isn't left guessing either. */
  writeOut: "Write it as {date}",
  past: "That's in the past.",
  future: "That's in the future.",
  basis: {
    "this-week": "this week",
    "next-week": "next week",
    "last-week": "last week",
    "this-month": "this month",
    "next-month": "next month",
    "this-year": "this year",
    "next-year": "next year",
    today: "today",
    "in-a-week": "a week from today",
    exact: "",
  } as Record<string, string>,
}
export type RelativeDateMessages = typeof RELATIVE_DATE_MESSAGES

export interface RelativeDateInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the field's text. */
  onValueChange?: (value: string) => void
  /** Called with `YYYY-MM-DD`, or null while the text is unreadable or still ambiguous. */
  onDateChange?: (date: string | null) => void
  /** "Today" as `YYYY-MM-DD`. Defaults to the device's date once mounted. */
  today?: string
  /** First day of the week: 1 = Monday, 0 = Sunday. Decides what "this week" covers. */
  weekStartsOn?: Day
  /** Only future (bookings, deadlines) or only past (expenses) dates make sense here. */
  expect?: "future" | "past"
  /** BCP 47 locale for the read-back. */
  locale?: string
  /** Override any text (see `RELATIVE_DATE_MESSAGES`). */
  messages?: Partial<RelativeDateMessages>
}

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A date field that takes the way people say dates ("next Fri", "in 2 weeks", "the 15th") and
 * never guesses when the phrase splits listeners: "next Friday" on a Wednesday, "this Monday"
 * after Monday, "the 10th" once the 10th has passed. It shows both dates and waits for a pick,
 * reads the answer back with its weekday, and can rewrite the text so later readers aren't left
 * guessing either.
 */
export function RelativeDateInput({
  label = "Date",
  value,
  defaultValue = "",
  onValueChange,
  onDateChange,
  today: todayProp,
  weekStartsOn = 1,
  expect,
  locale = "en-GB",
  messages,
  id,
  className,
  onBlur,
  "aria-describedby": describedBy,
  ...props
}: RelativeDateInputProps) {
  const say = { ...RELATIVE_DATE_MESSAGES, ...messages, basis: { ...RELATIVE_DATE_MESSAGES.basis, ...messages?.basis } }
  const reduce = useReducedMotion()
  const [inner, setInner] = React.useState(defaultValue)
  const [deviceToday, setDeviceToday] = React.useState<string>()
  const [choice, setChoice] = React.useState<{ text: string; iso: string }>()
  const [settled, setSettled] = React.useState(defaultValue)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner

  React.useEffect(() => {
    if (!todayProp) setDeviceToday(toIsoDay(new Date()))
  }, [todayProp])
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), 600)
    return () => clearTimeout(timer)
  }, [text])

  const today = fromIsoDay(todayProp ?? deviceToday ?? "")
  const result = today ? readRelativeDate(text, today, { weekStartsOn, expect }) : { readings: [] as DateReading[] }
  const ambiguous = result.readings.length > 1
  const chosen = ambiguous ? result.readings.find((r) => choice?.text === text && toIsoDay(r.date) === choice.iso) : result.readings[0]
  const iso = chosen ? toIsoDay(chosen.date) : null
  const showProblem = settled === text && text.trim() !== "" && result.readings.length === 0

  const report = React.useRef(onDateChange)
  React.useEffect(() => {
    report.current = onDateChange
  })
  React.useEffect(() => report.current?.(iso), [iso])

  const setText = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const long = (d: Date) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d)
  const relative = (d: Date) => {
    const days = today ? differenceInCalendarDays(d, today) : 0
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    return Math.abs(days) < 14 ? rtf.format(days, "day") : Math.abs(days) < 63 ? rtf.format(Math.round(days / 7), "week") : rtf.format(Math.round(days / 30.44), "month")
  }
  const optionText = (r: DateReading) => [long(r.date), say.basis[r.basis]].filter(Boolean).join(" · ")
  const wrongSide = chosen && today && expect && (expect === "future" ? chosen.date < today : chosen.date > today)

  return (
    <div data-slot="relative-date-input" className={cn("grid w-full max-w-sm min-w-0 gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        value={text}
        placeholder={say.placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={showProblem || undefined}
        aria-describedby={cn(`${inputId}-status`, describedBy)}
        data-warning={(ambiguous && !chosen) || showProblem || wrongSide ? "" : undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => {
          setSettled(text)
          onBlur?.(event)
        }}
        className={fieldClass}
        {...props}
      />
      {ambiguous && (
        <LayoutGroup id={`${inputId}-pick`}>
          <div role="radiogroup" aria-label={fill(say.ambiguous, { text: text.trim() })} className="grid grid-cols-2 gap-1.5">
            {result.readings.map((reading, index) => {
              const key = toIsoDay(reading.date)
              const on = !!chosen && toIsoDay(chosen.date) === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  data-option={index}
                  aria-checked={on}
                  tabIndex={on || (!chosen && index === 0) ? 0 : -1}
                  onClick={() => setChoice({ text, iso: key })}
                  onKeyDown={(event) => {
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return
                    event.preventDefault()
                    const other = result.readings[1 - index]
                    setChoice({ text, iso: toIsoDay(other.date) })
                    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-option="${1 - index}"]`)?.focus()
                  }}
                  className={cn(
                    "relative isolate min-h-9 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    on ? "border-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId={reduce ? undefined : "pick"}
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-[5px] bg-primary"
                    />
                  )}
                  {optionText(reading)}
                </button>
              )
            })}
          </div>
        </LayoutGroup>
      )}
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {ambiguous && !chosen && (
          <p className="flex items-center gap-1.5 py-1 text-amber-700 dark:text-amber-400">
            <CalendarSearch aria-hidden className="size-3.5 shrink-0" />
            {fill(say.ambiguous, { text: text.trim() })}
          </p>
        )}
        {chosen && (
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            <CalendarCheck aria-hidden className="size-3.5 shrink-0" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={iso}
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -8 }}
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                className="py-1 font-medium text-foreground"
              >
                {fill(say.readback, { date: long(chosen.date), relative: relative(chosen.date) })}
              </motion.span>
            </AnimatePresence>
            {ambiguous && (
              <button
                type="button"
                onClick={() => {
                  setText(long(chosen.date))
                  inputRef.current?.focus()
                }}
                className={fixClass}
              >
                <PencilLine aria-hidden className="size-3.5" />
                {fill(say.writeOut, { date: long(chosen.date) })}
              </button>
            )}
          </p>
        )}
        {wrongSide && <p className="py-1 text-amber-700 dark:text-amber-400">{expect === "future" ? say.past : say.future}</p>}
        {showProblem && <p className="py-1 text-amber-700 dark:text-amber-400">{result.numeric ? say.numeric : say.unreadable}</p>}
      </div>
    </div>
  )
}
