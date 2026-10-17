"use client"

// Bollard UI — feature-flag-rollout · MIT licence · https://bollard-ui.vercel.app/components/feature-flag-rollout

import * as React from "react"
import { ArrowRight, Check, TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RolloutEnvironment {
  id: string
  name: string
  /** How many users this environment serves, for the readback. */
  users: number
  /** Production environments get the step guard. */
  production?: boolean
}

export interface RolloutSegment {
  id: string
  label: string
  /** Users in this segment. Segment users always get the flag, on top of the percentage. */
  users: number
}

export interface RolloutState {
  percent: number
  segments: string[]
}

export type RolloutValue = Record<string, RolloutState>

export interface RolloutIssue {
  env: string
  kind: "jump" | "ahead" | "pullback"
  /** Saved and draft percentages of this environment. */
  from: number
  to: number
  /** jump: the next ramp step. ahead: the previous environment's percentage. The one-tap fix sets this. */
  fix?: number
  /** ahead: name of the environment it would overtake. */
  prev?: string
  /** pullback: users who lose the feature. */
  lost?: number
}

const EMPTY: RolloutState = { percent: 0, segments: [] }
const nf = new Intl.NumberFormat("en")

/** Users who get the flag: everyone in the chosen segments plus `percent` of the rest. */
export function rolloutReach(env: RolloutEnvironment, state: RolloutState, segments: RolloutSegment[]) {
  const inSegments = Math.min(env.users, segments.filter((s) => state.segments.includes(s.id)).reduce((sum, s) => sum + s.users, 0))
  return inSegments + Math.round(((env.users - inSegments) * state.percent) / 100)
}

/**
 * Finds risky rollout changes: a production jump that skips ramp steps, an
 * environment ahead of the one before it (prod before staging), and a pullback
 * that takes the feature away from users who already have it.
 */
export function checkRollout(
  environments: RolloutEnvironment[],
  before: RolloutValue,
  after: RolloutValue,
  segments: RolloutSegment[] = [],
  steps: number[] = [5, 10, 25, 50, 100],
): RolloutIssue[] {
  const issues: RolloutIssue[] = []
  environments.forEach((env, index) => {
    const from = (before[env.id] ?? EMPTY).percent
    const to = (after[env.id] ?? EMPTY).percent
    const next = steps.find((step) => step > from)
    if (env.production && next !== undefined && to > next) issues.push({ env: env.id, kind: "jump", from, to, fix: next })
    const prev = environments[index - 1]
    const prevPercent = prev ? (after[prev.id] ?? EMPTY).percent : 100
    if (prev && to > prevPercent) issues.push({ env: env.id, kind: "ahead", from, to, fix: prevPercent, prev: prev.name })
    const lost = rolloutReach(env, before[env.id] ?? EMPTY, segments) - rolloutReach(env, after[env.id] ?? EMPTY, segments)
    if (lost > 0) issues.push({ env: env.id, kind: "pullback", from, to, lost })
  })
  return issues
}

const DEFAULT_MESSAGES: Record<RolloutIssue["kind"], string> = {
  jump: "{env} would jump from {from}% to {to}%, skipping the ramp.",
  ahead: "{env} would be ahead of {prev} ({fix}%), so users get it before it's tested there.",
  pullback: "About {lost} users in {env} lose the feature they already have.",
}
const DEFAULT_FIXES: Record<"jump" | "ahead", string> = { jump: "Go to {fix}% first", ahead: "Match {prev}" }

export interface FeatureFlagRolloutProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Environments in promotion order, e.g. dev → staging → production. */
  environments: RolloutEnvironment[]
  /** Segments that can be switched on per environment (staff, beta testers…). */
  segments?: RolloutSegment[]
  /** Saved rollout (controlled). */
  value?: RolloutValue
  /** Saved rollout when uncontrolled. */
  defaultValue?: RolloutValue
  /** Unsaved edit to start from, e.g. a change restored from a link. Defaults to the saved rollout. */
  defaultDraft?: RolloutValue
  /** Called with the new rollout when the user saves. May return a promise. */
  onValueChange?: (value: RolloutValue) => void | Promise<void>
  /** Ramp steps for production. Raising past the next step asks for confirmation. */
  steps?: number[]
  /** Warning text per issue. `{env}`, `{from}`, `{to}`, `{fix}`, `{prev}` and `{lost}` are filled in. */
  messages?: Partial<Record<RolloutIssue["kind"], string>>
  /** One-tap fix labels. `{fix}` and `{prev}` are filled in. */
  fixLabels?: Partial<Record<"jump" | "ahead", string>>
  /** Shown once the save button is armed. */
  armedText?: string
  /** Save button text. */
  saveLabel?: string
  /** Shown after saving. */
  savedLabel?: string
  /** Save label while onValueChange is pending. */
  savingLabel?: string
  /** Badge on production environments. */
  productionLabel?: string
  /** Save label when there are warnings. `{count}` is filled in. */
  confirmLabel?: string
  /** Text for discarding changes. */
  discardLabel?: string
  /** Readback templates. `{who}`, `{count}` and `{total}` are filled in. */
  reachText?: string
  /** Readback when nobody gets the flag. */
  nobodyText?: string
  /** Readback when everyone gets the flag. */
  everyoneText?: string
  /** Joins segments and the percentage in the readback, e.g. "{segments} + {percent}% of everyone else". */
  restText?: string
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
const button =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

/**
 * A percentage + segment rollout that reads back exactly who gets the flag
 * ("Internal staff + 10% of everyone else ≈ 1,280 of 12,400 users"). It won't
 * let production skip ramp steps or get ahead of staging without a second,
 * explicit confirmation, and it warns how many users lose the feature on a pullback.
 */
export function FeatureFlagRollout({
  environments,
  segments = [],
  value,
  defaultValue = {},
  defaultDraft,
  onValueChange,
  steps = [5, 10, 25, 50, 100],
  messages,
  fixLabels,
  armedText = "Click again to save anyway.",
  saveLabel = "Save rollout",
  savedLabel = "Saved",
  savingLabel = "Saving…",
  productionLabel = "prod",
  confirmLabel = "Save with {count} warnings",
  discardLabel = "Discard",
  reachText = "{who} ≈ {count} of {total} users",
  nobodyText = "Nobody gets this flag.",
  everyoneText = "Everyone ({total} users)",
  restText = "{percent}% of everyone else",
  className,
  ...props
}: FeatureFlagRolloutProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const saved = value ?? inner
  const [draft, setDraft] = React.useState(defaultDraft ?? saved)
  const [armed, setArmed] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const baseId = React.useId()

  // A new saved value (from the parent or our own save) becomes the new draft.
  const savedKey = JSON.stringify(saved)
  const [syncedKey, setSyncedKey] = React.useState(savedKey)
  if (syncedKey !== savedKey) {
    setSyncedKey(savedKey)
    setDraft(saved)
  }
  const text = { ...DEFAULT_MESSAGES, ...messages }
  const fixes = { ...DEFAULT_FIXES, ...fixLabels }

  const issues = checkRollout(environments, saved, draft, segments, steps)
  const risky = issues.filter((issue) => issue.kind !== "pullback")
  // Segment order doesn't matter: turning one off and on again is not a change.
  const shape = (v: RolloutValue) => JSON.stringify(environments.map((e) => { const s = v[e.id] ?? EMPTY; return [s.percent, [...s.segments].sort()] }))
  const dirty = shape(draft) !== shape(saved)

  const edit = (env: string, patch: Partial<RolloutState>) => {
    setArmed(false)
    setDraft((current) => ({ ...current, [env]: { ...EMPTY, ...current[env], ...patch } }))
  }

  const save = async () => {
    if (risky.length && !armed) return setArmed(true)
    setPending(true)
    try {
      await onValueChange?.(draft)
      if (value === undefined) setInner(draft)
      setArmed(false)
    } catch {
      // The caller reports the failure; the draft stays so nothing is lost.
    } finally {
      setPending(false)
    }
  }

  const readback = (env: RolloutEnvironment, state: RolloutState) => {
    const total = nf.format(env.users)
    const chosen = segments.filter((s) => state.segments.includes(s.id)).map((s) => s.label)
    if (state.percent >= 100) return fill(everyoneText, { total })
    if (!chosen.length && state.percent <= 0) return nobodyText
    const parts = [...chosen, ...(state.percent > 0 ? [fill(restText, { percent: state.percent })] : [])]
    return fill(reachText, { who: parts.join(" + "), count: nf.format(rolloutReach(env, state, segments)), total })
  }

  return (
    <div data-slot="feature-flag-rollout" className={cn("grid w-full max-w-xl gap-3 text-sm", className)} {...props}>
      {environments.map((env) => {
        const from = saved[env.id] ?? EMPTY
        const state = draft[env.id] ?? EMPTY
        const envIssues = issues.filter((issue) => issue.env === env.id)
        const sliderId = `${baseId}-${env.id}`
        return (
          <fieldset key={env.id} className={cn("grid gap-2 rounded-lg border p-3", env.production && "border-red-500/30")}>
            <legend className="sr-only">{env.name}</legend>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={sliderId} className="flex items-center gap-2 font-medium">
                {env.name}
                {env.production && <span className="rounded-md border border-red-500/40 px-1.5 py-0.5 font-mono text-[11px] text-red-700 dark:text-red-300">{productionLabel}</span>}
              </label>
              <span className="flex items-center gap-1 font-mono text-xs tabular-nums">
                {state.percent !== from.percent && (
                  <>
                    <span className="text-muted-foreground line-through">{from.percent}%</span>
                    <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                  </>
                )}
                <span className="font-semibold">{state.percent}%</span>
              </span>
            </div>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              value={state.percent}
              list={env.production ? `${sliderId}-steps` : undefined}
              aria-valuetext={`${state.percent}%. ${readback(env, state)}`}
              onChange={(event) => edit(env.id, { percent: Number(event.target.value) })}
              className="h-5 w-full cursor-pointer accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md"
            />
            {env.production && (
              <datalist id={`${sliderId}-steps`}>
                {steps.map((step) => <option key={step} value={step} />)}
              </datalist>
            )}
            {segments.length > 0 && (
              <div role="group" aria-label={`Segments in ${env.name}`} className="flex flex-wrap gap-1.5">
                {segments.map((segment) => {
                  const on = state.segments.includes(segment.id)
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => edit(env.id, { segments: on ? state.segments.filter((id) => id !== segment.id) : [...state.segments, segment.id] })}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent dark:bg-input/30",
                      )}
                    >
                      {on && <Check aria-hidden className="size-3" />}
                      {segment.label}
                      <span className={cn("tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>{nf.format(segment.users)}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{readback(env, state)}</p>
            <div aria-live="polite" className="grid gap-1 empty:hidden">
              {envIssues.map((issue) => {
                const values = { env: env.name, from: issue.from, to: issue.to, fix: issue.fix ?? "", prev: issue.prev ?? "", lost: nf.format(issue.lost ?? 0) }
                return (
                <p key={issue.kind} className={cn("flex gap-1.5 text-xs", issue.kind === "pullback" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
                  <TriangleAlert aria-hidden className="mt-1 size-3.5 shrink-0" />
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="py-0.5">{fill(text[issue.kind], values)}</span>
                    {issue.kind !== "pullback" && issue.fix !== undefined && (
                      <button
                        type="button"
                        onClick={() => edit(env.id, { percent: issue.fix ?? 0 })}
                        className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
                      >
                        {fill(fixes[issue.kind], values)}
                      </button>
                    )}
                  </span>
                </p>
                )
              })}
            </div>
          </fieldset>
        )
      })}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {armed && (
          <p role="status" className="mr-auto text-xs font-medium text-red-700 dark:text-red-400">
            {armedText}
          </p>
        )}
        {dirty && (
          <button type="button" onClick={() => (setDraft(saved), setArmed(false))} className={cn(button, "border shadow-xs hover:bg-accent dark:bg-input/30")}>
            <Undo2 aria-hidden className="size-4" />
            {discardLabel}
          </button>
        )}
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={save}
          className={cn(button, armed ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {pending ? savingLabel : !dirty ? savedLabel : risky.length ? fill(confirmLabel, { count: risky.length }) : saveLabel}
        </button>
      </div>
    </div>
  )
}
