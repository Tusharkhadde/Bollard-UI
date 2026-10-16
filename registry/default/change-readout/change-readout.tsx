import * as React from "react"
import { TrendingDown, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

export type ChangeSummary = {
  /** to − from, in the values' own unit (percentage points when the values are percentages). */
  delta: number
  /** Relative change as a fraction (0.25 = +25%), or null when a percentage would be meaningless. */
  relative: number | null
  /** Why `relative` is null. */
  reason?: "zero-base" | "crosses-zero"
  direction: "up" | "down" | "same"
  /** to ÷ from when it at least doubled, since "+150%" is often misread as 1.5×. */
  multiple?: number
}

/**
 * Absolute and relative change between two numbers, correct at the edges: a negative base divides
 * by |from| so a shrinking loss reads as a rise, a zero base or a sign flip gives no percentage at
 * all instead of a misleading one, and float noise (0.1 + 0.2) is rounded off the delta.
 */
export function describeChange(from: number, to: number): ChangeSummary {
  const delta = Number((to - from).toPrecision(12))
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "same"
  if (delta === 0) return { delta: 0, relative: 0, direction }
  if (from === 0) return { delta, relative: null, reason: "zero-base", direction }
  if (to !== 0 && Math.sign(from) !== Math.sign(to)) return { delta, relative: null, reason: "crosses-zero", direction }
  const multiple = from > 0 && to / from >= 2 ? to / from : undefined
  return { delta, relative: delta / Math.abs(from), direction, multiple }
}

const MINUS = "\u2212"
const signed = (n: number, text: string) => (n > 0 ? `+${text}` : n < 0 ? `${MINUS}${text}` : text)

/** "+25%", "−3.4%", "<0.1%": never rounds a real change down to "0%". */
export function formatRelative(fraction: number, locale = "en-IN") {
  const pct = Math.abs(fraction * 100)
  if (pct > 0 && pct < 0.1) return signed(fraction, "<0.1%")
  const digits = pct < 10 && pct % 1 !== 0 ? 1 : 0
  return signed(fraction, `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(pct)}%`)
}

const tones = {
  good: "text-emerald-700 dark:text-emerald-400",
  bad: "text-red-700 dark:text-red-400",
  neutral: "text-foreground",
}

export interface ChangeReadoutProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The earlier value. */
  from: number
  /** The later value. */
  to: number
  /** "percent" when the values are themselves percentages (4 means 4%): the difference is then shown in points. */
  kind?: "number" | "percent"
  /** Which way is good news, for colour and the "better/worse" wording. "none" keeps it neutral. */
  goodDirection?: "up" | "down" | "none"
  /** Shorthand for currency formatting, e.g. "INR". Ignored when `format` is set. */
  currency?: string
  /** Locale for number formatting. */
  locale?: string
  /** Formats one magnitude (always called with a value ≥ 0 for the delta). */
  format?: (value: number) => string
  pointsLabel?: string
  pointsHint?: string
  zeroBaseText?: string
  crossesZeroText?: string
  noChangeText?: string
  betterLabel?: string
  worseLabel?: string
  toLabel?: string
}

/**
 * Shows a change both ways so nobody misreads its size: "₹1,200 → ₹1,500 · +₹300 · +25%".
 * Percentages get points and percent kept apart ("4% → 6% · +2 pts · +50%"), a zero base or a
 * sign flip says why there's no percentage, doubling adds "2.5×", and colour plus words say
 * whether the move is good or bad, because "up" isn't always good.
 */
export function ChangeReadout({
  from,
  to,
  kind = "number",
  goodDirection = "up",
  currency,
  locale = "en-IN",
  format,
  pointsLabel = "pts",
  pointsHint = "Percentage points: the plain difference between two percentages.",
  zeroBaseText = "no % from 0",
  crossesZeroText = "crossed zero, no %",
  noChangeText = "no change",
  betterLabel = "better",
  worseLabel = "worse",
  toLabel = "to",
  className,
  ...props
}: ChangeReadoutProps) {
  const number = new Intl.NumberFormat(locale, currency ? { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 } : { maximumFractionDigits: 2 })
  const magnitude = format ?? ((v: number) => number.format(v))
  const value = (v: number) => (v < 0 ? `${MINUS}${magnitude(-v)}` : magnitude(v)) + (kind === "percent" && !format ? "%" : "")
  const change = describeChange(from, to)
  const tone = change.direction === "same" || goodDirection === "none" ? "neutral" : change.direction === goodDirection ? "good" : "bad"
  const Icon = change.direction === "up" ? TrendingUp : TrendingDown
  const deltaText = signed(change.delta, magnitude(Math.abs(change.delta)))

  return (
    <span data-slot="change-readout" data-direction={change.direction} data-tone={tone} className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 text-sm tabular-nums", className)} {...props}>
      <span className="inline-flex items-baseline gap-x-1.5 whitespace-nowrap">
        <span className="text-muted-foreground">{value(from)}</span>
        <span aria-hidden className="text-muted-foreground">→</span>
        <span className="sr-only">{toLabel}</span>
        <span className="font-medium">{value(to)}</span>
        <span aria-hidden className="text-muted-foreground">·</span>
      </span>
      {change.direction === "same" ? (
        <span className="text-muted-foreground">{noChangeText}</span>
      ) : (
        <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
          <span className={cn("inline-flex items-baseline gap-1 font-medium whitespace-nowrap", tones[tone])}>
            <Icon aria-hidden className="size-3.5 self-center" />
            {kind === "percent" ? (
              <abbr title={pointsHint} className="no-underline">
                {deltaText} {pointsLabel}
              </abbr>
            ) : (
              deltaText
            )}
            {tone !== "neutral" && <span className="sr-only">({tone === "good" ? betterLabel : worseLabel})</span>}
            <span aria-hidden className="ml-0.5 font-normal text-muted-foreground">·</span>
          </span>
          {change.relative === null ? (
            <span className="whitespace-nowrap text-muted-foreground italic">{change.reason === "zero-base" ? zeroBaseText : crossesZeroText}</span>
          ) : (
            <span className={cn("whitespace-nowrap", tones[tone])}>
              {formatRelative(change.relative, locale)}
              {change.multiple && <span className="text-muted-foreground"> ({new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(change.multiple)}×)</span>}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
