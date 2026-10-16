"use client"

import * as React from "react"
import { ChartLine, Table2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type GapAwareDatum = {
  /** X label, e.g. "4 Oct". */
  label: string
  /** The reading, or null when there is none. 0 means a real zero. */
  value: number | null
  /** The value is filled in or modelled, not measured. */
  estimated?: boolean
}

/** Runs of missing readings, as inclusive index ranges. */
export function findGaps(data: GapAwareDatum[]) {
  const gaps: { start: number; end: number }[] = []
  data.forEach((d, i) => {
    if (d.value !== null) return
    const last = gaps[gaps.length - 1]
    if (last && last.end === i - 1) last.end = i
    else gaps.push({ start: i, end: i })
  })
  return gaps
}

/** "1, 2, 2.5 or 5 × 10ⁿ" ticks covering the readings. */
function niceTicks(lo: number, hi: number, count = 3) {
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1]
  const rough = (hi - lo) / count
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].find((f) => f * power >= rough)! * power
  const start = Math.floor(lo / step) * step
  const ticks: number[] = []
  for (let t = start; t <= Math.ceil(hi / step) * step + step / 2; t += step) ticks.push(Number(t.toPrecision(12)))
  return ticks
}

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })

export interface GapAwareLineProps extends Omit<React.ComponentProps<"figure">, "children"> {
  /** Readings in order. */
  data: GapAwareDatum[]
  /** Accessible name and caption. */
  label: string
  /** "chart" has axes and a summary; "sparkline" is a compact inline trend. */
  variant?: "chart" | "sparkline"
  /** Plot height in px. */
  height?: number
  /** Value format for axis, tooltip and table. */
  format?: (value: number) => string
  /** Show the data table instead of the chart at first. */
  defaultTable?: boolean
  /** Templates: `{from}`, `{to}`, `{count}`, `{gaps}` and `{estimated}` are filled in. */
  gapText?: string
  gapRangeText?: string
  summaryText?: string
  noDataLabel?: string
  estimatedLabel?: string
  showTableLabel?: string
  showChartLabel?: string
  valueHeader?: string
  noteHeader?: string
}

/**
 * A pure-SVG line that never lies about missing data. A null breaks the line instead of
 * dropping to zero or being silently bridged; the hole is shaded and says "No data · 4–6 Oct"
 * on hover or keyboard focus; a lone reading between two gaps still shows as a dot (a classic
 * charting bug hides it); estimated points are hollow with dashed segments; and every reading
 * is in a data table, visually hidden until asked for.
 */
export function GapAwareLine({
  data, label, variant = "chart", height, format = (v) => compact.format(v), defaultTable = false,
  gapText = "No data · {from}", gapRangeText = "No data · {from} – {to} ({count} readings)",
  summaryText = "{gaps} · {estimated}. Breaks are missing data, not zero.",
  noDataLabel = "No data", estimatedLabel = "Estimated", showTableLabel = "Table", showChartLabel = "Chart",
  valueHeader = "Value", noteHeader = "Note",
  className, ...props
}: GapAwareLineProps) {
  const [width, setWidth] = React.useState(320)
  const [active, setActive] = React.useState<number>()
  const [table, setTable] = React.useState(defaultTable)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const ids = React.useId().replace(/:/g, "")
  const spark = variant === "sparkline"

  React.useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(80, Math.round(entry.contentRect.width))))
    observer.observe(box)
    return () => observer.disconnect()
  }, [table])

  const gaps = findGaps(data)
  const gapOf = (i: number) => gaps.find((g) => i >= g.start && i <= g.end)
  const gapLabel = (g: { start: number; end: number }) =>
    fill(g.start === g.end ? gapText : gapRangeText, { from: data[g.start].label, to: data[g.end].label, count: g.end - g.start + 1 })
  const estimates = data.filter((d) => d.value !== null && d.estimated).length
  const measured = data.flatMap((d) => (d.value === null ? [] : [d.value]))
  const readings = measured.length ? measured : [0]
  const ticks = niceTicks(Math.min(...readings, spark ? Infinity : 0), Math.max(...readings))
  const lo = spark ? Math.min(...readings) : ticks[0]
  const hi = spark ? Math.max(...readings) : ticks[ticks.length - 1]

  const m = spark ? { top: 4, right: 4, bottom: 4, left: 4 } : { top: 8, right: 8, bottom: 20, left: 34 }
  const plotH = height ?? (spark ? 32 : 140)
  const H = plotH + m.top + m.bottom
  const step = (width - m.left - m.right) / Math.max(1, data.length - 1)
  const x = (i: number) => m.left + i * step
  const y = (v: number) => m.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH

  let solid = ""
  let dashed = ""
  data.forEach((d, i) => {
    const next = data[i + 1]
    if (d.value === null || !next || next.value === null) return
    const seg = `M${x(i)},${y(d.value)}L${x(i + 1)},${y(next.value)}`
    if (d.estimated || next.estimated) dashed += seg
    else solid += seg
  })
  const lone = data.map((d, i) => d.value !== null && data[i - 1]?.value == null && data[i + 1]?.value == null)

  const describe = (i: number) => {
    const d = data[i]
    const gap = gapOf(i)
    return d.value === null && gap ? gapLabel(gap) : `${d.label}: ${format(d.value ?? 0)}${d.estimated ? ` (${estimatedLabel.toLowerCase()})` : ""}`
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1, Home: -data.length, End: data.length }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    setActive((a) => Math.min(data.length - 1, Math.max(0, (a ?? (delta > 0 ? -1 : data.length)) + delta)))
  }
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left
    setActive(Math.min(data.length - 1, Math.max(0, Math.round((event.clientX - left - m.left) / step))))
  }

  const activeGap = active !== undefined ? gapOf(active) : undefined
  const tipX = active === undefined ? 0 : activeGap ? (x(activeGap.start) + x(activeGap.end)) / 2 : x(active)
  const tipY = active === undefined || activeGap ? m.top : y(data[active].value ?? 0)
  const summary = fill(summaryText, {
    gaps: gaps.length ? `${gaps.length} ${gaps.length === 1 ? "gap" : "gaps"} (${gaps.map((g) => (g.start === g.end ? data[g.start].label : `${data[g.start].label}–${data[g.end].label}`)).join(", ")})` : "No gaps",
    estimated: `${estimates} estimated`,
  })
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(width / 56))))
  const toggle = "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <figure data-slot="gap-aware-line" data-variant={variant} className={cn("grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-2", !spark && "max-w-md rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-gap-aware-line-reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}"}</style>
      <figcaption className={cn("flex items-center justify-between gap-2", spark && "sr-only")}>
        <span className="text-sm font-medium">{label}</span>
        {!spark && (
        <button type="button" aria-pressed={table} onClick={() => setTable((t) => !t)} className={toggle}>
          {table ? <ChartLine aria-hidden className="size-3.5" /> : <Table2 aria-hidden className="size-3.5" />}
          {table ? showChartLabel : showTableLabel}
        </button>
        )}
      </figcaption>

      {!table && (
        <div ref={boxRef} className="relative min-w-0">
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`${label}. ${summary}`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(undefined)}
            onBlur={() => setActive(undefined)}
            className="block touch-pan-y overflow-visible rounded-sm text-[10px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <defs>
              <pattern id={`${ids}h`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="5" className="stroke-muted-foreground/25" strokeWidth="1.5" />
              </pattern>
            </defs>
            {!spark &&
              ticks.map((t) => (
                <g key={t}>
                  <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-foreground/40" : "stroke-border"} />
                  <text x={m.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground">{format(t)}</text>
                </g>
              ))}
            {gaps.map((g) => {
              const x1 = Math.max(m.left, x(g.start) - step / 2)
              const x2 = Math.min(width - m.right, x(g.end) + step / 2)
              const on = activeGap === g
              return (
                <g key={g.start}>
                  <rect x={x1} y={m.top} width={x2 - x1} height={plotH} fill={`url(#${ids}h)`} className={cn("transition-opacity duration-200", on ? "opacity-100" : "opacity-70")} />
                  <rect x={x1} y={m.top} width={x2 - x1} height={plotH} className={cn("fill-amber-500/0 transition-colors duration-200", on && "fill-amber-500/15")} />
                  {!spark && x2 - x1 >= 44 && (
                    <text x={(x1 + x2) / 2} y={m.top + plotH / 2} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground">{noDataLabel}</text>
                  )}
                </g>
              )
            })}
            <g className="motion-safe:animate-[cui-gap-aware-line-reveal_400ms_ease-out] fill-none stroke-primary" strokeWidth={spark ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
              <path d={solid} />
              <path d={dashed} strokeDasharray="3 3" className="stroke-primary/70" />
              {data.map((d, i) =>
                d.value !== null && (lone[i] || d.estimated || (!spark && active === i)) ? (
                  <circle key={i} cx={x(i)} cy={y(d.value)} r={active === i ? 4 : 3} strokeWidth={1.5} className={cn("transition-[r] duration-150", d.estimated ? "fill-card" : "fill-primary")} />
                ) : null,
              )}
            </g>
            {active !== undefined && !activeGap && <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + plotH} className="stroke-foreground/25" strokeDasharray="2 2" />}
            {!spark &&
              data.map((d, i) =>
                i === data.length - 1 || (i % every === 0 && (data.length - 1 - i) * step >= 48) ? (
                  <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="fill-muted-foreground">{d.label}</text>
                ) : null,
              )}
          </svg>
          {active !== undefined && (
            <div
              aria-hidden
              className={cn("pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md", activeGap && "border-amber-500/40")}
              style={{ left: Math.min(width - 60, Math.max(60, tipX)), top: Math.max(0, tipY - 6) }}
            >
              {describe(active)}
            </div>
          )}
          <p aria-live="polite" className="sr-only">{active !== undefined ? describe(active) : ""}</p>
        </div>
      )}

      {!spark && !table && <p className="text-xs text-muted-foreground">{summary}</p>}

      <table className={cn("w-full text-left text-xs tabular-nums", !table && "sr-only")}>
        <caption className="sr-only">{label}</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-1.5 font-medium"><span className="sr-only">Label</span></th>
            <th scope="col" className="py-1.5 text-right font-medium">{valueHeader}</th>
            <th scope="col" className="py-1.5 pl-3 font-medium">{noteHeader}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i} className={cn("border-b last:border-0", d.value === null && "text-muted-foreground")}>
              <th scope="row" className="py-1 font-normal">{d.label}</th>
              <td className="py-1 text-right">{d.value === null ? "—" : format(d.value)}</td>
              <td className="py-1 pl-3">{d.value === null ? noDataLabel : d.estimated ? estimatedLabel : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
