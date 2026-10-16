"use client"

import * as React from "react"
import { ArrowRightLeft, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface UnitDef {
  id: string
  /** Short symbol shown in the picker, e.g. "cm". */
  label: string
  /** Converts a value in this unit to the preset's base unit. */
  toBase: (value: number) => number
  fromBase: (value: number) => number
  /** Range a real value in this unit usually falls in. */
  plausible: [number, number]
  /** Decimals kept when a value is converted into this unit. Defaults to 2 below 10 (1.78 m), else 1. */
  decimals?: number
}

export interface UnitPreset {
  /** What is being measured, used in messages ("height"). */
  quantity: string
  units: UnitDef[]
  /** Extra readings of the raw text, like 5.9 meaning 5 ft 9 in. Returns a base value. */
  reinterpret?: (raw: string) => { label: string; base: number } | null
}

const linear = (id: string, label: string, factor: number, plausible: [number, number]): UnitDef => ({
  id, label, plausible, toBase: (v) => v * factor, fromBase: (v) => v / factor,
})

export const UNIT_PRESETS = {
  height: {
    quantity: "height",
    units: [linear("cm", "cm", 1, [120, 230]), linear("m", "m", 100, [1.2, 2.3]), linear("in", "in", 2.54, [48, 90]), linear("ft", "ft", 30.48, [4, 7.5])],
    reinterpret: (raw) => {
      // 5.9, 5'9, 5'9", 5′9″, 5 ft 9 in, 5ft9
      const match = raw.trim().toLowerCase().match(/^([4-7])\s*(?:[.,'′ ]|ft|feet|foot)\s*(\d{1,2})\s*(?:"|″|''|in|inch|inches)?$/)
      if (!match || Number(match[2]) > 11) return null
      return { label: `${match[1]} ft ${match[2]} in`, base: Number(match[1]) * 30.48 + Number(match[2]) * 2.54 }
    },
  },
  weight: {
    quantity: "body weight",
    units: [linear("kg", "kg", 1, [30, 160]), linear("lb", "lb", 0.45359237, [66, 350]), linear("st", "st", 6.35029318, [5, 25])],
  },
  temperature: {
    quantity: "body temperature",
    units: [
      { id: "c", label: "°C", toBase: (v) => v, fromBase: (v) => v, plausible: [34, 42.5] },
      { id: "f", label: "°F", toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32, plausible: [93, 108.5] },
    ],
  },
} satisfies Record<string, UnitPreset>

const fmt = (value: number, decimals = 1) => new Intl.NumberFormat("en", { maximumFractionDigits: decimals, useGrouping: false }).format(value)
const decimalsOf = (unit: UnitDef) => unit.decimals ?? (unit.plausible[1] < 10 ? 2 : 1)
const parse = (raw: string) => (raw.trim() === "" ? NaN : Number(raw.trim().replace(",", ".")))

export interface UnitSuggestion {
  /** How the number was probably meant, e.g. "70 in" or "5 ft 9 in". */
  meant: string
  /** The value converted into the selected unit. */
  converted: number
  /** A unit to switch to instead of converting, when the number fits it as typed. */
  switchTo?: string
}

/** Returns null when the value is plausible in its unit, otherwise the likelier readings. */
export function checkUnit(raw: string, unitId: string, preset: UnitPreset): UnitSuggestion[] | null {
  const value = parse(raw)
  const unit = preset.units.find((u) => u.id === unitId)
  if (!unit) return null
  if (!Number.isFinite(value)) {
    // Text like 5'9" isn't a number, but it can still be read as one.
    const alt = preset.reinterpret?.(raw)
    return alt ? [{ meant: alt.label, converted: unit.fromBase(alt.base) }] : null
  }
  const fits = (u: UnitDef) => value >= u.plausible[0] && value <= u.plausible[1]
  if (fits(unit)) return null
  const other = preset.units
    .filter((u) => u.id !== unit.id && fits(u))
    .map((u) => ({ meant: `${fmt(value, 2)} ${u.label}`, converted: unit.fromBase(u.toBase(value)), switchTo: u.id }))
  const alt = preset.reinterpret?.(raw)
  return alt ? [...other, { meant: alt.label, converted: unit.fromBase(alt.base) }] : other
}

export interface UnitInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label: string
  /** Helper text shown under the field while there is nothing to warn about. */
  hint?: string
  /** A built-in preset or your own units and plausible ranges. */
  preset: keyof typeof UNIT_PRESETS | UnitPreset
  /** Override plausible ranges per unit id, e.g. `{ cm: [45, 120] }` for children. */
  ranges?: Record<string, [number, number]>
  /** Controlled text of the number. */
  value?: string
  /** Initial text when uncontrolled. */
  defaultValue?: string
  /** Called with the number's text on every change. */
  onValueChange?: (value: string) => void
  /** Controlled unit id. */
  unit?: string
  /** Unit selected initially; defaults to the first unit. */
  defaultUnit?: string
  /** Called when the unit changes, including from a one-tap switch. */
  onUnitChange?: (unit: string) => void
  /** Called with the number, its unit and the value in the preset's base unit, or null. */
  onMeasurementChange?: (measurement: { value: number; unit: string; base: number } | null) => void
  /** Pause in ms before warnings appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Accessible label of the button that keeps the value as typed. */
  keepLabel?: string
  /** Override any other visible string. */
  messages?: Partial<typeof UNIT_INPUT_MESSAGES>
}

/** Templates: `{value}`, `{quantity}`, `{options}`, `{min}`, `{max}`, `{unit}` are filled in. */
export const UNIT_INPUT_MESSAGES = {
  invalid: "Enter a number, like 72.5.",
  unusual: "{value} is an unusual {quantity}.",
  didYouMean: "Did you mean {options}?",
  usually: "Usually {min}–{max} {unit}.",
  readAs: "Read as {options}.",
  or: " or ",
  switchTo: "Switch to {unit}",
  use: "Use {value}",
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m)

const groupClass =
  "flex h-9 w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A number + unit field that notices when the number fits a different unit far better: 70 "cm"
 * is almost certainly inches, 180 "kg" is probably pounds, 98.6 "°C" is Fahrenheit. It offers a
 * one-tap conversion or unit switch instead of silently storing a value that's off by 2.5×.
 */
export function UnitInput({
  label,
  hint,
  preset,
  ranges,
  value,
  defaultValue = "",
  onValueChange,
  unit: unitProp,
  defaultUnit,
  onUnitChange,
  onMeasurementChange,
  delay = 700,
  keepLabel = "Keep it as typed",
  messages,
  id,
  className,
  onBlur,
  ...props
}: UnitInputProps) {
  const t = { ...UNIT_INPUT_MESSAGES, ...messages }
  const base = typeof preset === "string" ? UNIT_PRESETS[preset] : preset
  const config: UnitPreset = { ...base, units: base.units.map((u) => ({ ...u, plausible: ranges?.[u.id] ?? u.plausible })) }
  const [innerText, setInnerText] = React.useState(defaultValue)
  const [innerUnit, setInnerUnit] = React.useState(defaultUnit ?? config.units[0].id)
  const [settled, setSettled] = React.useState(defaultValue)
  const [kept, setKept] = React.useState<string>()
  const autoId = React.useId()
  const inputId = id ?? autoId
  const raw = value ?? innerText
  const unit = config.units.find((u) => u.id === (unitProp ?? innerUnit)) ?? config.units[0]

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(raw), delay)
    return () => clearTimeout(timer)
  }, [raw, delay])

  const apply = (nextRaw: string, nextUnit: UnitDef, now = false) => {
    if (value === undefined) setInnerText(nextRaw)
    if (unitProp === undefined) setInnerUnit(nextUnit.id)
    if (nextRaw !== raw) onValueChange?.(nextRaw)
    if (nextUnit.id !== unit.id) onUnitChange?.(nextUnit.id)
    if (now) setSettled(nextRaw)
    const v = parse(nextRaw)
    onMeasurementChange?.(Number.isFinite(v) ? { value: v, unit: nextUnit.id, base: nextUnit.toBase(v) } : null)
  }

  const ready = settled === raw && raw.trim() !== ""
  const numeric = Number.isFinite(parse(raw))
  const suggestions = ready && kept !== `${raw}${unit.id}` ? checkUnit(raw, unit.id, config) : null
  const invalid = ready && !numeric && !suggestions
  const options = suggestions?.map((c) => c.meant).join(t.or) ?? ""
  const message = invalid
    ? t.invalid
    : !numeric
      ? fill(t.readAs, { options })
      : `${fill(t.unusual, { value: `${fmt(parse(raw), 2)} ${unit.label}`, quantity: config.quantity })} ${
          suggestions?.length ? fill(t.didYouMean, { options }) : fill(t.usually, { min: fmt(unit.plausible[0], 2), max: fmt(unit.plausible[1], 2), unit: unit.label })
        }`
  const byId = (unitId: string) => config.units.find((u) => u.id === unitId) ?? unit

  return (
    <div data-slot="unit-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div className={groupClass} data-warning={suggestions || invalid ? "" : undefined}>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          aria-invalid={!!suggestions || invalid || undefined}
          aria-describedby={`${inputId}-hint`}
          onChange={(event) => apply(event.target.value, unit)}
          onBlur={(event) => {
            setSettled(raw)
            onBlur?.(event)
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-base tabular-nums outline-none placeholder:text-muted-foreground md:text-sm"
          {...props}
        />
        <select
          aria-label={`${label} unit`}
          value={unit.id}
          onChange={(event) => apply(raw, byId(event.target.value), true)}
          className="h-full shrink-0 rounded-r-md border-l bg-transparent pr-1 pl-2.5 text-sm outline-none dark:[color-scheme:dark]"
        >
          {config.units.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
      </div>
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 text-xs">
        {invalid || suggestions ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{message}</span>
              {suggestions?.map((c) => (
                <React.Fragment key={c.meant}>
                  {c.switchTo && (
                    <button type="button" className={fixClass} onClick={() => apply(raw, byId(c.switchTo ?? unit.id), true)}>
                      {fill(t.switchTo, { unit: byId(c.switchTo).label })}
                    </button>
                  )}
                  <button type="button" className={fixClass} onClick={() => apply(fmt(c.converted, decimalsOf(unit)), unit, true)}>
                    <ArrowRightLeft aria-hidden className="size-3" /> {fill(t.use, { value: `${fmt(c.converted, decimalsOf(unit))} ${unit.label}` })}
                  </button>
                </React.Fragment>
              ))}
              {suggestions && numeric && (
                <button
                  type="button"
                  onClick={() => setKept(`${raw}${unit.id}`)}
                  aria-label={keepLabel}
                  title={keepLabel}
                  className="grid size-6 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              )}
            </span>
          </p>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
