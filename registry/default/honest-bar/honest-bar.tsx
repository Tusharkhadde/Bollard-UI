"use client"

import * as React from "react"
import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type HonestBarDatum = { label: string; value: number }

/** 1, 2, 2.5 or 5 times a power of ten: the step a person would pick. */
export function niceStep(rough: number) {
  const power = 10 ** Math.floor(Math.log10(rough || 1))
  const f = rough / power
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * power
}

/** Value-axis range and ticks. Without `min`/`max` it always includes zero, as bar lengths need. */
export function barScale(values: number[], min?: number, max?: number, tickCount = 4) {
  const lo0 = min ?? Math.min(0, ...values)
  const hi0 = max ?? Math.max(min === undefined ? 0 : lo0, ...values)
  const step = niceStep((hi0 - lo0) / tickCount || 1)
  const lo = min ?? Math.floor(lo0 / step) * step
  const hi = max ?? Math.ceil(hi0 / step) * step
  const ticks = [lo]
  for (let t = Math.ceil(lo / step + 1e-9) * step; t <= hi + 1e-9; t += step) if (t - lo > step / 3) ticks.push(Number(t.toPrecision(12)))
  return { lo, hi, ticks, truncated: lo > 0 || hi < 0 }
}

/**
 * How much a truncated axis exaggerates: the longest bar's drawn length over the shortest's,
 * against their real ratio (Tufte's lie factor). Null when the axis is honest or it doesn't apply.
 */
export function exaggeration(values: number[], lo: number) {
  const positive = values.filter((v) => v > 0)
  if (lo <= 0 || positive.length < 2) return null
  const big = Math.max(...positive)
  const small = Math.min(...positive)
  if (big === small) return null
  return { drawn: small <= lo ? Infinity : (big - lo) / (small - lo), real: big / small }
}

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const ratio = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(n < 1.1 ? 2 : 1))

export interface HonestBarProps extends Omit<React.ComponentProps<"figure">, "children"> {
  /** Bars, in order. */
  data: HonestBarDatum[]
  /** Accessible name of the chart, also shown as its caption. */
  label: string
  /** "vertical" columns (default) or "horizontal" bars. */
  orientation?: "vertical" | "horizontal"
  /** Where the value axis starts. Above zero triggers the truncation warning and broken-axis mark. */
  min?: number
  /** Where the value axis ends. Values past it are drawn torn and labelled with their real value. */
  max?: number
  /** Plot height in px (vertical) or height per bar (horizontal). */
  size?: number
  /** Short format for ticks and labels. */
  format?: (value: number) => string
  /** Exact format for the hover/focus readout. */
  exactFormat?: (value: number) => string
  /** Templates: `{min}`, `{drawn}`, `{real}` and `{count}` are filled in. */
  truncatedText?: string
  /** Label for a bar that runs past the scale. */
  cutOffText?: string
  /** Message when bars are clipped at max. */
  clippedText?: string
  /** Button text that resets the axis to start at 0. */
  fixLabel?: string
  /** Button text that restores the original axis. */
  undoLabel?: string
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
const exact = new Intl.NumberFormat("en", { maximumFractionDigits: 6 })

/**
 * A pure-SVG bar chart that refuses to mislead. If the axis doesn't start at zero it draws a
 * broken-axis mark through the axis and every bar, says how much that exaggerates ("looks 4×,
 * really 1.1×") and offers a one-tap "Start at 0". Values past the scale are torn and labelled,
 * and every bar reads out its exact value on hover or keyboard focus.
 */
export function HonestBar({
  data,
  label,
  orientation = "vertical",
  min,
  max,
  size,
  format = (v) => compact.format(v),
  exactFormat = (v) => exact.format(v),
  truncatedText = "The axis starts at {min}, not 0: the longest bar looks {drawn}× the shortest, but it's {real}×.",
  cutOffText = "The axis starts at {min}, not 0, so bar lengths aren't proportional to the values.",
  clippedText = "{count} past the edge of the scale, labelled with the real value.",
  fixLabel = "Start at 0",
  undoLabel = "Undo",
  className,
  ...props
}: HonestBarProps) {
  const [zeroed, setZeroed] = React.useState(false)
  const [active, setActive] = React.useState<number>()
  const [width, setWidth] = React.useState(320)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const barRefs = React.useRef<(SVGGElement | null)[]>([])

  React.useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.round(entry.contentRect.width))))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const values = data.map((d) => d.value)
  const asked = barScale(values, min, max)
  const { lo, hi, ticks, truncated } = zeroed ? barScale(values, Math.min(0, min ?? 0, ...values), max) : asked
  const vertical = orientation === "vertical"
  const m = vertical ? { top: 18, right: 8, bottom: 22, left: 40 } : { top: 6, right: 44, bottom: 20, left: 76 }
  const height = vertical ? (size ?? 180) + m.top + m.bottom : data.length * (size ?? 28) + m.top + m.bottom
  const L = vertical ? height - m.top - m.bottom : width - m.left - m.right // value-axis length
  const band = (vertical ? width - m.left - m.right : height - m.top - m.bottom) / Math.max(1, data.length)
  const thick = Math.min(band * 0.64, vertical ? 48 : 20)
  const pos = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * L
  const base = pos(0)
  const box = (b: number, p1: number, p2: number) =>
    vertical
      ? { x: m.left + b, y: m.top + L - Math.max(p1, p2), width: thick, height: Math.abs(p1 - p2) }
      : { x: m.left + Math.min(p1, p2), y: m.top + b, width: Math.abs(p1 - p2), height: thick }
  const at = (p: number, b: number) => (vertical ? { x: m.left + b, y: m.top + L - p } : { x: m.left + p, y: m.top + b })
  const clipped = data.filter((d) => d.value > hi || d.value < lo).length
  const lie = truncated ? exaggeration(values, lo) : null
  const zig = (cx: number, cy: number, w: number) =>
    vertical ? `M${cx - w / 2},${cy + 2} l${w / 4},-4 l${w / 4},4 l${w / 4},-4 l${w / 4},4` : `M${cx - 2},${cy - w / 2} l4,${w / 4} l-4,${w / 4} l4,${w / 4} l-4,${w / 4}`
  const maxChars = vertical ? Math.max(3, Math.floor(band / 6.5)) : 11
  const short = (text: string) => (text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text)

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: -data.length, End: data.length }[event.key]
    if (step === undefined || active === undefined) return
    event.preventDefault()
    barRefs.current[Math.min(data.length - 1, Math.max(0, active + step))]?.focus()
  }

  const tip = active !== undefined ? data[active] : undefined
  const tipAt = tip && active !== undefined ? at(pos(Math.max(0, tip.value)), active * band + band / 2) : undefined

  return (
    <figure data-slot="honest-bar" className={cn("grid w-full min-w-0 max-w-md grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-honest-bar-grow-y{from{transform:scale(1,0)}}@keyframes cui-honest-bar-grow-x{from{transform:scale(0,1)}}"}</style>
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <div ref={boxRef} className="relative min-w-0">
        <svg width={width} height={height} role="list" aria-label={label} onKeyDown={onKeyDown} className="block overflow-visible text-[10px]">
          {ticks.map((t) => {
            const a = at(pos(t), 0)
            return (
              <g key={t} className="fill-muted-foreground">
                {vertical ? (
                  <line x1={m.left} x2={width - m.right} y1={a.y} y2={a.y} className={cn("stroke-border", t === 0 && "stroke-foreground/40")} />
                ) : (
                  <line y1={m.top} y2={height - m.bottom} x1={a.x} x2={a.x} className={cn("stroke-border", t === 0 && "stroke-foreground/40")} />
                )}
                <text {...(vertical ? { x: m.left - 6, y: a.y, textAnchor: "end", dominantBaseline: "middle" } : { x: a.x, y: height - 6, textAnchor: "middle" })}>
                  {format(t)}
                </text>
              </g>
            )
          })}
          <g key={String(zeroed)}>
            {data.map((d, i) => {
              const b = i * band + (band - thick) / 2
              const r = box(b, base, pos(d.value))
              const over = d.value > hi || d.value < lo
              const tipPoint = at(pos(d.value), b + thick / 2)
              const full = `${d.label}: ${exactFormat(d.value)}`
              return (
                <g
                  key={d.label + i}
                  ref={(el) => {
                    barRefs.current[i] = el
                  }}
                  role="listitem"
                  tabIndex={0}
                  aria-label={full}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(undefined)}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(undefined)}
                  className="outline-none focus-visible:[&>rect:nth-child(2)]:stroke-ring focus-visible:[&>rect:nth-child(2)]:stroke-2"
                >
                  <rect {...(vertical ? { x: m.left + i * band, y: m.top, width: band, height: L } : { x: m.left, y: m.top + i * band, width: L, height: band })} className="fill-transparent" />
                  <rect
                    {...r}
                    rx={2}
                    style={{ transformOrigin: vertical ? `0 ${m.top + L - base}px` : `${m.left + base}px 0`, animationDelay: `${i * 40}ms` }}
                    className={cn(vertical ? "motion-safe:animate-[cui-honest-bar-grow-y_400ms_ease-out_both]" : "motion-safe:animate-[cui-honest-bar-grow-x_400ms_ease-out_both]", active === i ? "fill-primary" : "fill-primary/75", over && "fill-amber-500 dark:fill-amber-400")}
                  />
                  {truncated && Math.abs(pos(d.value) - base) > 14 && <path d={zig(vertical ? r.x + thick / 2 : m.left + 8, vertical ? m.top + L - 8 : r.y + thick / 2, thick + 4)} className="fill-none stroke-card stroke-[3]" />}
                  {d.value > hi && <path d={zig(tipPoint.x, tipPoint.y + (vertical ? 1 : 0), thick + 4)} className="fill-none stroke-card stroke-2" />}
                  {over && (
                    <text {...(vertical ? { x: tipPoint.x, y: tipPoint.y - 5, textAnchor: "middle" } : { x: tipPoint.x + 5, y: tipPoint.y, dominantBaseline: "middle" })} className="fill-amber-700 font-semibold dark:fill-amber-300">
                      {format(d.value)}
                    </text>
                  )}
                  <text {...(vertical ? { x: b + m.left + thick / 2, y: height - 6, textAnchor: "middle" } : { x: m.left - 6, y: m.top + b + thick / 2, textAnchor: "end", dominantBaseline: "middle" })} className="fill-muted-foreground">
                    {short(d.label)}
                  </text>
                </g>
              )
            })}
          </g>
          {vertical ? (
            <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + L} className="stroke-foreground/40" />
          ) : (
            <line x1={m.left} x2={m.left + L} y1={height - m.bottom} y2={height - m.bottom} className="stroke-foreground/40" />
          )}
          {truncated && (
            <g transform={vertical ? `translate(${m.left} ${m.top + L - 8})` : `translate(${m.left + 8} ${height - m.bottom}) rotate(90)`} aria-hidden>
              <rect x={-6} y={-3} width={12} height={6} className="fill-card" />
              <path d="M-5,-1 L5,-5 M-5,5 L5,1" className="fill-none stroke-foreground/70 stroke-[1.5]" />
            </g>
          )}
        </svg>
        {tip && tipAt && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            style={{ left: Math.min(width - 40, Math.max(40, tipAt.x)), top: Math.max(0, tipAt.y - 6) }}
          >
            <span className="text-muted-foreground">{tip.label}</span> <span className="font-medium tabular-nums">{exactFormat(tip.value)}</span>
          </div>
        )}
      </div>
      {(truncated || zeroed || clipped > 0) && (
        <div aria-live="polite" className="grid gap-1 text-xs">
          {(truncated || zeroed) && (
            <p className={cn("flex gap-1.5", zeroed ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
              {!zeroed && <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>}
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                {!zeroed && <span className="py-1">{fill(lie && Number.isFinite(lie.drawn) ? truncatedText : cutOffText, { min: format(asked.lo), drawn: lie ? ratio(lie.drawn) : "", real: lie ? ratio(lie.real) : "" })}</span>}
                <button
                  type="button"
                  onClick={() => setZeroed((z) => !z)}
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {zeroed ? undoLabel : fixLabel}
                </button>
              </span>
            </p>
          )}
          {clipped > 0 && <p className="text-amber-700 dark:text-amber-400">{fill(clippedText, { count: clipped })}</p>}
        </div>
      )}
    </figure>
  )
}
