"use client"

import * as React from "react"
import { LoaderCircle, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type DedupeRow = Record<string, unknown>

const clean = (v: unknown, normalize: boolean) => {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return normalize ? s.replace(/[\u00a0\u200b\ufeff]/g, " ").trim().replace(/\s+/g, " ").toLowerCase() : s
}

/**
 * Groups rows by the chosen key columns. A row with a blank key column never merges, the way
 * SQL treats NULL, so 40 contacts without a phone don't collapse into one.
 */
export function analyzeDedupe(rows: DedupeRow[], keys: string[], normalize = true) {
  const groups = new Map<string, number[]>()
  let blank = 0
  if (keys.length) {
    rows.forEach((row, i) => {
      const parts = keys.map((k) => clean(row[k], normalize))
      if (parts.some((p) => !p.trim())) return void blank++
      const id = parts.join("\u0001")
      groups.set(id, [...(groups.get(id) ?? []), i])
    })
  }
  const dupes = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length)
  const merges = dupes.reduce((n, g) => n + g.length - 1, 0)
  return { merges, after: rows.length - merges, groups: dupes, blank, largest: dupes[0]?.length ?? 0 }
}

/** Share of non-blank values in a column that are distinct (1 = every row different). */
export function distinctShare(rows: DedupeRow[], column: string) {
  const values = rows.map((r) => clean(r[column], true)).filter(Boolean)
  return values.length ? new Set(values).size / values.length : 0
}

/** Columns, other than the key, whose values differ inside a group: data a merge would throw away. */
export function conflictingColumns(rows: DedupeRow[], group: number[], keys: string[], columns: string[]) {
  return columns.filter((c) => !keys.includes(c) && new Set(group.map((i) => clean(rows[i][c], true))).size > 1)
}

export interface DedupeKeyPickerMessages {
  legend: string; normalize: string; summary: string; groups: string; blank: string
  nearUnique: string; dropFix: string; coarse: string; addFix: string; conflicts: string
  caseOnly: string; empty: string; apply: string; failed: string
  /** Screen-reader text after each column name. */
  unique?: string
}

const DEFAULTS: DedupeKeyPickerMessages = {
  legend: "Rows are duplicates when these match",
  normalize: "Ignore case and extra spaces",
  summary: "{rows} rows → {after}",
  groups: "{merges} rows merge into {groups} groups",
  blank: "{count} rows have a blank key and stay separate.",
  nearUnique: "These columns are almost unique, so nothing merges. {column} is different on {pct} of rows.",
  dropFix: "Leave out {column} · merges {count}",
  coarse: "Too broad: “{key}” alone would merge {count} rows ({pct}).",
  addFix: "Also match {column}",
  conflicts: "{count} groups disagree on other columns. Merging keeps one row of each.",
  caseOnly: "{count} of these merge only because case or spaces are ignored.",
  empty: "Pick at least one column.",
  apply: "Merge {count} rows",
  failed: "Merging failed. Nothing was changed.",
  unique: "{pct} of values unique",
}

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface DedupeKeyPickerProps extends Omit<React.ComponentProps<"fieldset">, "children" | "defaultValue"> {
  /** The rows to deduplicate. A sample of a few thousand is plenty. */
  rows: DedupeRow[]
  /** Columns offered as key candidates. Defaults to the keys of the first row. */
  columns?: string[]
  /** Controlled key columns. */
  value?: string[]
  /** Initial key columns when uncontrolled. */
  defaultValue?: string[]
  onValueChange?: (keys: string[]) => void
  /** Controlled "ignore case and spaces". */
  normalize?: boolean
  /** Initial "ignore case and spaces" when uncontrolled. */
  defaultNormalize?: boolean
  onNormalizeChange?: (normalize: boolean) => void
  /** Runs the merge. May return a Promise; the button shows a pending state. */
  onApply?: (plan: { keys: string[]; normalize: boolean }) => void | Promise<unknown>
  /** Groups shown as sample collisions. */
  samples?: number
  /** Share of rows one key may absorb before it is called too broad. */
  coarseShare?: number
  locale?: string
  /** Every visible string, with `{placeholders}`. */
  messages?: Partial<DedupeKeyPickerMessages>
}

/**
 * Picking the columns that define "duplicate" is where dedupes go wrong: add a timestamp and
 * nothing merges, pick only "city" and half the table collapses. This previews the merge as you
 * pick, names the column making the key near-unique (with a one-tap "leave it out"), flags a key
 * that is too broad, keeps blank keys apart and shows sample collisions with the values a merge
 * would discard highlighted.
 */
export function DedupeKeyPicker({
  rows, columns, value, defaultValue = [], onValueChange, normalize, defaultNormalize = true, onNormalizeChange,
  onApply, samples = 2, coarseShare = 0.25, locale, messages, className, ...props
}: DedupeKeyPickerProps) {
  const t = { ...DEFAULTS, ...messages } as Required<DedupeKeyPickerMessages>
  const cols = columns ?? Object.keys(rows[0] ?? {})
  const [innerKeys, setInnerKeys] = React.useState(defaultValue)
  const [innerNorm, setInnerNorm] = React.useState(defaultNormalize)
  const [state, setState] = React.useState<"idle" | "pending" | "error">("idle")
  const keys = value ?? innerKeys
  const norm = normalize ?? innerNorm
  const nf = new Intl.NumberFormat(locale)
  const pf = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 })
  const fieldId = React.useId()

  const setKeys = (next: string[]) => { if (value === undefined) setInnerKeys(next); onValueChange?.(next) }
  const setNorm = (next: boolean) => { if (normalize === undefined) setInnerNorm(next); onNormalizeChange?.(next) }
  const toggle = (c: string) => setKeys(keys.includes(c) ? keys.filter((k) => k !== c) : cols.filter((k) => k === c || keys.includes(k)))

  const shares = React.useMemo(() => Object.fromEntries(cols.map((c) => [c, distinctShare(rows, c)])), [rows, cols.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = React.useMemo(() => analyzeDedupe(rows, keys, norm), [rows, keys, norm])
  const raw = React.useMemo(() => (norm ? analyzeDedupe(rows, keys, false) : a), [rows, keys, norm, a])

  // Near-unique: barely anything merges, and dropping one key column would change that.
  let drop: { column: string; merges: number } | null = null
  if (keys.length > 1 && a.merges <= rows.length * 0.02) {
    for (const k of keys) {
      const merges = analyzeDedupe(rows, keys.filter((x) => x !== k), norm).merges
      if (merges > a.merges && shares[k] >= 0.8 && (!drop || merges > drop.merges)) drop = { column: k, merges }
    }
  }
  // Too broad: one key absorbs a big share. Suggest the unpicked column that splits it best.
  const coarse = a.largest > Math.max(2, rows.length * coarseShare)
  let add: string | null = null
  if (coarse) {
    let best = a.largest
    for (const c of cols.filter((x) => !keys.includes(x))) {
      const next = analyzeDedupe(rows, [...keys, c], norm)
      if (next.merges > 0 && next.largest < best) [add, best] = [c, next.largest]
    }
  }
  const conflicted = a.groups.filter((g) => conflictingColumns(rows, g, keys, cols).length > 0)
  const caseOnly = a.merges - raw.merges

  const run = async () => {
    if (!onApply || state === "pending") return
    setState("pending")
    try { await onApply({ keys, normalize: norm }); setState("idle") } catch { setState("error") }
  }

  return (
    <fieldset data-slot="dedupe-key-picker" className={cn("grid w-full min-w-0 max-w-md gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground", className)} {...props}>
      <legend className="sr-only">{t.legend}</legend>
      <p aria-hidden className="font-medium">{t.legend}</p>
      <div className="flex flex-wrap gap-1.5">
        {cols.map((c) => {
          const on = keys.includes(c)
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", on ? "border-primary bg-primary text-primary-foreground" : "bg-transparent hover:bg-accent dark:bg-input/30")}
            >
              {c}
              <span aria-hidden className={cn("text-xs tabular-nums", on ? "text-primary-foreground/75" : "text-muted-foreground")}>{pf.format(shares[c])}</span>
              <span className="sr-only">, {fill(t.unique, { pct: pf.format(shares[c]) })}</span>
            </button>
          )
        })}
      </div>
      <label htmlFor={fieldId} className="flex w-fit items-center gap-2 text-sm">
        <input id={fieldId} type="checkbox" checked={norm} onChange={(e) => setNorm(e.target.checked)} className="size-4 rounded accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
        {t.normalize}
      </label>

      <div aria-live="polite" className="grid gap-1.5">
        {keys.length === 0 ? (
          <p className="text-muted-foreground">{t.empty}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold tabular-nums">{fill(t.summary, { rows: nf.format(rows.length), after: nf.format(a.after) })}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{fill(t.groups, { merges: nf.format(a.merges), groups: nf.format(a.groups.length) })}</span>
            </p>
            <div aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary/70 transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${(a.after / Math.max(1, rows.length)) * 100}%` }} />
            </div>
            <div className="grid gap-1 text-xs">
              {drop && <Warn text={fill(t.nearUnique, { column: drop.column, pct: pf.format(shares[drop.column]) })} fix={fill(t.dropFix, { column: drop.column, count: nf.format(drop.merges) })} onFix={() => setKeys(keys.filter((k) => k !== drop!.column))} />}
              {coarse && <Warn text={fill(t.coarse, { key: keys.map((k) => String(rows[a.groups[0][0]][k])).join(" · "), count: nf.format(a.largest), pct: pf.format(a.largest / rows.length) })} fix={add ? fill(t.addFix, { column: add }) : undefined} onFix={() => add && setKeys(cols.filter((c) => c === add || keys.includes(c)))} />}
              {conflicted.length > 0 && <Warn text={fill(t.conflicts, { count: nf.format(conflicted.length) })} />}
              {caseOnly > 0 && <p className="py-1 pl-5 text-muted-foreground">{fill(t.caseOnly, { count: nf.format(caseOnly) })}</p>}
              {a.blank > 0 && <p className="py-1 pl-5 text-muted-foreground">{fill(t.blank, { count: nf.format(a.blank) })}</p>}
            </div>
          </>
        )}
      </div>

      {keys.length > 0 && a.groups.length > 0 && (
        <div className="grid gap-2">
          {a.groups.slice(0, samples).map((g) => {
            const shown = [...keys, ...conflictingColumns(rows, g, keys, cols)].slice(0, 4)
            return (
              <div key={g.join()} className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>{shown.map((c) => <th key={c} scope="col" className="px-2 py-1 font-medium">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {g.slice(0, 3).map((i) => (
                      <tr key={i} className="border-t">
                        {shown.map((c) => (
                          <td key={c} className={cn("px-2 py-1 whitespace-nowrap", keys.includes(c) ? "font-medium" : "bg-amber-500/10 text-amber-900 dark:text-amber-200")}>
                            {String(rows[i][c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {onApply && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {state === "error" && <p role="alert" className="mr-auto text-xs text-red-700 dark:text-red-400">{t.failed}</p>}
          <button type="button" onClick={run} disabled={!a.merges || state === "pending"} aria-busy={state === "pending"} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50">
            {state === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {fill(t.apply, { count: nf.format(a.merges) })}
          </button>
        </div>
      )}
    </fieldset>
  )
}

function Warn({ text, fix, onFix }: { text: string; fix?: string; onFix?: () => void }) {
  return (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 py-1 [overflow-wrap:anywhere]">{text}</span>
        {fix && <button type="button" onClick={onFix} className={fixClass}><span className="truncate">{fix}</span></button>}
      </span>
    </p>
  )
}
