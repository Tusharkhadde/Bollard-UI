"use client"

// Bollard UI — migration-preview · MIT licence · https://bollard-ui.vercel.app/components/migration-preview

import * as React from "react"
import { CircleAlert, CircleCheck, Info, Lock, TriangleAlert, Undo2, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { replaceStep, reviewMigration, type MigrationContext, type MigrationRisk, type MigrationStep } from "@/registry/default/migration-preview/review-migration"

export { replaceStep, reviewMigration, splitStatements, type MigrationContext, type MigrationLock, type MigrationRisk, type MigrationRiskKind, type MigrationStep } from "@/registry/default/migration-preview/review-migration"

const DEFAULT_MESSAGES = {
  label: "Migration",
  empty: "No statements to review.",
  steps: "{count} steps",
  steps_one: "1 step",
  irreversible: "{count} can't be undone",
  locking: "{count} hold a long lock",
  locking_one: "1 holds a long lock",
  clean: "Safe to run: no long locks, nothing lost.",
  step: "Step {n}",
  "lock-reads-writes": "Blocks reads and writes",
  "lock-writes": "Blocks writes",
  slow: "Touches every row",
  brief: "briefly",
  rows: "{rows} rows",
  cantUndo: "Can't undo",
  "drop-table": "Deletes the table and every row in it. A down migration can recreate it, not refill it.",
  "drop-column": "Deletes {detail} and its data. Code still reading {detail} breaks until it's deployed without it.",
  truncate: "Deletes every row, with no way back but a backup.",
  "delete-all": "DELETE with no WHERE removes every row.",
  "not-null-no-default": "Adding {detail} as NOT NULL with no default fails if the table has any rows.",
  "volatile-default": "{detail} is computed per row, so Postgres rewrites the whole table under a full lock.",
  "rewrite-column": "Adding {detail} this way rewrites the whole table under a full lock.",
  "type-change": "Changing the type of {detail} usually rewrites the table under a full lock.",
  "set-not-null": "SET NOT NULL scans every row while blocking reads and writes.",
  "index-blocking": "Building this index blocks every write to the table until it finishes.",
  "drop-index-blocking": "Dropping an index this way waits for, then blocks, every query on the table.",
  "concurrently-in-tx": "CONCURRENTLY can't run inside a transaction, so this step fails. Run it in its own migration.",
  "constraint-validate": "Checks every existing row while holding the lock.",
  "unique-constraint": "Builds a unique index while blocking reads and writes.",
  "rename-column": "Renaming {detail} breaks the old code still running mid-deploy. Add the new column, write both, then drop the old one.",
  "rename-table": "Renaming the table breaks the old code still running mid-deploy.",
  "update-all": "One big UPDATE locks every row it touches until it commits. Backfill in batches.",
  "lock-timeout": "No lock_timeout, so a step waiting behind a slow query blocks every query queued behind it.",
  "reindex-blocking": "Rebuilding indexes this way blocks writes, and queries that use them, until it finishes.",
  "table-rewrite": "Rewrites the whole table while blocking reads and writes.",
  "fix-index-blocking": "Use CONCURRENTLY",
  "fix-drop-index-blocking": "Use CONCURRENTLY",
  "fix-not-null-no-default": "Split into safe steps",
  "fix-volatile-default": "Split into safe steps",
  "fix-set-not-null": "Validate first",
  "fix-constraint-validate": "Add NOT VALID",
  "fix-unique-constraint": "Build index first",
  "fix-lock-timeout": "Add lock_timeout",
  "fix-reindex-blocking": "Use CONCURRENTLY",
  undo: "Undo fix",
}
export type MigrationPreviewMessages = typeof DEFAULT_MESSAGES

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const tones = { danger: "text-red-700 dark:text-red-400", warning: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" }
const icons = { danger: CircleAlert, warning: TriangleAlert, info: Info }
const rank = { danger: 3, warning: 2, info: 1 }
const fixClass = (danger: boolean) =>
  cn(
    "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium [overflow-wrap:anywhere] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    danger ? "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200",
  )
const badge = "inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[11px] font-medium whitespace-nowrap"

/** Announces `text` only after changes settle, so screen readers don't chatter. */
function useSettled(text: string, delay = 900) {
  const [settled, setSettled] = React.useState(text)
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(text), delay)
    return () => clearTimeout(timer)
  }, [text, delay])
  return settled
}

export interface MigrationPreviewProps extends Omit<React.ComponentProps<"section">, "defaultValue">, MigrationContext {
  /** Controlled migration SQL (Postgres). */
  value?: string
  /** Initial SQL when uncontrolled. */
  defaultValue?: string
  /** Called with the new SQL when a fix is applied or undone. */
  onValueChange?: (value: string) => void
  /** Number format for row counts. */
  locale?: string
  /** Visible label; shorthand for `messages.label`. */
  label?: string
  /** Every visible string (`_one` keys are the singular forms). `{count}`, `{n}`, `{rows}`, `{detail}` are filled in. */
  messages?: Partial<MigrationPreviewMessages>
}

/**
 * A readback of a Postgres migration, one step at a time, before it runs:
 * what each step locks and for how long (with real row counts when you pass
 * them), what rewrites the table, what can't be undone (dropped tables and
 * columns, TRUNCATE), NOT NULL columns that will fail, renames that break code
 * mid-deploy, CONCURRENTLY inside a transaction and a missing lock_timeout.
 * Each fixable step gets the safer sequence in one tap, with undo.
 */
export function MigrationPreview({
  value,
  defaultValue = "",
  onValueChange,
  tableSizes,
  largeTableRows,
  inTransaction,
  locale,
  label,
  messages,
  className,
  ...props
}: MigrationPreviewProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages, ...(label !== undefined && { label }) }
  const [inner, setInner] = React.useState(defaultValue)
  // Each entry is the SQL before a fix and the SQL the fix produced, so undo only offers itself while nothing else changed it.
  const [history, setHistory] = React.useState<{ before: string; after: string }[]>([])
  const list = React.useRef<HTMLOListElement>(null)
  const undoButton = React.useRef<HTMLButtonElement>(null)
  const refocus = React.useRef<number | null>(null)
  const baseId = React.useId()
  const sql = value ?? inner
  const canUndo = history.length > 0 && history[history.length - 1].after === sql
  const steps = React.useMemo(() => reviewMigration(sql, { tableSizes, largeTableRows, inTransaction }), [sql, tableSizes, largeTableRows, inTransaction])
  const irreversible = steps.filter((step) => step.irreversible).length
  const locking = steps.filter((step) => step.slow && step.lock !== "none" && step.risks.some((risk) => risk.severity === "warning")).length
  const risky = steps.some((step) => step.risks.some((risk) => risk.severity !== "info"))
  const summary = [steps.length === 1 ? t.steps_one : fill(t.steps, { count: steps.length }), irreversible && fill(t.irreversible, { count: irreversible }), locking && (locking === 1 ? t.locking_one : fill(t.locking, { count: locking }))].filter(Boolean).join(" · ")
  const announced = useSettled(steps.length ? summary : "")
  const number = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 })

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  // The tapped fix disappears with its risk, so focus goes to the next fix, or the step that changed.
  React.useEffect(() => {
    if (refocus.current === null) return
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button[data-fix]") ?? []
    const target = buttons[Math.min(refocus.current, buttons.length - 1)] ?? undoButton.current
    target?.focus()
    refocus.current = null
  }, [sql])
  const applyFix = (step: MigrationStep, risk: MigrationRisk, button: HTMLElement) => {
    if (risk.fix === undefined) return
    refocus.current = [...(list.current?.querySelectorAll("button[data-fix]") ?? [])].indexOf(button)
    const next = replaceStep(sql, step, risk.fix)
    setHistory((prev) => [...(canUndo ? prev : []), { before: sql, after: next }])
    update(next)
  }
  const undo = () => {
    if (!canUndo) return
    setHistory((prev) => prev.slice(0, -1))
    refocus.current = 0
    update(history[history.length - 1].before)
  }

  return (
    <section data-slot="migration-preview" aria-labelledby={`${baseId}-title`} className={cn("grid w-full grid-cols-[minmax(0,1fr)] max-w-xl min-w-0 gap-2 text-sm", className)} {...props}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id={`${baseId}-title`} className="font-medium">
          {t.label}
        </h3>
        {steps.length > 0 && (
          <p className={cn("flex items-center gap-1.5 text-xs", risky ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
            {risky ? <TriangleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-400" /> : <CircleCheck aria-hidden className="size-3.5" />}
            {risky ? summary : t.clean}
          </p>
        )}
      </header>
      <span role="status" className="sr-only">
        {announced}
      </span>
      {steps.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t.empty}</p>
      ) : (
        <ol ref={list} className="grid gap-2">
          {steps.map((step) => {
            const top = step.risks.reduce<MigrationRisk["severity"] | null>((max, risk) => (!max || rank[risk.severity] > rank[max] ? risk.severity : max), null)
            return (
              <li key={`${step.index}-${step.start}`} data-severity={top ?? undefined} className="grid min-w-0 gap-1.5 rounded-md border p-2 data-[severity=danger]:border-red-500/40 data-[severity=danger]:bg-red-500/5 data-[severity=warning]:border-amber-500/40 data-[severity=warning]:bg-amber-500/5">
                <div className="flex min-w-0 gap-2">
                  <span className="sr-only">{fill(t.step, { n: step.index + 1 })}</span>
                  <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-muted font-mono text-[11px] text-muted-foreground tabular-nums">
                    {step.index + 1}
                  </span>
                  <pre className="max-h-40 min-w-0 flex-1 overflow-auto font-mono text-xs leading-5 break-words whitespace-pre-wrap">{step.sql}</pre>
                </div>
                {(step.lock !== "none" || step.irreversible || step.rows !== undefined) && (
                  <div className="flex flex-wrap gap-1.5 pl-7">
                    {step.irreversible && (
                      <span className={cn(badge, "border-red-500/40 text-red-700 dark:text-red-300")}>
                        <Undo2 aria-hidden className="size-3" />
                        {t.cantUndo}
                      </span>
                    )}
                    {step.lock !== "none" && (
                      <span className={cn(badge, step.slow && (step.rows === undefined || step.risks.some((risk) => risk.severity === "warning")) ? "border-amber-500/40 text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
                        <Lock aria-hidden className="size-3" />
                        {t[step.lock === "writes" ? "lock-writes" : "lock-reads-writes"]}
                        {step.slow ? ` · ${t.slow}` : ` ${t.brief}`}
                      </span>
                    )}
                    {step.table && step.rows !== undefined && <span className={cn(badge, "font-mono font-normal text-muted-foreground")}>{`${step.table} · ${fill(t.rows, { rows: number.format(step.rows) })}`}</span>}
                  </div>
                )}
                {step.risks.length > 0 && (
                  <ul className="grid gap-1 pl-7 text-xs">
                    {step.risks.map((risk) => {
                      const Icon = icons[risk.severity]
                      const fixLabel = (t as Record<string, string>)[`fix-${risk.kind}`]
                      return (
                        <li key={risk.kind} className={cn("flex gap-1.5", tones[risk.severity])}>
                          <span className="flex h-6 shrink-0 items-center">
                            <Icon aria-hidden className="size-3.5" />
                          </span>
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="py-1 [overflow-wrap:anywhere]">{fill(t[risk.kind], { detail: risk.detail ?? "" })}</span>
                            {risk.fix !== undefined && fixLabel && (
                              <button type="button" data-fix="" onClick={(event) => applyFix(step, risk, event.currentTarget)} className={fixClass(risk.severity === "danger")}>
                                <WandSparkles aria-hidden className="size-3.5" />
                                {fixLabel}
                              </button>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {canUndo && (
        <button ref={undoButton} type="button" onClick={undo} className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
          <Undo2 aria-hidden className="size-3.5" />
          {t.undo}
        </button>
      )}
    </section>
  )
}
