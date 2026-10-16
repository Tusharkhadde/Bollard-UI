"use client"

import * as React from "react"
import { ListFilter, SearchX, X } from "lucide-react"

import { cn } from "@/lib/utils"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
/** Banner tones, identical across Bollard UI banners. */
const tones = {
  warning: {
    surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
  },
  info: {
    surface: "border-sky-500/30 bg-background bg-linear-to-r from-sky-500/10 to-sky-500/10 text-sky-950 dark:text-sky-50",
    icon: "text-sky-600 dark:text-sky-400",
    muted: "text-sky-900/75 dark:text-sky-100/75",
    solid: "bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-400 dark:text-sky-950 dark:hover:bg-sky-300",
    outline: "border border-sky-700/25 hover:bg-sky-500/15 dark:border-sky-300/25",
  },
} as const

export interface ActiveFilter {
  /** Stable id passed back to `onRemoveFilter`. */
  id: string
  /** What the chip says, e.g. "Status: Open" or `Search: "acme"`. */
  label: string
  /** Items that would come back if only this filter were removed. Shown on the chip; the biggest is highlighted. */
  hides?: number
}

/**
 * Items each filter hides on its own: how many more would show if that one
 * filter were removed. `matches(item, skip)` should test every filter except
 * `skip`; pass `skip` as undefined for the full set.
 */
export function hiddenByEach<T>(items: T[], filterIds: string[], matches: (item: T, skip?: string) => boolean) {
  const shown = items.filter((item) => matches(item)).length
  return Object.fromEntries(filterIds.map((id) => [id, items.filter((item) => matches(item, id)).length - shown]))
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface FilterNoticeProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Items before any filter or search. */
  total: number
  /** Items visible now. */
  shown: number
  /** Active filters and search terms, one chip each. */
  filters: ActiveFilter[]
  /** Remove one filter. */
  onRemoveFilter: (id: string) => void
  /** Remove every filter and the search. */
  onClearAll: () => void
  /** Selected items that the filters now hide, so a bulk action wouldn't visibly include them. */
  hiddenSelected?: number
  /** "23 items". Override to name your rows or translate. */
  formatCount?: (count: number) => string
  /** Templates: `{hidden}`, `{shown}`, `{total}` (formatted counts) and `{filters}` ("2 filters") are filled in. */
  message?: string
  emptyText?: string
  /** `{count}` is the number of hidden selected items. */
  hiddenSelectedText?: string
  clearAllLabel?: string
  removeLabel?: string
}

const defaultCount = (count: number) => `${count} ${count === 1 ? "item" : "items"}`

/**
 * Stops people concluding data is missing, or bulk-acting on a partial set,
 * because a filter they forgot about is still on. It says how many items are
 * hidden and by how many filters, lists each filter as a removable chip that
 * shows how many items it hides on its own (so the culprit stands out), and
 * warns when selected items are among the hidden ones.
 */
export function FilterNotice({
  total,
  shown,
  filters,
  onRemoveFilter,
  onClearAll,
  hiddenSelected = 0,
  formatCount = defaultCount,
  message = "{hidden} hidden by {filters} · showing {shown} of {total}",
  emptyText = "Nothing matches. {hidden} hidden by {filters}.",
  hiddenSelectedText = "{count} selected {verb} hidden by these filters and not visible in the list.",
  clearAllLabel = "Clear all",
  removeLabel = "Remove filter",
  className,
  ...props
}: FilterNoticeProps) {
  const hidden = Math.max(0, total - shown)
  if (hidden === 0 || filters.length === 0) return null

  const values = {
    hidden: formatCount(hidden),
    shown: shown.toLocaleString(),
    total: total.toLocaleString(),
    filters: `${filters.length} ${filters.length === 1 ? "filter" : "filters"}`,
  }
  const warn = shown === 0 || hiddenSelected > 0
  const tone = warn ? tones.warning : tones.info
  const Icon = shown === 0 ? SearchX : ListFilter
  const biggest = Math.max(0, ...filters.map((filter) => filter.hides ?? 0))

  return (
    <div
      data-slot="filter-notice"
      data-state={shown === 0 ? "empty" : warn ? "hidden-selection" : "filtered"}
      role="region"
      aria-label="Active filters"
      className={cn("overflow-hidden rounded-lg border transition-colors", tone.surface, className)}
      {...props}
    >
      <div className={bar}>
        <div className="flex min-w-0 flex-1 basis-48 items-start gap-3">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
          <p className="min-w-0 flex-1 font-medium tabular-nums" aria-live="polite">
            {fill(shown === 0 ? emptyText : message, values)}
          </p>
        </div>
        <button type="button" onClick={onClearAll} className={cn(action, shown === 0 ? tone.solid : tone.outline)}>
          {clearAllLabel}
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5 px-3 pb-2" aria-label="Filters">
        {filters.map((filter) => {
          const culprit = filters.length > 1 && biggest > 0 && filter.hides === biggest
          const extra = filter.hides ? ` (shows ${formatCount(filter.hides)})` : ""
          return (
            <li
              key={filter.id}
              className={cn(
                "inline-flex h-7 max-w-full items-center gap-1 rounded-md border bg-background/70 pr-0.5 pl-2 text-xs",
                culprit ? "border-current/40 font-medium" : "border-current/15",
              )}
            >
              <span className="truncate">{filter.label}</span>
              {filter.hides ? <span className={cn("tabular-nums", tone.muted)}>+{filter.hides}</span> : null}
              <button
                type="button"
                aria-label={`${removeLabel} ${filter.label}${extra}`}
                onClick={() => onRemoveFilter(filter.id)}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm outline-none hover:bg-current/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
      <p aria-live="polite" className={cn("border-t border-inherit px-3 py-2 text-xs empty:hidden", tone.muted)}>
        {hiddenSelected > 0 && fill(hiddenSelectedText, { count: hiddenSelected, verb: hiddenSelected === 1 ? "item is" : "items are" })}
      </p>
    </div>
  )
}
