"use client"

// Bollard UI — presence-lock · MIT licence · https://bollard-ui.vercel.app/components/presence-lock

import * as React from "react"
import { Clock3, LockKeyhole, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** Someone else looking at the record. Feed it from any transport (WebSocket, Liveblocks, Supabase, polling). */
export interface Collaborator {
  id: string
  name: string
  avatarUrl?: string
  /** The field they have focused, if any. */
  field?: string | null
  /** Their last keystroke or heartbeat. Past `idleAfter` they stop holding a lock. */
  lastActiveAt: Date | number | string
}

const PALETTE = [
  { bg: "bg-sky-600", ring: "ring-sky-500/60" },
  { bg: "bg-violet-600", ring: "ring-violet-500/60" },
  { bg: "bg-rose-600", ring: "ring-rose-500/60" },
  { bg: "bg-teal-600", ring: "ring-teal-500/60" },
  { bg: "bg-orange-600", ring: "ring-orange-500/60" },
  { bg: "bg-indigo-600", ring: "ring-indigo-500/60" },
]

/** A stable colour per person, so their avatar and the field they hold always match. */
export function presenceColor(id: string) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/** Splits the people on `field` into those actively editing it and those who went quiet (closed laptop, lost tab). */
export function fieldPresence(people: Collaborator[], field: string, now: number, idleAfter: number) {
  const here = people.filter((p) => p.field === field)
  const fresh = (p: Collaborator) => now - new Date(p.lastActiveAt).getTime() < idleAfter
  return { active: here.filter(fresh), idle: here.filter((p) => !fresh(p)) }
}

const names = (people: Collaborator[]) =>
  people.length <= 2 ? people.map((p) => p.name).join(" and ") : `${people[0].name} and ${people.length - 1} others`
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

const KEYFRAMES = `@keyframes cui-presence-lock-join{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}`

export function PresenceAvatar({ person, className }: { person: Collaborator; className?: string }) {
  const initials = person.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
  return (
    <span
      title={person.name}
      className={cn("inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white ring-2 ring-background", presenceColor(person.id).bg, className)}
    >
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="size-full object-cover" /> : <span aria-hidden>{initials}</span>}
    </span>
  )
}

export interface PresenceAvatarsProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Everyone else on the record right now. */
  people: Collaborator[]
  /** Avatars shown before "+N". */
  max?: number
  /** Announced to screen readers. `{name}` is filled in. */
  joinedText?: string
  /** Announcement template when someone leaves. */
  leftText?: string
}

/** The record-level avatar stack. People pop in when they join and shrink away when they leave, so arrivals get noticed. */
export function PresenceAvatars({ people, max = 4, joinedText = "{name} joined", leftText = "{name} left", className, ...props }: PresenceAvatarsProps) {
  const [shown, setShown] = React.useState(() => people.map((person) => ({ person, leaving: false })))
  const [announce, setAnnounce] = React.useState("")
  const latest = React.useRef(people)
  latest.current = people
  const ids = people.map((p) => p.id).join("\n")

  React.useEffect(() => {
    const people = latest.current
    setShown((prev) => {
      const ids = new Set(people.map((p) => p.id))
      const before = new Set(prev.map((s) => s.person.id))
      const gone = prev.filter((s) => !ids.has(s.person.id))
      const joined = people.filter((p) => !before.has(p.id))
      const messages = [...joined.map((p) => fill(joinedText, { name: p.name })), ...gone.filter((s) => !s.leaving).map((s) => fill(leftText, { name: s.person.name }))]
      if (messages.length) setAnnounce(messages.join(". "))
      return [...people.map((person) => ({ person, leaving: false })), ...gone.map((s) => ({ ...s, leaving: true }))]
    })
    const timer = setTimeout(() => setShown((prev) => prev.filter((s) => !s.leaving)), 250)
    return () => clearTimeout(timer)
  }, [ids, joinedText, leftText])

  const extra = Math.max(0, people.length - max)
  return (
    <div data-slot="presence-avatars" role="group" aria-label={`${people.length} others here`} className={cn("flex items-center -space-x-1.5", className)} {...props}>
      <style>{KEYFRAMES}</style>
      {shown.slice(0, max).map(({ person, leaving }) => (
        <PresenceAvatar
          key={person.id}
          person={person}
          className={cn(
            "transition-[opacity,scale] duration-200 ease-out motion-safe:animate-[cui-presence-lock-join_250ms_ease-out] motion-reduce:transition-none",
            leaving && "scale-50 opacity-0",
          )}
        />
      ))}
      {extra > 0 && <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-background">+{extra}</span>}
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  )
}

const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface PresenceLockProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The field's key, matched against `Collaborator.field`. */
  field: string
  /** Visible label. */
  label: string
  /** The id of the field's input, so the label is a real `<label>`. */
  htmlFor?: string
  /** The field itself. */
  children: React.ReactNode
  /** Everyone else on the record. */
  people: Collaborator[]
  /** After this many ms without activity, a person stops locking the field. */
  idleAfter?: number
  /** Called when you take the field anyway, e.g. to tell the others. */
  onEditAnyway?: (field: string) => void
  /** Templates: `{names}`, `{label}` and `{when}` are filled in. */
  editingText?: string
  /** Template when several people edit the field. */
  editingManyText?: string
  /** Button text to edit a locked field. */
  editAnywayLabel?: string
  /** Warning shown before editing anyway. */
  confirmText?: string
  /** Cancel button text. */
  cancelLabel?: string
  /** Template when you and one other are editing. */
  bothText?: string
  /** Template when you and several others are editing. */
  bothManyText?: string
  /** Template for people who went idle. */
  idleText?: string
  /** Shown when the field is free. */
  freeText?: string
}

/**
 * Stops two people silently overwriting each other's edit of one field. While
 * someone else is editing it, the field is softly locked (inert, outlined in
 * their colour) with "Priya is editing Price". "Edit anyway" asks once and
 * then keeps a warning up while you both type. A lock is never pulled from
 * under someone already typing, and a person who goes quiet past `idleAfter`
 * stops holding it, so a closed laptop can't block the field.
 */
export function PresenceLock({
  field,
  label,
  htmlFor,
  children,
  people,
  idleAfter = 45_000,
  onEditAnyway,
  editingText = "{names} is editing {label}",
  editingManyText = "{names} are editing {label}",
  editAnywayLabel = "Edit anyway",
  confirmText = "Your change could overwrite theirs.",
  cancelLabel = "Cancel",
  bothText = "{names} is editing this too. The last save wins.",
  bothManyText = "{names} are editing this too. The last save wins.",
  idleText = "{names} was editing {label}, idle for {when}",
  freeText = "{label} is free to edit now.",
  className,
  onFocus,
  onBlur,
  ...props
}: PresenceLockProps) {
  const [now, setNow] = React.useState<number>()
  const [mine, setMine] = React.useState(false)
  const [overriding, setOverriding] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [freed, setFreed] = React.useState(false)
  const fieldRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  const { active, idle } = now === undefined ? { active: [], idle: [] } : fieldPresence(people, field, now, idleAfter)
  const locked = active.length > 0 && !overriding && !mine
  const others = { names: names(active), label }

  // When the last editor leaves, drop any override and say the field is free.
  const wasLocked = React.useRef(false)
  React.useEffect(() => {
    const justFreed = wasLocked.current && active.length === 0
    wasLocked.current = locked
    if (active.length) return setFreed(false)
    setOverriding(false)
    setConfirming(false)
    if (!justFreed) return
    setFreed(true)
    const timer = setTimeout(() => setFreed(false), 3000)
    return () => clearTimeout(timer)
  }, [active.length, locked])

  React.useEffect(() => {
    if (overriding) fieldRef.current?.querySelector<HTMLElement>("input, textarea, select, [contenteditable], button")?.focus()
  }, [overriding])

  const takeOver = () => {
    setConfirming(false)
    setOverriding(true)
    onEditAnyway?.(field)
  }

  const idleWhen = idle[0] && now !== undefined ? `${Math.max(1, Math.round((now - new Date(idle[0].lastActiveAt).getTime()) / 60_000))} min` : ""

  return (
    <div
      data-slot="presence-lock"
      data-state={locked ? "locked" : active.length ? "shared" : "free"}
      className={cn("grid gap-2", className)}
      onFocus={(event) => {
        if (event.currentTarget.contains(event.target) && fieldRef.current?.contains(event.target)) setMine(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) setMine(false)
        onBlur?.(event)
      }}
      {...props}
    >
      <div className="flex min-h-6 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm leading-none font-medium">{label}</label>
        {active.length > 0 && <PresenceAvatars people={active} max={3} />}
      </div>
      <div
        ref={fieldRef}
        inert={locked}
        className={cn(
          "rounded-md ring-offset-2 ring-offset-background transition-[opacity,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          active[0] && "ring-2",
          active[0] && presenceColor(active[0].id).ring,
          locked && "cursor-not-allowed opacity-60 select-none",
        )}
      >
        {children}
      </div>
      <div aria-live="polite" className="min-h-0 text-xs empty:hidden">
        {locked ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <LockKeyhole aria-hidden className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{fill(active.length > 1 ? editingManyText : editingText, others)}</span>
            {confirming ? (
              <span role="group" aria-label={confirmText} className="flex flex-wrap items-center gap-2" onKeyDown={(e) => e.key === "Escape" && setConfirming(false)}>
                <span className="text-amber-800 dark:text-amber-300">{confirmText}</span>
                <button type="button" autoFocus onClick={() => setConfirming(false)} className="h-6 rounded-md px-2 font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {cancelLabel}
                </button>
                <button type="button" onClick={takeOver} className={fix}>{editAnywayLabel}</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className={cn(fix, "ml-auto")}>{editAnywayLabel}</button>
            )}
          </div>
        ) : active.length > 0 ? (
          <p className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            {fill(active.length > 1 ? bothManyText : bothText, others)}
          </p>
        ) : idle.length > 0 ? (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Clock3 aria-hidden className="size-3.5 shrink-0" />
            {fill(idleText, { names: names(idle), label, when: idleWhen })}
          </p>
        ) : freed ? (
          <p className="text-emerald-700 dark:text-emerald-400">{fill(freeText, others)}</p>
        ) : null}
      </div>
    </div>
  )
}
