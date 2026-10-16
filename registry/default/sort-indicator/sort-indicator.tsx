"use client"

import * as React from "react"
import { ArrowDown, ArrowDownWideNarrow, ArrowUp, ArrowUpDown, EyeOff, Pin } from "lucide-react"

import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc"
export interface SortState {
  column: string
  direction: SortDirection
}
export interface SortColumn {
  id: string
  label: string
  /** Picks the plain-language direction words: "A to Z", "lowest first", "oldest first". */
  type?: "text" | "number" | "date"
  /** The column isn't on screen, so sorting by it makes the order look random. */
  hidden?: boolean
  /** Direction of the first click, e.g. "desc" for "newest first". */
  firstDirection?: SortDirection
}

const WORDS = { text: ["A to Z", "Z to A"], number: ["lowest first", "highest first"], date: ["oldest first", "newest first"] }

/** "oldest first", "Z to A": what ascending and descending actually mean for this column. */
export const directionWords = (column: SortColumn, direction: SortDirection) => WORDS[column.type ?? "text"][direction === "asc" ? 0 : 1]

export const ariaSort = (sort: SortState | null | undefined, columnId: string) =>
  sort?.column === columnId ? (sort.direction === "asc" ? "ascending" : "descending") : "none"

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
const isEmpty = (v: unknown) => v === null || v === undefined || v === ""

/**
 * Stable sort with empty values always last (in both directions) and pinned rows
 * always first. Text compares numerically, so "Item 9" comes before "Item 10".
 */
export function sortRows<T>(
  rows: T[],
  sort: SortState | null | undefined,
  { getValue, isPinned }: { getValue: (row: T, column: string) => unknown; isPinned?: (row: T) => boolean },
) {
  const pinned = isPinned ? rows.filter(isPinned) : []
  const rest = isPinned ? rows.filter((r) => !isPinned(r)) : [...rows]
  if (!sort) return { rows: [...pinned, ...rest], emptyCount: 0, pinnedCount: pinned.length }
  const dir = sort.direction === "asc" ? 1 : -1
  const filled = rest.filter((r) => !isEmpty(getValue(r, sort.column)))
  const empty = rest.filter((r) => isEmpty(getValue(r, sort.column)))
  filled.sort((a, b) => {
    const x = getValue(a, sort.column)
    const y = getValue(b, sort.column)
    const order = typeof x === "string" && typeof y === "string" ? collator.compare(x, y) : Number(x) - Number(y)
    return order * dir
  })
  return { rows: [...pinned, ...filled, ...empty], emptyCount: empty.length, pinnedCount: pinned.length }
}

/**
 * FLIP: animates `[data-flip-key]` children from where they were to where they
 * are now whenever `order` changes, so people can follow a row to its new place.
 * Skipped under reduced motion.
 */
export function useFlip<T extends HTMLElement>(order: unknown, duration = 300) {
  const ref = React.useRef<T>(null)
  const tops = React.useRef(new Map<string, number>())
  React.useLayoutEffect(() => {
    const container = ref.current
    if (!container) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const base = container.getBoundingClientRect().top
    for (const el of container.querySelectorAll<HTMLElement>("[data-flip-key]")) {
      el.getAnimations().forEach((a) => a.cancel())
      const key = el.dataset.flipKey ?? ""
      const top = el.getBoundingClientRect().top - base
      const before = tops.current.get(key)
      if (!reduce && before !== undefined && before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" })
      }
      tops.current.set(key, top)
    }
  }, [order, duration])
  return ref
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
const nextSort = (column: SortColumn, sort: SortState | null | undefined): SortState =>
  sort?.column === column.id
    ? { column: column.id, direction: sort.direction === "asc" ? "desc" : "asc" }
    : { column: column.id, direction: column.firstDirection ?? "asc" }

export interface SortButtonProps extends Omit<React.ComponentProps<"button">, "onClick"> {
  /** The column this header sorts. */
  column: SortColumn
  /** Current sort state, or null when unsorted. */
  sort: SortState | null | undefined
  /** Called with the next sort state. */
  onSortChange: (sort: SortState) => void
  /** Tooltip template: `{label}` and `{direction}` are filled in. */
  hintText?: string
}

/** Header button. Put `aria-sort={ariaSort(sort, column.id)}` on its `<th>`. */
export function SortButton({ column, sort, onSortChange, hintText = "Sort by {label}, {direction}", className, ...props }: SortButtonProps) {
  const active = sort?.column === column.id
  const next = nextSort(column, sort)
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      data-slot="sort-button"
      title={fill(hintText, { label: column.label, direction: directionWords(column, next.direction) })}
      onClick={() => onSortChange(next)}
      className={cn(
        "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 font-medium transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active && "text-foreground",
        className,
      )}
      {...props}
    >
      {column.label}
      <Icon aria-hidden className={cn("size-3.5 shrink-0", !active && "opacity-40")} />
    </button>
  )
}

export interface SortIndicatorProps extends Omit<React.ComponentProps<"div">, "children" | "defaultValue"> {
  /** All sortable columns, used for labels and the readback. */
  columns: SortColumn[]
  /** Controlled sort; `null` means unsorted. */
  value?: SortState | null
  /** Starting sort when uncontrolled. */
  defaultValue?: SortState | null
  /** Called with the new sort, or null when cleared. */
  onValueChange?: (sort: SortState | null) => void
  /** Rows with no value in the sort column (they sit at the end). `sortRows` returns it. */
  emptyCount?: number
  /** Rows pinned above the sort. `sortRows` returns it. */
  pinnedCount?: number
  /** Shows a "Show column" fix when sorting by a hidden column. */
  onRevealColumn?: (columnId: string) => void
  /** Templates: `{label}`, `{direction}`, `{count}`, `{rows}` are filled in. */
  sortedText?: string
  /** Readback when nothing is sorted. */
  unsortedText?: string
  /** Label of the reverse button. */
  reverseLabel?: string
  /** Label of the clear-sort button. */
  clearLabel?: string
  /** Warning when sorting by a hidden column. */
  hiddenText?: string
  /** Label of the reveal-column button. */
  revealLabel?: string
  /** Note about rows with empty values. */
  emptyText?: string
  /** Note about pinned rows. */
  pinnedText?: string
  /** Singular and plural word for a row, e.g. ["task", "tasks"]. */
  rowWords?: [string, string]
}

/**
 * Makes the current order explicit ("Sorted by Due date, oldest first") instead
 * of a tiny arrow, and warns when the order on screen won't match what people
 * expect: sorted by a column that isn't shown, empty values gathered at the end,
 * pinned rows above everything. Changes are announced to screen readers.
 */
export function SortIndicator({
  columns,
  value,
  defaultValue = null,
  onValueChange,
  emptyCount = 0,
  pinnedCount = 0,
  onRevealColumn,
  sortedText = "Sorted by {label}, {direction}",
  unsortedText = "Not sorted: rows are in the order they were added",
  reverseLabel = "Reverse",
  clearLabel = "Clear sort",
  hiddenText = "{label} isn't shown in the table, so the order can look random.",
  revealLabel = "Show {label}",
  emptyText = "{count} {rows} with no {label} placed at the end.",
  pinnedText = "{count} pinned {rows} kept on top whatever the sort.",
  rowWords = ["row", "rows"],
  className,
  ...props
}: SortIndicatorProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const sort = value === undefined ? inner : value
  const column = columns.find((c) => c.id === sort?.column)
  const update = (next: SortState | null) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const words = (n: number) => (n === 1 ? rowWords[0] : rowWords[1])
  const values = { label: column?.label ?? "", direction: column && sort ? directionWords(column, sort.direction) : "" }
  const action = "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
  const note = "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"

  return (
    <div data-slot="sort-indicator" className={cn("grid gap-1.5 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ArrowDownWideNarrow aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p aria-live="polite" className="min-w-0 flex-1 basis-48">
          {column && sort ? (
            <>
              {fill(sortedText.split("{label}")[0], values)}
              <span className="font-medium">{column.label}</span>
              {fill(sortedText.split("{label}").slice(1).join(column.label), values)}
            </>
          ) : (
            <span className="text-muted-foreground">{unsortedText}</span>
          )}
        </p>
        {column && sort && (
          <span className="flex gap-1">
            <button type="button" onClick={() => update(nextSort(column, sort))} className={cn(action, "border hover:bg-accent")}>
              {reverseLabel}
            </button>
            <button type="button" onClick={() => update(null)} className={cn(action, "text-muted-foreground hover:bg-accent hover:text-foreground")}>
              {clearLabel}
            </button>
          </span>
        )}
      </div>
      <div aria-live="polite" className="grid gap-1 empty:hidden">
        {column?.hidden && (
          <p className={cn(note, "text-amber-700 dark:text-amber-400")}>
            <span className="flex min-w-0 flex-1 basis-48 gap-1.5">
              <EyeOff aria-hidden className="mt-px size-3.5 shrink-0" />
              {fill(hiddenText, values)}
            </span>
            {onRevealColumn && (
              <button
                type="button"
                onClick={() => onRevealColumn(column.id)}
                className={cn(action, "border border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}
              >
                {fill(revealLabel, values)}
              </button>
            )}
          </p>
        )}
        {column && emptyCount > 0 && (
          <p className={cn(note, "text-muted-foreground")}>
            <span className="flex gap-1.5">
              <ArrowDown aria-hidden className="mt-px size-3.5 shrink-0" />
              {fill(emptyText, { ...values, label: values.label.toLowerCase(), count: String(emptyCount), rows: words(emptyCount) })}
            </span>
          </p>
        )}
        {pinnedCount > 0 && (
          <p className={cn(note, "text-muted-foreground")}>
            <span className="flex gap-1.5">
              <Pin aria-hidden className="mt-px size-3.5 shrink-0" />
              {fill(pinnedText, { ...values, count: String(pinnedCount), rows: words(pinnedCount) })}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
