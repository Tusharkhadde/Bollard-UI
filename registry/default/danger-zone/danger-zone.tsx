"use client"

// Bollard UI — danger-zone · MIT licence · https://bollard-ui.vercel.app/components/danger-zone

import * as React from "react"
import { LoaderCircle, Lock, LockOpen } from "lucide-react"

import { cn } from "@/lib/utils"

interface ZoneContext {
  unlocked: boolean
  /** Restart the auto-lock countdown. */
  touch: () => void
  /** An action ran: lock again if the zone is one-action-per-unlock. */
  acted: () => void
  /** A locked action was pressed: point at the unlock button. */
  nudge: () => void
}

const DangerZoneContext = React.createContext<ZoneContext | null>(null)

const button =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface DangerZoneProps extends Omit<React.ComponentProps<"section">, "title"> {
  /** Heading of the section. */
  title?: React.ReactNode
  /** Seconds of inactivity before it locks again. Any interaction inside restarts the count. */
  timeout?: number
  /** Lock again as soon as one action has run, so one unlock can't be spent on several. */
  lockAfterAction?: boolean
  /** Controlled lock state. */
  unlocked?: boolean
  /** Initial unlocked state when uncontrolled. */
  defaultUnlocked?: boolean
  /** Called when the section locks or unlocks. */
  onUnlockedChange?: (unlocked: boolean) => void
  /** Text for the unlock button. */
  unlockLabel?: string
  /** Text for the lock button. */
  lockLabel?: string
  /** Shown while locked. `{count}` is the number of actions inside. */
  lockedText?: string
  /** Shown while unlocked. `{seconds}` counts down to the auto-lock. */
  unlockedText?: string
  /** Shown for a moment when a locked action is pressed. */
  nudgeText?: string
}

/**
 * A settings "danger zone" whose destructive actions stay locked until the user
 * deliberately unlocks it, so a stray click while tidying settings can't delete
 * anything. While locked it still lists every action and its consequence. It
 * locks itself again after `timeout` seconds idle, when focus leaves the
 * section, when the tab is hidden, on Escape, and by default after one action.
 */
export function DangerZone({
  title = "Danger zone",
  timeout = 60,
  lockAfterAction = true,
  unlocked: unlockedProp,
  defaultUnlocked = false,
  onUnlockedChange,
  unlockLabel = "Unlock",
  lockLabel = "Lock",
  lockedText = "{count} destructive actions are locked.",
  unlockedText = "Unlocked. Locks again in {seconds}s or when you leave this section.",
  nudgeText = "Locked, so nothing happened. Unlock first if you meant it.",
  className,
  children,
  onKeyDown,
  onBlur,
  ref,
  ...props
}: DangerZoneProps) {
  const [inner, setInner] = React.useState(defaultUnlocked)
  const [lastActive, setLastActive] = React.useState(0)
  const [now, setNow] = React.useState(0)
  const [nudged, setNudged] = React.useState(false)
  const rootRef = React.useRef<HTMLElement>(null)
  React.useImperativeHandle(ref, () => rootRef.current as HTMLElement)
  const unlocked = unlockedProp ?? inner
  const titleId = React.useId()

  const set = React.useCallback(
    (next: boolean) => {
      if (unlockedProp === undefined) setInner(next)
      onUnlockedChange?.(next)
    },
    [unlockedProp, onUnlockedChange],
  )
  const touch = React.useCallback(() => setLastActive(Date.now()), [])

  React.useEffect(() => {
    if (!nudged) return
    const timer = setTimeout(() => setNudged(false), 2400)
    return () => clearTimeout(timer)
  }, [nudged])

  React.useEffect(() => {
    if (!unlocked) return
    setNudged(false)
    touch()
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const onHide = () => document.visibilityState === "hidden" && set(false)
    document.addEventListener("visibilitychange", onHide)
    return () => {
      clearInterval(tick)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [unlocked, touch, set])

  const remaining = Math.max(0, Math.ceil(timeout - (now - lastActive) / 1000))
  React.useEffect(() => {
    if (unlocked && lastActive && now && remaining === 0) set(false)
  }, [unlocked, lastActive, now, remaining, set])

  const context = React.useMemo<ZoneContext>(
    () => ({ unlocked, touch, acted: () => lockAfterAction && set(false), nudge: () => setNudged(true) }),
    [unlocked, touch, lockAfterAction, set],
  )
  const count = React.Children.toArray(children).filter(React.isValidElement).length

  return (
    <section
      ref={rootRef}
      data-slot="danger-zone"
      data-state={unlocked ? "unlocked" : "locked"}
      aria-labelledby={titleId}
      // Focusable so a click on plain text inside keeps focus in the zone instead of locking it.
      tabIndex={-1}
      onPointerDown={touch}
      onKeyDown={(event) => {
        touch()
        if (event.key === "Escape" && unlocked) set(false)
        onKeyDown?.(event)
      }}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) set(false)
        onBlur?.(event)
      }}
      className={cn(
        "overflow-hidden rounded-lg border outline-none transition-colors",
        unlocked ? "border-red-500/60 dark:border-red-400/50" : "border-red-500/25",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm transition-colors",
          unlocked ? "bg-red-500/10 text-red-950 dark:text-red-50" : "bg-muted/50",
        )}
      >
        <div className="flex min-w-0 flex-1 basis-48 items-start gap-3">
          {unlocked ? (
            <LockOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          ) : (
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
          <h3 id={titleId} className="font-medium">
            {title}
          </h3>
          <p
            aria-live="polite"
            className={cn(
              "text-xs",
              unlocked ? "text-red-900/75 dark:text-red-100/75" : nudged ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
              {(unlocked ? unlockedText : nudged ? nudgeText : lockedText).replace("{count}", String(count)).replace("{seconds}", String(remaining))}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={unlocked}
          onClick={() => set(!unlocked)}
          className={cn(
            button,
            unlocked
              ? "border border-red-700/25 hover:bg-red-500/15 dark:border-red-300/25"
              : "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30",
            nudged && !unlocked && "border-amber-500 ring-[3px] ring-amber-500/30",
          )}
        >
          {unlocked ? <Lock aria-hidden className="size-4" /> : <LockOpen aria-hidden className="size-4" />}
          {unlocked ? lockLabel : unlockLabel}
        </button>
      </div>
      <DangerZoneContext.Provider value={context}>
        <ul className="divide-y border-t border-inherit">{children}</ul>
      </DangerZoneContext.Provider>
    </section>
  )
}

export interface DangerZoneActionProps extends Omit<React.ComponentProps<"li">, "title"> {
  /** What the action is, e.g. "Delete this project". */
  title: React.ReactNode
  /** What happens, to whom, and whether it can be undone. */
  consequence: React.ReactNode
  /** Label of the action button. */
  actionLabel: string
  /** Runs the action. Return a promise to show a pending state. */
  onAction: () => void | Promise<void>
  /** Action button text while it runs. */
  pendingLabel?: string
}

/** One destructive action inside a `DangerZone`: always visible with its consequence, usable only while the zone is unlocked. */
export function DangerZoneAction({
  title,
  consequence,
  actionLabel,
  onAction,
  pendingLabel = "Working…",
  className,
  ...props
}: DangerZoneActionProps) {
  const zone = React.useContext(DangerZoneContext)
  const [pending, setPending] = React.useState(false)
  const descriptionId = React.useId()
  if (!zone) throw new Error("DangerZoneAction must be used inside DangerZone")
  const locked = !zone.unlocked

  const run = async () => {
    if (locked) return zone.nudge()
    if (pending) return
    setPending(true)
    try {
      await onAction()
      zone.acted()
    } catch {
      // The caller reports the error; the zone stays unlocked so they can retry.
      zone.touch()
    } finally {
      setPending(false)
    }
  }

  return (
    <li data-slot="danger-zone-action" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3", className)} {...props}>
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-sm font-medium">{title}</p>
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {consequence}
        </p>
      </div>
      <button
        type="button"
        // aria-disabled rather than disabled, so the locked button stays focusable and its consequence stays readable.
        aria-disabled={locked || pending}
        aria-describedby={descriptionId}
        aria-busy={pending || undefined}
        onClick={() => void run()}
        className={cn(
          button,
          locked
            ? "cursor-not-allowed border border-dashed text-muted-foreground"
            : "bg-destructive text-white shadow-xs hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70",
        )}
      >
        {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : locked && <Lock aria-hidden className="size-3.5" />}
        {pending ? pendingLabel : actionLabel}
      </button>
    </li>
  )
}
