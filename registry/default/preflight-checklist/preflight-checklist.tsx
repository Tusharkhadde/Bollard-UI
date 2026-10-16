"use client"

import * as React from "react"
import { CircleAlert, CircleCheck, CircleDashed, CircleX, LoaderCircle, Lock, RotateCw, Rocket } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CheckResult {
  pass: boolean
  /** Why it failed (or a short note on why it passed). */
  reason?: string
}

export interface PreflightCheck {
  id: string
  label: string
  description?: string
  /** Async auto-check. Omit it to make this a manual check the user ticks. Throwing counts as a failure. */
  run?: (signal: AbortSignal) => Promise<CheckResult>
}

export interface PreflightChecklistProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children"> {
  checks: PreflightCheck[]
  /** Label of the gated action, e.g. "Deploy to production". */
  actionLabel: string
  /** The gated action. Return a promise to show a pending state; a rejection is shown under the button. */
  onAction: () => void | Promise<void>
  /** What's being shipped (a commit, a draft version). When it changes, manual ticks reset and auto-checks re-run. */
  revision?: string
  /** Re-run auto-checks right before the action fires, so a result can't go stale between check and click. */
  recheckOnAction?: boolean
  /** Header text. */
  title?: string
  /** Re-run button text. */
  rerunLabel?: string
  /** Text before the blocker chips. */
  blockedLabel?: string
  /** Shown when nothing blocks. */
  passedLabel?: string
  /** Button text while auto-checks re-run before the action. */
  verifyingLabel?: string
  /** Button text while the action runs. */
  workingLabel?: string
}

type Status = { state: "running" } | ({ state: "done" } & CheckResult)

const smallButton =
  "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Gates a risky action (deploy, publish, send) behind required checks. Auto
 * checks run on mount and again right before the action; manual ticks are
 * tied to a revision and reset when it changes, so "I checked it" can't
 * carry over to a build nobody checked. The button names what's blocking.
 */
export function PreflightChecklist({
  checks,
  actionLabel,
  onAction,
  revision,
  recheckOnAction = true,
  title = "Preflight",
  rerunLabel = "Re-run checks",
  blockedLabel = "Blocked by",
  passedLabel = "All checks passed.",
  verifyingLabel = "Re-verifying…",
  workingLabel = "Working…",
  className,
  ...props
}: PreflightChecklistProps) {
  const [results, setResults] = React.useState<Record<string, Status>>({})
  const [ticked, setTicked] = React.useState<Record<string, boolean>>({})
  const [phase, setPhase] = React.useState<"idle" | "verifying" | "running">("idle")
  const [error, setError] = React.useState<string>()
  const controller = React.useRef<AbortController | null>(null)
  const checksRef = React.useRef(checks)
  const baseId = React.useId()
  const statusId = `${baseId}-status`
  const rowId = (id: string) => `${baseId}-${id}`

  React.useEffect(() => {
    checksRef.current = checks
  })

  const runAll = React.useCallback(async () => {
    controller.current?.abort()
    const { signal } = (controller.current = new AbortController())
    const auto = checksRef.current.filter((check) => check.run)
    setResults((prev) => ({ ...prev, ...Object.fromEntries(auto.map((c) => [c.id, { state: "running" } as Status])) }))
    const outcomes = await Promise.all(
      auto.map(async (check) => {
        let result: CheckResult
        try {
          result = await check.run!(signal)
        } catch (err) {
          result = { pass: false, reason: err instanceof Error ? err.message : "Check crashed" }
        }
        if (!signal.aborted) setResults((prev) => ({ ...prev, [check.id]: { state: "done", ...result } }))
        return result.pass
      })
    )
    return !signal.aborted && outcomes.every(Boolean)
  }, [])

  // Re-run when what's being shipped changes, or when an auto-check is added or removed.
  const autoIds = checks.filter((check) => check.run).map((check) => check.id).join("|")
  React.useEffect(() => {
    setTicked({})
    setError(undefined)
    void runAll()
    return () => controller.current?.abort()
  }, [revision, autoIds, runAll])

  const isPassing = (check: PreflightCheck) => {
    const status = results[check.id]
    return check.run ? status?.state === "done" && status.pass : !!ticked[check.id]
  }
  const blocking = checks.filter((check) => !isPassing(check))
  const locked = blocking.length > 0 || phase !== "idle"

  /** Manual checks focus their checkbox, auto checks their row. */
  const focusCheck = (check: PreflightCheck) => document.getElementById(rowId(check.id))?.focus()

  const fire = async () => {
    if (phase !== "idle") return
    if (blocking.length > 0) return focusCheck(blocking[0])
    setError(undefined)
    try {
      setPhase("verifying")
      if (recheckOnAction && !(await runAll())) return
      setPhase("running")
      await onAction()
    } catch (err) {
      setError(err instanceof Error ? err.message : `${actionLabel} failed`)
    } finally {
      setPhase("idle")
    }
  }

  return (
    <div
      data-slot="preflight-checklist"
      data-state={blocking.length > 0 ? "blocked" : "ready"}
      className={cn("w-full max-w-md overflow-hidden rounded-xl border bg-card text-sm text-card-foreground", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-3 border-b p-3">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          {title}
          {revision && <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-normal">{revision}</code>}
        </span>
        <button
          type="button"
          onClick={() => void runAll()}
          disabled={phase !== "idle"}
          title={rerunLabel}
          className={cn(smallButton, "shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50")}
        >
          <RotateCw aria-hidden className="size-4" />
          <span className="max-sm:sr-only">{rerunLabel}</span>
        </button>
      </div>

      <ul className="divide-y">
        {checks.map((check) => {
          const status = results[check.id]
          const running = check.run && (!status || status.state === "running")
          const passing = isPassing(check)
          const reason = status?.state === "done" ? status.reason : undefined
          const state = running ? "checking" : passing ? "passed" : "failed"
          const text = (
            <>
              <span className="font-medium">{check.label}</span>
              {check.description && <span className="block text-xs text-muted-foreground">{check.description}</span>}
              {reason && (
                <span className={cn("mt-0.5 block text-xs", passing ? "text-muted-foreground" : "text-red-700 dark:text-red-400")}>
                  {reason}
                </span>
              )}
              {!check.run && revision && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {ticked[check.id] ? `Confirmed for ${revision}` : `Confirm for ${revision}`}
                </span>
              )}
            </>
          )
          return check.run ? (
            <li key={check.id} id={rowId(check.id)} tabIndex={-1} className="flex gap-3 p-3 outline-none focus:bg-accent/60">
              <span className="mt-0.5 shrink-0" aria-hidden>
                {running ? (
                  <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                ) : passing ? (
                  <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CircleX className="size-4 text-red-600 dark:text-red-400" />
                )}
              </span>
              <p className="min-w-0 flex-1">
                {text}
                <span className="sr-only">, {state}</span>
              </p>
            </li>
          ) : (
            <li key={check.id}>
              <label className="flex cursor-pointer gap-3 p-3 hover:bg-accent/40">
                <input
                  id={rowId(check.id)}
                  type="checkbox"
                  checked={!!ticked[check.id]}
                  onChange={(event) => setTicked((prev) => ({ ...prev, [check.id]: event.target.checked }))}
                  className="mt-0.5 size-4 shrink-0 accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <span className="min-w-0 flex-1">{text}</span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="space-y-3 border-t bg-muted/30 p-3">
        <div id={statusId} aria-live="polite" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {blocking.length > 0 ? (
            <>
              <span>{blockedLabel}</span>
              {blocking.map((check) => (
                <button
                  key={check.id}
                  type="button"
                  onClick={() => focusCheck(check)}
                  className="inline-flex h-6 max-w-full items-center gap-1 rounded-md border bg-background px-2 text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <CircleDashed aria-hidden className="size-3 shrink-0" />
                  <span className="truncate">{check.label}</span>
                </button>
              ))}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              {passedLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-disabled={locked}
          aria-describedby={statusId}
          onClick={() => void fire()}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50",
            locked && "cursor-not-allowed opacity-50 hover:bg-primary"
          )}
        >
          {phase !== "idle" ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : blocking.length > 0 ? (
            <Lock aria-hidden className="size-4" />
          ) : (
            <Rocket aria-hidden className="size-4" />
          )}
          {phase === "verifying" ? verifyingLabel : phase === "running" ? workingLabel : actionLabel}
        </button>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
