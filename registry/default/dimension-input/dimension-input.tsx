"use client"

import * as React from "react"
import { ArrowLeftRight, Box, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  AXES, DIMENSION_CATEGORIES, findDimensionIssue, formatOtherSystem, parseDimensions, volumeReadback,
  type Axis, type DimensionCategory, type DimensionIssue, type DimensionUnit, type Sides,
} from "./dimension"

export {
  AXES, DIMENSION_CATEGORIES, findDimensionIssue, formatOtherSystem, parseDimensions, UNIT_CM, volumeReadback,
  type Axis, type DimensionCategory, type DimensionIssue, type DimensionUnit, type Sides,
} from "./dimension"

export interface DimensionValue {
  /** Sides as typed, so "12." survives while typing. */
  w: string
  h: string
  d: string
  unit: DimensionUnit
}

/** Every user-visible string. `issue` rewrites a warning, e.g. to translate it; it gets the English message by default. */
export const DIMENSION_MESSAGES = {
  zero: "Each side needs a size above 0.",
  switchTo: (unit: DimensionUnit) => `Switch to ${unit}`,
  use: (value: number) => `Use ${value}`,
  swap: "Swap",
  issue: (issue: DimensionIssue) => issue.message,
}

export interface DimensionInputProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue"> {
  /** Group label. */
  label?: string
  /** Controlled value. */
  value?: DimensionValue
  /** Initial value when uncontrolled. */
  defaultValue?: DimensionValue
  /** Called on every change, including a pasted "40 x 30 x 20 cm" that fills all three sides. */
  onValueChange?: (value: DimensionValue) => void
  /** What is being measured, to judge sizes and side order. A built-in key or your own ranges. */
  category?: keyof typeof DIMENSION_CATEGORIES | DimensionCategory
  /** Units offered in the picker. */
  units?: DimensionUnit[]
  /** Names for each side. */
  axisLabels?: Record<Axis, string>
  /** Courier divisor in cm³/kg for the volumetric weight readback (5000 for express couriers); null hides it. */
  volumetricDivisor?: number | null
  /** Text after the volumetric weight. */
  volumetricLabel?: string
  /** Label of the unit picker. */
  unitLabel?: string
  /** Override any message or fix label. */
  messages?: Partial<typeof DIMENSION_MESSAGES>
}

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-2 text-center text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium whitespace-nowrap text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")))

/**
 * A width × height × depth field that keeps sizes honest. Each number is labelled,
 * a pasted "16 x 12 x 8 in" fills all three, and against a category it catches the
 * wrong unit (sizes that only make sense in inches), a side with an extra digit and
 * sides entered in the wrong order, then reads the size back in metric and imperial
 * with volume and courier volumetric weight.
 */
export function DimensionInput({
  label = "Dimensions",
  value,
  defaultValue = { w: "", h: "", d: "", unit: "cm" },
  onValueChange,
  category,
  units = ["cm", "mm", "m", "in", "ft"],
  axisLabels = { w: "Width", h: "Height", d: "Depth" },
  volumetricDivisor = 5000,
  volumetricLabel = "volumetric",
  unitLabel = "Unit",
  messages,
  className,
  ...props
}: DimensionInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const t = { ...DIMENSION_MESSAGES, ...messages }
  const refs = React.useRef<Partial<Record<Axis | "unit", HTMLElement | null>>>({})
  const id = React.useId()
  const dims = value ?? inner
  const cat = typeof category === "string" ? DIMENSION_CATEGORIES[category] : category
  const sides = { w: toNumber(dims.w), h: toNumber(dims.h), d: toNumber(dims.d) } as Sides
  const complete = AXES.every((a) => Number.isFinite(sides[a]) && sides[a] > 0)
  const zero = AXES.some((a) => sides[a] === 0)
  const issue = complete && cat ? findDimensionIssue(sides, dims.unit, cat, axisLabels) : null
  const flagged = (a: Axis) => (issue?.kind === "digit" && issue.axis === a) || (issue?.kind === "range" && issue.axes.includes(a)) || issue?.kind === "unit"

  /** Briefly tints the fields a fix changed, so the change is noticed. */
  const flash = (keys: (Axis | "unit")[]) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    keys.forEach((k) => refs.current[k]?.animate([{ backgroundColor: "rgb(245 158 11 / 0.3)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" }))
  }
  const update = (patch: Partial<DimensionValue>, changed: (Axis | "unit")[] = []) => {
    const next = { ...dims, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (changed.length) requestAnimationFrame(() => flash(changed))
  }

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = parseDimensions(e.clipboardData.getData("text"))
    if (!parsed) return
    e.preventDefault()
    const [w, h, d] = parsed.values.map(String)
    const unit = parsed.unit && units.includes(parsed.unit) ? parsed.unit : dims.unit
    update({ w, h, d, unit }, unit !== dims.unit ? [...AXES, "unit"] : AXES)
  }

  const back = complete ? volumeReadback(sides, dims.unit, volumetricDivisor) : null

  return (
    <fieldset data-slot="dimension-input" className={cn("grid w-full max-w-sm min-w-0 gap-1.5", className)} {...props}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_4.5rem] items-end gap-x-1.5 gap-y-1">
        {AXES.map((a, i) => (
          <React.Fragment key={a}>
            {i > 0 && <span aria-hidden className="flex h-9 items-center text-sm text-muted-foreground">×</span>}
            <div className="grid min-w-0 gap-1">
              <label htmlFor={`${id}-${a}`} className="truncate text-xs text-muted-foreground">{axisLabels[a]}</label>
              <input
                ref={(el) => { refs.current[a] = el }}
                id={`${id}-${a}`}
                inputMode="decimal"
                autoComplete="off"
                value={dims[a]}
                onChange={(e) => update({ [a]: e.target.value.replace(/[^\d.,]/g, "") })}
                onPaste={onPaste}
                aria-describedby={`${id}-status`}
                data-warning={flagged(a) ? "" : undefined}
                className={field}
              />
            </div>
          </React.Fragment>
        ))}
        <div className="grid min-w-0 gap-1">
          <label htmlFor={`${id}-unit`} className="text-xs text-muted-foreground">{unitLabel}</label>
          <select
            ref={(el) => { refs.current.unit = el }}
            id={`${id}-unit`}
            value={dims.unit}
            onChange={(e) => update({ unit: e.target.value as DimensionUnit })}
            data-warning={issue?.kind === "unit" ? "" : undefined}
            className={cn(field, "px-1.5 text-left")}
          >
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div id={`${id}-status`} aria-live="polite" className="grid min-h-6 gap-1 text-xs">
        {zero && <p className="py-1 text-amber-700 dark:text-amber-400">{t.zero}</p>}
        {issue && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{t.issue(issue)}</span>
              {issue.kind === "unit" && <button type="button" onClick={() => update({ unit: issue.unit }, ["unit"])} className={fix}>{t.switchTo(issue.unit)}</button>}
              {issue.kind === "digit" && (
                <button type="button" onClick={() => update({ [issue.axis]: String(issue.fixValue) }, [issue.axis])} className={fix}>{t.use(issue.fixValue)}</button>
              )}
              {issue.kind === "order" && (
                <button type="button" onClick={() => update({ w: String(issue.fix.w), h: String(issue.fix.h), d: String(issue.fix.d) }, AXES.filter((a) => issue.fix[a] !== sides[a]))} className={fix}>
                  <ArrowLeftRight aria-hidden className="size-3" /> {t.swap}
                </button>
              )}
            </span>
          </p>
        )}
        {back && (
          <div className="flex gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <Box aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="grid min-w-0 gap-0.5 tabular-nums">
              <p>
                {AXES.map((a, i) => (
                  <React.Fragment key={a}>
                    {i > 0 && <span className="text-muted-foreground"> × </span>}
                    <span className="font-medium">{sides[a]}</span>
                    <span className="text-xs text-muted-foreground"> {axisLabels[a][0]}</span>
                  </React.Fragment>
                ))}{" "}
                {dims.unit}
                <span className="text-muted-foreground"> ≈ {formatOtherSystem(sides, dims.unit)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {back.volume} · {back.ft3}
                {back.weight && <> · {back.weight} {volumetricLabel}</>}
              </p>
            </div>
          </div>
        )}
      </div>
    </fieldset>
  )
}
