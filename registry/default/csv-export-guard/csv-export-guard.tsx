"use client"

import * as React from "react"
import { Check, Download, FileSpreadsheet, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzeCsv, spreadsheetIssue, toCsv, type CsvIssueKind } from "./csv-checks"

export { analyzeCsv, fixCell, spreadsheetIssue, toCsv } from "./csv-checks"
export type { CsvCellIssue, CsvColumnReport, CsvIssueKind } from "./csv-checks"

const DEFAULT_MESSAGES: Record<CsvIssueKind, string> = {
  "leading-zero": "lose leading zeros",
  "long-number": "turn into scientific notation",
  "plus-number": "lose the + sign",
  "date-like": "turn into dates",
  formula: "run as formulas",
}

export interface CsvExportGuardProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Rows to export. */
  rows: Record<string, unknown>[]
  /** Columns in order. Defaults to the keys of the first row. */
  columns?: { key: string; label: string }[]
  /** File name for the default download. */
  filename?: string
  /** Receives the finished CSV. Defaults to downloading it as `filename`. */
  onExport?: (csv: string, filename: string) => void
  /** Columns fixed from the start. */
  defaultFixed?: string[]
  /** Character put in front of formula-looking cells. OWASP suggests a tab for Excel; `'` is the common choice. */
  formulaPrefix?: string
  /** Prepend a UTF-8 byte-order mark so Excel reads accents and ₹ correctly. */
  bom?: boolean
  /** Short phrase per issue kind: "{count} values {phrase}". */
  messages?: Partial<Record<CsvIssueKind, string>>
  /** Heading above the column list. */
  title?: string
  /** Text for a column's fix toggle. */
  fixLabel?: string
  /** Text for a column's fix toggle when on. */
  fixedLabel?: string
  /** Text for the fix-all button. */
  fixAllLabel?: string
  /** Export button text. */
  exportLabel?: string
  /** `{count}` is filled in. */
  exportAnywayLabel?: string
  /** Size line under the title. */
  sizeText?: (columns: number, rows: string) => string
  /** "{count} values {phrase}" for each issue. */
  valuesText?: (count: number, phrase: string) => string
  /** Screen-reader summary while columns would still be changed. */
  unfixedText?: (count: number) => string
  /** Screen-reader summary once every column is safe. */
  allSafeText?: string
  /** Shown after a neutralised formula sample. */
  asTextLabel?: string
  /** Accessible name of the column list. */
  columnsLabel?: string
  /** Accessible name of the check on a clean column. */
  noProblemsLabel?: string
  /** Read before the "after" sample, e.g. "007 opens as 7". */
  opensAsLabel?: string
}

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const toggle =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200 aria-pressed:border-emerald-500/40 aria-pressed:text-emerald-800 aria-pressed:hover:bg-emerald-500/10 dark:aria-pressed:text-emerald-300"

/**
 * A CSV export step that shows what Excel will do to the file before anyone
 * opens it: PIN codes and phone numbers losing leading zeros or their +,
 * 16-digit IDs collapsing to 1.23457E+15, "3-4" becoming a date, and cells
 * starting with = + - @ running as formulas. Each column shows a before →
 * after sample and a one-tap fix: force to text (="00412") or neutralise the
 * formula with a prefix. Exporting is never blocked.
 */
export function CsvExportGuard({
  rows,
  columns: columnsProp,
  filename = "export.csv",
  onExport,
  defaultFixed = [],
  formulaPrefix = "'",
  bom = true,
  messages,
  title = "Before you export",
  fixLabel = "Keep as typed",
  fixedLabel = "Kept as typed",
  fixAllLabel = "Fix all",
  exportLabel = "Export CSV",
  exportAnywayLabel = "Export with {count} unfixed",
  sizeText = (columns, rows) => `${columns} column${columns === 1 ? "" : "s"} · ${rows} row${rows === "1" ? "" : "s"}`,
  valuesText = (count, phrase) => `${count} ${count === 1 ? "value" : "values"} ${phrase}`,
  unfixedText = (count) => `${count} column${count === 1 ? "" : "s"} would be changed by a spreadsheet.`,
  allSafeText = "Every column opens as typed.",
  asTextLabel = "(as text)",
  columnsLabel = "Columns",
  noProblemsLabel = "No problems",
  opensAsLabel = "opens as",
  className,
  ...props
}: CsvExportGuardProps) {
  const columns = React.useMemo(() => columnsProp ?? Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key })), [columnsProp, rows])
  const reports = React.useMemo(() => analyzeCsv(rows, columns), [rows, columns])
  const [fixed, setFixed] = React.useState<Set<string>>(() => new Set(defaultFixed))
  const text = { ...DEFAULT_MESSAGES, ...messages }
  const flaggedColumns = reports.filter((r) => r.flagged > 0)
  const unfixed = flaggedColumns.filter((r) => !fixed.has(r.key)).length

  const flip = (key: string) =>
    setFixed((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const exportCsv = () => {
    const csv = toCsv(rows, columns, fixed, { prefix: formulaPrefix, bom })
    if (onExport) return onExport(csv, filename)
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = Object.assign(document.createElement("a"), { href: url, download: filename })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div data-slot="csv-export-guard" className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-csv-export-guard-flash{from{background-color:rgb(16 185 129 / 0.35)}}"}</style>
      <div className="flex items-center gap-2">
        <FileSpreadsheet aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm font-medium">{title}</p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sizeText(columns.length, rows.length.toLocaleString())}
        </span>
      </div>

      <ul className="grid divide-y rounded-md border" aria-label={columnsLabel}>
        {reports.map((report) => {
          const isFixed = fixed.has(report.key)
          const issue = report.issues[0]
          const sample = issue?.example ?? report.samples[0] ?? ""
          const cell = spreadsheetIssue(sample)
          const opened = !cell ? sample : isFixed ? (cell.kind === "formula" ? `${sample} ${asTextLabel}` : sample) : cell.becomes
          return (
            <li key={report.key} className="grid gap-1 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{report.label}</span>
                {report.flagged > 0 ? (
                  <button type="button" aria-pressed={isFixed} onClick={() => flip(report.key)} className={toggle}>
                    {isFixed && <Check aria-hidden className="size-3.5" />}
                    {isFixed ? fixedLabel : fixLabel}
                  </button>
                ) : (
                  <Check aria-label={noProblemsLabel} className="size-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-mono text-xs text-muted-foreground">
                <span className="truncate">{sample || "—"}</span>
                {cell && (
                  <>
                    <span aria-hidden>→</span>
                    <span className="sr-only">{opensAsLabel}</span>
                    <span
                      key={String(isFixed)}
                      className={cn(
                        "truncate rounded-sm px-1",
                        isFixed
                          ? "text-emerald-800 motion-safe:animate-[cui-csv-export-guard-flash_400ms_ease-out] dark:text-emerald-300"
                          : "bg-red-500/10 text-red-800 line-through decoration-red-500/50 dark:text-red-300",
                      )}
                    >
                      {opened}
                    </span>
                  </>
                )}
              </p>
              {report.issues.length > 0 && !isFixed && (
                <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {report.issues
                      .map((i) => valuesText(i.count, text[i.kind]))
                      .join(" · ")}
                  </span>
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <p aria-live="polite" className="sr-only">
        {unfixed ? unfixedText(unfixed) : allSafeText}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {unfixed > 0 && (
          <button type="button" onClick={() => setFixed(new Set(flaggedColumns.map((r) => r.key)))} className={cn(button, "border bg-background hover:bg-accent dark:border-input dark:bg-input/30")}>
            {fixAllLabel}
          </button>
        )}
        <button type="button" onClick={exportCsv} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
          <Download aria-hidden className="size-4" />
          {unfixed ? exportAnywayLabel.replace("{count}", String(unfixed)) : exportLabel}
        </button>
      </div>
    </div>
  )
}

