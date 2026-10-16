"use client"

import * as React from "react"
import { Check, ChevronLeft, ChevronRight, EyeOff, TextSelect } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RangeRow {
  id: string
  label: React.ReactNode
  /** Right-aligned secondary text, e.g. an amount. */
  detail?: React.ReactNode
  /** Filtered out of the current view. Hidden rows stay in order but are never range-selected. */
  hidden?: boolean
}

/** Every id from `anchor` to `target` inclusive, in list order (either direction). */
export function selectRange(order: string[], anchor: string, target: string) {
  const a = order.indexOf(anchor)
  const b = order.indexOf(target)
  if (a < 0 || b < 0) return [target]
  return order.slice(Math.min(a, b), Math.max(a, b) + 1)
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const small =
  "inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

type Gesture = { how: string; base: string[]; count: number; added: string[]; skipped: number; offPage: string[]; pages: number[] }

export interface RangeSelectGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Every row in display order, including ones the current filter hides. */
  rows: RangeRow[]
  /** Rows per page. */
  pageSize?: number
  /** Controlled selected ids. */
  value?: string[]
  /** Initial selected ids when uncontrolled. */
  defaultValue?: string[]
  onValueChange?: (ids: string[]) => void
  /** Accessible name of the list. */
  label?: string
  /** Templates. `{how}`, `{count}`, `{pages}` are filled in. */
  rangeText?: string
  skippedText?: string
  offPageText?: string
  onlyPageLabel?: string
  undoLabel?: string
  hiddenSelectedText?: string
  deselectHiddenLabel?: string
}

/**
 * Shift-click range selection that reads back what it just did. After every
 * range ("Shift-click selected 214 rows") it offers Undo, says how many rows
 * it skipped because the filter hides them, and flags rows on pages that were
 * never on screen during the gesture, with a one-tap "only these". Rows already selected and then
 * hidden by a filter are called out too, so a bulk action never hits rows you
 * can't see. The anchor stays put, so a second shift-click redraws the range.
 * Keyboard: ↑/↓ move, Space toggles, Shift+↑/↓ or Shift+Space extend.
 */
export function RangeSelectGuard({
  rows, pageSize = 10, value, defaultValue = [], onValueChange, label = "Rows",
  rangeText = "{how} selected {count} rows",
  skippedText = "skipped {count} hidden by your filter",
  offPageText = "{count} are on {pages}, out of view",
  onlyPageLabel = "Only the ones I saw ({count})",
  undoLabel = "Undo",
  hiddenSelectedText = "{count} selected rows are hidden by your filter.",
  deselectHiddenLabel = "Deselect them",
  className, ...props
}: RangeSelectGuardProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const selected = new Set(value ?? inner)
  const [anchor, setAnchor] = React.useState<string>()
  const [focusId, setFocusId] = React.useState<string>()
  const [page, setPage] = React.useState(0)
  const [gesture, setGesture] = React.useState<Gesture>()
  const listRef = React.useRef<HTMLDivElement>(null)
  const keyboard = React.useRef(false)

  const visible = rows.filter((r) => !r.hidden)
  const pageOf = new Map(visible.map((r, i) => [r.id, Math.floor(i / pageSize)]))
  const pages = Math.max(1, Math.ceil(visible.length / pageSize))
  const shown = visible.slice(page * pageSize, (page + 1) * pageSize)
  const hiddenSelected = rows.filter((r) => r.hidden && selected.has(r.id)).map((r) => r.id)

  const commit = (ids: Iterable<string>) => {
    const next = [...new Set(ids)]
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const goTo = (p: number) => setPage(p)

  const extend = (target: string, how: string, from = anchor ?? target) => {
    if (from !== anchor) setAnchor(from)
    // A second range from the same anchor redraws it instead of stacking.
    const base = gesture ? gesture.base : [...selected]
    const span = selectRange(rows.map((r) => r.id), from, target)
    const pick = span.filter((id) => pageOf.has(id))
    // Rows on pages between the two ends were never on screen during the gesture.
    const ends = new Set([pageOf.get(from), pageOf.get(target)])
    const offPage = pick.filter((id) => !ends.has(pageOf.get(id)))
    commit([...base, ...pick])
    setGesture({
      how, base, count: pick.length, added: pick.filter((id) => !base.includes(id)), skipped: span.length - pick.length, offPage,
      pages: [...new Set(offPage.map((id) => (pageOf.get(id) ?? 0) + 1))],
    })
  }

  const toggle = (id: string) => {
    setAnchor(id)
    setGesture(undefined)
    commit(selected.has(id) ? [...selected].filter((s) => s !== id) : [...selected, id])
  }

  const onlyThisPage = () => {
    if (!gesture) return
    const off = new Set(gesture.offPage)
    commit([...selected].filter((id) => !off.has(id) || gesture.base.includes(id)))
    setGesture({ ...gesture, count: gesture.count - off.size, added: gesture.added.filter((id) => !off.has(id)), offPage: [], pages: [] })
  }

  const move = (delta: number, shift: boolean) => {
    const at = visible.findIndex((r) => r.id === focusId)
    const next = visible[Math.max(0, Math.min(visible.length - 1, at + delta))]
    if (!next) return
    keyboard.current = true
    setFocusId(next.id)
    const p = pageOf.get(next.id) ?? 0
    if (p !== page) goTo(p)
    if (shift) extend(next.id, "Shift+arrow", anchor ?? focusId)
  }

  React.useEffect(() => {
    if (!keyboard.current || !focusId) return
    listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(focusId)}"]`)?.focus()
  }, [focusId, page])

  // Flash the rows a range just added, so you see what joined.
  React.useEffect(() => {
    if (!gesture?.added.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    for (const id of gesture.added) {
      listRef.current?.querySelector(`[data-row="${CSS.escape(id)}"]`)?.animate(
        [{ backgroundColor: "rgb(245 158 11 / 0.3)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" })
    }
  }, [gesture])

  const tabbable = shown.some((r) => r.id === focusId) ? focusId : shown[0]?.id
  const total = selected.size

  return (
    <div data-slot="range-select-guard" className={cn("w-full max-w-md overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs", className)} {...props}>
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
        <span className="font-medium whitespace-nowrap tabular-nums">{total} selected</span>
        <span className="min-w-0 truncate text-muted-foreground max-[420px]:hidden">of {visible.length} shown</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => goTo(page - 1)} className={cn(small, "size-7 px-0 hover:bg-accent")}><ChevronLeft aria-hidden className="size-4" /></button>
          <span className="px-1 whitespace-nowrap tabular-nums" aria-live="polite">Page {page + 1} of {pages}</span>
          <button type="button" aria-label="Next page" disabled={page >= pages - 1} onClick={() => goTo(page + 1)} className={cn(small, "size-7 px-0 hover:bg-accent")}><ChevronRight aria-hidden className="size-4" /></button>
        </div>
      </div>

      <div aria-live="polite">
        {gesture ? (
          <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3 py-2 text-xs", gesture.skipped || gesture.offPage.length ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100" : "bg-muted/50")}>
            <TextSelect aria-hidden className="size-3.5 shrink-0" />
            <p className="min-w-0 flex-1 basis-48">
              <span className="font-medium">{fill(rangeText, { how: gesture.how, count: gesture.count })}</span>
              {gesture.skipped ? `, ${fill(skippedText, { count: gesture.skipped })}` : ""}
              {gesture.offPage.length ? `. ${fill(offPageText, { count: gesture.offPage.length, pages: `${gesture.pages.length === 1 ? "page" : "pages"} ${gesture.pages.join(", ")}` })}` : ""}.
            </p>
            {gesture.offPage.length ? (
              <button type="button" onClick={onlyThisPage} className={cn(small, "border-amber-500/40 hover:bg-amber-500/15")}>{fill(onlyPageLabel, { count: gesture.count - gesture.offPage.length })}</button>
            ) : null}
            <button type="button" onClick={() => { commit(gesture.base); setGesture(undefined) }} className={cn(small, "hover:bg-accent")}>{undoLabel}</button>
          </div>
        ) : null}
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-multiselectable
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move(e.key === "ArrowDown" ? 1 : -1, e.shiftKey) }
          if (e.key === " " && focusId) { e.preventDefault(); if (e.shiftKey && anchor) extend(focusId, "Shift+Space"); else toggle(focusId) }
        }}
        className="divide-y"
      >
        {shown.map((row) => {
          const on = selected.has(row.id)
          return (
            <div
              key={row.id}
              data-row={row.id}
              role="option"
              aria-selected={on}
              tabIndex={row.id === tabbable ? 0 : -1}
              onMouseDown={(e) => e.shiftKey && e.preventDefault()}
              onFocus={() => setFocusId(row.id)}
              onClick={(e) => { keyboard.current = false; if (e.shiftKey && anchor) extend(row.id, "Shift-click"); else toggle(row.id) }}
              className={cn("flex h-10 cursor-default items-center gap-3 px-3 text-sm outline-none select-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50", on ? "bg-accent/70" : "hover:bg-accent/40", row.id === anchor && "shadow-[inset_2px_0_0] shadow-foreground/40")}
            >
              <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-[4px] border shadow-xs transition-colors", on && "border-primary bg-primary text-primary-foreground")}>
                {on ? <Check className="size-3" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              {row.detail ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{row.detail}</span> : null}
            </div>
          )
        })}
      </div>

      {hiddenSelected.length ? (
        <p className="flex flex-wrap items-center gap-2 border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <EyeOff aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{fill(hiddenSelectedText, { count: hiddenSelected.length })}</span>
          <button type="button" onClick={() => commit([...selected].filter((id) => !hiddenSelected.includes(id)))} className={cn(small, "border-amber-500/40 hover:bg-amber-500/15")}>{deselectHiddenLabel}</button>
        </p>
      ) : null}
    </div>
  )
}
