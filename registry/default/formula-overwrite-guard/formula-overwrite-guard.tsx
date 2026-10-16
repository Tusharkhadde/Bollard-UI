"use client"

import * as React from "react"
import { ClipboardPaste, Lock, TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { applyPaste, cellName, colName, parseClipboard, planPaste, rangeName, type CellFate, type Grid, type PastePlan } from "./paste-plan"

export { applyPaste, cellName, colName, parseClipboard, planPaste, rangeName, type CellFate, type Grid, type GridCell, type PastePlan, type PlannedCell } from "./paste-plan"

/** Every visible string. `{…}` placeholders are filled in. */
export const FORMULA_GUARD_MESSAGES = {
  label: "Sheet",
  pasteButton: "Paste",
  pasteHint: "Select a cell, then press Ctrl+V (⌘V).",
  clipboardDenied: "Clipboard access was blocked. Select a cell and press Ctrl+V (⌘V).",
  headline: "Pasting {rows}×{cols} at {cell} changes {n} cells.",
  formula: "{n} formulas ({range}) would become plain values and stop updating.",
  header: "{n} headings ({range}) would be replaced.",
  locked: "{n} locked cells ({range}) stay as they are.",
  outside: "{n} values fall past the edge of the table ({range}) and would be lost.",
  headerEcho: "Your copy starts with its own headings ({names}).",
  headerSkippedNote: "Your copy started with its own headings, so that row is left out.",
  skipHeader: "Skip that row",
  keepHeader: "Paste it too",
  safe: "Paste into {n} safe cells",
  all: "Paste all {n}",
  cancel: "Cancel",
  pasted: "Pasted {n} cells.",
  pastedSkipped: "Pasted {n} cells; left {skipped} alone.",
  undo: "Undo",
  undone: "Paste undone.",
  legend: { fill: "fills empty", overwrite: "replaces value", same: "unchanged", formula: "replaces formula", header: "replaces heading", locked: "locked, kept", outside: "lost past edge" } as Record<CellFate, string>,
}
export type FormulaGuardMessages = typeof FORMULA_GUARD_MESSAGES

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const RISKY: CellFate[] = ["formula", "header", "outside"]
const FATE: Record<CellFate, string> = {
  fill: "bg-emerald-500/15",
  overwrite: "bg-sky-500/15",
  same: "",
  formula: "bg-red-500/15 text-red-800 ring-1 ring-inset ring-red-500/50 dark:text-red-300",
  header: "bg-red-500/15 text-red-800 ring-1 ring-inset ring-red-500/50 dark:text-red-300",
  locked: "bg-muted text-muted-foreground",
  outside: "border-dashed text-red-700/80 line-through dark:text-red-300/80",
}
const small = "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface PasteReviewProps extends React.ComponentProps<"div"> {
  plan: PastePlan
  /** The table, to name the headings the copy repeats. */
  grid: Grid
  /** Writes the paste. "safe" skips formulas, headings, locked and outside cells. */
  onApply: (mode: "all" | "safe") => void
  onCancel: () => void
  /** Offered when the copy repeats the headings: re-plan without its first row (or with it again). */
  onToggleHeader?: () => void
  /** Whether the pasted heading row is currently skipped. FormulaOverwriteGuard skips it by default when the copy repeats the headings. */
  headerSkipped?: boolean
  messages?: Partial<FormulaGuardMessages>
}

/** The review panel on its own, for grids you already have: pair it with `planPaste`. */
export function PasteReview({ plan, grid, onApply, onCancel, onToggleHeader, headerSkipped, messages, className, ...props }: PasteReviewProps) {
  const t = { ...FORMULA_GUARD_MESSAGES, ...messages }
  const of = (fate: CellFate) => plan.cells.filter((c) => c.fate === fate)
  const changes = plan.count.fill + plan.count.overwrite + plan.count.formula + plan.count.header
  const safe = plan.count.fill + plan.count.overwrite
  const names = (grid[0] ?? []).slice(plan.col, plan.col + plan.cols).map((c) => c.value).filter(Boolean).slice(0, 4).join(", ")
  const lines = (["formula", "header", "locked", "outside"] as const).filter((f) => plan.count[f]).map((f) => [f, fill(t[f], { n: plan.count[f], range: rangeName(of(f)) })] as const)
  return (
    <div role="region" aria-label={fill(t.headline, { rows: plan.rows, cols: plan.cols, cell: cellName(plan.row, plan.col), n: changes })} className={cn("grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm", className)} {...props}>
      <p className="font-medium">{fill(t.headline, { rows: plan.rows, cols: plan.cols, cell: cellName(plan.row, plan.col), n: changes })}</p>
      <ul className="grid gap-1 text-xs">
        {lines.map(([fate, text]) => (
          <li key={fate} className={cn("flex gap-1.5", fate === "locked" ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300")}>
            {fate === "locked" ? <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
            <span className="min-w-0 break-words">{text}</span>
          </li>
        ))}
        {(plan.headerEcho || headerSkipped) && onToggleHeader && (
          <li className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-amber-800 dark:text-amber-300">
            <span>{headerSkipped ? t.headerSkippedNote : fill(t.headerEcho, { names })}</span>
            <button type="button" data-header-toggle onClick={onToggleHeader} className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200">
              {headerSkipped ? t.keepHeader : t.skipHeader}
            </button>
          </li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" data-safe disabled={!safe} onClick={() => onApply("safe")} className={cn(small, "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50")}>
          <ClipboardPaste aria-hidden className="size-3.5" />
          {fill(t.safe, { n: safe })}
        </button>
        <button type="button" onClick={() => onApply("all")} className={cn(small, "border text-red-700 hover:bg-red-500/10 dark:text-red-300")}>
          {fill(t.all, { n: changes })}
        </button>
        <button type="button" data-cancel onClick={onCancel} className={cn(small, "text-muted-foreground hover:bg-accent hover:text-foreground")}>{t.cancel}</button>
      </div>
    </div>
  )
}

export interface FormulaOverwriteGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "onPaste"> {
  /** Controlled cells, row by row. */
  value?: Grid
  /** Initial cells when uncontrolled. */
  defaultValue?: Grid
  /** Called with the new cells after a paste or undo. */
  onValueChange?: (grid: Grid) => void
  /** How many top rows are headings. */
  headerRows?: number
  /** Opens with this paste under review (for restoring an unresolved paste, and for demos). */
  defaultPaste?: { text: string; row: number; col: number }
  /** Any visible string. */
  messages?: Partial<Omit<FormulaGuardMessages, "legend">> & { legend?: Partial<Record<CellFate, string>> }
}

/**
 * A small sheet that checks a paste before writing it. Pasting over formulas, locked cells or the heading
 * row, or past the table edge, shows which cells would change, in place, and offers to paste values only
 * into the empty and non-formula cells. A copy that drags its own headings along can skip that row. Safe
 * pastes go straight in, with Undo.
 */
export function FormulaOverwriteGuard({ value, defaultValue = [], onValueChange, headerRows = 1, defaultPaste, messages, className, ...props }: FormulaOverwriteGuardProps) {
  const t = { ...FORMULA_GUARD_MESSAGES, ...messages, legend: { ...FORMULA_GUARD_MESSAGES.legend, ...messages?.legend } }
  const [inner, setInner] = React.useState<Grid>(defaultValue)
  const grid = (Array.isArray(value ?? inner) ? (value ?? inner) : []).map((r) => (Array.isArray(r) ? r : []))
  const [active, setActive] = React.useState({ row: defaultPaste?.row ?? headerRows, col: defaultPaste?.col ?? 0 })
  // A copied heading row is left out by default: pasting "Qty" into a quantity cell is never what was meant.
  const [pending, setPending] = React.useState<{ data: string[][]; row: number; col: number; skipHeader: boolean } | null>(() => {
    if (!defaultPaste) return null
    const data = parseClipboard(defaultPaste.text)
    const echo = planPaste(Array.isArray(value ?? defaultValue) ? (value ?? defaultValue) : [], defaultPaste.row, defaultPaste.col, data, { headerRows }).headerEcho
    return { data, row: defaultPaste.row, col: defaultPaste.col, skipHeader: echo }
  })
  const [done, setDone] = React.useState<{ before: Grid; text: string } | null>(null)
  const [note, setNote] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [undone, setUndone] = React.useState(false)
  const tableRef = React.useRef<HTMLTableElement>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const width = Math.max(0, ...grid.map((r) => r.length))

  const plan = pending ? planPaste(grid, pending.row, pending.col, pending.skipHeader ? pending.data.slice(1) : pending.data, { headerRows }) : null
  const at = new Map(plan?.cells.map((c) => [`${c.row}:${c.col}`, c]))
  const shownRows = Math.max(grid.length, plan ? plan.row + plan.rows : 0)
  const shownCols = Math.max(width, plan ? plan.col + plan.cols : 0)

  const announce = plan ? fill(t.headline, { rows: plan.rows, cols: plan.cols, cell: cellName(plan.row, plan.col), n: plan.count.fill + plan.count.overwrite + plan.count.formula + plan.count.header }) : done ? done.text : undone ? t.undone : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(announce), 400)
    return () => clearTimeout(timer)
  }, [announce])

  const commit = (next: Grid) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const focusCell = (row: number, col: number) => requestAnimationFrame(() => tableRef.current?.querySelector<HTMLElement>(`[data-cell="${row}:${col}"]`)?.focus())

  const write = (p: PastePlan, mode: "all" | "safe") => {
    const { grid: next, changed } = applyPaste(grid, p, mode)
    commit(next)
    const skipped = p.cells.length - changed.length - p.count.same
    setDone({ before: grid, text: skipped ? fill(t.pastedSkipped, { n: changed.length, skipped }) : fill(t.pasted, { n: changed.length }) })
    setPending(null)
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-undo]")?.focus())
  }

  const start = (text: string) => {
    const data = parseClipboard(text)
    if (!data.length) return
    setNote("")
    setUndone(false)
    const p = planPaste(grid, active.row, active.col, data, { headerRows })
    // Nothing risky: paste at once, Undo is enough.
    if (!RISKY.some((f) => p.count[f]) && !p.headerEcho) return write(p, "all")
    setDone(null)
    setPending({ data, row: active.row, col: active.col, skipHeader: p.headerEcho })
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-safe]:not(:disabled), [data-cancel]")?.focus())
  }

  const pasteFromButton = async () => {
    try {
      start(await navigator.clipboard.readText())
    } catch {
      setNote(t.clipboardDenied)
      focusCell(active.row, active.col)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const d = move[e.key]
    if (!d || !grid.length || !width) return
    e.preventDefault()
    const row = Math.min(Math.max(0, active.row + d[0]), grid.length - 1), col = Math.min(Math.max(0, active.col + d[1]), width - 1)
    setActive({ row, col })
    focusCell(row, col)
  }

  return (
    <div ref={rootRef} onKeyDown={(e) => { if (e.key === "Escape" && pending) { e.preventDefault(); setPending(null); focusCell(active.row, active.col) } }} data-slot="formula-overwrite-guard" data-state={pending ? "review" : "idle"} className={cn("grid w-full max-w-md min-w-0 gap-2 text-sm", className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{t.label}</span>
        <button type="button" onClick={pasteFromButton} className={cn(small, "h-7 border text-xs hover:bg-accent")}>
          <ClipboardPaste aria-hidden className="size-3.5" />
          {t.pasteButton}
        </button>
      </div>
      <div className="max-w-full overflow-x-auto rounded-md border">
        <table ref={tableRef} role="grid" aria-label={t.label} onKeyDown={onKeyDown} onPaste={(e) => { e.preventDefault(); start(e.clipboardData.getData("text/plain")) }} className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              <th aria-hidden className="w-6 bg-muted/60 px-1 py-1 font-normal text-muted-foreground" />
              {Array.from({ length: shownCols }, (_, c) => (
                <th key={c} scope="col" className={cn("bg-muted/60 px-2 py-1 font-normal text-muted-foreground", c >= width && "border-l border-dashed")}>{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: shownRows }, (_, r) => (
              <tr key={r} className="border-t">
                <th scope="row" className="bg-muted/60 px-1 py-1 text-center font-normal text-muted-foreground">{r + 1}</th>
                {Array.from({ length: shownCols }, (_, c) => {
                  const cell = grid[r]?.[c]
                  const planned = at.get(`${r}:${c}`)
                  const header = r < headerRows
                  const isActive = active.row === r && active.col === c
                  if (!cell) return <td key={c} className={cn("min-w-14 border-l px-2 py-1.5", planned && FATE.outside)} title={planned ? t.legend.outside : undefined}>{planned?.to}</td>
                  const shown = planned && planned.fate !== "locked" ? planned.to : cell.value
                  return (
                    <td
                      key={c}
                      role="gridcell"
                      data-cell={`${r}:${c}`}
                      tabIndex={isActive ? 0 : -1}
                      aria-selected={isActive}
                      aria-readonly={cell.locked || undefined}
                      aria-label={`${cellName(r, c)} ${cell.value || "empty"}${cell.formula ? `, formula ${cell.formula}` : ""}${cell.locked ? ", locked" : ""}${planned ? `, paste ${t.legend[planned.fate]}: ${planned.to}` : ""}`}
                      title={planned ? `${t.legend[planned.fate]}${planned.from && planned.fate !== "fill" ? ` (was ${cell.formula ?? planned.from})` : ""}` : cell.formula}
                      onClick={() => setActive({ row: r, col: c })}
                      onFocus={() => setActive({ row: r, col: c })}
                      className={cn(
                        "relative min-w-14 cursor-cell whitespace-nowrap border-l px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        header && "font-medium",
                        isActive && "ring-2 ring-inset ring-primary/60",
                        planned && FATE[planned.fate],
                      )}
                    >
                      {cell.formula && !(planned && planned.fate === "formula") && <span aria-hidden className="mr-1 font-serif italic text-muted-foreground">ƒ</span>}
                      {cell.locked && <Lock aria-hidden className="mr-1 inline size-3 align-[-2px] text-muted-foreground" />}
                      {shown}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!pending && !done && <p className="text-xs text-muted-foreground">{note || t.pasteHint}</p>}
      {plan && (
        <>
          <ul aria-hidden className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(Object.keys(plan.count) as CellFate[]).filter((f) => plan.count[f] && f !== "same").map((f) => (
              <li key={f} className="flex items-center gap-1"><span className={cn("inline-block size-2.5 rounded-sm border", FATE[f])} />{t.legend[f]}</li>
            ))}
          </ul>
          <PasteReview
            plan={plan}
            grid={grid}
            messages={t}
            headerSkipped={pending?.skipHeader}
            onToggleHeader={() => {
              setPending((p) => (p ? { ...p, skipHeader: !p.skipHeader } : p))
              requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-header-toggle]")?.focus())
            }}
            onApply={(mode) => write(plan, mode)}
            onCancel={() => { setPending(null); focusCell(active.row, active.col) }}
          />
        </>
      )}
      {done && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-700 dark:text-emerald-400">
          <span>{done.text}</span>
          <button
            type="button"
            data-undo
            onClick={() => { commit(done.before); setDone(null); setUndone(true); focusCell(active.row, active.col) }}
            className="inline-flex h-6 items-center gap-1 rounded-md px-2 font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Undo2 aria-hidden className="size-3.5" />
            {t.undo}
          </button>
        </p>
      )}
      <span aria-live="polite" className="sr-only">{status}</span>
    </div>
  )
}
