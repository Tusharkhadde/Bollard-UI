"use client"

import * as React from "react"
import { LoaderCircle, ShieldAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** Cockpit convention: red guards protect actions you can't take back, black guards ones you can. */
const tones = {
  red: "text-red-600 dark:text-red-400",
  black: "text-foreground/80",
} as const

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

export interface GuardedSwitchProps extends Omit<React.ComponentProps<"div">, "children" | "defaultValue"> {
  /** The setting's name, e.g. "Maintenance mode". Also the switch's accessible name. */
  label: string
  /** What turning it on does, e.g. "Site goes offline for all 12,400 users". */
  onEffect: string
  /** What turning it off does, e.g. "Site comes back for all 12,400 users". */
  offEffect: string
  /** Controlled state. */
  value?: boolean
  /** Initial state when uncontrolled. */
  defaultValue?: boolean
  /** Called with the new state. Return a promise to show a pending state; a rejection keeps the old state. */
  onValueChange?: (value: boolean) => void | Promise<void>
  /** `red` for irreversible or high-blast-radius settings, `black` for reversible ones. */
  tone?: keyof typeof tones
  /** How long the lifted cover stays up, in milliseconds. Pauses while the pointer is over the switch. */
  openFor?: number
  disabled?: boolean
  /** Accessible name of the cover. `{label}` is filled in. */
  liftLabel?: string
  /** Shown while the cover is up. `{state}` and `{effect}` are filled in. */
  armedText?: string
  /** Read back after a flip. `{label}`, `{state}` and `{effect}` are filled in. */
  changedText?: string
  onText?: string
  offText?: string
}

/**
 * A switch for settings that shouldn't change by accident, modelled on an
 * aircraft switch guard. A see-through cover sits over the switch, so the
 * current state is always visible but the first click only lifts the cover.
 * While it's up, the line below says what flipping will do; after a flip, it
 * reads back the consequence. The cover drops on its own after `openFor` ms
 * (paused while the pointer is over it), right after a flip, or on Escape.
 */
export function GuardedSwitch({
  label,
  onEffect,
  offEffect,
  value,
  defaultValue = false,
  onValueChange,
  tone = "red",
  openFor = 4000,
  disabled,
  liftLabel = "Lift cover to change {label}",
  armedText = "Flipping {state}: {effect}.",
  changedText = "{label} is {state}. {effect}.",
  onText = "on",
  offText = "off",
  className,
  ...props
}: GuardedSwitchProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const [hovering, setHovering] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [settling, setSettling] = React.useState(false)
  const [changes, setChanges] = React.useState(0)
  const [draining, setDraining] = React.useState(false)
  const openedAt = React.useRef(0)
  const coverRef = React.useRef<HTMLButtonElement>(null)
  const switchRef = React.useRef<HTMLButtonElement>(null)
  const labelId = React.useId()
  const lineId = React.useId()
  const checked = value ?? inner
  const next = !checked

  const drop = React.useCallback(() => {
    setOpen(false)
    setSettling(false)
    // Keep keyboard focus on the control instead of losing it to <body>.
    if (document.activeElement === switchRef.current) coverRef.current?.focus()
  }, [])

  // The auto-drop timer restarts whenever the pointer leaves, so the cover never shuts under a finger.
  React.useEffect(() => {
    setDraining(false)
    if (!open || hovering || pending || settling) return
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setDraining(true))
    })
    const timer = setTimeout(drop, openFor)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [open, hovering, pending, settling, openFor, drop])

  const lift = () => {
    if (disabled) return
    openedAt.current = performance.now()
    setOpen(true)
    switchRef.current?.focus()
  }

  const flip = async () => {
    // A double-click on the cover must not also flip the switch.
    if (!open || pending || settling || performance.now() - openedAt.current < 350) return
    setPending(true)
    try {
      await onValueChange?.(next)
      if (value === undefined) setInner(next)
      setChanges((count) => count + 1)
    } catch {
      // The caller reports the error; the switch keeps its old state.
    } finally {
      setPending(false)
      // Leave the lever visible in its new position for a beat before the cover comes down.
      setSettling(true)
      setTimeout(drop, 450)
    }
  }

  const state = (on: boolean) => (on ? onText : offText)
  const effect = (on: boolean) => (on ? onEffect : offEffect)
  const line = open && !settling
    ? fill(armedText, { state: state(next), effect: effect(next) })
    : changes > 0
      ? fill(changedText, { label, state: state(checked), effect: effect(checked) })
      : ""

  return (
    <div
      data-slot="guarded-switch"
      data-state={checked ? "on" : "off"}
      data-cover={open ? "open" : "closed"}
      className={cn("w-full rounded-lg border bg-card p-3 text-card-foreground", disabled && "opacity-50", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault()
          drop()
        }
      }}
      {...props}
    >
      <style>{`@keyframes cui-guarded-switch-flash{from{background-color:color-mix(in oklab,currentColor 18%,transparent)}to{background-color:transparent}}`}</style>
      <div className="flex items-center gap-3">
        <ShieldAlert aria-hidden className={cn("size-4 shrink-0", tones[tone])} />
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-sm font-medium">
            {label}
          </p>
          <p className="text-xs text-muted-foreground first-letter:uppercase">{state(checked)}</p>
        </div>
        <div
          className="relative p-1.5 [perspective:240px]"
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
        >
          <button
            ref={switchRef}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={labelId}
            aria-describedby={lineId}
            aria-disabled={!open || pending || undefined}
            aria-busy={pending || undefined}
            tabIndex={open ? 0 : -1}
            onClick={() => void flip()}
            className={cn(
              "relative flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              checked ? (tone === "red" ? "bg-red-600 dark:bg-red-500" : "bg-primary") : "bg-input dark:bg-input/80",
            )}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none",
                checked && "translate-x-5",
              )}
            >
              {pending && <LoaderCircle aria-hidden className="size-3 animate-spin text-muted-foreground" />}
            </span>
          </button>
          <button
            ref={coverRef}
            type="button"
            aria-label={fill(liftLabel, { label })}
            aria-expanded={open}
            disabled={disabled}
            tabIndex={open ? -1 : 0}
            onClick={lift}
            className={cn(
              "absolute inset-0 origin-top rounded-lg border-2 border-current outline-none transition-transform duration-300 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
              tones[tone],
              open ? "pointer-events-none [transform:rotateX(-112deg)]" : "cursor-pointer hover:[transform:rotateX(-14deg)]",
            )}
            style={{
              backgroundImage:
                // Thin, sparse hatching: it reads as a cover without hiding the switch position underneath.
                "repeating-linear-gradient(135deg, color-mix(in oklab, currentColor 22%, transparent) 0 1.5px, transparent 1.5px 6px)",
            }}
          >
            <span aria-hidden className="absolute -bottom-1.5 left-1/2 h-1 w-4 -translate-x-1/2 rounded-b-sm bg-current" />
          </button>
          <span
            aria-hidden
            className="absolute inset-x-1.5 -bottom-1 h-0.5 origin-left rounded-full bg-current ease-linear"
            style={{
              color: "var(--muted-foreground)",
              opacity: open && !hovering && !pending ? 0.6 : 0,
              transform: `scaleX(${draining ? 0 : 1})`,
              transitionProperty: draining ? "transform" : "none",
              transitionDuration: `${openFor}ms`,
            }}
          />
        </div>
      </div>
      <p id={lineId} aria-live="polite" className="empty:hidden">
        {line && (
          <span
            key={open && !settling ? "armed" : changes}
            className={cn(
              "mt-2 flex items-start gap-1.5 rounded-sm text-xs",
              open && !settling ? "text-amber-700 dark:text-amber-400" : "text-foreground motion-safe:animate-[cui-guarded-switch-flash_400ms_ease-out]",
            )}
          >
            <TriangleAlert aria-hidden className={cn("mt-px size-3.5 shrink-0", !(open && !settling) && tones[tone])} />
            {line}
          </span>
        )}
      </p>
    </div>
  )
}
