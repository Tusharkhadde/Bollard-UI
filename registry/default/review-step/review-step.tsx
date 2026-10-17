"use client"

// Bollard UI — review-step · MIT licence · https://bollard-ui.vercel.app/components/review-step

import * as React from "react"
import { CircleAlert, LoaderCircle, Pencil } from "lucide-react"

import { cn } from "@/lib/utils"

export type ReviewValue = string | number | boolean | string[] | null | undefined

export interface ReviewField {
  id: string
  label: string
  value: ReviewValue
  /** Empty optional fields are shown as "Not provided" instead of blocking submit. */
  optional?: boolean
  /** Custom display, e.g. masking a card or formatting money. */
  format?: (value: ReviewValue) => string
}

export interface ReviewGroup {
  id: string
  title: string
  fields: ReviewField[]
}

/** Turns any answer into display text; "" means empty. */
export function formatAnswer(value: ReviewValue) {
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return value === null || value === undefined ? "" : String(value).trim()
}

/** Counts what the reviewer should look at: missing required answers, empty optional ones and changes since last time. */
export function reviewSummary(steps: ReviewGroup[], previous?: Record<string, ReviewValue>) {
  const fields = steps.flatMap((step) => step.fields)
  const empty = fields.filter((field) => formatAnswer(field.value) === "")
  return {
    missing: empty.filter((field) => !field.optional),
    skipped: empty.filter((field) => field.optional),
    changed: previous ? fields.filter((field) => field.id in previous && formatAnswer(previous[field.id]) !== formatAnswer(field.value)) : [],
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const link =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-foreground underline-offset-4 hover:bg-accent hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface ReviewStepProps extends Omit<React.ComponentProps<"div">, "onSubmit"> {
  /** Every step of the form with its answers, in order. */
  steps: ReviewGroup[]
  /** Answers from the last submission, keyed by field id. Changed answers are highlighted. */
  previous?: Record<string, ReviewValue>
  /** Jump back to a step, focusing that field when `fieldId` is given. */
  onEdit: (stepId: string, fieldId?: string) => void
  /** Sends the form. Return a promise to show a pending state; a rejection re-enables submit. */
  onSubmit: () => void | Promise<void>
  /** Clicks sooner than this (ms) after the review appears are ignored, so a double-click or held Enter on "Next" can't submit. */
  guard?: number
  /** Heading above the review. */
  heading?: string
  /** Label of the submit button. */
  submitLabel?: string
  /** Submit label while onSubmit runs. */
  pendingLabel?: string
  /** Submit label after success. */
  doneLabel?: string
  /** Label of each Edit button. */
  editLabel?: string
  /** Label shown instead of Edit for an empty field. */
  addLabel?: string
  /** Shown for an empty optional answer. */
  emptyText?: string
  /** Shown for a missing required answer. */
  missingText?: string
  /** Marks a value changed since last time. */
  changedText?: string
  /** Shown when onSubmit rejects. */
  errorText?: string
  /** Under a blocked submit button. `{fields}` lists what is missing. */
  missingHint?: string
}

/**
 * The "check your answers" step before a multi-step form is sent. Every answer
 * is listed by step with an Edit link that names its field and jumps back to
 * it; empty optional answers read "Not provided" instead of vanishing, answers
 * that differ from last time show the old value, and a single deliberate
 * submit ignores clicks carried over from the previous step and can't fire twice.
 */
export function ReviewStep({
  steps,
  previous,
  onEdit,
  onSubmit,
  guard = 700,
  heading = "Check your answers",
  submitLabel = "Submit",
  pendingLabel = "Submitting…",
  doneLabel = "Submitted",
  editLabel = "Edit",
  addLabel = "Add",
  emptyText = "Not provided",
  missingText = "Answer required",
  changedText = "Changed",
  errorText = "Couldn't submit. Nothing was sent, so you can try again.",
  missingHint = "Answer {fields} to submit.",
  className,
  ...props
}: ReviewStepProps) {
  const [phase, setPhase] = React.useState<"idle" | "pending" | "done" | "error">("idle")
  const shownAt = React.useRef(0)
  const id = React.useId()
  React.useEffect(() => {
    shownAt.current = performance.now()
  }, [])

  const { missing, skipped, changed } = reviewSummary(steps, previous)
  const busy = phase === "pending" || phase === "done"

  const submit = async () => {
    if (busy || missing.length || performance.now() - shownAt.current < guard) return
    setPhase("pending")
    try {
      await onSubmit()
      setPhase("done")
    } catch {
      setPhase("error")
    }
  }

  const notes = [missing.length && plural(missing.length, "required answer") + " missing", changed.length && plural(changed.length, "answer") + " changed since last time", skipped.length && plural(skipped.length, "optional answer") + " left empty"].filter(Boolean)

  return (
    <div data-slot="review-step" className={cn("grid w-full max-w-lg gap-3", className)} {...props}>
      <div>
        <h2 className="text-base font-semibold">{heading}</h2>
        {notes.length > 0 && <p className="text-xs text-muted-foreground">{notes.join(" · ")}</p>}
      </div>
      {steps.map((step) => (
        <section key={step.id} aria-labelledby={`${id}-${step.id}`} className="overflow-hidden rounded-lg border bg-background">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
            <h3 id={`${id}-${step.id}`} className="text-sm font-medium">{step.title}</h3>
            <button type="button" onClick={() => onEdit(step.id)} aria-label={`${editLabel} ${step.title}`} className={link}>
              {editLabel}
            </button>
          </div>
          <dl className="divide-y">
            {step.fields.map((field) => {
              const shown = (field.format ?? formatAnswer)(field.value)
              const empty = formatAnswer(field.value) === ""
              const old = changed.includes(field) && previous ? (field.format ?? formatAnswer)(previous[field.id]) : null
              return (
                <div key={field.id} data-state={empty ? (field.optional ? "skipped" : "missing") : old !== null ? "changed" : undefined} className="flex items-start gap-2 px-3 py-2 data-[state=missing]:bg-red-500/5">
                  <div className="min-w-0 flex-1">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {field.label}
                      {old !== null && <span className="rounded-sm bg-primary px-1 text-[0.6875rem] leading-4 font-medium text-primary-foreground">{changedText}</span>}
                    </dt>
                    <dd className="text-sm break-words">
                      {!empty ? shown : field.optional ? (
                        <span className="text-amber-700 dark:text-amber-400">{emptyText}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
                          <CircleAlert aria-hidden className="size-3.5" />
                          {missingText}
                        </span>
                      )}
                      {old !== null && (
                        <del className="block text-xs text-muted-foreground decoration-muted-foreground/60">
                          <span className="sr-only">Previously: </span>
                          {old || emptyText}
                        </del>
                      )}
                    </dd>
                  </div>
                  <button type="button" onClick={() => onEdit(step.id, field.id)} aria-label={`${empty ? addLabel : editLabel} ${field.label}`} className={link}>
                    {empty ? addLabel : <><Pencil aria-hidden className="size-3" />{editLabel}</>}
                  </button>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
      {phase === "error" && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
          <CircleAlert aria-hidden className="size-4" />
          {errorText}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        onKeyDown={(event) => event.repeat && event.preventDefault()}
        disabled={busy || missing.length > 0}
        aria-describedby={missing.length ? `${id}-missing` : undefined}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {phase === "pending" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {phase === "pending" ? pendingLabel : phase === "done" ? doneLabel : submitLabel}
      </button>
      {missing.length > 0 && (
        <p id={`${id}-missing`} className="-mt-1.5 text-xs text-muted-foreground">
          {missingHint.replace("{fields}", missing.map((field) => field.label).join(", "))}
        </p>
      )}
    </div>
  )
}
