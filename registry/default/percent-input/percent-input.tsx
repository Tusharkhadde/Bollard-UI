"use client"

// Bollard UI — percent-input · MIT licence · https://bollard-ui.vercel.app/components/percent-input

import * as React from "react"
import { CircleAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type PercentUnit = "percent" | "bps"

/** Reads "15", "15 %", "1,250.5", "25bps". Returns the number and a unit when one was typed. */
export function parsePercentText(text: string): { number: number | null; unit?: PercentUnit } {
  const unit: PercentUnit | undefined = /b\s*p\s*s?\s*$/i.test(text) ? "bps" : /%/.test(text) ? "percent" : undefined
  const bare = text.replace(/[\s,%]|b\s*p\s*s?$/gi, "")
  return { number: /^-?(\d+\.?\d*|\.\d+)$/.test(bare) ? Number(bare) : null, unit }
}

export interface PercentProblem {
  kind: "fraction" | "tinyBps" | "over" | "under"
  /** A replacement for the typed number (in the current unit), when one is likely. */
  fix?: number
}

/**
 * Checks a typed number. `fraction`: 0.15 typed where 15% was meant. `tinyBps`:
 * 0.25 typed in basis points where 0.25% (25 bps) was meant. `over` / `under`:
 * outside the allowed range, with a dropped-zero fix for 150 → 15.
 */
export function checkPercent(
  typed: number,
  { unit = "percent", min = 0, max = 100, likelyMin = 1 }: { unit?: PercentUnit; min?: number; max?: number; likelyMin?: number } = {}
): PercentProblem | null {
  const percent = unit === "bps" ? typed / 100 : typed
  const scale = unit === "bps" ? 100 : 1
  if (percent > max) {
    const tenth = percent / 10
    return { kind: "over", fix: Number.isInteger(tenth) && tenth <= max && tenth >= min ? tenth * scale : undefined }
  }
  if (percent < min) return { kind: "under", fix: -percent >= min && -percent <= max ? -typed : undefined }
  if (unit === "bps" && typed > 0 && typed < 1) return { kind: "tinyBps", fix: Number((typed * 100).toPrecision(12)) }
  if (unit === "percent" && typed > 0 && typed < 1 && typed < likelyMin && typed * 100 <= max) {
    return { kind: "fraction", fix: Number((typed * 100).toPrecision(12)) }
  }
  return null
}

export interface PercentInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "min" | "max"> {
  /** Visible label. */
  label?: string
  /** Controlled value, in `valueFormat`. `null` means empty. */
  value?: number | null
  /** Initial value when uncontrolled. */
  defaultValue?: number | null
  /** Called with the value in `valueFormat`, or `null` when empty or unreadable. */
  onValueChange?: (value: number | null) => void
  /** How values go in and out: `percent` (15 means 15%) or `fraction` (0.15 means 15%). */
  valueFormat?: "percent" | "fraction"
  /** Lowest allowed percent. */
  min?: number
  /** Highest allowed percent. Set higher for growth rates or markups. */
  max?: number
  /** Positive values below this look like a decimal typed for a percent (0.15 for 15%). 0 turns it off. */
  likelyMin?: number
  /** Show a % / bps switch. Switching converts the typed number, so the amount never changes meaning. */
  basisPoints?: boolean
  /** Unit the field starts in when `basisPoints` is on. */
  defaultUnit?: PercentUnit
  /** Amount the percent applies to, for the readback ("15% of ₹2,000 = ₹300"). */
  base?: number
  /** ISO 4217 currency of `base`. Leave out for a plain number. */
  currency?: string
  /** BCP 47 locale for number formatting. */
  locale?: string
  /** Message when a fraction was typed for a percent. */
  fractionMessage?: (typed: string, fix: string) => string
  /** Message when a tiny basis-point value was typed. */
  tinyBpsMessage?: (typed: string, fix: string) => string
  /** Message when the value is above max. */
  overMessage?: (max: string) => string
  /** Message when the value is below min. */
  underMessage?: (min: string) => string
  /** Fix button text; receives the fixed value with its unit, e.g. "15%". */
  fixLabel?: (fix: string) => string
  /** Readback without a base; receives the percent and the same value as a decimal. */
  decimalText?: (percent: string, decimal: string) => string
}

const fieldClass =
  "flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400 data-error:border-destructive"
const fixClass = (error: boolean) =>
  cn(
    "inline-flex h-6 items-center gap-1 rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    error
      ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200"
      : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200"
  )

/**
 * A percent field that catches the two classic slips: 0.15 typed where 15% was
 * meant (and the reverse in basis points), and 150% where nothing over 100% is
 * allowed. It reads the result back in plain words ("15% of ₹2,000 = ₹300", or
 * "15% = 0.15" so the stored decimal is visible) and offers a one-tap fix.
 */
export function PercentInput({
  label = "Percentage",
  value,
  defaultValue = null,
  onValueChange,
  valueFormat = "percent",
  min = 0,
  max = 100,
  likelyMin = 1,
  basisPoints = false,
  defaultUnit = "percent",
  base,
  currency,
  locale = "en-IN",
  fractionMessage = (typed, fix) => `${typed} is under 1%. Did you mean ${fix}?`,
  tinyBpsMessage = (typed, fix) => `${typed} is a tiny fraction of a percent. Did you mean ${fix}?`,
  overMessage = (limit) => `Can't be more than ${limit}.`,
  underMessage = (limit) => `Can't be less than ${limit}.`,
  fixLabel = (fix) => `Use ${fix}`,
  decimalText = (percent, decimal) => `${percent} = ${decimal} as a decimal`,
  id,
  className,
  ref,
  ...props
}: PercentInputProps) {
  const fromValue = (v: number | null | undefined) => (v == null ? "" : String(valueFormat === "fraction" ? Number((v * 100).toPrecision(12)) : v))
  const [unit, setUnit] = React.useState<PercentUnit>(basisPoints ? defaultUnit : "percent")
  const toRaw = (v: number | null | undefined, u: PercentUnit) =>
    u === "bps" && v != null ? String(Number((Number(fromValue(v)) * 100).toPrecision(12))) : fromValue(v)
  const [raw, setRaw] = React.useState(() => toRaw(value ?? defaultValue, unit))
  const [lastValue, setLastValue] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const typed = parsePercentText(raw).number
  const percent = typed === null ? null : unit === "bps" ? typed / 100 : typed
  const out = (p: number | null) => (p === null ? null : valueFormat === "fraction" ? Number((p / 100).toPrecision(12)) : p)

  // Follow the parent when it changes the value.
  if (value !== lastValue) {
    setLastValue(value)
    if (value !== undefined && value !== out(percent)) setRaw(toRaw(value, unit))
  }

  const number = (n: number, digits = 4) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n)
  const money = (n: number) => (currency ? new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) : number(n, 2))
  const withUnit = (n: number, u: PercentUnit) => (u === "bps" ? `${number(n)} bps` : `${number(n)}%`)

  const commit = (text: string, nextUnit = unit) => {
    setRaw(text)
    const n = parsePercentText(text).number
    onValueChange?.(out(n === null ? null : nextUnit === "bps" ? n / 100 : n))
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    const parsed = parsePercentText(text)
    // "25bps" switches to basis points when the switch is offered; a typed % sign is simply dropped.
    const nextUnit = basisPoints && parsed.unit ? parsed.unit : unit
    if (nextUnit !== unit) setUnit(nextUnit)
    commit(text.replace(/\s*(%|b\s*p\s*s?)\s*$/i, ""), nextUnit)
  }

  const switchUnit = (next: PercentUnit) => {
    if (next === unit) return
    setUnit(next)
    if (typed !== null) setRaw(String(Number((next === "bps" ? typed * 100 : typed / 100).toPrecision(12))))
  }

  const problem = typed === null ? null : checkPercent(typed, { unit, min, max, likelyMin })
  const error = problem?.kind === "over" || problem?.kind === "under"
  const shown = typed === null ? "" : withUnit(typed, unit)
  const message = !problem
    ? ""
    : problem.kind === "over"
      ? overMessage(withUnit(max, "percent"))
      : problem.kind === "under"
        ? underMessage(withUnit(min, "percent"))
        : problem.kind === "fraction"
          ? fractionMessage(shown, withUnit(problem.fix ?? 0, "percent"))
          : tinyBpsMessage(shown, `${withUnit(typed ?? 0, "percent")} (${withUnit(problem.fix ?? 0, "bps")})`)

  let readback = ""
  if (percent !== null && !error) {
    const lead = unit === "bps" ? `${shown} = ${withUnit(percent, "percent")}` : shown
    readback = base !== undefined ? `${lead} of ${money(base)} = ${money((base * percent) / 100)}` : decimalText(lead, number(percent / 100, 6))
  }
  const Icon = error ? CircleAlert : TriangleAlert

  return (
    <div data-slot="percent-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div data-warning={problem && !error ? "" : undefined} data-error={error ? "" : undefined} className={fieldClass}>
        <input
          ref={inputRef}
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={handleChange}
          aria-invalid={error || undefined}
          aria-describedby={`${inputId}-status`}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-base tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          {...props}
        />
        {basisPoints ? (
          <span role="group" aria-label="Unit" className="mr-1 flex shrink-0 rounded-sm bg-muted p-0.5 text-xs">
            {(["percent", "bps"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => switchUnit(u)}
                className="h-6 rounded-sm px-2 font-medium text-muted-foreground transition-colors outline-none aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:aria-pressed:bg-input/60"
              >
                {u === "bps" ? "bps" : "%"}
              </button>
            ))}
          </span>
        ) : (
          <span aria-hidden className="pr-3 text-sm text-muted-foreground">%</span>
        )}
      </div>
      <div id={`${inputId}-status`} aria-live="polite" className="min-h-6 text-xs">
        {problem && (
          <p role={error ? "alert" : undefined} className={cn("flex gap-1.5", error ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
            <span className="flex h-6 shrink-0 items-center">
              <Icon aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{message}</span>
              {problem.fix !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    commit(String(problem.fix))
                    inputRef.current?.focus()
                  }}
                  className={fixClass(error)}
                >
                  {fixLabel(withUnit(problem.fix, unit))}
                </button>
              )}
            </span>
          </p>
        )}
        {readback && <p className="py-1 text-muted-foreground tabular-nums">{readback}</p>}
      </div>
    </div>
  )
}
