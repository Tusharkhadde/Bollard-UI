"use client"

import * as React from "react"
import { CircleDashed, CircleHelp, Flag, Hourglass, LoaderCircle, SquareSplitHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ExamQuestion {
  id: string
  /** Label shown on its jump link. Defaults to its position, 1-based. */
  label?: string
  /** `"partial"` for a question with parts left, such as 1 of 2 choices picked. */
  answered: boolean | "partial"
  /** Optional questions can be left blank without penalty. Defaults to required. */
  required?: boolean
  /** Marked for review by the candidate. */
  flagged?: boolean
  /** The answer hasn't reached the server yet. */
  saving?: boolean
  /** Short detail for a partial answer, e.g. "1 of 2 chosen". */
  note?: string
}

/** Questions grouped by what still needs attention, in question order. */
export function summarizeAnswers(questions: ExamQuestion[]) {
  const items = questions.map((q, i) => ({ ...q, label: q.label ?? String(i + 1) }))
  const open = (q: ExamQuestion) => q.answered === false
  return {
    required: items.filter((q) => open(q) && q.required !== false),
    optional: items.filter((q) => open(q) && q.required === false),
    partial: items.filter((q) => q.answered === "partial"),
    flagged: items.filter((q) => q.flagged),
    saving: items.filter((q) => q.saving),
    answered: items.filter((q) => q.answered === true).length,
    total: items.length,
  }
}

/** "4:05", "1:02:09". */
export function formatTimeLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
  const pad = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const button =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"

export interface UnansweredCheckProps extends Omit<React.ComponentProps<"section">, "children"> {
  questions: ExamQuestion[]
  /** `exam`: blanks are allowed but cost marks, so submitting with them takes a second click. `survey`: required questions must be answered. */
  mode?: "exam" | "survey"
  /** When time runs out. Leave out for untimed tests. */
  endsAt?: Date | number
  /** Fixed "now" for previews and tests. Defaults to a live clock. */
  now?: Date | number
  /** Turns the timer amber below this many ms; red below a fifth of it. */
  lowTime?: number
  /** Go to a question. */
  onJump: (id: string) => void
  /** Called once when the time runs out, so the host can auto-submit. */
  onTimeUp?: () => void
  /** Final submit. Return a promise to show a pending state; a rejection keeps the answers and says so. */
  onSubmit: () => void | Promise<void>
  heading?: string
  requiredLabel?: string
  optionalLabel?: string
  partialLabel?: string
  flaggedLabel?: string
  allDoneText?: string
  /** Templates: `{count}` and `{each}` are filled in. */
  autoSubmitText?: string
  paceText?: string
  lastSecondsText?: string
  submitLabel?: string
  submitWithBlanksLabel?: string
  confirmLabel?: string
  needRequiredLabel?: string
  savingLabel?: string
  pendingLabel?: string
  errorText?: string
}

/**
 * Stops a test or survey being submitted with questions skipped by accident. Before the final
 * submit it lists, by number with jump links, the required and optional questions still blank,
 * partly answered ones and those flagged for review, with time left and how much of it each open
 * question gets. Blanks in an exam take a deliberate second click, required survey questions
 * block, and submit waits until every answer has actually saved.
 */
export function UnansweredCheck({
  questions,
  mode = "exam",
  endsAt,
  now: fixedNow,
  lowTime = 5 * 60_000,
  onJump,
  onTimeUp,
  onSubmit,
  heading = "Before you submit",
  requiredLabel = "Not answered",
  optionalLabel = "Optional, not answered",
  partialLabel = "Partly answered",
  flaggedLabel = "Flagged for review",
  allDoneText = "Every question is answered.",
  autoSubmitText = "At 0:00 your answers are submitted as they are.",
  paceText = "About {each} for each of the {count} still open.",
  lastSecondsText = "Submit now: the last seconds can be lost to a slow connection.",
  submitLabel = "Submit",
  submitWithBlanksLabel = "Submit with {count}",
  confirmLabel = "Blanks score 0. Submit anyway",
  needRequiredLabel = "Answer {count} required to submit",
  savingLabel = "Saving {count}…",
  pendingLabel = "Submitting…",
  errorText = "Not submitted. Your answers are kept, try again.",
  className,
  ...props
}: UnansweredCheckProps) {
  const [tick, setTick] = React.useState<number>()
  const [armed, setArmed] = React.useState(false)
  const [state, setState] = React.useState<"idle" | "pending" | "error">("idle")
  const armedAt = React.useRef(0)
  const timeUpFired = React.useRef(false)
  const summary = summarizeAnswers(questions)
  const blanks = summary.required.length + summary.optional.length
  const blocked = mode === "survey" && summary.required.length > 0
  const open = summary.required.length + summary.partial.length + (mode === "exam" ? summary.optional.length : 0)

  React.useEffect(() => {
    if (fixedNow !== undefined || endsAt === undefined) return
    setTick(Date.now())
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [fixedNow, endsAt])

  // Arming lasts a few seconds, and any change to the answers disarms it.
  React.useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(id)
  }, [armed])
  React.useEffect(() => setArmed(false), [blanks, open])

  const now = fixedNow !== undefined ? new Date(fixedNow).getTime() : tick
  const left = endsAt !== undefined && now !== undefined ? Math.max(0, new Date(endsAt).getTime() - now) : undefined
  const tone = left === undefined || left > lowTime ? "calm" : left > lowTime / 5 ? "low" : "critical"
  const each = left !== undefined && open > 0 ? left / open : undefined
  const eachText = each === undefined ? "" : each >= 90_000 ? `${Math.floor(each / 60_000)} min` : `${Math.floor(each / 1000)} s`

  React.useEffect(() => {
    if (left !== 0 || timeUpFired.current) return
    timeUpFired.current = true
    onTimeUp?.()
  }, [left, onTimeUp])

  const submit = async () => {
    if (blocked) return onJump(summary.required[0].id)
    if (blanks > 0 && mode === "exam" && !armed) {
      armedAt.current = Date.now()
      return setArmed(true)
    }
    // A double-click arms and would confirm in one motion; ignore a second click that fast.
    if (armed && Date.now() - armedAt.current < 400) return
    setArmed(false)
    setState("pending")
    try {
      await onSubmit()
      setState("idle")
    } catch {
      setState("error")
    }
  }

  const groups = [
    { key: "required", label: requiredLabel, items: summary.required, icon: CircleHelp, tone: "border-red-500/50 text-red-700 dark:text-red-400" },
    { key: "partial", label: partialLabel, items: summary.partial, icon: SquareSplitHorizontal, tone: "border-amber-500/50 text-amber-800 dark:text-amber-300" },
    { key: "flagged", label: flaggedLabel, items: summary.flagged, icon: Flag, tone: "border-amber-500/50 text-amber-800 dark:text-amber-300" },
    { key: "optional", label: optionalLabel, items: summary.optional, icon: CircleDashed, tone: "border-dashed text-muted-foreground" },
  ].filter((g) => g.items.length > 0)

  return (
    <section data-slot="unanswered-check" aria-label={heading} className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{heading}</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {summary.answered} of {summary.total} answered
          </p>
        </div>
        {endsAt !== undefined && (
          <p
            role="timer"
            aria-label={left === undefined ? undefined : `${formatTimeLeft(left)} left`}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium tabular-nums",
              tone === "low" && "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
              tone === "critical" && "border-red-500/40 bg-red-500/10 text-red-700 motion-safe:animate-pulse dark:text-red-400",
            )}
          >
            <Hourglass aria-hidden className="size-3.5" />
            {left === undefined ? "–:––" : formatTimeLeft(left)}
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-emerald-700 dark:text-emerald-400">{allDoneText}</p>
      ) : (
        <div className="grid gap-2.5">
          {groups.map(({ key, label, items, icon: Icon, tone: chip }) => (
            <div key={key} className="grid gap-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Icon aria-hidden className="size-3.5 text-muted-foreground" />
                {label} <span className="text-muted-foreground tabular-nums">· {items.length}</span>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {items.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => onJump(q.id)}
                      title={q.note}
                      aria-label={`Go to question ${q.label}${q.note ? `, ${q.note}` : ""}`}
                      className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border bg-background px-2 text-xs font-medium tabular-nums transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        chip,
                        key === "flagged" && q.answered === false && "border-red-500/50 text-red-700 dark:text-red-400",
                      )}
                    >
                      {q.label}
                      {key === "partial" && q.note && <span className="font-normal opacity-80">· {q.note}</span>}
                      {key === "flagged" && q.answered !== true && <span className="sr-only">, not answered</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {left !== undefined && (
        <div aria-live="polite" className="grid gap-1 text-xs text-muted-foreground">
          {each !== undefined && <p>{fill(paceText, { each: eachText, count: open })}</p>}
          <p className={cn(tone === "critical" && "font-medium text-red-700 dark:text-red-400")}>{tone === "critical" ? lastSecondsText : autoSubmitText}</p>
        </div>
      )}

      <div className="grid gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={summary.saving.length > 0 || state === "pending"}
          className={cn(
            button,
            "w-full",
            armed ? "bg-destructive text-white hover:bg-destructive/90" : blocked ? "border bg-background hover:bg-accent" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {(summary.saving.length > 0 || state === "pending") && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {summary.saving.length > 0
            ? fill(savingLabel, { count: plural(summary.saving.length, "answer") })
            : state === "pending"
              ? pendingLabel
              : blocked
                ? fill(needRequiredLabel, { count: summary.required.length })
                : armed
                  ? confirmLabel
                  : blanks > 0 && mode === "exam"
                    ? fill(submitWithBlanksLabel, { count: plural(blanks, "blank") })
                    : submitLabel}
        </button>
        {state === "error" && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            {errorText}
          </p>
        )}
      </div>
    </section>
  )
}
