"use client"

import * as React from "react"
import { LoaderCircle, LogOut, MapPin, Monitor, Smartphone, Tablet, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

const button =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const outline = "border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
const ICONS = { desktop: Monitor, phone: Smartphone, tablet: Tablet } as const

export interface Session {
  id: string
  /** What the user recognises, e.g. "Chrome on MacBook Pro". */
  device: string
  kind?: keyof typeof ICONS
  /** Approximate place from the IP, e.g. "Pune, India". */
  location: string
  /** Country code or name, used to flag sessions away from this device's country. */
  country?: string
  ip?: string
  lastActive: Date | number | string
  /** The session making this request. */
  current?: boolean
}

/** "Active now", "12 min ago", "3 days ago", localized. */
export function formatLastActive(at: Date | number | string, now: number, locale?: string, activeNow = "Active now") {
  const minutes = Math.round((now - new Date(at).getTime()) / 60_000)
  // A bad timestamp shows nothing rather than crashing the list.
  if (Number.isNaN(minutes)) return ""
  if (minutes < 3) return activeNow
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (minutes < 60) return rtf.format(-minutes, "minute")
  if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), "hour")
  return rtf.format(-Math.round(minutes / 1440), "day")
}

/** This device first, then the rest by most recent activity. */
export function sortSessions(sessions: Session[]) {
  const time = (s: Session) => new Date(s.lastActive).getTime()
  return [...sessions].sort((a, b) => Number(!!b.current) - Number(!!a.current) || time(b) - time(a))
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

export interface SessionListProps extends React.ComponentProps<"section"> {
  sessions: Session[]
  /** Ends one session. Return a promise to show a pending state; a rejection keeps the row. */
  onRevoke: (id: string) => void | Promise<void>
  /** Ends every session except the current one. Defaults to calling `onRevoke` for each. */
  onRevokeOthers?: (ids: string[]) => void | Promise<void>
  /** Locale for relative times. */
  locale?: string
  /** Templates: `{count}` is filled in. */
  title?: string
  thisDeviceLabel?: string
  activeNowLabel?: string
  revokeLabel?: string
  signOutHereLabel?: string
  revokeOthersLabel?: string
  currentWarning?: string
  confirmCurrentLabel?: string
  cancelLabel?: string
  awayText?: string
  approximateText?: string
  noOthersText?: string
  revokedText?: string
}

/**
 * Stops people signing themselves out by mistake while cleaning up sessions.
 * "Sign out all other sessions" never includes this device and names how many
 * it ends. Signing out the current session asks once, inline, with Cancel
 * focused. Sessions from another country than this device are flagged, and
 * locations are labelled approximate because IP geolocation often is.
 */
export function SessionList({
  sessions,
  onRevoke,
  onRevokeOthers,
  locale,
  title = "Where you're signed in",
  thisDeviceLabel = "This device",
  activeNowLabel = "Active now",
  revokeLabel = "Sign out",
  signOutHereLabel = "Sign out here",
  revokeOthersLabel = "Sign out all others ({count})",
  currentWarning = "This signs you out of this browser now. Anything unsaved here is lost.",
  confirmCurrentLabel = "Sign me out",
  cancelLabel = "Cancel",
  awayText = "Different country from this device. Don't recognise it? Sign it out.",
  approximateText = "Locations are approximate, based on IP address.",
  noOthersText = "You're only signed in on this device.",
  revokedText = "Done: {count} signed out.",
  className,
  ...props
}: SessionListProps) {
  const id = React.useId()
  const [now, setNow] = React.useState<number>()
  const [pending, setPending] = React.useState<string[]>([])
  const [confirming, setConfirming] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const hereRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const wasConfirming = React.useRef(false)
  React.useEffect(() => {
    // Focus moves into the warning, and back to "Sign out here" when it closes, so keyboard users never land on <body>.
    if (confirming) cancelRef.current?.focus()
    else if (wasConfirming.current) hereRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  const sorted = sortSessions(sessions)
  const current = sorted.find((s) => s.current)
  const others = sorted.filter((s) => !s.current).map((s) => s.id)

  const run = async (ids: string[], action: () => void | Promise<void>) => {
    setPending((list) => [...list, ...ids])
    try {
      await action()
      setStatus(fill(revokedText, { count: ids.length }))
    } catch {
      // The caller reports the error; the rows stay so the user can retry.
    } finally {
      setPending((list) => list.filter((x) => !ids.includes(x)))
    }
  }
  const revokeOthers = () =>
    run(others, onRevokeOthers ? () => onRevokeOthers(others) : () => Promise.all(others.map((x) => onRevoke(x))).then(() => undefined))

  return (
    <section data-slot="session-list" aria-labelledby={`${id}-title`} className={cn("grid w-full min-w-0 max-w-md gap-3 text-sm", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="font-medium">{title}</h3>
        {others.length > 0 ? (
          <button type="button" onClick={() => void revokeOthers()} disabled={others.every((x) => pending.includes(x))} className={cn(button, outline)}>
            <LogOut aria-hidden className="size-4" />
            {fill(revokeOthersLabel, { count: others.length })}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">{noOthersText}</span>
        )}
      </div>

      <ul className="divide-y rounded-lg border bg-card text-card-foreground shadow-xs">
        {sorted.map((session) => {
          const Icon = ICONS[session.kind ?? "desktop"]
          const busy = pending.includes(session.id)
          const away = !session.current && !!current?.country && !!session.country && session.country !== current.country
          return (
            <li key={session.id} data-current={session.current || undefined} aria-busy={busy || undefined} className={cn("grid gap-2 px-3 py-2.5 transition-opacity", busy && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", session.current ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <Icon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="flex flex-wrap items-center gap-x-2 font-medium">
                    <span className="truncate">{session.device}</span>
                    {session.current && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">{thisDeviceLabel}</span>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <MapPin aria-hidden className={cn("size-3.5", away && "text-amber-600 dark:text-amber-400")} />
                    {/* The dot ends the previous part, so a wrapped line never starts with one. */}
                    {[
                      { text: session.location },
                      { text: session.ip, mono: true },
                      { text: now === undefined ? "" : formatLastActive(session.lastActive, now, locale, activeNowLabel) },
                    ]
                      .filter((part) => part.text)
                      .map((part, i, parts) => (
                        <span key={i}><span className={cn(part.mono && "font-mono")}>{part.text}</span>{i < parts.length - 1 && " ·"}</span>
                      ))}
                  </p>
                </div>
                {!(session.current && confirming) && (
                  <button
                    ref={session.current ? hereRef : undefined}
                    type="button"
                    disabled={busy}
                    onClick={() => (session.current ? setConfirming(true) : void run([session.id], () => onRevoke(session.id)))}
                    className={cn(button, "ml-auto px-2.5", session.current ? "text-muted-foreground hover:bg-accent hover:text-foreground" : outline)}
                  >
                    {busy && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                    {session.current ? signOutHereLabel : revokeLabel}
                    <span className="sr-only">: {session.device}, {session.location}</span>
                  </button>
                )}
              </div>
              {away && (
                <p className="flex items-start gap-1.5 pl-11 text-xs text-amber-800 dark:text-amber-300">
                  <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                  {awayText}
                </p>
              )}
              {session.current && confirming && (
                <div role="group" aria-label={currentWarning} onKeyDown={(event) => event.key === "Escape" && setConfirming(false)} className="flex flex-wrap items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-red-950 dark:text-red-50">
                  <TriangleAlert aria-hidden className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="min-w-0 flex-1 basis-48 text-xs">{currentWarning}</p>
                  <div className="ml-auto flex gap-2">
                    <button ref={cancelRef} type="button" onClick={() => setConfirming(false)} className={cn(button, "border border-red-700/25 hover:bg-red-500/15 dark:border-red-300/25")}>{cancelLabel}</button>
                    <button type="button" onClick={() => { setConfirming(false); void run([session.id], () => onRevoke(session.id)) }} className={cn(button, "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300")}>{confirmCurrentLabel}</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{approximateText}</span>
        <span aria-live="polite" className="text-foreground">{status}</span>
      </p>
    </section>
  )
}
