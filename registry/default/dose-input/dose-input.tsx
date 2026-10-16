"use client"

import * as React from "react"
import { Pill, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkRange, formatAmount, readDose, spellDose, type DoseIssue, type DoseRange, type DoseUnit } from "./dose"

export { checkRange, convertDose, formatAmount, readDose, spellDose, type Dose, type DoseIssue, type DoseRange, type DoseUnit } from "./dose"

const UNIT_RISKS: Record<string, string> = {
  u: `"U" can be misread as 0 or 4 (4U seen as 40).`,
  iu: `"IU" can be misread as IV or 10.`,
  "i.u.": `"IU" can be misread as IV or 10.`,
  µg: `"µg" can be misread as mg, a 1,000-fold error.`,
  μg: `"µg" can be misread as mg, a 1,000-fold error.`,
  ug: `"ug" can be misread as mg, a 1,000-fold error.`,
  cc: `"cc" can be misread as u (units).`,
  ml: "A lowercase l can be misread as a 1.",
  l: "A lowercase l can be misread as a 1.",
  ng: `"ng" can be misread as mg.`,
  nanog: `"nanog" can be misread as mg.`,
}

/** Every user-visible string. Issue messages follow the ISMP error-prone designations list. */
export const DOSE_MESSAGES = {
  issue: {
    unreadable: () => "Enter a dose like 0.5 mg or 10 units.",
    "decimal-comma": (i: DoseIssue) => `"${i.typed}" is a decimal in some countries and a thousands separator in others.`,
    fraction: (i: DoseIssue) => `"${i.typed}" can be read as ${i.typed.split("/").join(" or ")}.`,
    "leading-zero": (i: DoseIssue) => `"${i.typed}" can be read as ${i.typed.slice(1)} if the point is missed.`,
    "trailing-zero": (i: DoseIssue) => `"${i.typed}" can be read as ${i.typed.replace(".", "")} if the point is missed.`,
    multiplier: (i: DoseIssue) => (i.options!.length > 1 ? `"${i.typed}" has meant both thousand and million.` : `"${i.typed}" gets misread. Write the number out.`),
    unit: (i: DoseIssue) => UNIT_RISKS[i.typed.toLowerCase()] ?? `Write "${i.safe}" instead of "${i.typed}".`,
    period: () => "A period after the unit can be misread as a 1.",
    spacing: (i: DoseIssue) => `In "${i.typed}" the unit can look like extra zeros.`,
    grouping: (i: DoseIssue) => `${i.typed} is easy to misread by a zero.`,
    "no-unit": () => "No unit, so the amount can be misread.",
  } satisfies Record<DoseIssue["kind"], (issue: DoseIssue) => string>,
  more: (count: number) => `+${count} more`,
  write: (safe: string) => `Write ${safe}`,
  usual: (range: DoseRange) => `Usual ${formatAmount(range.min)}–${formatAmount(range.max)} ${range.unit}`,
  outlier: (factor: number, above: boolean, range: DoseRange) =>
    `${factor >= 10 ? `${formatAmount(Math.round(factor))}× ${above ? "above the usual maximum" : "below the usual minimum"}` : above ? "Above the usual range" : "Below the usual range"} (${formatAmount(range.min)}–${formatAmount(range.max)} ${range.unit}).`,
  meant: "Did you mean",
  readsAs: "Reads back as",
  unitWords: {
    mg: ["milligram", "milligrams"],
    mcg: ["microgram", "micrograms"],
    g: ["gram", "grams"],
    nanograms: ["nanogram", "nanograms"],
    units: ["unit", "units"],
    mL: ["milliliter", "milliliters"],
    L: ["liter", "liters"],
    mEq: ["milliequivalent", "milliequivalents"],
    mmol: ["millimole", "millimoles"],
  } as Record<DoseUnit, [string, string]>,
}

export interface DoseInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label, usually the drug name. */
  label?: string
  /** Controlled text. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the text on every change, including one-tap fixes. */
  onValueChange?: (value: string) => void
  /** Typical dose range for this drug. Doses 10× outside it are flagged with likely meant values. */
  range?: DoseRange
  /** Unit assumed and suggested when none is typed. Defaults to the range's unit. */
  defaultUnit?: DoseUnit
  /** Override any string. */
  messages?: Partial<typeof DOSE_MESSAGES>
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A dose field that catches the notations behind ten-fold medication errors, following the ISMP list of
 * error-prone designations: trailing zeros (1.0 mg read as 10 mg), a missing leading zero (.5), "U" and
 * "IU", µg for mcg, cc, a unit flush against the number, and big numbers without commas. One tap rewrites
 * the dose safely, a dose 10× outside the drug's usual `range` offers the value it probably meant
 * (mg typed for mcg, a slipped decimal), and the dose is spelled back in words for read-back.
 */
export function DoseInput({
  label = "Dose",
  value,
  defaultValue = "",
  onValueChange,
  range,
  defaultUnit,
  messages,
  id,
  className,
  ref,
  ...props
}: DoseInputProps) {
  const m = { ...DOSE_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const text = value ?? inner
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const reading = readDose(text, defaultUnit ?? range?.unit)
  const issue = reading.issues[0]
  // "1M units" could be a thousand or a million: read nothing back until that's settled.
  const ambiguous = reading.issues.some((i) => i.kind === "multiplier" && i.options!.length > 1)
  const dose = !ambiguous && reading.dose && { ...reading.dose, unit: reading.dose.unit ?? defaultUnit ?? range?.unit ?? null }
  const outlier = dose && range ? checkRange(dose, range) : null
  const flagged = outlier && outlier.factor > 1 ? outlier : null

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    inputRef.current?.focus()
  }

  return (
    <div data-slot="dose-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        {range && <span className="text-xs text-muted-foreground">{m.usual(range)}</span>}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={text}
        onChange={(event) => update(event.target.value)}
        aria-describedby={hintId}
        aria-invalid={issue?.kind === "unreadable" || undefined}
        data-warning={(issue && issue.kind !== "unreadable") || (flagged && flagged.factor >= 10) ? "" : undefined}
        className={fieldClass}
        {...props}
      />
      <div id={hintId} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {issue && (
          <p className={cn("flex gap-1.5", issue.kind === "unreadable" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
            <span className="flex h-6 shrink-0 items-center">
              <Pill aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">
                {m.issue[issue.kind](issue)}
                {reading.issues.length > 1 && <span className="opacity-75"> {m.more(reading.issues.length - 1)}</span>}
              </span>
              {reading.safe && (
                <button type="button" onClick={() => update(reading.safe!)} className={fixClass}>
                  {m.write(reading.safe)}
                </button>
              )}
              {!reading.safe &&
                issue.options?.map((option) => (
                  <button key={option} type="button" onClick={() => update(option)} className={fixClass}>
                    {m.write(option)}
                  </button>
                ))}
            </span>
          </p>
        )}
        {flagged && range && (
          <p className={cn("flex gap-1.5", flagged.factor >= 10 ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{m.outlier(flagged.factor, flagged.above, range)}</span>
              {flagged.suggestions.length > 0 && <span className="py-1">{m.meant}</span>}
              {flagged.suggestions.map((s) => (
                <button key={s} type="button" onClick={() => update(s)} className={fixClass} aria-label={`${m.meant} ${s}?`}>
                  {s}?
                </button>
              ))}
            </span>
          </p>
        )}
        {dose && issue?.kind !== "unreadable" && (
          <p className="py-1 text-muted-foreground">
            {m.readsAs} <span className="font-medium text-foreground">“{spellDose(dose, m.unitWords)}”</span>
          </p>
        )}
      </div>
    </div>
  )
}
