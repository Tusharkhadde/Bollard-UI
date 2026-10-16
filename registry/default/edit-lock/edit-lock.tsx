"use client"

import * as React from "react"
import { Lock, LockOpen, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const tones = {
  locked: "border-border bg-muted/50",
  open: "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-50",
  void: "border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-50",
} as const
const outline = "border bg-background hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50"
const solid = "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/** "0:42" */
export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export interface EditLockProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Who locked it, e.g. "Priya". */
  lockedBy: string
  /** Why it is locked, e.g. "approval", "sign-off". */
  reason?: string
  /** Identifies the approval. A new value (a fresh approval) clears the "needs re-approval" state. */
  approvalId?: string
  /** Controlled lock state. */
  locked?: boolean
  /** Initial lock state when uncontrolled. */
  defaultLocked?: boolean
  onLockedChange?: (locked: boolean) => void
  /** Called once, on the first change made after unlocking: the moment the approval stops being valid. */
  onEdit?: () => void
  /** Relocks after this many ms without any typing, clicking or key presses inside. */
  relockAfter?: number
  /** Templates: `{name}`, `{reason}` and `{time}` are filled in. */
  lockedText?: string
  unlockLabel?: string
  consequenceText?: string
  confirmUnlockLabel?: string
  cancelLabel?: string
  unlockedText?: string
  editedText?: string
  staleText?: string
  lockNowLabel?: string
  /** Read to screen readers instead of the ticking visible text, which would be announced every second. */
  unlockedAnnouncement?: string
  editedAnnouncement?: string
  /** Announced once when the idle relock is this close: `{time}` is filled in. */
  relockSoonText?: string
  /** How close the relock must be, in ms, before `relockSoonText` is announced. */
  relockWarnWithin?: number
}

/**
 * Stops accidental edits to finished, approved records. The form sits in a
 * native disabled fieldset with a plain "Locked by Priya after approval"
 * line. Unlocking first says what it costs (re-approval), but the approval is
 * only voided if you actually change something, so opening it to look is
 * free. It relocks itself after a stretch of idleness, never mid-typing.
 */
export function EditLock({
  lockedBy,
  reason = "approval",
  approvalId,
  locked,
  defaultLocked = true,
  onLockedChange,
  onEdit,
  relockAfter = 60_000,
  lockedText = "Locked by {name} after {reason}",
  unlockLabel = "Unlock to edit",
  consequenceText = "Any change voids {name}'s {reason}. It will need re-approval.",
  confirmUnlockLabel = "Unlock",
  cancelLabel = "Cancel",
  unlockedText = "Unlocked · nothing changed yet · relocks in {time}",
  editedText = "Edited · needs re-approval · relocks in {time}",
  staleText = "Locked · changed since {name}'s {reason}, needs re-approval",
  lockNowLabel = "Lock now",
  unlockedAnnouncement = "Unlocked. Nothing changed yet.",
  editedAnnouncement = "Edited. Needs re-approval.",
  relockSoonText = "Relocks in {time} unless you keep working.",
  relockWarnWithin = 10_000,
  className,
  children,
  onInput,
  ...props
}: EditLockProps) {
  const [inner, setInner] = React.useState(defaultLocked)
  const isLocked = locked ?? inner
  const [asking, setAsking] = React.useState(false)
  const [edited, setEdited] = React.useState(false)
  const [deadline, setDeadline] = React.useState(0)
  const [now, setNow] = React.useState(0)
  const unlockRef = React.useRef<HTMLButtonElement>(null)
  const fieldsetRef = React.useRef<HTMLFieldSetElement>(null)

  React.useEffect(() => setEdited(false), [approvalId])

  const setLocked = React.useCallback(
    (next: boolean) => {
      if (locked === undefined) setInner(next)
      onLockedChange?.(next)
    },
    [locked, onLockedChange],
  )

  const bump = React.useCallback(() => setDeadline(Date.now() + relockAfter), [relockAfter])

  // While unlocked, tick once a second and relock when the idle deadline passes.
  React.useEffect(() => {
    if (isLocked) return
    bump()
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isLocked, bump])

  React.useEffect(() => {
    if (isLocked || !deadline || now < deadline) return
    const focusInside = fieldsetRef.current?.contains(document.activeElement)
    setLocked(true)
    if (focusInside) unlockRef.current?.focus()
  }, [isLocked, deadline, now, setLocked])

  const unlock = () => {
    setAsking(false)
    setLocked(false)
    // Wait a frame for the fieldset to enable, then put the caret in the first field.
    requestAnimationFrame(() =>
      fieldsetRef.current?.querySelector<HTMLElement>("input, textarea, select, [contenteditable]")?.focus(),
    )
  }

  const values = { name: lockedBy, reason, time: formatClock(deadline - now) }
  const tone = !isLocked ? (edited ? tones.void : tones.open) : edited ? tones.void : tones.locked
  const remaining = isLocked || !deadline ? 0 : Math.max(0, (deadline - now) / relockAfter)

  let text = fill(lockedText, values)
  if (asking) text = fill(consequenceText, values)
  else if (!isLocked) text = fill(edited ? editedText : unlockedText, values)
  else if (edited) text = fill(staleText, values)
  // The visible line ticks every second; screen readers get the state, plus one heads-up before relocking.
  const soon = !isLocked && deadline > 0 && deadline - now <= relockWarnWithin
  // A fixed value, so the heads-up is read once rather than every second.
  const soonText = fill(relockSoonText, { time: formatClock(relockWarnWithin) })
  const announcement = asking || isLocked ? text : soon ? soonText : edited ? editedAnnouncement : unlockedAnnouncement

  return (
    <div
      data-slot="edit-lock"
      data-state={isLocked ? "locked" : "unlocked"}
      data-edited={edited || undefined}
      className={cn("w-full space-y-3", className)}
      onPointerDownCapture={() => !isLocked && bump()}
      onKeyDownCapture={() => !isLocked && bump()}
      onInput={(event) => {
        if (!isLocked && !edited) {
          setEdited(true)
          onEdit?.()
        }
        onInput?.(event)
      }}
      {...props}
    >
      <style>{`@keyframes cui-edit-lock-snap{0%{transform:translateY(-3px) scale(1.15)}60%{transform:translateY(1px)}100%{transform:none}}`}</style>
      <div className={cn("relative overflow-hidden rounded-lg border transition-colors", tone)}>
        <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm">
          <span key={String(isLocked)} aria-hidden className="motion-safe:animate-[cui-edit-lock-snap_300ms_ease-out]">
            {asking || (edited && isLocked) ? (
              <TriangleAlert className="size-4 text-red-600 dark:text-red-400" />
            ) : isLocked ? (
              <Lock className="size-4 text-muted-foreground" />
            ) : (
              <LockOpen className={cn("size-4", edited ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
            )}
          </span>
          <p className="min-w-0 flex-1 basis-48 font-medium tabular-nums">{text}</p>
          <span className="sr-only" aria-live="polite">
            {announcement}
          </span>
          <div
            className="ml-auto flex gap-2"
            onKeyDown={(event) => event.key === "Escape" && asking && (setAsking(false), unlockRef.current?.focus())}
          >
            {asking ? (
              <>
                <button type="button" onClick={() => (setAsking(false), unlockRef.current?.focus())} className={cn(action, outline)}>
                  {cancelLabel}
                </button>
                <button type="button" autoFocus onClick={unlock} className={cn(action, solid)}>
                  {confirmUnlockLabel}
                </button>
              </>
            ) : isLocked ? (
              <button ref={unlockRef} type="button" onClick={() => setAsking(true)} className={cn(action, outline)}>
                <LockOpen aria-hidden className="size-4" />
                {unlockLabel}
              </button>
            ) : (
              <button ref={unlockRef} type="button" onClick={() => setLocked(true)} className={cn(action, outline)}>
                <Lock aria-hidden className="size-4" />
                {lockNowLabel}
              </button>
            )}
          </div>
        </div>
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-40 transition-transform duration-1000 ease-linear motion-reduce:transition-none"
          style={{ transform: `scaleX(${remaining})` }}
        />
      </div>
      <fieldset ref={fieldsetRef} disabled={isLocked} aria-label={isLocked ? text : undefined} className="min-w-0 transition-opacity disabled:opacity-60">
        {children}
      </fieldset>
    </div>
  )
}
