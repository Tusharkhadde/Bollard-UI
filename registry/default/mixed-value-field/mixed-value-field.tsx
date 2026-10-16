"use client"

import * as React from "react"
import { Eraser, PencilLine, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

/** `null` keeps every record's own value; `{ set }` writes one value to all (`set: null` clears it). */
export type BulkChange = { set: string | null } | null

/** Each distinct value and how many records hold it, most common first. `null` is "empty". */
export function summarizeValues(values: (string | null | undefined)[]) {
  const counts = new Map<string | null, number>()
  for (const value of values) counts.set(value || null, (counts.get(value || null) ?? 0) + 1)
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
}

/** How many records a change would actually alter: records that already hold the value are skipped. */
export function countChanged(values: (string | null | undefined)[], change: BulkChange) {
  if (!change) return 0
  return values.filter((value) => (value || null) !== (change.set || null)).length
}

const swatches = ["bg-sky-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"]
const KEEP = "\u0000keep"
const CLEAR = "\u0000clear"

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-changed:border-sky-500 dark:data-changed:border-sky-400"

const ghost =
  "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground"

export interface MixedValueFieldProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "children"> {
  /** Field name, e.g. "Status". */
  label: string
  /** The field's current value on each selected record. Empty strings count as empty. */
  values: (string | null | undefined)[]
  /** Choices for a select. Leave out for a free-text field. */
  options?: { value: string; label?: string }[]
  /** Controlled change. */
  value?: BulkChange
  /** Initial change when uncontrolled. */
  defaultValue?: BulkChange
  onValueChange?: (change: BulkChange) => void
  /** Offer "Clear on all" so emptying the field is an explicit choice, never an accident. */
  allowClear?: boolean
  /** "40 tasks". Override to name your records or translate. */
  formatItems?: (count: number) => string
  /** Templates: `{count}`, `{field}`, `{value}`, `{changed}`, `{total}`, `{already}`, `{items}` are filled in. */
  mixedText?: string
  uniformText?: string
  emptyText?: string
  keepText?: string
  setText?: string
  alreadyText?: string
  clearText?: string
  noopText?: string
  clearLabel?: string
  revertLabel?: string
}

const defaultItems = (count: number) => `${count.toLocaleString()} ${count === 1 ? "record" : "records"}`

/**
 * A field for editing many records at once. Instead of a misleading blank or
 * the first record's value it shows "Mixed (3 values)" with the distribution,
 * leaves each record's value alone unless you choose one, and reads back
 * exactly what saving will do, counting only the records that actually change.
 */
export function MixedValueField({
  label,
  values,
  options,
  value,
  defaultValue = null,
  onValueChange,
  allowClear = false,
  formatItems = defaultItems,
  mixedText = "Mixed ({count} values)",
  uniformText = "{value} on all",
  emptyText = "Empty",
  keepText = "{field} stays as it is on each of the {items}.",
  setText = "Set {field} to {value} on {changed} of {items}.",
  alreadyText = "{already} already {value}.",
  clearText = "Clear {field} on {changed} of {items}.",
  noopText = "All {items} are already {value}. Nothing changes.",
  clearLabel = "Clear on all",
  revertLabel = "Keep as is",
  id,
  className,
  ...props
}: MixedValueFieldProps) {
  const [inner, setInner] = React.useState<BulkChange>(defaultValue)
  const autoId = React.useId()
  const fieldId = id ?? autoId
  const change = value === undefined ? inner : value
  const summary = React.useMemo(() => summarizeValues(values), [values])
  const total = values.length
  const changed = countChanged(values, change)

  const update = (next: BulkChange) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const nameOf = (v: string | null) => (v === null ? emptyText : (options?.find((o) => o.value === v)?.label ?? v))
  const current =
    summary.length === 1 ? fill(uniformText, { value: nameOf(summary[0].value) }) : fill(mixedText, { count: summary.length })
  const vars = {
    field: label,
    items: formatItems(total),
    total,
    changed,
    value: change ? nameOf(change.set) : "",
  }
  const already = change ? total - changed : 0
  const readback = !change
    ? fill(keepText, vars)
    : changed === 0
      ? fill(noopText, vars)
      : change.set === null
        ? fill(clearText, vars)
        : `${fill(setText, vars)}${already ? ` ${fill(alreadyText, { ...vars, already })}` : ""}`

  // Segments after the change: everything that changes moves to the new value.
  const keys = [...summary.map((s) => s.value), ...(change && !summary.some((s) => s.value === change.set) ? [change.set] : [])]
  const after = (key: string | null) =>
    !change ? (summary.find((s) => s.value === key)?.count ?? 0) : key === (change.set || null) ? total : 0
  const swatch = (index: number, key: string | null) =>
    key === null ? "bg-muted-foreground/30" : (swatches[index] ?? "bg-foreground/30")

  return (
    <div
      data-slot="mixed-value-field"
      data-state={!change ? "keep" : changed ? "change" : "noop"}
      className={cn("grid w-full max-w-sm gap-1.5", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {label}
        </label>
        <span className="flex gap-1">
          {allowClear && !options && (
            <button
              type="button"
              aria-pressed={change?.set === null}
              onClick={() => update(change?.set === null ? null : { set: null })}
              className={ghost}
            >
              <Eraser aria-hidden className="size-3.5" />
              {clearLabel}
            </button>
          )}
          {change && (
            <button type="button" onClick={() => update(null)} className={ghost}>
              <Undo2 aria-hidden className="size-3.5" />
              {revertLabel}
            </button>
          )}
        </span>
      </div>
      {options ? (
        <select
          id={fieldId}
          value={!change ? KEEP : change.set === null ? CLEAR : change.set}
          onChange={(event) => {
            const next = event.target.value
            update(next === KEEP ? null : { set: next === CLEAR ? null : next })
          }}
          aria-describedby={`${fieldId}-readback`}
          data-changed={change ? "" : undefined}
          className={cn(fieldClass, !change && "text-muted-foreground italic")}
        >
          <option value={KEEP}>{current}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-foreground not-italic">
              {option.label ?? option.value}
            </option>
          ))}
          {allowClear && <option value={CLEAR}>{clearLabel}</option>}
        </select>
      ) : (
        <input
          id={fieldId}
          value={change?.set ?? ""}
          placeholder={change ? emptyText : current}
          onChange={(event) => update(event.target.value ? { set: event.target.value } : null)}
          aria-describedby={`${fieldId}-readback`}
          data-changed={change ? "" : undefined}
          className={cn(fieldClass, "placeholder:italic")}
        />
      )}
      <div aria-hidden className="flex h-1.5 gap-px overflow-hidden rounded-full bg-muted">
        {keys.map((key, index) => (
          <span
            key={key ?? KEEP}
            style={{ flexGrow: after(key), flexBasis: 0 }}
            className={cn("transition-[flex-grow] duration-300 ease-out motion-reduce:transition-none", swatch(index, key))}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-label={`${label} now`}>
        {keys.map((v, index) => {
          const count = summary.find((s) => s.value === v)?.count ?? 0
          return (
            <li key={v ?? KEEP} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", swatch(index, v))} />
              <span className={cn(v === null && "italic")}>{nameOf(v)}</span>
              <span className="tabular-nums text-foreground">{count}</span>
              {change && after(v) !== count && <span className="tabular-nums">→ {after(v)}</span>}
            </li>
          )
        })}
      </ul>
      <p
        id={`${fieldId}-readback`}
        aria-live="polite"
        className={cn(
          "flex gap-1.5 text-xs",
          !change
            ? "text-muted-foreground"
            : changed
              ? "font-medium text-sky-800 dark:text-sky-300"
              : "text-amber-700 dark:text-amber-400",
        )}
      >
        {change && <PencilLine aria-hidden className="mt-px size-3.5 shrink-0" />}
        {readback}
      </p>
    </div>
  )
}
