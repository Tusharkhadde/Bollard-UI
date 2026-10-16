"use client"

import * as React from "react"
import { ChevronDown, CircleAlert, FileSpreadsheet, LoaderCircle, Rows3 } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkRows, detectHeaderRow, matchColumns, type ColumnMatch, type ImportField, type RowIssue } from "./import-match"

export { checkRows, detectHeaderRow, matchColumns, type ColumnMatch, type ImportField, type RowIssue } from "./import-match"

const REASONS: Record<RowIssue["reason"], string> = {
  duplicate: "Duplicates in this file",
  existing: "Already in your list",
  invalid: "Bad values",
  missing: "Missing required values",
  header: "Heading rows inside the data",
}

const columnName = (i: number): string => (i >= 26 ? columnName(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26))
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`

export interface ImportPreviewProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The parsed file, one array of cells per line, as CSV/XLSX parsers return it. */
  rows: string[][]
  /** The fields you import into. */
  fields: ImportField[]
  /** File name shown in the header. */
  fileName?: string
  /** Field that identifies a record, for duplicate checks (compared trimmed and case-insensitively). */
  uniqueKey?: string
  /** Whether a record with this (lower-cased) key already exists. */
  isExisting?: (key: string) => boolean
  /** Receives the clean records. Return a promise to show a pending state. */
  onImport?: (records: Record<string, string>[]) => void | Promise<void>
  /** Templates: `{count}` and `{skip}` are filled in. */
  importLabel?: string
  skipLabel?: string
  notMappedLabel?: string
  requiredText?: string
}

const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const select =
  "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 aria-invalid:border-destructive"

/**
 * An import preview that catches a bad import before it lands: it finds the
 * heading row (skipping title rows, and noticing when headings would be
 * imported as a record), matches columns by heading and by content with a
 * confidence, holds the import while a required field is unmapped, and lists
 * every skipped line by its spreadsheet line number and reason, ending in a
 * plain "Import 412 · skip 7".
 */
export function ImportPreview({
  rows,
  fields,
  fileName,
  uniqueKey,
  isExisting,
  onImport,
  importLabel = "Import {count}",
  skipLabel = "skip {skip}",
  notMappedLabel = "Don't import",
  requiredText = "{field} is required. Pick the column that holds it.",
  className,
  ...props
}: ImportPreviewProps) {
  const detected = React.useMemo(() => detectHeaderRow(rows, fields), [rows, fields])
  const [headerRow, setHeaderRow] = React.useState(detected)
  const width = Math.max(0, ...rows.map((r) => r.length))
  const headings = headerRow < 0 ? Array.from({ length: width }, (_, i) => `Column ${columnName(i)}`) : rows[headerRow]
  const data = rows.slice(headerRow + 1)
  const auto = matchColumns(headings, headings.map((_, c) => data.map((r) => r[c] ?? "")), fields)
  const [override, setOverride] = React.useState<Record<number, string | null>>({})
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [open, setOpen] = React.useState<RowIssue["reason"] | null>(null)
  const id = React.useId()

  // A new file starts from its own detected heading row and a fresh mapping.
  React.useEffect(() => {
    setHeaderRow(detected)
    setOverride({})
  }, [detected, rows])

  const mapping: ColumnMatch[] = auto.map((m, i) => (i in override ? { field: override[i], confidence: 1, byContent: false } : m))
  const unmapped = fields.filter((f) => f.required && !mapping.some((m) => m.field === f.key))
  const { records, issues } = checkRows(data, headerRow + 2, headings, mapping, fields, { uniqueKey, isExisting })
  const groups = (Object.keys(REASONS) as RowIssue["reason"][]).map((r) => ({ reason: r, items: issues.filter((i) => i.reason === r) })).filter((g) => g.items.length)
  const fill = (t: string) => t.replace("{count}", records.length.toLocaleString()).replace("{skip}", issues.length.toLocaleString())

  const changeHeader = (next: number) => {
    setHeaderRow(next)
    setOverride({})
  }
  const runImport = async () => {
    setPending(true)
    setError(undefined)
    try {
      await onImport?.(records)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Nothing was saved.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div data-slot="import-preview" className={cn("grid w-full max-w-md gap-3 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <FileSpreadsheet aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{fileName ?? "Import"}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Headings
          <select value={headerRow} onChange={(e) => changeHeader(Number(e.target.value))} className={cn(select, "h-7 w-auto text-xs")}>
            {rows.slice(0, 5).map((_, i) => <option key={i} value={i}>on line {i + 1}</option>)}
            <option value={-1}>none</option>
          </select>
        </label>
      </div>

      <div aria-live="polite" className="empty:hidden text-xs">
        {detected > 0 && headerRow === detected && (
          <p className="flex gap-1.5 text-muted-foreground">
            <Rows3 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>Skipped {detected === 1 ? "line 1" : `lines 1–${detected}`} above the headings (“{rows[0].filter(Boolean)[0]}”).</span>
          </p>
        )}
        {detected >= 0 && headerRow < 0 && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <CircleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">Line {detected + 1} looks like headings ({rows[detected].filter(Boolean).slice(0, 2).join(", ")}…), not a record.</span>
              <button type="button" onClick={() => changeHeader(detected)} className={fix}>Use as headings</button>
            </span>
          </p>
        )}
      </div>

      <ul aria-label="Column mapping" className="divide-y rounded-lg border">
        {headings.map((heading, col) => {
          const m = mapping[col]
          const sample = data.find((r) => r[col]?.trim())?.[col] ?? ""
          const tone = !m.field ? "text-muted-foreground" : m.confidence >= 0.85 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
          return (
            <li key={col} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] items-center gap-x-3 gap-y-1 px-3 py-2">
              <div className="min-w-0">
                <label htmlFor={`${id}-${col}`} className="block truncate font-medium">{heading || `Column ${columnName(col)}`}</label>
                <span className="block truncate text-xs text-muted-foreground">{sample || "empty"}</span>
              </div>
              <div className="grid gap-1">
                <select id={`${id}-${col}`} value={m.field ?? ""} onChange={(e) => setOverride({ ...override, [col]: e.target.value || null })} className={select}>
                  <option value="">{notMappedLabel}</option>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key} disabled={f.key !== m.field && mapping.some((x) => x.field === f.key)}>{f.label}{f.required ? " *" : ""}</option>
                  ))}
                </select>
                {!(col in override) && m.field && (
                  <span className={cn("text-xs", tone)}>
                    {Math.round(m.confidence * 100)}% match{m.byContent ? " · by values" : ""}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {unmapped.map((f) => (
        <p key={f.key} role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {requiredText.replace("{field}", f.label)}
        </p>
      ))}

      {groups.length > 0 && (
        <div className="divide-y rounded-lg border border-amber-500/30 bg-amber-500/5">
          {groups.map(({ reason, items }) => (
            <div key={reason}>
              <button
                type="button"
                aria-expanded={open === reason}
                onClick={() => setOpen(open === reason ? null : reason)}
                className="flex h-9 w-full items-center gap-2 px-3 text-left text-amber-950 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-50"
              >
                <span className="min-w-0 flex-1 truncate">{REASONS[reason]}</span>
                <span className="font-medium tabular-nums">{items.length}</span>
                <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200", open === reason && "rotate-180")} />
              </button>
              {open === reason && (
                <ul className="max-h-36 overflow-auto px-3 pb-2 text-xs text-amber-900/80 dark:text-amber-100/80">
                  {items.map((i) => (
                    <li key={i.line} className="flex gap-2 py-0.5">
                      <span className="w-14 shrink-0 tabular-nums">Line {i.line}</span>
                      <span className="min-w-0">{i.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {error ? <span role="alert" className="text-destructive">{error}</span> : `${plural(records.length, "record")} ready, ${plural(issues.length, "line")} skipped`}
        </p>
        <button
          type="button"
          onClick={runImport}
          disabled={pending || unmapped.length > 0 || records.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {fill(importLabel)}
          {issues.length > 0 && <span className="font-normal opacity-75">· {fill(skipLabel)}</span>}
        </button>
      </div>
    </div>
  )
}
