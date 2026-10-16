"use client"

import * as React from "react"
import { Check, GitBranch, Route } from "lucide-react"

import { cn } from "@/lib/utils"
import { cascadeReset, type DependentRules } from "@/registry/default/dependent-reset/dependent-reset"

type Values = Record<string, unknown>

/** One wizard step and the answers that live on it. */
export interface WizardStep<T extends Values> {
  id: string
  title: string
  fields: (keyof T)[]
}

/** What a change does to one later step: each answer it clears or trims. */
export interface StepImpact<T extends Values> {
  step: WizardStep<T>
  /** 1-based position, for "on step 4". */
  number: number
  fields: { name: keyof T; label: string; lost: string[]; list: boolean }[]
}

const show = (value: unknown) => (Array.isArray(value) ? value.join(", ") : String(value ?? ""))
const lostItems = (before: unknown, after: unknown) =>
  Array.isArray(before) ? before.filter((item) => !(Array.isArray(after) && after.includes(item))).map(String) : [show(before)]

/**
 * Works out, without applying anything, which later answers a change would
 * invalidate, grouped by the step they live on. Pure, so it runs on the server too.
 */
export function planStepInvalidation<T extends Values>(values: T, field: keyof T, next: T[keyof T], rules: DependentRules<T>, steps: WizardStep<T>[], labels: Partial<Record<keyof T, string>> = {}) {
  const result = cascadeReset({ ...values, [field]: next }, field, rules)
  const impacts: StepImpact<T>[] = []
  steps.forEach((step, index) => {
    const fields = result.cleared
      .filter((c) => step.fields.includes(c.name))
      .map((c) => ({ name: c.name, label: labels[c.name] ?? String(c.name), lost: lostItems(c.previous, result.values[c.name]), list: Array.isArray(c.previous) }))
    if (fields.length) impacts.push({ step, number: index + 1, fields })
  })
  return { values: result.values, impacts }
}

/** "removes SSO and Analytics on step 4 and clears Seats on step 3". */
export function describeImpacts<T extends Values>(impacts: StepImpact<T>[]) {
  const parts = impacts.flatMap(({ number, fields }) =>
    fields.map((f) => {
      const what = f.lost.length > 2 ? `${f.lost.length} ${f.label.toLowerCase()}` : f.lost.join(" and ")
      return f.list ? `removes ${what} on step ${number}` : `clears ${f.label} on step ${number}`
    }),
  )
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : (parts[0] ?? "")
}

export interface UseStepInvalidationOptions<T extends Values> {
  steps: WizardStep<T>[]
  /** Which answers depend on which (the same rules as `useDependentReset`). */
  rules: DependentRules<T>
  /** Answer names as the user sees them. */
  labels?: Partial<Record<keyof T, string>>
  /** Controlled answers. */
  value?: T
  /** Initial answers when uncontrolled. */
  defaultValue: T
  /** Called with all answers after every applied change. */
  onValueChange?: (values: T) => void
  /** Step to open on. */
  initialStep?: string
}

/**
 * Wizard state that never lets an earlier change silently break a later step.
 * `change` previews the damage first; once confirmed, the hit steps are marked
 * and `startReview` walks through only those, then returns where you were.
 * Changing the answer back restores everything it removed.
 */
export function useStepInvalidation<T extends Values>({ steps, rules, labels = {}, value, defaultValue, onValueChange, initialStep }: UseStepInvalidationOptions<T>) {
  const [inner, setInner] = React.useState(defaultValue)
  const [current, setCurrent] = React.useState(initialStep ?? steps[0].id)
  const [pending, setPending] = React.useState<{ field: keyof T; from: unknown; to: T[keyof T]; values: T; impacts: StepImpact<T>[] } | null>(null)
  const [stale, setStale] = React.useState<{ field: keyof T; impacts: StepImpact<T>[] } | null>(null)
  // What the last confirmed change removed, kept after review so undoing the answer brings it back.
  const [stash, setStash] = React.useState<{ field: keyof T; from: unknown; before: T; after: T } | null>(null)
  const [review, setReview] = React.useState<{ origin: string } | null>(null)
  const [checked, setChecked] = React.useState<string[]>([])
  const values = value ?? inner
  const label = (name: keyof T) => labels[name] ?? String(name)

  const commit = (next: T) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const staleSteps = (stale?.impacts ?? []).filter((i) => !checked.includes(i.step.id))

  const change = <K extends keyof T>(field: K, next: T[K]) => {
    if (show(values[field]) === show(next)) return
    // Going back to the answer that caused the damage puts back every removed answer not edited since.
    if (stash && stash.field === field && show(stash.from) === show(next)) {
      const restored: T = { ...values, [field]: next }
      for (const name of Object.keys(stash.before) as (keyof T)[])
        if (name !== field && show(values[name]) === show(stash.after[name])) restored[name] = stash.before[name]
      commit(restored)
      setStash(null)
      setStale(null)
      setChecked([])
      setReview(null)
      return
    }
    const plan = planStepInvalidation(values, field, next, rules, steps, labels)
    if (plan.impacts.length) setPending({ field, from: values[field], to: next, ...plan })
    else commit(plan.values)
  }

  const confirm = () => {
    if (!pending) return
    commit(pending.values)
    // A second change while steps are still unchecked adds to the marks instead of replacing them.
    const earlier = staleSteps.filter((s) => !pending.impacts.some((i) => i.step.id === s.step.id))
    const impacts = [...earlier, ...pending.impacts].sort((a, b) => a.number - b.number)
    setStale({ field: pending.field, impacts })
    setStash({ field: pending.field, from: pending.from, before: values, after: pending.values })
    setChecked([])
    setReview(null)
    setPending(null)
  }

  const goTo = (id: string) => {
    setCurrent(id)
    setReview(null)
  }
  const startReview = () => {
    if (!staleSteps.length) return
    setReview({ origin: current })
    setCurrent(staleSteps[0].step.id)
  }
  const index = steps.findIndex((s) => s.id === current)
  const next = () => {
    if (!review) return setCurrent(steps[Math.min(index + 1, steps.length - 1)].id)
    const done = [...checked, current]
    const upcoming = staleSteps.find((i) => !done.includes(i.step.id))
    if (upcoming) {
      setChecked(done)
      setCurrent(upcoming.step.id)
    } else {
      setStale(null)
      setChecked([])
      setReview(null)
      setCurrent(review.origin)
    }
  }
  const back = () => setCurrent(steps[Math.max(index - 1, 0)].id)

  const reviewTotal = stale?.impacts.length ?? 0
  return {
    steps,
    values,
    current,
    index,
    change,
    pending: pending && { ...pending, label: label(pending.field) },
    confirm,
    cancel: () => setPending(null),
    staleSteps,
    stale: stale && { ...stale, label: label(stale.field) },
    /** Where the review walk is, or null when not reviewing. */
    review: review && { position: checked.length + 1, total: reviewTotal },
    startReview,
    goTo,
    next,
    back,
    /** True while an answer was just cleared or trimmed and its step is unchecked: put it on `data-invalidated`. */
    isInvalidated: (name: keyof T) => staleSteps.some((i) => i.fields.some((f) => f.name === name)),
    /** What a field lost, while its step is unchecked. */
    lostFor: (name: keyof T) => staleSteps.flatMap((i) => i.fields).find((f) => f.name === name)?.lost ?? [],
    /** False while any affected step hasn't been looked at again. */
    canFinish: !pending && staleSteps.length === 0,
  }
}

type Wizard<T extends Values> = ReturnType<typeof useStepInvalidation<T>>

/** Add to an answer's field so it glows while `data-invalidated` is set. */
export const invalidatedFieldClass =
  "transition-[box-shadow,border-color] duration-300 ease-out data-invalidated:border-amber-500 data-invalidated:ring-[3px] data-invalidated:ring-amber-500/30 dark:data-invalidated:border-amber-400"

const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const solid = "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
const outline = "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25"
const keyframes =
  "@keyframes cui-step-invalidation-in{from{opacity:0;transform:translateY(-6px)}}@keyframes cui-step-invalidation-mark{0%{transform:scale(.4)}60%{transform:scale(1.25)}}"

export interface StepInvalidationRailProps<T extends Values> extends Omit<React.ComponentProps<"ol">, "children"> {
  wizard: Wizard<T>
  /** Read after a step that needs another look. */
  staleHint?: string
}

/** The step list, with every step a change broke marked until it has been checked again. */
export function StepInvalidationRail<T extends Values>({ wizard, staleHint = "needs another look", className, ...props }: StepInvalidationRailProps<T>) {
  return (
    <ol data-slot="step-invalidation-rail" className={cn("flex gap-1", className)} {...props}>
      <style>{keyframes}</style>
      {wizard.steps.map((step, i) => {
        const stale = wizard.staleSteps.some((s) => s.step.id === step.id)
        const active = step.id === wizard.current
        return (
          <li key={step.id} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => wizard.goTo(step.id)}
              aria-current={active ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${step.title}${stale ? `, ${staleHint}` : ""}`}
              className={cn(
                "group grid w-full gap-1.5 rounded-md pt-1 text-left text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className={cn("h-1 rounded-full transition-colors", stale ? "bg-amber-500" : i <= wizard.index ? "bg-primary" : "bg-muted")} />
              <span className="flex min-w-0 items-center gap-1 font-medium">
                {stale && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-500 motion-safe:animate-[cui-step-invalidation-mark_400ms_ease-out]" />}
                <span className="truncate">{step.title}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export interface StepInvalidationNoticeProps<T extends Values> extends Omit<React.ComponentProps<"div">, "children"> {
  wizard: Wizard<T>
  /** Formats an answer for the message. Defaults to the value, or the items joined. */
  formatValue?: (field: keyof T, value: unknown) => string
  /** Templates. `{field}`, `{from}`, `{to}`, `{impact}`, `{count}` ("2 steps"), `{position}`, `{total}` and `{step}` are filled in. */
  pendingText?: string
  staleText?: string
  reviewText?: string
  keepLabel?: string
  changeLabel?: string
  reviewLabel?: string
  stepWord?: [singular: string, plural: string]
}

/**
 * Says what an earlier change would break before it is applied, then how many
 * steps need another look, then where the review walk is ("1 of 2").
 */
export function StepInvalidationNotice<T extends Values>({
  wizard,
  formatValue = (_field, v) => show(v),
  pendingText = "Changing {field} to {to} {impact}.",
  staleText = "{count} changed because {field} is now {to}. Check them before you finish.",
  reviewText = "Checking {position} of {total}: {step}",
  keepLabel = "Keep {from}",
  changeLabel = "Change to {to}",
  reviewLabel = "Review {count}",
  stepWord = ["step", "steps"],
  className,
  ...props
}: StepInvalidationNoticeProps<T>) {
  const { pending, stale, staleSteps, review } = wizard
  const source = pending ?? stale
  const count = pending ? pending.impacts.length : staleSteps.length
  const fill = (t: string) =>
    t.replace(/\{(\w+)\}/g, (m, k: string) =>
      ({
        field: source?.label.toLowerCase() ?? "",
        from: pending ? formatValue(pending.field, pending.from) : "",
        to: source ? formatValue(source.field, pending ? pending.to : wizard.values[source.field]) : "",
        impact: pending ? describeImpacts(pending.impacts) : "",
        count: `${count} ${stepWord[count === 1 ? 0 : 1]}`,
        position: String(review?.position ?? ""),
        total: String(review?.total ?? ""),
        step: wizard.steps[wizard.index].title,
      })[k] ?? m,
    )
  const lost = (pending?.impacts ?? (review ? staleSteps.filter((s) => s.step.id === wizard.current) : [])).flatMap((i) => i.fields.map((f) => ({ ...f, number: i.number })))
  const shown = pending || (stale && staleSteps.length)
  const key = pending ? "pending" : review ? `review-${wizard.current}` : "stale"

  return (
    <div data-slot="step-invalidation" role="status" aria-live="polite" className={cn("empty:hidden", className)} {...props}>
      {shown ? (
        <div key={key} className="overflow-hidden rounded-lg border border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-sm text-amber-950 motion-safe:animate-[cui-step-invalidation-in_250ms_ease-out] dark:text-amber-50">
          <style>{keyframes}</style>
          <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
              {review ? <Route aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" /> : <GitBranch aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />}
              <p className="min-w-0 flex-1 font-medium">{fill(pending ? pendingText : review ? reviewText : staleText)}</p>
            </div>
            {pending ? (
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <button type="button" onClick={wizard.cancel} className={cn(action, outline)}>{fill(keepLabel)}</button>
                <button type="button" onClick={wizard.confirm} className={cn(action, solid)}>{fill(changeLabel)}</button>
              </div>
            ) : !review ? (
              <button type="button" onClick={wizard.startReview} className={cn(action, solid, "ml-auto")}>{fill(reviewLabel)}</button>
            ) : null}
          </div>
          {lost.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 border-t border-amber-500/20 px-3 py-2 text-xs">
              {lost.map((f) => (
                <li key={String(f.name)} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1">
                  <span className="text-amber-900/75 dark:text-amber-100/75">{pending ? `Step ${f.number} · ` : ""}{f.label}:</span>
                  <s className="truncate">{f.lost.join(", ")}</s>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

export interface StepInvalidationNavProps<T extends Values> extends Omit<React.ComponentProps<"div">, "children" | "onSubmit"> {
  wizard: Wizard<T>
  /** Runs on the last step once nothing needs another look. */
  onFinish?: () => void
  backLabel?: string
  nextLabel?: string
  reviewNextLabel?: string
  reviewDoneLabel?: string
  finishLabel?: string
  /** Shown beside a held finish button. */
  blockedHint?: string
}

/** Back / Next that, during a review, steps only through the affected steps and then returns. */
export function StepInvalidationNav<T extends Values>({
  wizard,
  onFinish,
  backLabel = "Back",
  nextLabel = "Next",
  reviewNextLabel = "Looks right, next",
  reviewDoneLabel = "Looks right, done",
  finishLabel = "Finish",
  blockedHint = "Review the marked steps first.",
  className,
  ...props
}: StepInvalidationNavProps<T>) {
  const { review, index, steps } = wizard
  const last = index === steps.length - 1
  const button = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
  const primary = "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
  return (
    <div data-slot="step-invalidation-nav" className={cn("flex flex-wrap items-center justify-end gap-2", className)} {...props}>
      {last && !review && !wizard.canFinish && <p className="mr-auto text-xs text-muted-foreground">{blockedHint}</p>}
      {!review && (
        <button type="button" onClick={wizard.back} disabled={index === 0} className={cn(button, "border bg-background shadow-xs hover:bg-accent dark:bg-input/30")}>{backLabel}</button>
      )}
      {review ? (
        <button type="button" onClick={wizard.next} className={cn(button, primary)}>
          <Check aria-hidden className="size-4" />
          {review.position === review.total ? reviewDoneLabel : reviewNextLabel}
        </button>
      ) : last ? (
        <button type="button" onClick={onFinish} disabled={!wizard.canFinish} className={cn(button, primary)}>{finishLabel}</button>
      ) : (
        <button type="button" onClick={wizard.next} disabled={!!wizard.pending} className={cn(button, primary)}>{nextLabel}</button>
      )}
    </div>
  )
}
