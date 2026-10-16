"use client"

import * as React from "react"
import { ListRestart, Undo2, X } from "lucide-react"

import { cn } from "@/lib/utils"

type Values = Record<string, unknown>

/** How one field depends on others. */
export interface DependentRule<T extends Values, K extends keyof T = keyof T> {
  /** Fields whose change can make this one invalid. */
  dependsOn: (keyof T)[]
  /** Whether the current value still makes sense for the new values. Invalid values are cleared. */
  isValid?: (value: T[K], values: T) => boolean
  /** For lists: keep only the items that still fit (plan → add-ons), instead of clearing them all. */
  prune?: (value: T[K], values: T) => T[K]
  /** How the old value reads in the notice. Defaults to the value, or the items joined. */
  format?: (value: T[K]) => string
}

export type DependentRules<T extends Values> = { [K in keyof T]?: DependentRule<T, K> }

const isEmpty = (value: unknown) => value === "" || value == null || (Array.isArray(value) && value.length === 0)
const emptyLike = (value: unknown) => (Array.isArray(value) ? [] : "")
const show = (value: unknown) => (Array.isArray(value) ? value.join(", ") : String(value ?? ""))

/**
 * Applies a change and clears, in dependency order, every downstream field the
 * change made invalid (country → state → city). Fields that are still valid,
 * and the still-valid items of a list, are kept.
 */
export function cascadeReset<T extends Values>(values: T, changed: keyof T, rules: DependentRules<T>) {
  const next = { ...values }
  const dirty = new Set<keyof T>([changed])
  const cleared: { name: keyof T; previous: T[keyof T]; partial: boolean }[] = []
  for (let found = true; found; ) {
    found = false
    for (const name of Object.keys(rules) as (keyof T)[]) {
      const rule = rules[name] as DependentRule<T> | undefined
      if (!rule || dirty.has(name) || isEmpty(next[name]) || !rule.dependsOn.some((d) => dirty.has(d))) continue
      const kept = rule.prune
        ? rule.prune(next[name], next)
        : rule.isValid?.(next[name], next) === false
          ? (emptyLike(next[name]) as T[keyof T])
          : next[name]
      if (show(kept) === show(next[name])) continue
      cleared.push({ name, previous: next[name], partial: !isEmpty(kept) })
      next[name] = kept
      dirty.add(name)
      found = true
    }
  }
  return { values: next, cleared }
}

export interface ResetNotice<T extends Values> {
  /** Increments per change, so the notice re-announces and re-animates. */
  id: number
  cause: keyof T
  causeLabel: string
  /** Each field that lost its value: label, old value as text, what went, and whether only part of it went. */
  fields: { name: keyof T; label: string; previous: string; removed: string; partial: boolean }[]
  /** The values just before the change, for undo. */
  before: T
}

export interface UseDependentResetOptions<T extends Values> {
  /** Controlled values. */
  value?: T
  /** Initial values when uncontrolled. */
  defaultValue: T
  /** Called with all values after every change, cascade included. */
  onValueChange?: (values: T) => void
  /** Which fields depend on which, and when their value stops making sense. */
  rules: DependentRules<T>
  /** Field names as the user sees them. */
  labels?: Partial<Record<keyof T, string>>
  /** How long cleared fields stay highlighted, in ms. */
  highlightFor?: number
}

/**
 * Form state that never wipes a dependent field silently. `setField` clears
 * what the change invalidated, raises a notice that names each lost value,
 * highlights those fields for a moment, and `undo` puts everything back.
 */
export function useDependentReset<T extends Values>({ value, defaultValue, onValueChange, rules, labels = {}, highlightFor = 1600 }: UseDependentResetOptions<T>) {
  const [inner, setInner] = React.useState(defaultValue)
  const [notice, setNotice] = React.useState<ResetNotice<T> | null>(null)
  const [highlighted, setHighlighted] = React.useState<(keyof T)[]>([])
  const values = value ?? inner
  const latest = React.useRef(values)
  React.useEffect(() => {
    latest.current = values
  }, [values])
  const label = (name: keyof T) => labels[name] ?? String(name)

  React.useEffect(() => {
    if (!highlighted.length) return
    const timer = setTimeout(() => setHighlighted([]), highlightFor)
    return () => clearTimeout(timer)
  }, [highlighted, highlightFor])

  // Once every cleared field has been filled in again, the notice has done its job.
  React.useEffect(() => {
    const emptied = notice?.fields.filter((f) => !f.partial) ?? []
    if (emptied.length && emptied.every((f) => !isEmpty(values[f.name]))) setNotice(null)
  }, [notice, values])

  const commit = (next: T) => {
    latest.current = next
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const setField = <K extends keyof T>(name: K, fieldValue: T[K]) => {
    const before = latest.current
    if (show(before[name]) === show(fieldValue)) return
    const result = cascadeReset({ ...before, [name]: fieldValue }, name, rules)
    commit(result.values)
    if (!result.cleared.length) return
    const fields = result.cleared.map(({ name: field, previous, partial }) => {
      const format = (rules[field] as DependentRule<T> | undefined)?.format ?? show
      const now = result.values[field]
      const removed = Array.isArray(previous) && Array.isArray(now) ? previous.filter((item) => !now.includes(item)) : previous
      return { name: field, label: label(field), previous: format(previous), removed: format(removed as T[keyof T]), partial }
    })
    setNotice((last) => ({ id: (last?.id ?? 0) + 1, cause: name, causeLabel: label(name), before, fields }))
    setHighlighted(result.cleared.map((c) => c.name))
  }

  const undo = () => {
    if (!notice) return
    const restored: T = { ...latest.current, [notice.cause]: notice.before[notice.cause] }
    for (const field of notice.fields) restored[field.name] = notice.before[field.name]
    commit(restored)
    setNotice(null)
    setHighlighted([])
  }

  return {
    values,
    setField,
    notice,
    undo,
    dismiss: () => setNotice(null),
    /** True for a moment after the field was cleared: put it on `data-cleared` to highlight it. */
    isCleared: (name: keyof T) => highlighted.includes(name),
    /** The value a field had before it was cleared, while the notice is up. Handy as a placeholder. */
    previousValue: (name: keyof T) => notice?.fields.find((f) => f.name === name && !f.partial)?.previous,
  }
}

/** Add to a dependent field so it glows briefly while `data-cleared` is set. */
export const clearedFieldClass =
  "transition-[box-shadow,border-color] duration-300 ease-out data-cleared:border-amber-500 data-cleared:ring-[3px] data-cleared:ring-amber-500/35 dark:data-cleared:border-amber-400"

export interface DependentResetNoticeProps<T extends Values> extends Omit<React.ComponentProps<"div">, "children"> {
  /** The notice from `useDependentReset`. */
  notice: ResetNotice<T> | null
  /** Restore the change and everything it cleared. */
  onUndo: () => void
  /** Close the notice and keep the new values. */
  onDismiss: () => void
  /** `{count}` ("2 fields") and `{cause}` ("Country") are filled in. */
  message?: string
  /** Word for one field and for several. */
  fieldWord?: [singular: string, plural: string]
  /** Shown after the items a list lost. */
  removedSuffix?: string
  /** Read to screen readers after a fully cleared value. */
  clearedSuffix?: string
  /** Button labels. */
  undoLabel?: string
  /** Accessible label for the dismiss button. */
  dismissLabel?: string
}

/**
 * Says exactly what a change wiped ("2 fields cleared because you changed
 * Country"), strikes through each lost value, and offers Undo. It keeps an
 * empty live region mounted, so the next notice is announced.
 */
export function DependentResetNotice<T extends Values>({
  notice,
  onUndo,
  onDismiss,
  message = "{count} cleared because you changed {cause}.",
  fieldWord = ["field", "fields"],
  removedSuffix = "removed",
  clearedSuffix = "cleared",
  undoLabel = "Undo",
  dismissLabel = "Dismiss",
  className,
  ...props
}: DependentResetNoticeProps<T>) {
  const count = notice?.fields.length ?? 0
  const muted = "text-amber-900/75 dark:text-amber-100/75"
  return (
    <div data-slot="dependent-reset" role="status" aria-live="polite" className={cn("empty:hidden", className)} {...props}>
      {notice && (
        <div
          key={notice.id}
          className="overflow-hidden rounded-lg border border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-sm text-amber-950 motion-safe:animate-[cui-dependent-reset-in_250ms_ease-out] dark:text-amber-50"
        >
          <style>{"@keyframes cui-dependent-reset-in{from{opacity:0;transform:translateY(-6px)}}@keyframes cui-dependent-reset-strike{from{background-size:0 1px}}"}</style>
          <div className="flex min-h-11 items-center gap-3 px-3 py-1.5">
            <ListRestart aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="min-w-0 flex-1 font-medium">
              {message.replace("{count}", `${count} ${fieldWord[count === 1 ? 0 : 1]}`).replace("{cause}", notice.causeLabel)}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className="-mr-1 grid size-8 shrink-0 place-items-center rounded-md transition-colors outline-none hover:bg-amber-500/15 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-amber-500/20 px-3 py-2">
            <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5 text-xs">
              {notice.fields.map((field) => {
                const lost = field.partial ? field.removed : field.previous
                return (
                  <li key={String(field.name)} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1">
                    <span className={muted}>{field.label}:</span>
                    <s
                      aria-label={`${lost} ${field.partial ? removedSuffix : clearedSuffix}`}
                      className="truncate bg-linear-to-r from-current to-current bg-[length:100%_1px] bg-center bg-no-repeat no-underline motion-safe:animate-[cui-dependent-reset-strike_400ms_ease-out_150ms_backwards]"
                    >
                      {lost}
                    </s>
                    {field.partial && <span className={muted}>{removedSuffix}</span>}
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={onUndo}
              className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-amber-700/25 px-3 font-medium transition-colors outline-none hover:bg-amber-500/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-amber-300/25"
            >
              <Undo2 aria-hidden className="size-4" />
              {undoLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
