"use client"

import * as React from "react"
import { CircleCheck, TriangleAlert, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { deltaE2000, labToLinear, linearToLab, parseHex, simulate, toHex, type Vision } from "./palette-math"

export type { Vision } from "./palette-math"

export interface Series {
  /** Legend name, e.g. "Revenue". */
  label: string
  /** Hex colour, e.g. "#1f77b4". */
  color: string
}

export interface Clash {
  a: number
  b: number
  vision: Vision
  delta: number
}

export const VISIONS: Vision[] = ["normal", "protan", "deutan", "tritan"]

const labOf = (hex: string, vision: Vision) => linearToLab(simulate(parseHex(hex) ?? [0, 0, 0], vision))

/**
 * Every pair of series that falls under `minDelta` (CIEDE2000) for some kind of vision, worst first.
 * A pair that is already too close in normal vision is reported once, as "normal".
 */
export function findClashes(series: Series[], minDelta = 6): Clash[] {
  const clashes: Clash[] = []
  for (let a = 0; a < series.length; a++) {
    for (let b = a + 1; b < series.length; b++) {
      const deltas = VISIONS.map((vision) => ({ vision, delta: deltaE2000(labOf(series[a].color, vision), labOf(series[b].color, vision)) }))
      const worst = deltas[0].delta < minDelta ? deltas[0] : deltas.slice(1).reduce((m, d) => (d.delta < m.delta ? d : m))
      if (worst.delta < minDelta) clashes.push({ a, b, ...worst })
    }
  }
  return clashes.sort((x, y) => x.delta - y.delta)
}

/**
 * The smallest lightness-only change to one colour of the clashing pair that separates it for every
 * kind of vision without creating a new clash. Hue stays, so the series keeps its meaning; Datawrapper's
 * advice for colour-blind readers is the same: vary the brightness. Returns null when none exists.
 */
export function suggestFix(series: Series[], clash: Clash, minDelta = 6): { index: number; color: string } | null {
  const before = findClashes(series, minDelta).length
  for (let step = 3; step <= 45; step += 3) {
    for (const index of [clash.b, clash.a]) {
      for (const sign of [-1, 1]) {
        const [l, a, b] = linearToLab(parseHex(series[index].color) ?? [0, 0, 0])
        const rgb = labToLinear([l + sign * step, a, b]) ?? labToLinear([l + sign * step, a * 0.8, b * 0.8])
        if (!rgb) continue
        const next = series.map((s, i) => (i === index ? { ...s, color: toHex(rgb) } : s))
        const after = findClashes(next, minDelta)
        if (after.length < before && !after.some((c) => (c.a === clash.a && c.b === clash.b) || c.a === index || c.b === index)) {
          return { index, color: toHex(rgb) }
        }
      }
    }
  }
  return null
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, key: string) => v[key] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface PaletteGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled palette, one entry per chart series. */
  value?: Series[]
  /** Initial palette when uncontrolled. */
  defaultValue?: Series[]
  /** Called with the new palette when a colour is edited or a fix is applied. */
  onValueChange?: (value: Series[]) => void
  /** Smallest CIEDE2000 difference that still reads as two series. 6 passes Okabe–Ito and fails red/green. */
  minDelta?: number
  /** Row names for each kind of vision. */
  visionLabels?: Record<Vision, string>
  /** Templates: `{a}`, `{b}`, `{vision}`, `{delta}`, `{name}`, `{direction}`. */
  clashText?: string
  normalClashText?: string
  fixText?: string
  noFixText?: string
  passText?: string
}

/**
 * A chart palette checker that stops series becoming indistinguishable for colour-blind readers.
 * It simulates protan, deutan and tritan vision (Machado 2009), measures every pair with CIEDE2000,
 * names the pairs that collapse, and offers the smallest lightness-only fix, or patterns and labels
 * when no colour change can separate them.
 */
export function PaletteGuard({
  value,
  defaultValue = [],
  onValueChange,
  minDelta = 6,
  visionLabels = { normal: "Typical vision", protan: "Red-blind (protan)", deutan: "Green-blind (deutan)", tritan: "Blue-blind (tritan)" },
  clashText = "{a} and {b} look alike to {vision} readers (ΔE {delta}).",
  normalClashText = "{a} and {b} are hard to tell apart for everyone (ΔE {delta}).",
  fixText = "{direction} {name}",
  noFixText = "No colour change separates them without breaking another pair: add patterns or label the lines directly.",
  passText = "All {count} series stay distinct for red-, green- and blue-blind readers.",
  className,
  ...props
}: PaletteGuardProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [flash, setFlash] = React.useState<number>()
  const series = value ?? inner
  const clashes = React.useMemo(() => findClashes(series, minDelta), [series, minDelta])
  const first = clashes[0]
  const fix = React.useMemo(() => (first ? suggestFix(series, first, minDelta) : null), [series, first, minDelta])

  const update = (next: Series[]) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const setColor = (index: number, color: string) => update(series.map((s, i) => (i === index ? { ...s, color } : s)))
  const applyFix = () => {
    if (!fix) return
    setColor(fix.index, fix.color)
    setFlash(fix.index)
  }

  const inClash = (vision: Vision, index: number) => clashes.some((c) => c.vision === vision && (c.a === index || c.b === index))
  const describe = (c: Clash) =>
    fill(c.vision === "normal" ? normalClashText : clashText, {
      a: series[c.a].label,
      b: series[c.b].label,
      vision: visionLabels[c.vision].split(" (")[0].toLowerCase(),
      delta: c.delta.toFixed(1),
    })
  const lighter = fix && linearToLab(parseHex(fix.color) ?? [0, 0, 0])[0] > linearToLab(parseHex(series[fix.index].color) ?? [0, 0, 0])[0]

  return (
    <div data-slot="palette-guard" data-state={clashes.length ? "clash" : "ok"} className={cn("grid w-full max-w-sm gap-3", className)} {...props}>
      <style>{"@keyframes cui-palette-guard-pop{40%{transform:scale(1.25)}}"}</style>
      <ul aria-label="Series colours" className="flex flex-wrap gap-x-3 gap-y-2">
        {series.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5 text-sm">
            <label className="relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-xs has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
              <span
                aria-hidden
                onAnimationEnd={() => setFlash(undefined)}
                className={cn("absolute inset-0 transition-colors duration-300", flash === i && "motion-safe:animate-[cui-palette-guard-pop_350ms_ease-out]")}
                style={{ background: s.color }}
              />
              <input type="color" value={s.color} onChange={(e) => setColor(i, e.target.value)} aria-label={`Colour for ${s.label}`} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <span>{s.label}</span>
            <span className="font-mono text-xs text-muted-foreground uppercase">{s.color}</span>
          </li>
        ))}
      </ul>

      <dl className="grid gap-1.5 rounded-lg border bg-card p-3 text-xs">
        {VISIONS.map((vision) => (
          <div key={vision} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-2">
            <dt className={cn("truncate", clashes.some((c) => c.vision === vision) ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{visionLabels[vision]}</dt>
            <dd className="flex gap-1">
              {series.map((s, i) => {
                const hex = toHex(simulate(parseHex(s.color) ?? [0, 0, 0], vision))
                const bad = inClash(vision, i)
                return (
                  <span
                    key={i}
                    title={`${s.label} as seen: ${hex}`}
                    className={cn("h-5 min-w-0 flex-1 rounded-sm transition-colors duration-300", bad && "ring-2 ring-amber-500 ring-offset-1 ring-offset-card")}
                    style={{ background: hex }}
                  >
                    <span className="sr-only">{`${s.label}${bad ? ", clashes" : ""}`}</span>
                  </span>
                )
              })}
            </dd>
          </div>
        ))}
      </dl>

      <div aria-live="polite" className="grid gap-1.5 text-xs">
        {first ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{describe(first)}{fix ? "" : ` ${noFixText}`}</span>
              {fix && (
                <button type="button" onClick={applyFix} className={fixClass} aria-label={`${fill(fixText, { direction: lighter ? "Lighten" : "Darken", name: series[fix.index].label })} to ${fix.color}`}>
                  <WandSparkles aria-hidden className="size-3.5" />
                  {fill(fixText, { direction: lighter ? "Lighten" : "Darken", name: series[fix.index].label })}
                  <span aria-hidden className="size-3 rounded-sm border" style={{ background: fix.color }} />
                </button>
              )}
            </span>
          </p>
        ) : (
          <p className="flex gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            {fill(passText, { count: String(series.length) })}
          </p>
        )}
        {clashes.length > 1 && (
          <ul className="grid gap-1 pl-5 text-muted-foreground">
            {clashes.slice(1).map((c) => <li key={`${c.a}-${c.b}`}>{describe(c)}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
