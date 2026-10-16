"use client"

// Bollard UI — dual-axis-guard · MIT licence · https://bollard-ui.vercel.app/components/dual-axis-guard

import * as React from "react"
import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type DualAxisMode = "dual" | "indexed"
export interface DualAxisSeries {
  /** Series name, shown in the legend and readout. */
  label: string
  values: number[]
  /** Axis range. Left out, it is fitted to the data the way most chart libraries do (no zero). */
  domain?: [number, number]
  /** Formats values on this axis. */
  format?: (value: number) => string
}

/** A "nice" axis range fitted to the values: what Recharts, Chart.js and Excel pick by default. */
export function autoDomain(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) return [0, 1]
  const lo = Math.min(...finite), hi = Math.max(...finite)
  const step = niceStep((hi - lo || Math.abs(hi) || 1) / 4)
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
}

/** 1, 2, 2.5 or 5 times a power of ten, at least `rough`. */
function niceStep(rough: number) {
  const power = 10 ** Math.floor(Math.log10(rough))
  return [1, 2, 2.5, 5, 10].map((f) => f * power).find((s) => s >= rough * 0.999) ?? 10 * power
}

/** Round tick values inside a domain. */
function niceTicks([lo, hi]: [number, number]) {
  const step = niceStep((hi - lo || 1) / 4)
  const out: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

/** Values rebased so the point at `at` is 100. Null when that point is zero or negative. */
export function indexTo100(values: number[], at = 0) {
  const base = values[at]
  return base > 0 ? values.map((v) => (v / base) * 100) : null
}

/**
 * Finds what makes a dual-axis chart lie. `zero`: zero sits at different heights on the two axes
 * (or only one axis shows it). `scale`: the two lines move a similar distance on screen while the
 * data changed by very different percentages (or the reverse), which reads as a correlation that
 * isn't there.
 */
export function analyzeDualAxis(left: number[], right: number[], leftDomain: [number, number], rightDomain: [number, number], at = 0) {
  const zeroAt = ([lo, hi]: [number, number]) => (lo <= 0 && hi >= 0 ? (0 - lo) / (hi - lo || 1) : null)
  const zl = zeroAt(leftDomain), zr = zeroAt(rightDomain)
  const zero = (zl === null) !== (zr === null) ? "one-side" : zl !== null && zr !== null && Math.abs(zl - zr) > 0.05 ? "offset" : null
  // Change is measured to the last real point, so a trailing gap (NaN) doesn't hide it.
  const last = (v: number[]) => { for (let i = v.length - 1; i >= 0; i--) if (Number.isFinite(v[i])) return v[i]; return NaN }
  const move = (v: number[], [lo, hi]: [number, number]) => ({
    drawn: (last(v) - v[at]) / (hi - lo || 1),
    real: v[at] !== 0 ? (last(v) - v[at]) / Math.abs(v[at]) : NaN,
  })
  const l = move(left, leftDomain), r = move(right, rightDomain)
  let scale: "look-same" | "look-different" | null = null
  if (Number.isFinite(l.real) && Number.isFinite(r.real) && l.real !== 0 && r.real !== 0) {
    const looksAlike = Math.abs(l.drawn - r.drawn) < 0.2 && Math.sign(l.drawn) === Math.sign(r.drawn)
    const ratio = Math.abs(l.real) > Math.abs(r.real) ? l.real / r.real : r.real / l.real
    const reallyAlike = ratio > 0 && ratio < 1.5
    if (looksAlike && !reallyAlike) scale = "look-same"
    else if (!looksAlike && reallyAlike && Math.abs(l.drawn - r.drawn) > 0.35) scale = "look-different"
  }
  return { zero, scale, leftChange: l.real, rightChange: r.real, canIndex: left[at] > 0 && right[at] > 0 }
}

export interface DualAxisGuardMessages {
  zeroOffset: string; zeroOneSide: string; lookSame: string; lookDifferent: string
  indexFix: string; indexed: string; undo: string; cannotIndex: string; indexAxis: string; leftAxis: string; rightAxis: string
  /** The chart's screen-reader summary, with {label}, {left}, {leftChange}, {right}, {rightChange}, {at}. */
  summary?: string
  /** Screen-reader name of the point scrubber. */
  scrubber?: string
  /** Shown for a point with no value. */
  noValue?: string
}
const DEFAULTS: DualAxisGuardMessages = {
  zeroOffset: "Zero sits at different heights on the two axes, so where the lines cross means nothing.",
  zeroOneSide: "Only one axis starts at zero, so the two lines can't be compared by height.",
  lookSame: "The lines move almost alike, but {left} changed {leftChange} and {right} changed {rightChange}. The match comes from the axis ranges.",
  lookDifferent: "The lines look very different, but {left} changed {leftChange} and {right} changed {rightChange}.",
  indexFix: "Index both to 100",
  indexed: "Both start at 100 in {at}, on one scale. Hover for real values.",
  undo: "Show two axes",
  cannotIndex: "Can't index: a series is zero or negative in {at}.",
  indexAxis: "Index ({at} = 100)",
  leftAxis: "left axis",
  rightAxis: "right axis",
  summary: "{label}. {left}: {leftChange}; {right}: {rightChange} since {at}. Use arrow keys to read values.",
  scrubber: "{label}, values by point",
  noValue: "no data",
}
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** What a custom chart needs to draw the current view. */
export interface DualAxisView {
  mode: DualAxisMode
  left: { values: number[]; domain: [number, number] }
  right: { values: number[]; domain: [number, number] }
}

export interface DualAxisGuardProps extends Omit<React.ComponentProps<"figure">, "children" | "defaultValue" | "onChange"> {
  /** Accessible name of the chart, shown as its caption. */
  label: string
  /** X-axis labels, one per value. */
  labels: string[]
  /** The series on the left axis. */
  left: DualAxisSeries
  /** The series on the right axis. */
  right: DualAxisSeries
  /** Controlled view. */
  value?: DualAxisMode
  /** Initial view when uncontrolled. */
  defaultValue?: DualAxisMode
  /** Called when the view switches between dual-axis and indexed. */
  onValueChange?: (mode: DualAxisMode) => void
  /** Which point becomes 100 when indexed, and where change is measured from. */
  indexAt?: number
  /** Locale for the default number and percent formats. */
  locale?: string
  /** Plot height in px. */
  height?: number
  /** Draw with your own chart library instead of the built-in SVG; the warnings still apply. */
  children?: (view: DualAxisView) => React.ReactNode
  /** Override any visible string. */
  messages?: Partial<DualAxisGuardMessages>
}

/**
 * A dual-axis line chart that catches the two ways two y-axes mislead: zero baselines at
 * different heights, and independent ranges that make a +15% line and a +140% line climb in
 * lockstep. It says how much each series really changed and offers a one-tap "index both to 100",
 * which puts them on one honest scale while the readout keeps the real values.
 */
export function DualAxisGuard({
  label, labels, left, right, value, defaultValue = "dual", onValueChange, indexAt = 0, locale = "en", height = 160, children, messages, className, ...props
}: DualAxisGuardProps) {
  const t = { ...DEFAULTS, ...messages } as Required<DualAxisGuardMessages>
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 })
  const signed = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" })
  const [inner, setInner] = React.useState(defaultValue)
  const [active, setActive] = React.useState<number>()
  const [width, setWidth] = React.useState(320)
  const box = React.useRef<HTMLDivElement>(null)
  const mode = value ?? inner
  const setMode = (next: DualAxisMode) => { if (value === undefined) setInner(next); onValueChange?.(next) }

  React.useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ld = left.domain ?? autoDomain(left.values), rd = right.domain ?? autoDomain(right.values)
  const a = analyzeDualAxis(left.values, right.values, ld, rd, indexAt)
  const li = indexTo100(left.values, indexAt), ri = indexTo100(right.values, indexAt)
  const indexed = mode === "indexed" && li && ri
  const id = indexed ? autoDomain([...li, ...ri, 100]) : null
  const view: DualAxisView = indexed
    ? { mode, left: { values: li, domain: id! }, right: { values: ri, domain: id! } }
    : { mode: "dual", left: { values: left.values, domain: ld }, right: { values: right.values, domain: rd } }
  const at = labels[indexAt] ?? ""
  const show = (f: (v: number) => string) => (v: number) => (Number.isFinite(v) ? f(v) : t.noValue)
  const fl = show(left.format ?? compact.format), fr = show(right.format ?? compact.format)

  const m = { top: 8, right: indexed ? 10 : 40, bottom: 20, left: 40 }
  const W = width - m.left - m.right
  const x = (i: number) => m.left + (labels.length > 1 ? (i / (labels.length - 1)) * W : W / 2)
  const y = (v: number, [lo, hi]: [number, number]) => m.top + height - ((v - lo) / (hi - lo || 1)) * height
  // Gaps (NaN, Infinity) break the line instead of drawing it to zero.
  const path = (vals: number[], d: [number, number]) =>
    vals.map((v, i) => (Number.isFinite(v) ? `${i && Number.isFinite(vals[i - 1]) ? "L" : "M"}${x(i)},${y(v, d)}` : "")).join("")
  const ticks = niceTicks

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 3, PageDown: -3, Home: -labels.length, End: labels.length }[e.key]
    if (step === undefined) return
    e.preventDefault()
    setActive((i) => Math.min(labels.length - 1, Math.max(0, (i ?? (step > 0 ? -1 : labels.length)) + step)))
  }
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    setActive(Math.min(labels.length - 1, Math.max(0, Math.round(((px - m.left) / W) * (labels.length - 1)))))
  }

  const readout = (i: number) =>
    `${labels[i]} · ${left.label} ${fl(left.values[i])} · ${right.label} ${fr(right.values[i])}` +
    (indexed && Number.isFinite(li![i]) && Number.isFinite(ri![i]) ? ` · ${Math.round(li![i])} vs ${Math.round(ri![i])}` : "")
  const summaryId = React.useId()
  const point = active ?? labels.length - 1

  const warnings = [
    !indexed && a.zero && (a.zero === "offset" ? t.zeroOffset : t.zeroOneSide),
    !indexed && a.scale && fill(a.scale === "look-same" ? t.lookSame : t.lookDifferent, { left: left.label, right: right.label, leftChange: signed.format(a.leftChange), rightChange: signed.format(a.rightChange) }),
  ].filter(Boolean) as string[]

  return (
    <figure data-slot="dual-axis-guard" className={cn("grid w-full min-w-0 max-w-md grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-foreground" />{left.label}{!indexed && ` (${t.leftAxis})`}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground" />{right.label}{!indexed && ` (${t.rightAxis})`}</li>
        {indexed && <li className="ml-auto">{fill(t.indexAxis, { at })}</li>}
      </ul>
      <div ref={box} className="relative min-w-0">
        {children ? children(view) : (
          <>
            <p id={summaryId} className="sr-only">{fill(t.summary, { label, left: left.label, leftChange: signed.format(a.leftChange), right: right.label, rightChange: signed.format(a.rightChange), at })}</p>
            {/* A slider, not an image: browse-mode screen readers can reach it, and arrow keys step through the points. */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={fill(t.scrubber, { label })}
              aria-describedby={summaryId}
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={Math.max(0, labels.length - 1)}
              aria-valuenow={point}
              aria-valuetext={labels.length ? readout(point) : undefined}
              onKeyDown={onKeyDown}
              onFocus={() => setActive((i) => i ?? labels.length - 1)}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={(e) => document.activeElement !== e.currentTarget && setActive(undefined)}
              onBlur={() => setActive(undefined)}
              className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
            <svg aria-hidden width={width} height={height + m.top + m.bottom} className="block overflow-visible text-[10px]">
              {ticks(view.left.domain).map((v) => (
                <g key={`l${v}`}>
                  <line x1={m.left} x2={width - m.right} y1={y(v, view.left.domain)} y2={y(v, view.left.domain)} className="stroke-border" />
                  <text x={m.left - 6} y={y(v, view.left.domain)} textAnchor="end" dominantBaseline="middle" className="fill-foreground/80">{indexed ? Math.round(v) : fl(v)}</text>
                </g>
              ))}
              {!indexed && ticks(rd).map((v) => (
                <text key={`r${v}`} x={width - m.right + 6} y={y(v, rd)} dominantBaseline="middle" className="fill-muted-foreground">{fr(v)}</text>
              ))}
              {!indexed && a.zero && ([[ld, m.left - 2, "end"], [rd, width - m.right + 2, "start"]] as const).map(([d, px], k) =>
                d[0] <= 0 && d[1] >= 0 ? <path key={k} d={`M${px - (k ? 0 : 4)},${y(0, d)} h4`} className="stroke-amber-500 stroke-[3]" /> : null,
              )}
              {labels.map((l, i) => (i === 0 || i === labels.length - 1 || W / labels.length >= 44) && (
                <text key={l + i} x={x(i)} y={height + m.top + 14} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="fill-muted-foreground">{l}</text>
              ))}
              <path d={path(view.right.values, view.right.domain)} className="fill-none stroke-muted-foreground stroke-2 [stroke-dasharray:5_4] transition-[d] duration-300 ease-out motion-reduce:transition-none" />
              <path d={path(view.left.values, view.left.domain)} className="fill-none stroke-foreground stroke-2 transition-[d] duration-300 ease-out motion-reduce:transition-none" />
              {active !== undefined && (
                <g aria-hidden>
                  <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + height} className="stroke-foreground/30" />
                  {Number.isFinite(view.left.values[active]) && <circle cx={x(active)} cy={y(view.left.values[active], view.left.domain)} r={3.5} className="fill-foreground" />}
                  {Number.isFinite(view.right.values[active]) && <circle cx={x(active)} cy={y(view.right.values[active], view.right.domain)} r={3.5} className="fill-card stroke-muted-foreground stroke-2" />}
                </g>
              )}
            </svg>
            </div>
          </>
        )}
      </div>
      {/* The slider announces its own value; only a custom chart needs the readout announced. */}
      <p aria-live={children ? "polite" : undefined} className="min-h-4 text-xs text-muted-foreground tabular-nums">
        {active !== undefined && readout(active)}
      </p>
      <div aria-live="polite" className="grid gap-1 text-xs empty:hidden">
        {warnings.map((w) => (
          <p key={w} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="py-1">{w}</span>
          </p>
        ))}
        {(warnings.length > 0 || indexed) && (
          <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", warnings.length ? "pl-5" : "text-muted-foreground")}>
            {indexed && <span className="py-1">{fill(t.indexed, { at })}</span>}
            {a.canIndex ? (
              <button type="button" aria-pressed={!!indexed} onClick={() => setMode(indexed ? "dual" : "indexed")} className={fixClass}>{indexed ? t.undo : t.indexFix}</button>
            ) : (
              <span className="py-1 text-muted-foreground">{fill(t.cannotIndex, { at })}</span>
            )}
          </p>
        )}
      </div>
    </figure>
  )
}
