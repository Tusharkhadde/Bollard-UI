"use client"

import * as React from "react"
import { DatabaseZap, LoaderCircle, Play, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { analyzeSql, uncommentWhere, type SqlStatementInfo } from "./sql-lint"

export { analyzeSql, tokenizeSql, uncommentWhere } from "./sql-lint"
export type { SqlRisk, SqlStatementInfo, SqlToken } from "./sql-lint"

export interface SqlGuardProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled query text. */
  value?: string
  /** Initial query when uncontrolled. */
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Runs the query. Return a promise to show a pending state; a rejection is shown under the box. */
  onRun: (sql: string) => void | Promise<void>
  /** Connection the query runs against, e.g. "production" or "staging". */
  env?: string
  /** Environments that ask before any write. */
  productionEnvs?: string[]
  /** Estimates how many rows a write statement touches. Return null when unknown. */
  estimateRows?: (statement: SqlStatementInfo) => number | null | Promise<number | null>
  label?: string
  runLabel?: string
  runAnywayLabel?: string
  cancelLabel?: string
  /** `{env}` is filled in. */
  productionText?: string
  /** `{table}` is filled in. */
  typeTableText?: string
  uncommentLabel?: string
}

type Estimate = number | null | "pending" | "error"

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A query box that won't let a forgotten WHERE wipe a table. It tokenizes the
 * SQL (so a WHERE inside a comment or string doesn't count), warns as you type
 * about UPDATE/DELETE without WHERE, always-true conditions like WHERE 1=1,
 * DROP and TRUNCATE, asks before any write on production, shows how many rows
 * would change, and makes you type the table name before a destructive run.
 */
export function SqlGuard({
  value,
  defaultValue = "",
  onValueChange,
  onRun,
  env,
  productionEnvs = ["production", "prod"],
  estimateRows,
  label = "Query",
  runLabel = "Run",
  runAnywayLabel = "Run anyway",
  cancelLabel = "Cancel",
  productionText = "This runs on {env}.",
  typeTableText = "Type {table} to run it.",
  uncommentLabel = "Uncomment WHERE",
  className,
  ...props
}: SqlGuardProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [confirming, setConfirming] = React.useState(false)
  const [typed, setTyped] = React.useState("")
  const [estimates, setEstimates] = React.useState<Estimate[]>([])
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const ticket = React.useRef(0)
  const confirmRef = React.useRef<HTMLInputElement | HTMLButtonElement>(null)
  const id = React.useId()
  const sql = value ?? inner

  const statements = React.useMemo(() => analyzeSql(sql), [sql])
  const risky = statements.filter((s) => s.risks.length > 0)
  const isProd = !!env && productionEnvs.includes(env.toLowerCase())
  const prodWrites = isProd ? statements.filter((s) => s.writes) : []
  const checked = statements.filter((s) => s.risks.length > 0 || (isProd && s.writes))
  const phrase = [...new Set(risky.map((s) => s.table).filter(Boolean))].join(" ")
  const unlocked = !phrase || typed.trim() === phrase
  const hiddenWhere = risky.some((s) => s.risks.some((r) => r.code === "commented-where"))

  // Any edit voids the confirmation: it was for the query as it was.
  React.useEffect(() => setConfirming(false), [sql])
  React.useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const run = async () => {
    setConfirming(false)
    setPending(true)
    setError(undefined)
    try {
      await onRun(sql)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPending(false)
    }
  }

  const requestRun = () => {
    if (pending || !sql.trim()) return
    if (!risky.length && !prodWrites.length) return void run()
    setTyped("")
    setConfirming(true)
    if (!estimateRows) return setEstimates([])
    setEstimates(checked.map(() => "pending"))
    const mine = ++ticket.current
    const set = (i: number, n: Estimate) => mine === ticket.current && setEstimates((prev) => prev.map((e, j) => (j === i ? n : e)))
    checked.forEach((statement, i) => {
      Promise.resolve()
        .then(() => estimateRows(statement))
        .then((n) => set(i, n), () => set(i, "error"))
    })
  }

  const danger = risky.length > 0
  return (
    <div data-slot="sql-guard" data-env={env} className={cn("grid w-full max-w-lg gap-1.5", className)} {...props}>
      <style>{"@keyframes cui-sql-guard-in{from{opacity:0;transform:translateY(-4px)}}"}</style>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {env && (
          <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium", isProd ? "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300" : "text-muted-foreground")}>
            <span aria-hidden className={cn("size-1.5 rounded-full", isProd ? "bg-red-500" : "bg-emerald-500")} />
            {env}
          </span>
        )}
      </div>
      <textarea
        id={id}
        rows={4}
        value={sql}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            requestRun()
          }
        }}
        aria-describedby={`${id}-hint`}
        data-warning={danger ? "" : undefined}
        className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-[13px] leading-5 shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
      />
      <div id={`${id}-hint`} aria-live="polite" className="grid min-h-6 gap-0.5 text-xs">
        {risky.flatMap((s) => s.risks).map((risk) => (
          <p key={risk.message} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{risk.message}</span>
              {risk.code === "commented-where" && (
                <button type="button" onClick={() => update(uncommentWhere(sql))} className={fix}>
                  {uncommentLabel}
                </button>
              )}
            </span>
          </p>
        ))}
      </div>

      {confirming ? (
        <div
          role="group"
          aria-labelledby={`${id}-confirm`}
          onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}
          className={cn(
            "grid gap-3 rounded-lg border p-3 text-sm motion-safe:animate-[cui-sql-guard-in_200ms_ease-out]",
            danger ? "border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-50" : "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-50",
          )}
        >
          <p id={`${id}-confirm`} className="flex items-center gap-2 font-medium">
            <DatabaseZap aria-hidden className={cn("size-4 shrink-0", danger ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
            {isProd ? productionText.replace("{env}", env ?? "") : danger ? "This touches every row." : ""}
          </p>
          <ul className="grid gap-1 text-xs">
            {checked.map((s, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <code className="min-w-0 truncate font-mono">{s.verb} {s.table ?? ""}</code>
                <span className="tabular-nums opacity-80">
                  {estimates[i] === "pending" ? (
                    <LoaderCircle aria-label="Estimating rows" className="inline size-3.5 animate-spin" />
                  ) : typeof estimates[i] === "number" ? (
                    `≈ ${(estimates[i] as number).toLocaleString()} ${estimates[i] === 1 ? "row" : "rows"}`
                  ) : estimates[i] === "error" ? (
                    "rows unknown"
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {phrase && (
            <label className="grid gap-1.5 text-xs">
              <span>
                {typeTableText.split("{table}")[0]}
                <code className="rounded bg-background/70 px-1 py-0.5 font-mono font-semibold">{phrase}</code>
                {typeTableText.split("{table}")[1]}
              </span>
              <input
                ref={confirmRef as React.Ref<HTMLInputElement>}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && unlocked && run()}
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-md border bg-background px-3 font-mono text-sm text-foreground shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" ref={phrase ? undefined : (confirmRef as React.Ref<HTMLButtonElement>)} onClick={() => setConfirming(false)} className={cn(button, "border bg-background text-foreground hover:bg-accent dark:bg-input/30")}>
              {cancelLabel}
            </button>
            <button type="button" disabled={!unlocked} onClick={run} className={cn(button, "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60")}>
              {runAnywayLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-3">
          {error && (
            <p role="alert" className="min-w-0 flex-1 text-xs text-destructive">
              {error}
            </p>
          )}
          <button type="button" onClick={requestRun} disabled={pending || !sql.trim()} className={cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")}>
            {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-4" />}
            {runLabel}
          </button>
        </div>
      )}
    </div>
  )
}
