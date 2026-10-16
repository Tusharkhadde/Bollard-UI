"use client"

import * as React from "react"
import { TrendingDown, TrendingUp, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { describeChange, formatRelative } from "@/registry/default/change-readout/change-readout"

export type PartialComparison = {
  /** Total of the current period so far. */
  current: number
  /** Total of the whole previous period. */
  previousFull: number
  /** Previous period up to the same point, prorating the bucket in progress. */
  previousToDate: number
  /** Share of the current period that has elapsed, 0–1. */
  completeness: number
  /** Index of the bucket still filling, or null. */
  partialIndex: number | null
  /** Where the current period lands if the rest follows the previous period's shape, or null. */
  projected: number | null
}

/**
 * Compares a still-filling period fairly. `elapsed` counts buckets gone by, fractions included
 * (14.25 = quarter past 2 PM in hourly buckets). The previous period is cut at the same point,
 * and the projection scales by the previous period's own curve, not a straight line, because
 * most traffic isn't spread evenly across a day or a month.
 */
export function comparePartialPeriod(current: (number | null)[], previous: number[], elapsed: number): PartialComparison {
  const n = previous.length
  const done = Math.min(n, Math.max(0, elapsed))
  const whole = Math.floor(done)
  const fraction = done - whole
  const sum = (values: (number | null)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0)
  const previousToDate = sum(previous.slice(0, whole)) + (whole < n ? previous[whole] * fraction : 0)
  const currentSoFar = sum(current.slice(0, Math.ceil(done)))
  const previousFull = sum(previous)
  return {
    current: currentSoFar,
    previousFull,
    previousToDate,
    completeness: n ? done / n : 1,
    partialIndex: fraction > 0 && whole < n ? whole : null,
    projected: done < n && previousToDate > 0 ? (currentSoFar * previousFull) / previousToDate : null,
  }
}

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

export interface PartialPeriodProps extends Omit<React.ComponentProps<"figure">, "children"> {
  /** Metric name, e.g. "Orders". */
  label: string
  /** Current period per bucket; buckets that haven't happened yet can be null. */
  current: (number | null)[]
  /** Previous, complete period per bucket. */
  previous: number[]
  /** Buckets elapsed in the current period, with a fraction for the one in progress. */
  elapsed: number
  /** Axis label per bucket, e.g. "12 AM", "6 AM". Every few are shown. */
  bucketLabels?: string[]
  /** Where the current period is cut, e.g. "2:15 PM" or "13 Oct". */
  cutoffLabel: string
  /** Name of the current period, e.g. "Today". */
  currentLabel?: string
  /** Name of the previous period, lower case, e.g. "yesterday". */
  previousLabel?: string
  /** "to-date" compares like for like; "full" compares with the whole previous period. */
  mode?: "to-date" | "full"
  defaultMode?: "to-date" | "full"
  onModeChange?: (mode: "to-date" | "full") => void
  /** Whether a rise is good news. */
  higherIsBetter?: boolean
  /** Show where the period is heading, marked as an estimate. */
  showProjection?: boolean
  /** Number format for totals. */
  format?: (value: number) => string
  /** Templates: `{current}`, `{previous}`, `{cutoff}`, `{pct}`, `{change}` and `{value}` are filled in. */
  toDateLabel?: string
  fullLabel?: string
  soFarText?: string
  warningText?: string
  fixLabel?: string
  projectionText?: string
  partialLabel?: string
  estimateLabel?: string
}

/**
 * Catches "today so far vs all of yesterday", the comparison that makes every morning look like
 * a crash. It defaults to like-for-like (yesterday cut at the same minute), warns with a one-tap
 * fix when someone switches to the full period, hatches the bucket still filling, dims the part
 * of the previous period that hasn't been reached yet, and projects the finish from the previous
 * period's own curve, labelled as an estimate.
 */
export function PartialPeriod({
  label, current, previous, elapsed, bucketLabels, cutoffLabel, currentLabel = "Today", previousLabel = "yesterday",
  mode, defaultMode = "to-date", onModeChange, higherIsBetter = true, showProjection = true, format = (v) => plain.format(v),
  toDateLabel = "By {cutoff}", fullLabel = "All of {previous}", soFarText = "{current} so far · {pct} of the period",
  warningText = "{current} is only {pct} done, so comparing it with all of {previous} makes it look {change}.",
  fixLabel = "Compare by {cutoff}", projectionText = "On pace for about {value} if the rest follows {previous}.",
  partialLabel = "so far", estimateLabel = "estimate",
  className, ...props
}: PartialPeriodProps) {
  const [inner, setInner] = React.useState(defaultMode)
  const [width, setWidth] = React.useState(320)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const hatchId = React.useId().replace(/:/g, "")
  const active = mode ?? inner

  React.useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.round(entry.contentRect.width))))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const setMode = (next: "to-date" | "full") => {
    if (mode === undefined) setInner(next)
    onModeChange?.(next)
  }

  const r = comparePartialPeriod(current, previous, elapsed)
  const partial = r.completeness < 1
  const fair = !partial || active === "to-date"
  const base = fair ? r.previousToDate : r.previousFull
  const change = describeChange(base, r.current)
  const changeText = change.relative === null ? format(change.delta) : formatRelative(change.relative)
  const good = change.direction === "same" ? null : (change.direction === "up") === higherIsBetter
  const values = {
    current: currentLabel,
    previous: previousLabel,
    cutoff: cutoffLabel,
    pct: `${Math.round(r.completeness * 100)}%`,
    change: formatRelative(describeChange(r.previousFull, r.current).relative ?? 0),
    value: r.projected === null ? "" : format(r.projected),
  }
  const vsText = !partial ? `vs ${previousLabel}` : fair ? `vs ${previousLabel} by ${cutoffLabel}` : `vs all of ${previousLabel}`

  // Chart geometry.
  const n = previous.length
  const H = 88
  const top = 12
  const ratio = r.previousToDate > 0 ? r.current / r.previousToDate : 0
  const peak = Math.max(1, ...previous, ...current.map((v) => v ?? 0), ...(showProjection ? previous.map((v) => v * ratio) : []))
  const band = width / Math.max(1, n)
  const y = (v: number) => top + H - (v / peak) * H
  const cutX = Math.min(n, elapsed) * band
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(width / 64))))

  return (
    <figure data-slot="partial-period" data-mode={active} className={cn("grid w-full min-w-0 max-w-md gap-3 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-partial-period-flash{from{background-color:rgb(245 158 11 / .3)}}"}</style>
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-semibold tabular-nums">{format(r.current)}</span>
            <span
              key={active}
              aria-live="polite"
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1 text-sm font-medium motion-safe:animate-[cui-partial-period-flash_400ms_ease-out]",
                good === null ? "text-muted-foreground" : good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
              )}
            >
              {change.direction === "up" ? <TrendingUp aria-hidden className="size-4" /> : change.direction === "down" ? <TrendingDown aria-hidden className="size-4" /> : null}
              {changeText}
              <span className="font-normal text-muted-foreground">
                {vsText} ({format(base)})
              </span>
            </span>
          </span>
          {partial && <span className="text-xs text-muted-foreground">{fill(soFarText, values)}</span>}
        </span>
        {partial && (
          <span role="radiogroup" aria-label={`Compare ${currentLabel} with ${previousLabel}`} className="inline-flex rounded-md border p-0.5">
            {(["to-date", "full"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active === m}
                onClick={() => setMode(m)}
                className="h-7 rounded-[5px] px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-accent aria-checked:text-foreground"
              >
                {fill(m === "to-date" ? toDateLabel : fullLabel, values)}
              </button>
            ))}
          </span>
        )}
      </figcaption>

      <div ref={boxRef} className="min-w-0" aria-hidden>
        <svg width={width} height={top + H + 18} className="block overflow-visible text-[10px]">
          <defs>
            <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" className="fill-primary/25" />
              <line x1="0" y1="0" x2="0" y2="4" className="stroke-primary" strokeWidth="2" />
            </pattern>
          </defs>
          {previous.map((v, i) => {
            const reached = i < Math.ceil(Math.min(n, elapsed))
            return (
              <rect
                key={`p${i}`}
                x={i * band + band * 0.1}
                y={y(v)}
                width={band * 0.8}
                height={top + H - y(v)}
                rx={1.5}
                className={cn("fill-muted-foreground/20 transition-opacity duration-300 ease-out", fair && partial && !reached && "opacity-35")}
              />
            )
          })}
          {previous.map((v, i) => {
            const value = current[i]
            const x = i * band + band * 0.25
            if (i < Math.ceil(Math.min(n, elapsed)) && value !== null && value !== undefined) {
              const isPartial = i === r.partialIndex
              return (
                <g key={`c${i}`}>
                  <rect x={x} y={y(value)} width={band * 0.5} height={top + H - y(value)} rx={1.5} fill={isPartial ? `url(#${hatchId})` : undefined} className={cn(!isPartial && "fill-primary")} />
                  {isPartial && (
                    <text x={x + band * 0.25} y={y(Math.max(value, v)) - 3} textAnchor="middle" paintOrder="stroke" strokeWidth={3} className="fill-foreground stroke-card font-medium">
                      {partialLabel}
                    </text>
                  )}
                </g>
              )
            }
            if (!showProjection || r.projected === null || i < Math.floor(elapsed)) return null
            const est = v * ratio
            return <rect key={`e${i}`} x={x} y={y(est)} width={band * 0.5} height={top + H - y(est)} rx={1.5} className="fill-none stroke-primary/60" strokeDasharray="2 2" />
          })}
          {partial && <line x1={cutX} x2={cutX} y1={2} y2={top + H} className="stroke-foreground/60" strokeDasharray="3 2" />}
          {partial && (
            <text x={Math.min(width - 2, Math.max(2, cutX))} y={-2} textAnchor={cutX > width - 30 ? "end" : cutX < 30 ? "start" : "middle"} className="fill-muted-foreground">
              {cutoffLabel}
            </text>
          )}
          <line x1={0} x2={width} y1={top + H} y2={top + H} className="stroke-border" />
          {bucketLabels?.map((text, i) =>
            i % tickEvery === 0 ? (
              <text key={`t${i}`} x={i * band + band / 2} y={top + H + 13} textAnchor={i === 0 ? "start" : "middle"} className="fill-muted-foreground">
                {text}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-primary" />{currentLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-xs bg-muted-foreground/20" />{previousLabel.charAt(0).toUpperCase() + previousLabel.slice(1)}</span>
        {r.partialIndex !== null && <span className="inline-flex items-center gap-1.5"><svg className="size-2.5 rounded-xs"><rect width="10" height="10" fill={`url(#${hatchId})`} /></svg>In progress</span>}
        {showProjection && r.projected !== null && <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-xs border border-dashed border-primary/60" />{estimateLabel.charAt(0).toUpperCase() + estimateLabel.slice(1)}</span>}
      </div>

      <div aria-live="polite" className="grid gap-1.5 text-xs empty:hidden">
        {partial && !fair && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(warningText, values)}</span>
              <button
                type="button"
                onClick={() => setMode("to-date")}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {fill(fixLabel, values)}
              </button>
            </span>
          </p>
        )}
        {showProjection && r.projected !== null && (
          <p className="text-muted-foreground">
            {fill(projectionText, values)} <span className="rounded-sm border border-dashed px-1 text-[10px] tracking-wide uppercase">{estimateLabel}</span>
          </p>
        )}
      </div>
    </figure>
  )
}
