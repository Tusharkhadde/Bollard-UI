"use client"

import * as React from "react"
import { KeyRound, LoaderCircle, Monitor, Plug, TriangleAlert, Unplug, UserMinus } from "lucide-react"

import { cn } from "@/lib/utils"

export interface OwnedItem {
  id: string
  name: string
  /** e.g. "Dashboard", "Cron job". */
  kind: string
}

export interface ActiveSession {
  id: string
  /** e.g. "Chrome on macOS · Pune". */
  device: string
  /** Last activity. Sessions active within `liveWithin` are flagged as in use right now. */
  lastActive: Date | number | string
}

export interface AffectedIntegration {
  name: string
  /** True when it runs on their credentials and stops; false when it belongs to the workspace and keeps running. */
  breaks: boolean
  /** What stops or why it is safe, e.g. "Nightly sync stops". */
  effect: string
}

export interface Assignee {
  id: string
  name: string
}

/** Who gets each owned item: an assignee id, or null to leave it unowned. */
export type Reassignment = Record<string, string | null>

/** Counts unowned items and sessions in use right now, the two things that hurt most after removal. */
export function revokeRisks(owned: OwnedItem[], reassign: Reassignment, sessions: ActiveSession[], now: number, liveWithin: number) {
  return {
    orphaned: owned.filter((item) => !reassign[item.id]).length,
    live: sessions.filter((s) => now - new Date(s.lastActive).getTime() < liveWithin).length,
  }
}

/** Every other user-visible string, so the dialog can be translated. */
export const REVOKE_MESSAGES = {
  loseHeading: "They lose",
  ownHeading: "They own",
  sessionsHeading: "Signed out now",
  integrationsHeading: "Integrations",
  inUse: (ago: string) => `in use, ${ago}`,
  liveNote: "Unsaved work in a session in use may be lost.",
  stops: "stops",
  keepsRunning: "keeps running",
  /** Relative time from minutes ago. */
  ago: (minutes: number) =>
    minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`,
}
export type RevokeMessages = typeof REVOKE_MESSAGES

const minutesSince = (date: Date | number | string, now: number) => Math.max(0, Math.round((now - new Date(date).getTime()) / 60_000))

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress"
const outline = "border bg-background hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
const select =
  "h-8 min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
const heading = "mb-1.5 text-xs font-medium text-muted-foreground"

export interface RevokeAccessPreviewProps extends Omit<React.ComponentProps<"section">, "title" | "defaultValue"> {
  /** Who or what is losing access, e.g. "Rahul Mehta" or "ci-deploy token". */
  name: string
  /** What they can no longer do, e.g. "Edit 4 projects". */
  access: string[]
  /** What they own that would be left without an owner. */
  owned?: OwnedItem[]
  /** People who can take over owned items. */
  assignees?: Assignee[]
  sessions?: ActiveSession[]
  integrations?: AffectedIntegration[]
  /** Controlled reassignment. */
  value?: Reassignment
  defaultValue?: Reassignment
  onValueChange?: (value: Reassignment) => void
  /** Sessions active more recently than this (ms) are flagged as in use. */
  liveWithin?: number
  /** Runs with the final reassignment. Return a promise to show a pending state; a rejection is caught. */
  onConfirm: (reassign: Reassignment) => void | Promise<void>
  onCancel?: () => void
  /** Who "Give all to" offers, e.g. their manager. Defaults to the first assignee. */
  suggestedAssigneeId?: string
  /** Override headings and other small strings (see `REVOKE_MESSAGES`). */
  messages?: Partial<RevokeMessages>
  title?: (name: string) => React.ReactNode
  confirmLabel?: (name: string, orphaned: number) => string
  pendingLabel?: string
  cancelLabel?: string
  unownedLabel?: string
  orphanText?: (count: number) => string
  reassignAllLabel?: (assignee: string) => string
}

/**
 * The remove-access confirmation that shows the blast radius before it
 * happens: what they lose, what they own that would be left with no owner
 * (each with a reassign-to picker and a one-tap "reassign all"), sessions
 * that end now, flagging any in use this minute, and integrations that stop
 * because they run on that person's credentials, kept apart from the ones that
 * keep running. The button says plainly if it will leave anything unowned.
 */
export function RevokeAccessPreview({
  name,
  access,
  owned = [],
  assignees = [],
  sessions = [],
  integrations = [],
  value,
  defaultValue = {},
  onValueChange,
  liveWithin = 15 * 60_000,
  onConfirm,
  onCancel,
  suggestedAssigneeId,
  messages,
  title = (n) => `Remove ${n}?`,
  confirmLabel = (n, orphaned) => (orphaned > 0 ? `Remove and leave ${orphaned} unowned` : `Remove ${n}`),
  pendingLabel = "Removing…",
  cancelLabel = "Cancel",
  unownedLabel = "No owner",
  orphanText = (count) => `${count} ${count === 1 ? "item" : "items"} will have no owner.`,
  reassignAllLabel = (assignee) => `Give all to ${assignee}`,
  className,
  ...props
}: RevokeAccessPreviewProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [now, setNow] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const listRef = React.useRef<HTMLUListElement>(null)
  const baseId = React.useId()
  const reassign = value ?? inner
  const { orphaned, live } = revokeRisks(owned, reassign, sessions, now, liveWithin)
  const suggested = assignees.find((a) => a.id === suggestedAssigneeId) ?? assignees[0]
  const say = { ...REVOKE_MESSAGES, ...messages }

  React.useEffect(() => {
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])

  const update = (next: Reassignment) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const assignAll = (id: string) => {
    update(Object.fromEntries(owned.map((item) => [item.id, reassign[item.id] || id])))
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    listRef.current?.querySelectorAll("select[data-warning]").forEach((el) =>
      el.animate([{ boxShadow: "0 0 0 3px rgb(16 185 129 / 0.45)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 400, easing: "ease-out" }),
    )
  }
  const confirm = async () => {
    if (pending) return
    setPending(true)
    try {
      await onConfirm(Object.fromEntries(owned.map((item) => [item.id, reassign[item.id] || null])))
    } catch {
      // The caller reports the error; the dialog stays open.
    } finally {
      setPending(false)
    }
  }
  const broken = integrations.filter((i) => i.breaks)
  const safe = integrations.filter((i) => !i.breaks)

  return (
    <section
      data-slot="revoke-access-preview"
      aria-labelledby={`${baseId}-title`}
      className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <h3 id={`${baseId}-title`} className="flex items-center gap-2 font-medium">
        <UserMinus aria-hidden className="size-4 shrink-0 text-muted-foreground" /> {title(name)}
      </h3>

      <div>
        <h4 className={heading}>{say.loseHeading}</h4>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {access.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>

      {owned.length > 0 && (
        <div>
          <h4 className={heading}>{say.ownHeading}</h4>
          <ul ref={listRef} className="divide-y rounded-md border">
            {owned.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                <label htmlFor={`${baseId}-${item.id}`} className="min-w-0 flex-1 basis-32 text-sm">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.kind}</span>
                </label>
                <select
                  id={`${baseId}-${item.id}`}
                  value={reassign[item.id] ?? ""}
                  onChange={(event) => update({ ...reassign, [item.id]: event.target.value || null })}
                  data-warning={!reassign[item.id] ? "" : undefined}
                  className={cn(select, "w-36")}
                >
                  <option value="">{unownedLabel}</option>
                  {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <div aria-live="polite" className="min-h-6 text-xs">
            {orphaned > 0 && (
              <p className="mt-1.5 flex gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="flex h-6 shrink-0 items-center">
                  <TriangleAlert aria-hidden className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <span className="py-1">{orphanText(orphaned)}</span>
                  {suggested && (
                    <button type="button" onClick={() => assignAll(suggested.id)} className={fix}>
                      {reassignAllLabel(suggested.name)}
                    </button>
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <div>
          <h4 className={heading}>{say.sessionsHeading}</h4>
          <ul className="space-y-1 text-sm">
            {sessions.map((s) => {
              const isLive = now > 0 && now - new Date(s.lastActive).getTime() < liveWithin
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <Monitor aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">{s.device}</span>
                  <span className={cn("shrink-0 text-xs tabular-nums", isLive ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    {isLive && <span aria-hidden className="mr-1 inline-block size-1.5 rounded-full bg-amber-500 align-middle motion-safe:animate-pulse" />}
                    {now ? (isLive ? say.inUse(say.ago(minutesSince(s.lastActive, now))) : say.ago(minutesSince(s.lastActive, now))) : ""}
                  </span>
                </li>
              )
            })}
          </ul>
          {live > 0 && <p className="mt-1.5 text-xs text-muted-foreground">{say.liveNote}</p>}
        </div>
      )}

      {integrations.length > 0 && (
        <div>
          <h4 className={heading}>{say.integrationsHeading}</h4>
          <ul className="space-y-1 text-sm">
            {[...broken, ...safe].map((i) => (
              <li key={i.name} className="flex gap-2">
                {i.breaks ? (
                  <Unplug aria-hidden className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <Plug aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <span className="min-w-0">
                  <span className="font-medium">{i.name}</span>
                  <span className="sr-only"> {i.breaks ? say.stops : say.keepsRunning}</span>
                  <span className="text-muted-foreground"> · {i.effect}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" disabled={pending} onClick={onCancel} className={cn(button, outline)}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          aria-busy={pending || undefined}
          onClick={() => void confirm()}
          className={cn(button, "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60 dark:hover:bg-destructive/70")}
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <KeyRound aria-hidden className="size-4" />}
          {pending ? pendingLabel : confirmLabel(name, orphaned)}
        </button>
      </div>
    </section>
  )
}
