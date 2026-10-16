"use client"

import * as React from "react"
import { Globe, Link, LoaderCircle, Lock, TriangleAlert, Users } from "lucide-react"

import { cn } from "@/lib/utils"

export interface VisibilityOption {
  value: string
  label: string
  description?: string
  /** 0 (only you) to 3 (the whole internet). Options are ordered by this, then by `reach`. */
  risk: 0 | 1 | 2 | 3
  /** How many people can open it at this level. Omit when it's unbounded. */
  reach?: number
  /** Who that is, in plain words: "12 people in Design", "anyone who gets the link". */
  audience: string
  /** Extra consequence shown when widening to this level, e.g. "Search engines can index it." */
  consequence?: string
  icon?: React.ComponentType<{ className?: string }>
  /** Shown instead of the audience and blocks choosing this level, e.g. "Your admin turned off public sharing". */
  disabledReason?: string
}

export interface VisibilityPickerProps
  extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Sharing levels. They are shown ordered by `risk`. */
  options: VisibilityOption[]
  /** The applied level (controlled). */
  value?: string
  /** The starting level when uncontrolled. Defaults to the least risky option. */
  defaultValue?: string
  /** Called once a level is applied: instantly when narrowing, after confirming when widening. Return a promise to show saving; a rejection puts the old level back and says so. */
  onValueChange?: (value: string) => void | Promise<void>
  /** Name of the thing being shared, used in the warning. */
  resourceName?: string
  /** Visible label of the group. */
  label?: string
  /** Text of the button that cancels a widening. Defaults to "Keep <current level>". */
  cancelLabel?: string
  /** Text of the button that confirms a widening. Defaults to "Yes, change to <level>". */
  confirmLabel?: string
  /** The widening warning. Override to translate. `more` is how many more people, if known. */
  warningText?: (info: { resource: string; from: string; to: string; more?: number; unbounded: boolean }) => React.ReactNode
  /** Shown while an async `onValueChange` runs; `{level}` is filled in. */
  savingText?: string
  /** Shown when it rejects; `{level}` is the level that was kept. */
  failedText?: string
}

const defaultWarning: NonNullable<VisibilityPickerProps["warningText"]> = ({ resource, from, to, more, unbounded }) => (
  <>
    This widens access to <strong>{resource}</strong> from {from} to <strong>{to}</strong>
    {more !== undefined && more > 0 && <> ({new Intl.NumberFormat().format(more)} more {more === 1 ? "person" : "people"})</>}
    {unbounded && <>, with no limit on who that is</>}.
  </>
)

/** True when `next` lets more people in than `current`: a higher risk, or the same risk with a bigger reach. */
export function widensAccess(current: VisibilityOption, next: VisibilityOption) {
  if (next.risk !== current.risk) return next.risk > current.risk
  return (next.reach ?? Infinity) > (current.reach ?? Infinity)
}

const byReach = (a: VisibilityOption, b: VisibilityOption) => a.risk - b.risk || (a.reach ?? Infinity) - (b.reach ?? Infinity) || 0

const defaultIcons = [Lock, Users, Link, Globe]
/** Fill color of the risk meter, indexed by risk level (level 0 shows no bars). */
const riskTone = ["", "bg-sky-500", "bg-amber-500", "bg-red-500"]

/**
 * A sharing-level picker where narrowing is instant but widening needs a
 * second, informed click. The inline warning says exactly who gains access
 * ("+47 people", "anyone on the internet") before anything changes, so a
 * private doc never goes public by a stray click, a double-click or an
 * arrow key.
 */
export function VisibilityPicker({
  options,
  value,
  defaultValue,
  onValueChange,
  resourceName = "this",
  label = "Who can access",
  cancelLabel,
  confirmLabel,
  warningText = defaultWarning,
  savingText = "Saving {level}…",
  failedText = "Couldn't change who can access this. It's still {level}.",
  className,
  onKeyDown,
  ...props
}: VisibilityPickerProps) {
  const sorted = React.useMemo(() => [...options].sort(byReach), [options])
  const [internal, setInternal] = React.useState(defaultValue)
  const [pending, setPending] = React.useState<string>()
  const [saving, setSaving] = React.useState<{ value: string; failed?: boolean; kept?: string }>()
  const openedAt = React.useRef(0)
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const id = React.useId()
  const applied = sorted.find((o) => o.value === (value ?? internal)) ?? sorted[0]
  // While a save runs, show the level being saved; if it fails, the applied level is back.
  const current = (saving && !saving.failed && sorted.find((o) => o.value === saving.value)) || applied
  const target = sorted.find((o) => o.value === pending)

  const apply = (option: VisibilityOption) => {
    setPending(undefined)
    if (option.value === current.value) return
    const previous = current.value
    let result: void | Promise<void>
    try {
      result = onValueChange?.(option.value)
    } catch {
      result = Promise.reject()
    }
    if (!(result instanceof Promise)) {
      setSaving(undefined)
      setInternal(option.value)
      return
    }
    setSaving({ value: option.value })
    result.then(
      () => {
        setInternal(option.value)
        setSaving((s) => (s?.value === option.value ? undefined : s))
      },
      () => setSaving((s) => (s?.value === option.value ? { value: option.value, failed: true, kept: previous } : s)),
    )
  }

  // Narrowing applies at once. Widening only opens the warning: the confirm button is the
  // single way through, so a double-click on "Public" can't publish anything.
  const choose = (option: VisibilityOption) => {
    if (option.disabledReason || (saving && !saving.failed)) return
    if (!widensAccess(current, option)) return apply(option)
    if (option.value !== pending) openedAt.current = performance.now()
    setPending(option.value)
  }

  // The warning's buttons unmount once it closes, so hand focus back to the radio that now holds the choice.
  const resolveFromWarning = (option: VisibilityOption) => {
    apply(option)
    requestAnimationFrame(() => refs.current[sorted.indexOf(option)]?.focus())
  }

  const onRadioKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (step) {
      event.preventDefault()
      // Arrow keys only move focus: widening must be a deliberate Space/Enter.
      refs.current[(index + step + sorted.length) % sorted.length]?.focus()
    }
  }

  const delta = target?.reach !== undefined && current.reach !== undefined ? target.reach - current.reach : undefined

  return (
    <div
      data-slot="visibility-picker"
      className={cn("w-full max-w-md space-y-3", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.key === "Escape" && pending) resolveFromWarning(current)
      }}
      {...props}
    >
      <span id={`${id}-label`} className="block text-sm font-medium">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="overflow-hidden rounded-lg border">
        {sorted.map((option, index) => {
          const Icon = option.icon ?? defaultIcons[option.risk]
          const checked = option.value === current.value
          const isPending = option.value === pending
          return (
            <button
              key={option.value}
              ref={(node) => { refs.current[index] = node }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={option.disabledReason ? true : undefined}
              aria-describedby={isPending ? `${id}-warning` : undefined}
              tabIndex={checked ? 0 : -1}
              onClick={(event) => {
                // Safari doesn't focus buttons on click; focus keeps Escape and the arrow keys working.
                event.currentTarget.focus()
                choose(option)
              }}
              onKeyDown={(event) => onRadioKeyDown(event, index)}
              className={cn(
                "flex w-full items-center gap-3 border-b px-3 py-2.5 text-left text-sm select-none last:border-b-0 hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
                checked && "bg-accent",
                option.disabledReason && "cursor-not-allowed opacity-60 hover:bg-transparent",
                isPending && "bg-amber-50 dark:bg-amber-950/40"
              )}
            >
              <span aria-hidden className="shrink-0 text-muted-foreground"><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{option.disabledReason ?? option.description ?? option.audience}</span>
              </span>
              <span className="sr-only">, risk {option.risk} of 3</span>
              <span aria-hidden className="flex gap-0.5">
                {[1, 2, 3].map((level) => (
                  <span key={level} className={cn("h-3 w-1 rounded-full", level <= option.risk ? riskTone[option.risk] : "bg-muted")} />
                ))}
              </span>
              <span
                aria-hidden
                className={cn("grid size-4 place-items-center rounded-full border", checked && "border-primary")}
              >
                {checked && <span className="size-2 rounded-full bg-primary" />}
              </span>
            </button>
          )
        })}
      </div>

      <div id={`${id}-warning`} aria-live="polite">
        {saving && (
          <p className={cn("flex items-center gap-1.5 text-xs", saving.failed ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
            {saving.failed ? <TriangleAlert aria-hidden className="size-3.5" /> : <LoaderCircle aria-hidden className="size-3.5 animate-spin" />}
            {saving.failed
              ? failedText.replace("{level}", sorted.find((o) => o.value === saving.kept)?.label ?? "")
              : savingText.replace("{level}", current.label)}
          </p>
        )}
        {target && (
          <div className="space-y-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50">
            <p className="flex gap-2">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {warningText({
                  resource: resourceName,
                  from: current.audience,
                  to: target.audience,
                  more: delta,
                  unbounded: target.reach === undefined,
                })}
                {target.consequence && <> {target.consequence}</>}
              </span>
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => resolveFromWarning(current)}
                className="h-8 rounded-md px-3 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {cancelLabel ?? `Keep ${current.label}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  // The warning can shift layout; a double-click's second half must not land as a confirm.
                  if (performance.now() - openedAt.current > 500) resolveFromWarning(target)
                }}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  target.risk === 3 ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {confirmLabel ?? `Yes, change to ${target.label}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
