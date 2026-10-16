"use client"

import * as React from "react"
import { LoaderCircle, Mail, Minus, Plus, TriangleAlert, Users } from "lucide-react"

import { cn } from "@/lib/utils"

type When = Date | number | string

export interface SeatMember {
  id: string
  name: string
  role: "owner" | "admin" | "member"
  /** Last activity; never-active members are suggested first. */
  lastActive?: When | null
  /** What they leave behind, e.g. "14 docs, 2 projects". */
  work?: string
}

export interface PendingInvite {
  id: string
  email: string
}

export interface SeatReduction {
  seats: number
  /** Members who lose access. */
  remove: string[]
  /** Invites cancelled to free seats. */
  cancelInvites: string[]
}

const timeOf = (d?: When | null) => (d == null ? -Infinity : new Date(d).getTime())

/**
 * Who to let go to fit `seats`: unaccepted invites first (nobody loses
 * access), then the least recently active plain members. Owners and admins
 * are never suggested.
 */
export function suggestRemovals(members: SeatMember[], invites: PendingInvite[], seats: number) {
  const needed = Math.max(0, members.length + invites.length - seats)
  const cancel = invites.slice(0, needed).map((i) => i.id)
  const remove = members
    .filter((m) => m.role === "member")
    .sort((a, b) => timeOf(a.lastActive) - timeOf(b.lastActive))
    .slice(0, needed - cancel.length)
    .map((m) => m.id)
  return { needed, ids: [...cancel, ...remove] }
}

const DAY = 86_400_000
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, k: string) => (k in values ? String(values[k]) : match))

/** Every sentence the component writes. `{…}` placeholders are filled in; `{ago}` is localized with `Intl.RelativeTimeFormat`. */
export const SEAT_REDUCE_MESSAGES = {
  title: "Seats",
  fewerLabel: "One seat fewer",
  moreLabel: "One seat more",
  countLabel: "Seat count",
  /** After the new price; `{date}` is when it starts. */
  billFrom: "from {date}.",
  keepUntil: "You keep {seats} seats until then.",
  chooseMore: "Choose {short} more to remove ({needed} needed)",
  chosen: "{needed} chosen. They lose access on {date}.",
  suggested: "Suggested",
  invite: "Invite not accepted · nobody loses access",
  neverActive: "never active",
  active: "active {ago}",
  ownerLocked: "The owner can’t be removed. Transfer ownership first.",
  nobodyChosen: "Nobody is chosen yet, so nobody loses access by accident.",
  chooseSuggested: "Choose suggested ({count})",
  adminFlag: "{name} is an admin and can no longer manage billing or members",
  activeFlag: "{name} was {activity}",
  unusedSeat: "1 unused seat goes. Nobody loses access.",
  unusedSeats: "{count} unused seats go. Nobody loses access.",
  cancel: "Cancel",
  chooseMoreButton: "Choose {short} more",
  lowerToOne: "Lower to 1 seat",
  lowerTo: "Lower to {seats} seats",
  owner: "Owner",
  admin: "Admin",
}
export type SeatReduceMessages = typeof SEAT_REDUCE_MESSAGES

const activity = (d: When | null | undefined, now: number, locale: string, t: SeatReduceMessages) => {
  if (d == null) return t.neverActive
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const m = Math.max(0, (now - new Date(d).getTime()) / 60_000)
  const ago = m < 60 ? relative.format(-Math.max(1, Math.round(m)), "minute") : m < 1440 ? relative.format(-Math.round(m / 60), "hour") : relative.format(-Math.round(m / 1440), "day")
  return fill(t.active, { ago })
}
const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
const step = "grid size-9 place-items-center rounded-md border bg-background shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:border-input dark:bg-input/30"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
const badge = { owner: "bg-primary text-primary-foreground", admin: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", member: "" }

export interface SeatReduceProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "title"> {
  /** Seats paid for today. */
  seats: number
  /** New seat count. Controlled. */
  value?: number
  /** Starting seat count when uncontrolled. */
  defaultValue?: number
  /** Called with the new seat count. */
  onValueChange?: (seats: number) => void
  /** Current members, with role, last activity and work summary. */
  members: SeatMember[]
  /** Unaccepted invites; they hold seats too. */
  invites?: PendingInvite[]
  /** Price per seat per period. */
  pricePerSeat: number
  /** ISO 4217 code. */
  currency?: string
  /** Locale for money and dates. */
  locale?: string
  /** e.g. "month". */
  period?: string
  /** When the new bill (and the loss of access) starts. */
  renewsAt: When
  /** What happens to a removed member's work. */
  workFate?: (work: string) => string
  /** A returned promise shows a pending state; a rejection is caught. */
  onConfirm: (reduction: SeatReduction) => void | Promise<void>
  /** Called when the user cancels. */
  onCancel?: () => void
  /** Overrides any of the sentences in `SEAT_REDUCE_MESSAGES`, e.g. to translate them. */
  messages?: Partial<SeatReduceMessages>
}

/**
 * Lowering a team's seat count without silently cutting someone off: you
 * choose who goes, unaccepted invites and the least active members are
 * suggested (never the owner or admins), choosing an admin or someone active
 * today is called out, and the new bill, the date it starts and what happens
 * to each person's work are shown before you confirm.
 */
export function SeatReduce({
  seats,
  value,
  defaultValue = seats,
  onValueChange,
  members,
  invites = [],
  pricePerSeat,
  currency = "USD",
  locale = "en-US",
  period = "month",
  renewsAt,
  workFate = (work) => `${work} stay in the workspace, owned by you`,
  onConfirm,
  onCancel,
  messages,
  className,
  ...props
}: SeatReduceProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [chosen, setChosen] = React.useState<string[]>([])
  const [now, setNow] = React.useState(0)
  const [pending, setPending] = React.useState(false)
  const billRef = React.useRef<HTMLSpanElement>(null)
  const firstTarget = React.useRef(true)
  const baseId = React.useId()
  const target = value ?? inner
  const t = { ...SEAT_REDUCE_MESSAGES, ...messages }
  const ago = (d: When | null | undefined) => activity(d, now, locale, t)
  // The field keeps what's typed (even empty) and commits a clamped number on blur or Enter.
  const [draft, setDraft] = React.useState<string>()
  const { needed, ids: suggested } = suggestRemovals(members, invites, target)
  const picked = chosen.slice(0, needed)
  const short = needed - picked.length
  const money = (n: number) => n.toLocaleString(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 })
  const date = new Date(renewsAt).toLocaleDateString(locale, { day: "numeric", month: "short" })
  const flagged = members.filter((m) => picked.includes(m.id) && (m.role === "admin" || (now && now - timeOf(m.lastActive) < DAY)))

  React.useEffect(() => setNow(Date.now()), [])
  React.useEffect(() => {
    if (firstTarget.current) return void (firstTarget.current = false)
    if (!billRef.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return
    billRef.current.animate([{ backgroundColor: "rgb(16 185 129 / .25)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" })
  }, [target])

  const setTarget = (n: number) => {
    const next = Math.min(seats, Math.max(1, Math.round(n) || 1))
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...picked, id]))
  const confirm = async () => {
    if (pending || short > 0) return
    setPending(true)
    try {
      await onConfirm({ seats: target, remove: picked.filter((id) => members.some((m) => m.id === id)), cancelInvites: picked.filter((id) => invites.some((i) => i.id === id)) })
    } catch {
      // The caller reports the error; the dialog stays open.
    } finally {
      setPending(false)
    }
  }

  const row = (id: string, label: React.ReactNode, meta: string, extra?: React.ReactNode, locked?: string) => {
    const on = picked.includes(id)
    const full = !on && short <= 0
    return (
      <li key={id} className={cn("flex gap-3 px-3 py-2 text-sm transition-colors", on && "bg-red-500/5")}>
        <input id={`${baseId}-${id}`} type="checkbox" checked={on} disabled={!!locked || full} onChange={() => toggle(id)} aria-describedby={`${baseId}-${id}-meta`} className="mt-0.5 size-4 shrink-0 accent-red-600 disabled:opacity-40" />
        <label htmlFor={`${baseId}-${id}`} className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{label}</span>
            {suggested.includes(id) && !on && <span className="rounded-full border border-dashed px-1.5 text-[11px] text-muted-foreground">{t.suggested}</span>}
          </span>
          <span id={`${baseId}-${id}-meta`} className="block text-xs text-muted-foreground">{locked ?? meta}</span>
          {on && extra}
        </label>
      </li>
    )
  }

  return (
    <section data-slot="seat-reduce" aria-labelledby={`${baseId}-title`} className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`${baseId}-title`} className="flex items-center gap-2 font-medium">
          <Users aria-hidden className="size-4 shrink-0 text-muted-foreground" /> {t.title}
        </h3>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label={t.fewerLabel} disabled={target <= 1} onClick={() => setTarget(target - 1)} className={step}><Minus aria-hidden className="size-4" /></button>
          <input
            aria-label={t.countLabel}
            inputMode="numeric"
            value={draft ?? target}
            onChange={(e) => {
              const text = e.target.value.replace(/\D/g, "")
              setDraft(text)
              if (text && Number(text) >= 1 && Number(text) <= seats) setTarget(Number(text))
            }}
            onBlur={() => {
              if (draft) setTarget(Number(draft))
              setDraft(undefined)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur()
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
                setDraft(undefined)
                setTarget(target + (e.key === "ArrowUp" ? 1 : -1))
              }
            }}
            className="h-9 w-14 rounded-md border bg-transparent px-2 text-center text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30" />
          <button type="button" aria-label={t.moreLabel} disabled={target >= seats} onClick={() => setTarget(target + 1)} className={step}><Plus aria-hidden className="size-4" /></button>
        </div>
      </div>

      <p className="text-sm">
        {target < seats && <span className="text-muted-foreground line-through">{money(seats * pricePerSeat)}</span>}{" "}
        <span ref={billRef} className="rounded px-0.5 font-medium tabular-nums">{money(target * pricePerSeat)}/{period}</span>
        <span className="text-muted-foreground"> {fill(t.billFrom, { date })} </span>
        {target < seats && <span className="text-muted-foreground">{fill(t.keepUntil, { seats })}</span>}
      </p>

      {needed > 0 ? (
        <div>
          <p aria-live="polite" className="mb-1.5 text-xs font-medium text-muted-foreground">
            {short > 0 ? fill(t.chooseMore, { short, needed }) : fill(t.chosen, { needed, date })}
          </p>
          <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
            {invites.map((i) => row(i.id, <span className="inline-flex items-center gap-1.5"><Mail aria-hidden className="size-3.5 text-muted-foreground" />{i.email}</span>, t.invite))}
            {members.map((m) =>
              row(
                m.id,
                <>{m.name}{m.role !== "member" && <span className={cn("ml-2 rounded-full px-1.5 text-[11px] font-medium", badge[m.role])}>{t[m.role]}</span>}</>,
                now ? ago(m.lastActive) : "\u00a0",
                m.work && <span className="block text-xs text-red-700 dark:text-red-400">{workFate(m.work)}</span>,
                m.role === "owner" ? t.ownerLocked : undefined,
              ),
            )}
          </ul>
          <div aria-live="polite" className="min-h-6 text-xs">
            {short > 0 && suggested.length > 0 && picked.length === 0 ? (
              <p className="mt-1.5 flex gap-1.5 text-amber-700 dark:text-amber-400">
                <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <span className="py-1">{t.nobodyChosen}</span>
                  <button type="button" onClick={() => setChosen(suggested)} className={fix}>{fill(t.chooseSuggested, { count: suggested.length })}</button>
                </span>
              </p>
            ) : flagged.length > 0 && (
              <p className="mt-1.5 flex gap-1.5 text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                <span>
                  {flagged.map((m) => fill(m.role === "admin" ? t.adminFlag : t.activeFlag, { name: m.name, activity: ago(m.lastActive) })).join("; ")}.
                </span>
              </p>
            )}
          </div>
        </div>
      ) : (
        target < seats && <p className="text-sm text-emerald-700 dark:text-emerald-400">{fill(seats - target === 1 ? t.unusedSeat : t.unusedSeats, { count: seats - target })}</p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <button type="button" disabled={pending} onClick={onCancel} className={cn(button, "border bg-background hover:bg-accent dark:border-input dark:bg-input/30")}>{t.cancel}</button>}
        <button type="button" aria-disabled={short > 0 || target === seats || undefined} aria-busy={pending || undefined} onClick={() => target !== seats && void confirm()}
          className={cn(button, picked.some((id) => members.some((m) => m.id === id)) ? "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {short > 0 ? fill(t.chooseMoreButton, { short }) : target === 1 ? t.lowerToOne : fill(t.lowerTo, { seats: target })}
        </button>
      </div>
    </section>
  )
}
