"use client"

// Bollard UI — duration-input · MIT licence · https://bollard-ui.vercel.app/components/duration-input

import * as React from "react"
import { Timer, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  compactDuration,
  formatDuration,
  parseDuration,
  type ColonMode,
  type DurationUnit,
} from "@/registry/default/duration-input/duration"

export * from "@/registry/default/duration-input/duration"

/** Default messages. `{typed}`, `{alt}`, `{limit}` are filled in. */
export const DURATION_MESSAGES = {
  error: "Couldn't read that. Try 1h 30m, 90m, 1.5h or 1:30.",
  clock: "{typed} hours means .{digits} of an hour, not {digits} minutes.",
  decimal: "decimal hours",
  ambiguous: "Is {typed} hours and minutes, or minutes and seconds?",
  tooShort: "Shorter than the {limit} minimum.",
  tooLong: "Longer than the {limit} maximum.",
  use: "Use {value}",
  perDay: "{hours}-hour days",
}

export interface DurationInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "min" | "max"> {
  /** Visible label. */
  label?: string
  /** Controlled text, as typed. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text and the duration in seconds, or null while it can't be read, is ambiguous or out of range. */
  onValueChange?: (text: string, seconds: number | null) => void
  /** Unit of a bare number such as "90". */
  unit?: DurationUnit
  /** How "1:30" is read. "auto" uses min/max and asks when both readings fit. */
  colon?: ColonMode
  /** Smallest allowed duration, in seconds. */
  min?: number
  /** Largest allowed duration, in seconds. */
  max?: number
  /** Hours in a "day", e.g. 8 for work-day estimates. */
  hoursPerDay?: number
  /** Helper text shown while the field is empty. */
  hint?: string
  /** Override any of the default messages. */
  messages?: Partial<typeof DURATION_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-duration-input-flash{0%{background-color:rgb(16 185 129 / .3)}100%{background-color:transparent}}`

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * A duration field that reads "1h30", "90m", "1.5h", "1:30", "2d 4h" or "PT1H30M" and reads it back in
 * words, so what was understood is never a guess. It catches the timesheet classic, "1.50" typed for
 * 1 h 50 min (decimal hours make it 1 h 30 min), and a "1:30" that could be h:mm or m:ss: it settles
 * that from the min/max limits and asks only when both readings fit. Out-of-range values get a one-tap
 * clamp to the limit.
 */
export function DurationInput({
  label = "Duration",
  value,
  defaultValue = "",
  onValueChange,
  unit = "m",
  colon = "auto",
  min,
  max,
  hoursPerDay = 24,
  hint,
  messages,
  placeholder = "1h 30m",
  id,
  className,
  ref,
  ...props
}: DurationInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [flash, setFlash] = React.useState(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const t = { ...DURATION_MESSAGES, ...messages }
  const options = { unit, colon, min, max, hoursPerDay }
  const result = parseDuration(text, options)
  // Spell days out only when the user typed them, so a 9 h shift isn't shown as "1 day 1 hour".
  const days = /\d\s*d/i.test(text) ? hoursPerDay : undefined
  const words = (s: number) => formatDuration(s, days)

  const seconds = result.kind === "ok" ? result.seconds : null
  const limit = seconds === null ? null : min !== undefined && seconds < min ? min : max !== undefined && seconds > max ? max : null

  const commit = (next: string) => {
    const parsed = parseDuration(next, options)
    const ok = parsed.kind === "ok" && (min === undefined || parsed.seconds >= min) && (max === undefined || parsed.seconds <= max)
    if (value === undefined) setInner(next)
    onValueChange?.(next, ok && parsed.kind === "ok" ? parsed.seconds : null)
  }
  const apply = (s: number) => {
    commit(compactDuration(s, days))
    setFlash((n) => n + 1)
  }

  const typed = text.trim()
  let warning: React.ReactNode = null
  if (result.kind === "ambiguous") {
    warning = (
      <>
        <span className="py-1">{fill(t.ambiguous, { typed })}</span>
        <span className="flex flex-wrap gap-1">
          <button type="button" onClick={() => apply(result.hm)} className={fixClass}>{words(result.hm)}</button>
          <button type="button" onClick={() => apply(result.ms)} className={fixClass}>{words(result.ms)}</button>
        </span>
      </>
    )
  } else if (limit !== null) {
    warning = (
      <>
        <span className="py-1">{fill(limit === min ? t.tooShort : t.tooLong, { limit: words(limit) })}</span>
        <button type="button" onClick={() => apply(limit)} className={fixClass}>{fill(t.use, { value: words(limit) })}</button>
      </>
    )
  } else if (result.kind === "ok" && result.clockMinutes !== undefined) {
    const number = typed.match(/[\d.,]+/)?.[0] ?? typed
    warning = (
      <>
        <span className="py-1">{fill(t.clock, { typed: number, digits: number.split(/[.,]/)[1] ?? "" })}</span>
        <button type="button" onClick={() => apply(result.clockMinutes as number)} className={fixClass}>
          {fill(t.use, { value: words(result.clockMinutes) })}
        </button>
      </>
    )
  }

  return (
    <div data-slot="duration-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        onChange={(event) => commit(event.target.value)}
        aria-invalid={result.kind === "error" ? true : undefined}
        aria-describedby={`${inputId}-status`}
        data-warning={warning ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={`${inputId}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {result.kind === "error" ? (
          <p className="flex items-center gap-1.5 py-1 text-destructive">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            {t.error}
          </p>
        ) : seconds !== null ? (
          <p
            key={flash}
            className={cn(
              "flex w-fit items-center gap-1.5 rounded-sm py-1 pr-1 text-muted-foreground",
              flash > 0 && "motion-safe:animate-[cui-duration-input-flash_400ms_ease-out]",
            )}
          >
            <Timer aria-hidden className="size-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">{words(seconds)}</span>
              {result.kind === "ok" && result.decimal && <> · {t.decimal}</>}
              {days && hoursPerDay !== 24 && <> · {fill(t.perDay, { hours: hoursPerDay })}</>}
            </span>
          </p>
        ) : !warning && hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
        {warning && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{warning}</span>
          </p>
        )}
      </div>
    </div>
  )
}
