"use client"

import * as React from "react"
import { Check, CircleHelp, X } from "lucide-react"

import { cn } from "@/lib/utils"

/** `true`/`false` read as Included/Not included. `null`, `undefined`, "" and a bare dash are missing. */
export type DiffCellValue = string | number | boolean | null | undefined

export interface DiffColumn {
  id: string
  label: string
  /** Small line under the label, such as a price. */
  description?: string
}

export interface DiffRow {
  id: string
  label: string
  /** One value per column id. Leave a column out when the source doesn't say. */
  values: Record<string, DiffCellValue>
}

export interface RowComparison {
  /** `same`: every column agrees. `different`: known values disagree. `unknown`: they agree but some are missing. */
  status: "same" | "different" | "unknown"
  /** Columns whose value stands out from the rest. */
  differing: string[]
  /** Columns with no value, which must not be read as "no". */
  missing: string[]
}

const isMissing = (value: DiffCellValue) => value == null || (typeof value === "string" && /^\s*[-–—]?\s*$/.test(value))

/** Case, spacing and "10 GB" vs "10GB" don't count as differences; ticks and "Yes" are the same. */
export function normalizeCell(value: DiffCellValue): string {
  if (typeof value === "boolean") return value ? "yes" : "no"
  const text = String(value).trim().toLowerCase().replace(/\s+/g, " ").replace(/(\d) (?=\p{L})/gu, "$1").replace(/(\d),(?=\d)/g, "$1")
  if (/^(yes|included|true|✓|✔)$/.test(text)) return "yes"
  if (/^(no|not included|false|✗|✕|×)$/.test(text)) return "no"
  return text
}

/**
 * Compares one row across columns. With three or more columns the odd ones out are
 * marked (a clear majority stays plain); otherwise every known value is marked.
 * A row with a missing value is never "same": the gap might hide a difference.
 */
export function compareRow(row: DiffRow, columnIds: string[]): RowComparison {
  const missing = columnIds.filter((id) => isMissing(row.values[id]))
  const known = columnIds.filter((id) => !missing.includes(id))
  const groups = new Map<string, string[]>()
  for (const id of known) {
    const key = normalizeCell(row.values[id])
    groups.set(key, [...(groups.get(key) ?? []), id])
  }
  if (groups.size <= 1) return { status: missing.length ? "unknown" : "same", differing: [], missing }
  const sizes = [...groups.values()].map((ids) => ids.length).sort((a, b) => b - a)
  const majority = sizes[0] > sizes[1] && known.length >= 3 ? [...groups.values()].find((ids) => ids.length === sizes[0]) : undefined
  return { status: "different", differing: known.filter((id) => !majority?.includes(id)), missing }
}

export interface DiffTableProps extends React.ComponentProps<"div"> {
  /** The things being compared, left to right. */
  columns: DiffColumn[]
  /** The attributes, top to bottom. */
  rows: DiffRow[]
  /** Controlled "show only differences" state. */
  differencesOnly?: boolean
  /** Initial state when uncontrolled. */
  defaultDifferencesOnly?: boolean
  /** Called when the toggle changes. */
  onDifferencesOnlyChange?: (differencesOnly: boolean) => void
  /** Accessible caption of the table. */
  caption?: string
  /** Label of the toggle. */
  toggleLabel?: string
  /** Text in a cell with no value. */
  missingLabel?: string
  /** Note under a row with missing values. Receives the column labels that are missing. */
  missingNote?: (columns: string) => string
  /** Screen reader text for `true` and `false`. */
  yesLabel?: string
  /** Text read for a No cell. */
  noLabel?: string
  /** Line under a filtered table. Receives how many identical rows are hidden. */
  hiddenNote?: (count: number) => string
  /** Count beside the toggle. Receives how many rows are identical. */
  sameCountLabel?: (count: number) => string
  /** Button that turns the filter off. Receives the total number of rows. */
  showAllLabel?: (count: number) => string
  /** Screen reader text after a value that stands out. */
  differsLabel?: string
  /** When set, numbers in cells are formatted for this locale (1000 → "1,000"). Left unset they print as given. */
  locale?: string
}

/**
 * A comparison table for plans, products or versions that does the spotting for you:
 * cells that differ are marked, "Show only differences" hides rows that are truly
 * identical (and says how many), and a blank cell is shown as "Not stated", never as
 * a dash that reads as "No", and keeps its row visible because it may hide a difference.
 */
export function DiffTable({
  columns,
  rows,
  differencesOnly,
  defaultDifferencesOnly = false,
  onDifferencesOnlyChange,
  caption = "Comparison",
  toggleLabel = "Show only differences",
  missingLabel = "Not stated",
  missingNote = (names) => `Not stated for ${names}. Don’t read it as “No”.`,
  yesLabel = "Included",
  noLabel = "Not included",
  hiddenNote = (count) => `${count} identical ${count === 1 ? "row" : "rows"} hidden.`,
  sameCountLabel = (count) => `(${count} same)`,
  showAllLabel = (count) => `Show all ${count}`,
  differsLabel = "(differs)",
  locale,
  className,
  ...props
}: DiffTableProps) {
  const [inner, setInner] = React.useState(defaultDifferencesOnly)
  const filtered = differencesOnly ?? inner
  const ids = columns.map((c) => c.id)
  const compared = rows.map((row) => ({ row, ...compareRow(row, ids) }))
  const sameCount = compared.filter((r) => r.status === "same").length
  const shown = filtered ? compared.filter((r) => r.status !== "same") : compared
  const nameOf = (id: string) => columns.find((c) => c.id === id)?.label ?? id

  const setFiltered = (next: boolean) => {
    if (differencesOnly === undefined) setInner(next)
    onDifferencesOnlyChange?.(next)
  }

  const renderValue = (value: DiffCellValue) => {
    const key = typeof value === "number" ? "" : normalizeCell(value)
    if (key === "yes")
      return (
        <>
          <Check aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span className="sr-only">{yesLabel}</span>
        </>
      )
    if (key === "no")
      return (
        <>
          <X aria-hidden className="size-4 text-muted-foreground" />
          <span className="sr-only">{noLabel}</span>
        </>
      )
    return typeof value === "number" && locale ? value.toLocaleString(locale) : String(value)
  }

  return (
    <div data-slot="diff-table" className={cn("grid w-full min-w-0 gap-2", className)} {...props}>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
        <button
          type="button"
          role="switch"
          aria-checked={filtered}
          onClick={() => setFiltered(!filtered)}
          className="inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input p-0.5 transition-colors outline-none aria-checked:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/80 dark:aria-checked:bg-primary"
        >
          <span className={cn("size-4 rounded-full bg-background shadow-xs transition-transform duration-200 ease-out", filtered && "translate-x-4")} />
        </button>
        {toggleLabel}
        {sameCount ? <span className="font-normal text-muted-foreground">{sameCountLabel(sameCount)}</span> : null}
      </label>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b bg-muted">
              <td className="sticky left-0 bg-muted px-3 py-2" />
              {columns.map((column) => (
                <th key={column.id} scope="col" className="min-w-24 px-3 py-2 text-left align-bottom font-semibold">
                  {column.label}
                  {column.description ? <span className="block text-xs font-normal text-muted-foreground">{column.description}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={String(filtered)}>
            {shown.map(({ row, status, differing, missing }) => (
              <tr key={row.id} data-status={status} className="border-b last:border-b-0">
                <th scope="row" className="sticky left-0 z-10 max-w-40 min-w-24 bg-card px-3 py-2 text-left align-top font-medium">
                  {row.label}
                  {missing.length ? (
                    <span className="mt-0.5 block text-xs font-normal text-amber-700 dark:text-amber-400">{missingNote(missing.map(nameOf).join(", "))}</span>
                  ) : null}
                </th>
                {columns.map((column) => {
                  const value = row.values[column.id]
                  const differs = differing.includes(column.id)
                  return (
                    <td
                      key={column.id}
                      data-differs={differs || undefined}
                      className={cn(
                        "px-3 py-2 align-top tabular-nums",
                        differs && "bg-amber-500/10 font-medium motion-safe:animate-[cui-diff-table-flash_400ms_ease-out] dark:bg-amber-400/10",
                      )}
                    >
                      {missing.includes(column.id) ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-dashed whitespace-nowrap border-amber-500/60 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                          <CircleHelp aria-hidden className="size-3.5" />
                          {missingLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {renderValue(value)}
                          {differs ? <span className="sr-only"> {differsLabel}</span> : null}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered && sameCount ? (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" aria-live="polite">
          <span className="py-1">{hiddenNote(sameCount)}</span>
          <button
            type="button"
            onClick={() => setFiltered(false)}
            className="inline-flex h-6 items-center rounded-md border px-2 font-medium text-foreground transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {showAllLabel(rows.length)}
          </button>
        </p>
      ) : null}
      <style>{`@keyframes cui-diff-table-flash{from{background-color:rgb(245 158 11 / .35)}}`}</style>
    </div>
  )
}
