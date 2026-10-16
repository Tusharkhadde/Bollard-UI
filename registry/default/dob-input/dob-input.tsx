"use client"

import * as React from "react"
import { Cake, CircleAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface DobParts {
  day: string
  month: string
  year: string
}

export type DobIssueKind = "missing" | "year-digits" | "swapped" | "not-real" | "future" | "this-year" | "too-old" | "under-age" | "ambiguous"

export interface DobCheck {
  /** The birth date (UTC midnight) once the parts make a real date. */
  date?: Date
  /** Whole years old today. */
  age?: number
  /** The most important problem, if any. Errors block; warnings only ask. */
  issue?: { kind: DobIssueKind; severity: "error" | "warning"; fix?: DobParts; when?: Date; value?: number }
}

const utc = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(2000, m - 1, d))
  date.setUTCFullYear(y)
  return date
}
const daysIn = (y: number, m: number) => utc(y, m + 1, 0).getUTCDate()

/** Years completed on `today`. A 29 Feb birthday counts from 1 March in other years. */
export function ageOn(birth: Date, today: Date) {
  const [by, bm, bd] = [birth.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()]
  const [ty, tm, td] = [today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()]
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

/** The day someone born on `birth` turns `years` (29 Feb rolls to 1 Mar). */
export function birthdayAt(birth: Date, years: number) {
  const y = birth.getUTCFullYear() + years
  const [m, d] = [birth.getUTCMonth() + 1, birth.getUTCDate()]
  return d > daysIn(y, m) ? utc(y, 3, 1) : utc(y, m, d)
}

/**
 * Checks date-of-birth parts against today: missing parts, 2-digit years, a day
 * typed into the month box, impossible dates, the future, this year (age 0),
 * implausible ages and a minimum-age gate. `ambiguous` flags a pasted date
 * whose day and month could be read either way.
 */
export function checkDob(
  parts: DobParts,
  today: Date,
  { minAge, maxAge = 120, allowInfants = false, ambiguous = false }: { minAge?: number; maxAge?: number; allowInfants?: boolean; ambiguous?: boolean } = {}
): DobCheck {
  const { day, month, year } = parts
  if (!day || !month || !year) return { issue: { kind: "missing", severity: "error" } }
  const [d, m, y] = [Number(day), Number(month), Number(year)]
  const current = today.getUTCFullYear()
  if (year.length === 2) {
    const full = y + (y <= current % 100 ? Math.floor(current / 100) * 100 : Math.floor(current / 100) * 100 - 100)
    return { issue: { kind: "year-digits", severity: "error", fix: { ...parts, year: String(full) }, value: full } }
  }
  if (year.length !== 4) return { issue: { kind: "year-digits", severity: "error" } }
  if (m > 12 || m < 1) {
    const swap = { day: month, month: day, year }
    const fits = d >= 1 && d <= 12 && m <= daysIn(y, d)
    return { issue: { kind: fits ? "swapped" : "not-real", severity: "error", fix: fits ? swap : undefined } }
  }
  if (d < 1 || d > daysIn(y, m)) return { issue: { kind: "not-real", severity: "error", value: daysIn(y, m) } }
  const date = utc(y, m, d)
  const age = ageOn(date, today)
  const century = (shift: number): DobParts | undefined => {
    const alt = utc(y + shift, m, d)
    const altAge = ageOn(alt, today)
    return alt.getUTCDate() === d && altAge >= 0 && altAge <= maxAge ? { ...parts, year: String(y + shift) } : undefined
  }
  if (date > today) return { date, issue: { kind: "future", severity: "error", fix: century(-100) } }
  if (y === current && !allowInfants) return { date, age, issue: { kind: "this-year", severity: "warning" } }
  if (age > maxAge) return { date, age, issue: { kind: "too-old", severity: "warning", fix: century(100), value: age } }
  if (minAge !== undefined && age < minAge) return { date, age, issue: { kind: "under-age", severity: "error", when: birthdayAt(date, minAge), value: minAge } }
  if (ambiguous && d <= 12 && m <= 12 && d !== m) return { date, age, issue: { kind: "ambiguous", severity: "warning", fix: { day: month, month: day, year } } }
  return { date, age }
}

type Part = keyof DobParts
const ORDER: Record<"dmy" | "mdy" | "ymd", Part[]> = { dmy: ["day", "month", "year"], mdy: ["month", "day", "year"], ymd: ["year", "month", "day"] }
const AUTOCOMPLETE: Record<Part, string> = { day: "bday-day", month: "bday-month", year: "bday-year" }
const fromIso = (iso: string): DobParts => {
  const [year = "", month = "", day = ""] = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-") : []
  return { day, month, year }
}
const toIso = (p: DobParts) => `${p.year}-${p.month.padStart(2, "0")}-${p.day.padStart(2, "0")}`

export type DobMessages = Record<Exclude<DobIssueKind, "under-age">, string> & {
  underAge: (minAge: number, when: string) => string
  readback: (date: string, age: number) => string
}

const DEFAULT_MESSAGES: DobMessages = {
  missing: "Enter your full date of birth.",
  "year-digits": "Year must include 4 numbers.",
  swapped: "There's no month above 12. Day and month swapped?",
  "not-real": "Date of birth must be a real date.",
  future: "Date of birth must be in the past.",
  "this-year": "That makes you 0 years old. Did you type this year by mistake?",
  "too-old": "That's an unusually old age. Check the year.",
  ambiguous: "Pasted dates can be read two ways.",
  underAge: (minAge, when) => `You must be ${minAge} or older. You can sign up from ${when}.`,
  readback: (date, age) => `Born ${date} · ${age} ${age === 1 ? "year" : "years"} old`,
}

export interface DobInputProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Legend for the group. */
  label?: string
  /** Hint under the legend, e.g. "For example, 27 3 1990". */
  hint?: string
  /** Controlled value as `YYYY-MM-DD`, or `""` while incomplete. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  /** Called with `YYYY-MM-DD` once the parts make a real past date, else `""`, plus the age. */
  onValueChange?: (value: string, age?: number) => void
  /** Order of the boxes. */
  order?: "dmy" | "mdy" | "ymd"
  /** Block anyone younger than this, with the date they become old enough. */
  minAge?: number
  /** Ages above this are flagged as a likely year typo. */
  maxAge?: number
  /** Allow babies born this year (e.g. a child's record) without a warning. */
  allowInfants?: boolean
  /** "Today" as `YYYY-MM-DD`. Defaults to the user's local date once mounted. */
  today?: string
  /** Locale for month names and dates. */
  locale?: string
  /** Box labels. */
  partLabels?: Record<Part, string>
  /** Override any message. */
  messages?: Partial<DobMessages>
}

const boxClass =
  "h-9 rounded-md border bg-transparent px-3 text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A three-box date-of-birth field that reads the date and age back ("Born
 * 4 Nov 1990 · 35 years old") so a slip is visible, and catches the classics:
 * this year typed by habit (age 0), a future date, an implausible age, a day
 * typed into the month box, a pasted date that reads two ways, and a
 * minimum-age gate that says when the person becomes eligible.
 */
export function DobInput({
  label = "Date of birth",
  hint,
  value,
  defaultValue = "",
  onValueChange,
  order = "dmy",
  minAge,
  maxAge = 120,
  allowInfants = false,
  today: todayProp,
  locale = "en-IN",
  partLabels = { day: "Day", month: "Month", year: "Year" },
  messages: overrides,
  className,
  ...props
}: DobInputProps) {
  const [parts, setParts] = React.useState(() => fromIso(value ?? defaultValue))
  const [touched, setTouched] = React.useState(!!(value ?? defaultValue))
  const [settled, setSettled] = React.useState(parts)
  const [ambiguous, setAmbiguous] = React.useState(false)
  const [localToday, setLocalToday] = React.useState<Date>()
  const refs = React.useRef<Partial<Record<Part, HTMLInputElement | null>>>({})
  const id = React.useId()
  const messages = { ...DEFAULT_MESSAGES, ...overrides }
  const sequence = ORDER[order]

  React.useEffect(() => {
    if (todayProp) return
    const now = new Date()
    setLocalToday(utc(now.getFullYear(), now.getMonth() + 1, now.getDate()))
  }, [todayProp])

  // Follow a controlled value that changed from outside.
  React.useEffect(() => {
    if (value !== undefined && value && value !== toIso(parts)) setParts(fromIso(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Wait for a pause before judging, so "19" on the way to "1990" isn't flagged.
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(parts), 700)
    return () => clearTimeout(timer)
  }, [parts])

  const today = todayProp ? new Date(`${todayProp}T00:00:00Z`) : localToday
  const empty = !parts.day && !parts.month && !parts.year
  const check = today && !empty ? checkDob(parts, today, { minAge, maxAge, allowInfants, ambiguous }) : undefined
  const ready = settled.day === parts.day && settled.month === parts.month && settled.year === parts.year
  const issue = ready && check?.issue && (check.issue.kind !== "missing" || touched) ? check.issue : undefined

  const commit = (next: DobParts, nextAmbiguous = false) => {
    setParts(next)
    if (nextAmbiguous || next.year.length === 4) setSettled(next)
    setAmbiguous(nextAmbiguous)
    if (!today) return
    const result = checkDob(next, today, { minAge, maxAge, allowInfants })
    const ok = result.date && result.issue?.severity !== "error"
    onValueChange?.(ok ? toIso(next) : "", ok ? result.age : undefined)
  }

  const move = (part: Part, step: 1 | -1) => refs.current[sequence[sequence.indexOf(part) + step]]?.focus()

  const handleChange = (part: Part, raw: string) => {
    if (/\D$/.test(raw)) return parts[part] ? move(part, 1) : undefined // typing "/" or "." jumps to the next box
    const digits = raw.replace(/\D/g, "").slice(0, part === "year" ? 4 : 2)
    commit({ ...parts, [part]: digits })
    // Jump on a lone 4–9 (no day or month starts that way). A lone 2 or 3 waits, so a day typed into
    // the month box stays "23" and gets caught as a swap instead of splitting into month 2 and year 3….
    const full = part === "year" ? digits.length === 4 : digits.length === 2 || Number(digits) > 3
    if (full && part !== sequence[2]) move(part, 1)
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const match = /^\s*(\d{1,4})\D+(\d{1,2})\D+(\d{1,4})\s*$/.exec(event.clipboardData.getData("text"))
    if (!match) return
    event.preventDefault()
    const pasted = (match[1].length === 4 ? ORDER.ymd : sequence).reduce((acc, part, i) => ({ ...acc, [part]: match[i + 1] }), {} as DobParts)
    commit(pasted, match[1].length !== 4)
    setTouched(true)
    refs.current[sequence[2]]?.focus()
  }

  const fmt = (d: Date) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d)
  const fixed = issue?.fix && today ? checkDob(issue.fix, today, { minAge, maxAge, allowInfants }).date : undefined
  const text = issue
    ? issue.kind === "under-age"
      ? messages.underAge(issue.value ?? 0, issue.when ? fmt(issue.when) : "")
      : issue.kind === "not-real" && issue.value
        ? `${messages["not-real"]} That month has ${issue.value} days.`
        : messages[issue.kind]
    : ""
  const readback = check?.date && check.age !== undefined && check.age >= 0 ? messages.readback(fmt(check.date), check.age) : ""
  const statusId = `${id}-status`

  return (
    <fieldset
      data-slot="dob-input"
      aria-describedby={statusId}
      className={cn("grid w-full max-w-sm min-w-0 gap-1.5", className)}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        setTouched(true)
        setSettled(parts)
      }}
      {...props}
    >
      <style>{"@keyframes cui-dob-input-pop{from{opacity:.35;transform:translateY(2px)}to{opacity:1;transform:none}}"}</style>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        {sequence.map((part) => (
          <label key={part} className={cn("grid gap-1 text-xs text-muted-foreground", part === "year" ? "w-20" : "w-14")}>
            {partLabels[part]}
            <input
              ref={(el) => {
                refs.current[part] = el
              }}
              inputMode="numeric"
              autoComplete={AUTOCOMPLETE[part]}
              value={parts[part]}
              placeholder={part === "year" ? "YYYY" : part === "day" ? "DD" : "MM"}
              onChange={(event) => handleChange(part, event.target.value)}
              onKeyDown={(event) => event.key === "Backspace" && !parts[part] && move(part, -1)}
              onPaste={handlePaste}
              aria-invalid={issue?.severity === "error" && (issue.kind !== "missing" || !parts[part]) ? true : undefined}
              data-warning={issue?.severity === "warning" ? "" : undefined}
              className={cn(boxClass, "w-full text-foreground placeholder:text-muted-foreground/60")}
            />
          </label>
        ))}
      </div>
      <div id={statusId} aria-live="polite" className="min-h-6 text-xs">
        {readback && issue?.kind !== "future" && (
          <p key={readback} className="flex gap-1.5 text-muted-foreground motion-safe:animate-[cui-dob-input-pop_250ms_ease-out]">
            <span className="flex h-6 shrink-0 items-center">
              <Cake aria-hidden className="size-3.5" />
            </span>
            <span className="py-1">{readback}</span>
          </p>
        )}
        {issue && (
          <p
            role={issue.severity === "error" ? "alert" : undefined}
            data-issue={issue.kind}
            className={cn("flex gap-1.5", issue.severity === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}
          >
            <span className="flex h-6 shrink-0 items-center">
              {issue.severity === "error" ? <CircleAlert aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{text}</span>
              {issue.fix && (
                <button
                  type="button"
                  onClick={() => issue.fix && (commit(issue.fix), refs.current[sequence[2]]?.focus())}
                  className={fixClass}
                >
                  {fixed ? `Use ${fmt(fixed)}` : `Use ${issue.fix.year}`}
                </button>
              )}
            </span>
          </p>
        )}
      </div>
    </fieldset>
  )
}
