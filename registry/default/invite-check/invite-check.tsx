"use client"

// Bollard UI — invite-check · MIT licence · https://bollard-ui.vercel.app/components/invite-check

import * as React from "react"
import { CalendarCheck, CalendarClock, CopyX, Globe, MapPinOff, Moon, TriangleAlert, Video } from "lucide-react"

import { cn } from "@/lib/utils"
import { wallClock, weekendFor } from "@/registry/default/send-time-check/send-time-check"

export interface InviteGuest {
  email: string
  name?: string
  /** Guest's IANA zone, e.g. "America/Los_Angeles". */
  timeZone: string
  /** Working hours in their zone, [start, end) in 24h hours. Defaults to [9, 18]. */
  workHours?: [number, number]
  /** Their weekend days (0 = Sunday). Defaults to the zone's usual weekend. */
  weekend?: number[]
}

export interface ExistingInvite {
  id: string
  title: string
  start: Date | number | string
  guests: string[]
}

/** Pluggable holiday source: return the holiday's name for a guest's local date (YYYY-MM-DD), or nothing. */
export type HolidayLookup = (guest: InviteGuest, localDate: string) => string | null | undefined

export type GuestFlag = "night" | "holiday" | "weekend" | "after-hours"
const WEIGHT: Record<GuestFlag, number> = { night: 3, holiday: 2, weekend: 2, "after-hours": 1 }

/** How a start time lands for one guest: their wall clock and the worst problem with it. */
export function guestTime(start: number, guest: InviteGuest, holidayFor?: HolidayLookup) {
  const local = wallClock(start, guest.timeZone)
  const [from, to] = guest.workHours ?? [9, 18]
  const h = local.hour + local.minute / 60
  const holiday = holidayFor?.(guest, local.date) ?? undefined
  const flag: GuestFlag | null =
    h >= 22 || h < 7 ? "night" : holiday ? "holiday" : (guest.weekend ?? weekendFor(guest.timeZone)).includes(local.weekday) ? "weekend" : h < from || h >= to ? "after-hours" : null
  return { local, flag, holiday }
}

/** Lowercase, drop +tags, and drop dots for Gmail, so a.sharma+cal@gmail.com equals asharma@gmail.com. */
export function normalizeEmail(email: string) {
  const [user = "", domain = ""] = email.trim().toLowerCase().split("@")
  const base = user.split("+")[0]
  return `${/^(gmail|googlemail)\.com$/.test(domain) ? base.replace(/\./g, "") : base}@${domain === "googlemail.com" ? "gmail.com" : domain}`
}

function distance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

export interface InviteCheckOptions {
  /** Your organisation's email domains. Guests elsewhere are marked external. */
  orgDomains?: string[]
  /** Invites already sent, to catch sending the same one twice. */
  existing?: ExistingInvite[]
  holidayFor?: HolidayLookup
}

/** Everything wrong with an invite before it goes out, plus the nearest start that works for everyone. */
export function checkInvite(start: number, guests: InviteGuest[], title: string, { orgDomains = [], existing = [], holidayFor }: InviteCheckOptions = {}) {
  const seen = new Map<string, string>()
  const reports = guests.map((guest) => {
    const domain = guest.email.split("@")[1]?.toLowerCase() ?? ""
    const external = orgDomains.length > 0 && !orgDomains.includes(domain)
    const lookalike = external ? orgDomains.find((d) => distance(domain, d) <= 2) : undefined
    const key = normalizeEmail(guest.email)
    const duplicateOf = seen.get(key)
    if (!duplicateOf) seen.set(key, guest.email)
    return { guest, external, lookalike, duplicateOf, ...guestTime(start, guest, holidayFor) }
  })
  const score = (ts: number) =>
    guests.reduce((sum, g) => {
      const flag = guestTime(ts, g, holidayFor).flag
      return sum + (flag ? WEIGHT[flag] : 0)
    }, 0)
  const current = score(start)
  let suggestion: number | null = null
  if (current > 0) {
    let best = current
    // Nearest first, later before earlier: +30 min, −30 min, +1 h … up to 48 h later or 24 h earlier.
    for (let i = 1; i < 192; i++) {
      const delta = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 30 * 60_000
      if (delta < -24 * 36e5) continue
      const s = score(start + delta)
      if (s < best) [best, suggestion] = [s, start + delta]
      if (best === 0) break
    }
  }
  const keys = new Set(guests.map((g) => normalizeEmail(g.email)))
  const sameTitle = (t: string) => t.trim().toLowerCase() === title.trim().toLowerCase()
  const duplicate = existing
    .map((e) => ({ ...e, shared: e.guests.filter((g) => keys.has(normalizeEmail(g))).length }))
    .find((e) => e.shared * 2 >= keys.size && (Math.abs(new Date(e.start).getTime() - start) <= 36e5 || sameTitle(e.title)))
  return { guests: reports, suggestion, suggestionFixesAll: suggestion !== null && score(suggestion) === 0, duplicate }
}

const clock = (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
const when = (ts: number, tz?: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).format(ts)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const FLAG_TEXT: Record<GuestFlag, string> = { night: "Night", holiday: "Holiday", weekend: "Weekend", "after-hours": "After hours" }

function Warning({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><Icon aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{children}</span>
    </p>
  )
}

export interface InviteCheckProps extends InviteCheckOptions, Omit<React.ComponentProps<"div">, "title"> {
  /** Event title, used to spot a re-sent invite. */
  title: string
  /** Start of the event. */
  start: Date | number | string
  /** People invited, each with an email and optional zone and hours. */
  guests: InviteGuest[]
  /** Meeting place, if any. */
  location?: string
  /** Video call link, if any. */
  videoLink?: string
  /** Your zone, for the suggested time. Defaults to the browser's. */
  timeZone?: string
  /** Move the event to the suggested start. */
  onReschedule?: (start: Date) => void
  /** Add a video link (Meet, Zoom, Teams…). */
  onAddVideoLink?: () => void
  /** Replace a guest's address, e.g. a typo'd company domain. */
  onFixGuest?: (email: string, next: string) => void
  /** Called with a guest's email to remove them. */
  onRemoveGuest?: (email: string) => void
  /** Open the invite this one duplicates. */
  onOpenExisting?: (id: string) => void
  /** Heading above the check. */
  heading?: string
  /** Shown when there is neither a location nor a video link. */
  noPlaceText?: string
  /** Button text to add a video link. */
  addVideoLabel?: string
  /** Shown when nothing needs attention. */
  allClearText?: string
}

/**
 * Stops an invite landing at 3 AM, on someone's holiday or weekend, at a typo'd company domain,
 * with nowhere to meet, or twice. It shows the start in every guest's own zone, finds the nearest
 * start that suits everyone and offers it in one tap, and catches duplicate guests hidden by
 * +tags or Gmail dots and invites you have already sent.
 */
export function InviteCheck({
  title, start: startProp, guests, location, videoLink, timeZone, orgDomains, existing, holidayFor,
  onReschedule, onAddVideoLink, onFixGuest, onRemoveGuest, onOpenExisting,
  heading = "Before you send",
  noPlaceText = "No video link or location: guests won't know where to join.",
  addVideoLabel = "Add video link",
  allClearText = "Works for everyone.",
  className,
  ...props
}: InviteCheckProps) {
  const [zone, setZone] = React.useState(timeZone)
  React.useEffect(() => setZone(timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone), [timeZone])
  const start = new Date(startProp).getTime()
  const result = React.useMemo(() => checkInvite(start, guests, title, { orgDomains, existing, holidayFor }), [start, guests, title, orgDomains, existing, holidayFor])
  const flagged = result.guests.filter((r) => r.flag)
  const worst = [...flagged].sort((a, b) => WEIGHT[b.flag!] - WEIGHT[a.flag!])[0]
  const place = (r: (typeof result.guests)[number]) => r.guest.timeZone.split("/").pop()?.replace(/_/g, " ")
  const issues = flagged.length + result.guests.filter((r) => r.lookalike || r.duplicateOf).length + Number(!location && !videoLink) + Number(!!result.duplicate)

  return (
    <div data-slot="invite-check" data-state={issues ? "issues" : "ok"} className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-invite-check-flash{from{background-color:rgb(16 185 129 / 0.3)}}"}</style>
      <div className="flex items-center gap-2">
        <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-sm font-medium">{heading}</p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {guests.length} guests · {issues ? `${issues} to check` : "all clear"}
        </span>
      </div>

      <ul aria-label="Start time for each guest" className="grid divide-y rounded-md border">
        {result.guests.map((r) => (
          <li key={r.guest.email} className="grid gap-1 px-3 py-2 text-sm">
            <span className="truncate font-medium" title={r.guest.email}>{r.guest.name ?? r.guest.email}</span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span key={start} className={cn("-ml-1 rounded-sm px-1 tabular-nums motion-safe:animate-[cui-invite-check-flash_400ms_ease-out]", r.flag ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                {new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: r.guest.timeZone }).format(start)} {clock(r.local.hour, r.local.minute)} · {place(r)}
              </span>
              {r.flag && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-800 dark:text-amber-300">
                  {r.flag === "night" ? <Moon aria-hidden className="size-3" /> : <CalendarClock aria-hidden className="size-3" />}
                  {r.holiday ?? FLAG_TEXT[r.flag]}
                </span>
              )}
              {r.external && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                  <Globe aria-hidden className="size-3" />
                  External · {r.guest.email.split("@")[1]}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div aria-live="polite" className="grid gap-1.5 text-xs">
        {worst && (
          <Warning icon={worst.flag === "night" ? Moon : CalendarClock}>
            <span className="py-1 tabular-nums">
              {clock(worst.local.hour, worst.local.minute)} for {worst.guest.name ?? worst.guest.email} in {place(worst)}
              {worst.holiday ? ` (${worst.holiday})` : ""}
              {flagged.length > 1 ? `, and ${flagged.length - 1} more outside their day.` : "."}
            </span>
            {result.suggestion !== null && (
              <button type="button" onClick={() => onReschedule?.(new Date(result.suggestion!))} className={fixClass}>
                Move to {when(result.suggestion, zone)}
                {!result.suggestionFixesAll && " (fewest clashes)"}
              </button>
            )}
          </Warning>
        )}
        {result.guests.map((r) =>
          r.duplicateOf ? (
            <Warning key={`d-${r.guest.email}`} icon={CopyX}>
              <span className="py-1">{r.guest.email} is the same inbox as {r.duplicateOf}.</span>
              <button type="button" onClick={() => onRemoveGuest?.(r.guest.email)} className={fixClass}>Remove duplicate</button>
            </Warning>
          ) : r.lookalike ? (
            <Warning key={`l-${r.guest.email}`} icon={TriangleAlert}>
              <span className="py-1">@{r.guest.email.split("@")[1]} looks like a typo of @{r.lookalike}.</span>
              <button type="button" onClick={() => onFixGuest?.(r.guest.email, `${r.guest.email.split("@")[0]}@${r.lookalike}`)} className={fixClass}>Use @{r.lookalike}</button>
            </Warning>
          ) : null,
        )}
        {!location && !videoLink && (
          <Warning icon={MapPinOff}>
            <span className="py-1">{noPlaceText}</span>
            {onAddVideoLink && (
              <button type="button" onClick={onAddVideoLink} className={fixClass}><Video aria-hidden className="size-3.5" />{addVideoLabel}</button>
            )}
          </Warning>
        )}
        {result.duplicate && (
          <Warning icon={CopyX}>
            <span className="py-1">
              You already sent &ldquo;{result.duplicate.title}&rdquo; for {when(new Date(result.duplicate.start).getTime(), zone)} to {result.duplicate.shared} of these guests.
            </span>
            {onOpenExisting && <button type="button" onClick={() => onOpenExisting(result.duplicate!.id)} className={fixClass}>Open it</button>}
          </Warning>
        )}
        {!issues && (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <CalendarCheck aria-hidden className="size-3.5" />
            {allClearText}
          </p>
        )}
      </div>
    </div>
  )
}
