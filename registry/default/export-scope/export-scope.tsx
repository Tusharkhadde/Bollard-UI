"use client"

import * as React from "react"
import { CalendarRange, Columns3, Download, FileDown, Filter, Rows3, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ExportColumn {
  key: string
  label: string
  /** Hidden in the current table view. */
  hidden?: boolean
  /** Holds personal data (email, phone, address, ID numbers). */
  pii?: boolean
}

export interface ExportScopeData {
  /** Rows matching the filters across every page. */
  totalRows: number
  /** Rows on the page being viewed. */
  pageRows?: number
  /** Page being viewed (1-based) and the page count, for the readback. */
  page?: number
  pageCount?: number
  /** Rows ticked in the table. Shows a "Selected" choice when above 0. */
  selectedRows?: number
  filters?: { label: string; value: string }[]
  dateRange?: { from: Date | number | string; to: Date | number | string; label?: string }
  columns: ExportColumn[]
  /** Most rows the export can hold (a server cap, or 1,048,576 for Excel). */
  rowLimit?: number
}

export type ExportRows = "all" | "page" | "selected"
export type PiiMode = "include" | "mask" | "omit"
export interface ExportOptions {
  rows: ExportRows
  includeHidden: boolean
  pii: PiiMode
}

export type ExportIssue =
  | { kind: "page-only"; exporting: number; total: number }
  | { kind: "truncated"; exporting: number; requested: number }
  | { kind: "pii"; columns: string[] }

/** What the file will actually contain for these options, and what is likely a mistake. */
export function summarizeExport(scope: ExportScopeData, options: ExportOptions) {
  const available = { all: scope.totalRows, page: scope.pageRows ?? scope.totalRows, selected: scope.selectedRows ?? 0 }
  const requested = available[options.rows]
  const rowCount = scope.rowLimit ? Math.min(requested, scope.rowLimit) : requested
  const columns = scope.columns.filter((c) => (options.includeHidden || !c.hidden) && !(c.pii && options.pii === "omit"))
  const hiddenColumns = scope.columns.filter((c) => c.hidden)
  const piiColumns = columns.filter((c) => c.pii).map((c) => c.label)
  const issues: ExportIssue[] = []
  if (options.rows === "page" && scope.totalRows > requested) issues.push({ kind: "page-only", exporting: requested, total: scope.totalRows })
  if (rowCount < requested) issues.push({ kind: "truncated", exporting: rowCount, requested })
  if (options.pii === "include" && piiColumns.length) issues.push({ kind: "pii", columns: piiColumns })
  return { rowCount, columns, hiddenColumns, piiColumns, issues }
}

const toDate = (d: Date | number | string) => new Date(d)
/** "14 Sep – 13 Oct 2026 · 30 days", counting both ends. */
export function formatRange(from: Date | number | string, to: Date | number | string, locale = "en-GB") {
  const a = toDate(from)
  const b = toDate(to)
  const sameYear = a.getFullYear() === b.getFullYear()
  const fmt = (d: Date, year: boolean) => d.toLocaleDateString(locale, { day: "numeric", month: "short", year: year ? "numeric" : undefined })
  const days = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5) + 1
  return `${fmt(a, !sameYear)} – ${fmt(b, true)} · ${days} ${days === 1 ? "day" : "days"}`
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const segItem =
  "h-7 rounded-sm px-2.5 font-medium whitespace-nowrap text-muted-foreground transition-colors aria-checked:bg-accent aria-checked:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const move = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next][0])
    ;(event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex w-fit flex-wrap rounded-md border p-0.5 text-xs">
      {options.map(([key, text], i) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={(e) => move(e, i)} className={segItem}>
          {text}
        </button>
      ))}
    </div>
  )
}

function Line({ icon: Icon, term, children }: { icon: React.ComponentType<{ className?: string }>; term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {term}
      </dt>
      <dd className="grid min-w-0 gap-1.5 text-sm">{children}</dd>
    </div>
  )
}

/** Every other user-visible string. Words in braces are filled in. */
export const EXPORT_SCOPE_LABELS = {
  totals: "{rows} rows · {columns} columns",
  rows: "Rows",
  rowsToExport: "Rows to export",
  all: "All · {count}",
  page: "This page · {count}",
  selected: "Selected · {count}",
  pageOf: "Page {page} of {count}",
  dateRange: "Date range",
  filters: "Filters",
  filtersApplied: "Filters applied",
  noFilters: "None, every record",
  columns: "Columns",
  masked: "{label} (masked)",
  includeHidden: "Include {count} hidden ({columns})",
  personalData: "Personal data · {columns}",
  personalDataGroup: "Personal data",
  include: "Include",
  mask: "Mask",
  omit: "Leave out",
}

export interface ExportScopeProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** What the table currently shows: filters, range, pages, columns. */
  scope: ExportScopeData
  /** Controlled options. */
  value?: ExportOptions
  /** Initial options when uncontrolled. Defaults to the current page, the way most "Export" buttons behave. */
  defaultValue?: ExportOptions
  onValueChange?: (value: ExportOptions) => void
  /** Called with the chosen options and the readback. May return a Promise. */
  onExport?: (options: ExportOptions, summary: ReturnType<typeof summarizeExport>) => void | Promise<void>
  /** Locale for dates and numbers. */
  locale?: string
  title?: string
  /** Template: `{count}` rows. */
  downloadLabel?: string
  /** Templates: `{exporting}`, `{total}`, `{requested}`, `{columns}`. */
  pageOnlyText?: string
  truncatedText?: string
  piiText?: string
  allRowsLabel?: string
  maskLabel?: string
  /** Override any other string. */
  labels?: Partial<typeof EXPORT_SCOPE_LABELS>
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)

/**
 * Stops the "I exported the report" moment that was really page 1 of 250. Before the download
 * it reads back exactly what the file holds (row count, page, filters, the date range in plain
 * dates with its day count, hidden and personal-data columns) with toggles, warns when only one
 * page or a capped number of rows would go out, and offers a one-tap fix.
 */
export function ExportScope({
  scope,
  value,
  defaultValue = { rows: "page", includeHidden: false, pii: "include" },
  onValueChange,
  onExport,
  locale,
  title = "This export includes",
  downloadLabel = "Download {count} rows",
  pageOnlyText = "Only this page: {exporting} of {total} matching rows.",
  truncatedText = "Capped at {exporting} of {requested} rows. Narrow the filters or the date range.",
  piiText = "Includes personal data: {columns}.",
  allRowsLabel = "Export all {total}",
  maskLabel = "Mask it",
  labels,
  className,
  ...props
}: ExportScopeProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [pending, setPending] = React.useState(false)
  const t = { ...EXPORT_SCOPE_LABELS, ...labels }
  const n = (count: number) => count.toLocaleString(locale ?? "en-IN")
  const options = value ?? inner
  const summary = summarizeExport(scope, options)
  const set = (patch: Partial<ExportOptions>) => {
    const next = { ...options, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const download = async () => {
    setPending(true)
    try {
      await onExport?.(options, summary)
    } catch {
      // The caller reports its own failure; we only end the pending state.
    } finally {
      setPending(false)
    }
  }

  const rowChoices: [ExportRows, string][] = [["all", fill(t.all, { count: n(scope.totalRows) })], ["page", fill(t.page, { count: n(scope.pageRows ?? scope.totalRows) })]]
  if (scope.selectedRows) rowChoices.push(["selected", fill(t.selected, { count: n(scope.selectedRows) })])
  const hidden = summary.hiddenColumns
  const piiAll = scope.columns.filter((c) => c.pii)

  return (
    <div data-slot="export-scope" className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-export-scope-flash{from{background-color:rgb(245 158 11 / 0.3)}}"}</style>
      <div className="flex items-center gap-2">
        <FileDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm font-medium">{title}</p>
        <span key={summary.rowCount} className="rounded-sm px-1 text-xs font-medium tabular-nums motion-safe:animate-[cui-export-scope-flash_400ms_ease-out]">
          {fill(t.totals, { rows: n(summary.rowCount), columns: n(summary.columns.length) })}
        </span>
      </div>

      <dl className="grid divide-y rounded-md border">
        <Line icon={Rows3} term={t.rows}>
          <Segmented label={t.rowsToExport} value={options.rows} options={rowChoices} onChange={(rows) => set({ rows })} />
          {options.rows === "page" && scope.page && scope.pageCount ? (
            <span className="text-xs text-muted-foreground">{fill(t.pageOf, { page: n(scope.page), count: n(scope.pageCount) })}</span>
          ) : null}
        </Line>
        {scope.dateRange && (
          <Line icon={CalendarRange} term={t.dateRange}>
            <span className="tabular-nums">
              {scope.dateRange.label && <span className="font-medium">{scope.dateRange.label}: </span>}
              {formatRange(scope.dateRange.from, scope.dateRange.to, locale)}
            </span>
          </Line>
        )}
        <Line icon={Filter} term={t.filters}>
          {scope.filters?.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={t.filtersApplied}>
              {scope.filters.map((f) => (
                <li key={f.label} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  <span className="text-muted-foreground">{f.label}:</span> {f.value}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground">{t.noFilters}</span>
          )}
        </Line>
        <Line icon={Columns3} term={t.columns}>
          <span>{summary.columns.map((c) => (c.pii && options.pii === "mask" ? fill(t.masked, { label: c.label }) : c.label)).join(", ")}</span>
          {hidden.length > 0 && (
            <button type="button" role="switch" aria-checked={options.includeHidden} onClick={() => set({ includeHidden: !options.includeHidden })} className="group inline-flex w-fit items-center gap-2 rounded-md text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span className="relative h-5 w-9 shrink-0 rounded-full bg-input transition-colors group-aria-checked:bg-primary">
                <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-xs transition-transform duration-200 ease-out group-aria-checked:translate-x-4 motion-reduce:transition-none" />
              </span>
              <span className="text-left text-muted-foreground">
                {fill(t.includeHidden, { count: n(hidden.length), columns: hidden.map((c) => c.label).join(", ") })}
              </span>
            </button>
          )}
        </Line>
        {piiAll.length > 0 && (
          <Line icon={ShieldAlert} term={fill(t.personalData, { columns: piiAll.map((c) => c.label).join(", ") })}>
            <Segmented label={t.personalDataGroup} value={options.pii} options={[["include", t.include], ["mask", t.mask], ["omit", t.omit]]} onChange={(pii) => set({ pii })} />
          </Line>
        )}
      </dl>

      <div aria-live="polite" className="grid gap-1.5 text-xs empty:hidden">
        {summary.issues.map((issue) => (
          <p key={issue.kind} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">
                {issue.kind === "page-only"
                  ? fill(pageOnlyText, { exporting: n(issue.exporting), total: n(issue.total) })
                  : issue.kind === "truncated"
                    ? fill(truncatedText, { exporting: n(issue.exporting), requested: n(issue.requested) })
                    : fill(piiText, { columns: issue.columns.join(", ") })}
              </span>
              {issue.kind === "page-only" && (
                <button type="button" onClick={() => set({ rows: "all" })} className={fixClass}>
                  {fill(allRowsLabel, { total: n(issue.total) })}
                </button>
              )}
              {issue.kind === "pii" && (
                <button type="button" onClick={() => set({ pii: "mask" })} className={fixClass}>
                  {maskLabel}
                </button>
              )}
            </span>
          </p>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={download}
          disabled={pending || summary.rowCount === 0}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <Download aria-hidden className={cn("size-4", pending && "motion-safe:animate-pulse")} />
          {fill(downloadLabel, { count: n(summary.rowCount) })}
        </button>
      </div>
    </div>
  )
}
