"use client"

// Bollard UI — security-event-log · MIT licence · https://bollard-ui.vercel.app/components/security-event-log

import * as React from "react"
import { Fingerprint, KeyRound, KeySquare, LifeBuoy, LoaderCircle, LogIn, Mail, MonitorSmartphone, ShieldAlert, ShieldCheck, ShieldOff, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { dayKey, groupEvents, isRisky, LOCKOUT_TYPES, remediesFor, toTime, type EventGroup, type SecurityEvent, type SecurityRemedy } from "./events"

export { dayKey, groupEvents, isRisky, LOCKOUT_TYPES, remediesFor, RISKY_TYPES, toTime, type EventGroup, type SecurityEvent, type SecurityEventType, type SecurityRemedy } from "./events"

/** Every visible string. `{…}` placeholders are filled in. */
export const SECURITY_EVENT_MESSAGES = {
  heading: "Security activity",
  zone: "Times in {zone}",
  empty: "No security changes in this period.",
  today: "Today",
  yesterday: "Yesterday",
  type_password_changed: "Password changed",
  type_new_device: "New device signed in",
  type_two_factor_off: "2-step verification turned off",
  type_two_factor_on: "2-step verification turned on",
  type_recovery_changed: "Recovery email or phone changed",
  type_email_changed: "Account email changed",
  type_api_key_created: "New API key created",
  type_passkey_added: "Passkey added",
  type_sign_in: "Signed in",
  type_unknown: "Account change",
  thisDevice: "This device",
  approx: "{location} (approximate)",
  takeoverTitle: "This looks like someone taking over your account",
  takeoverBody: "A new device signed in, then {changes}, all within {span}.",
  burstTitle: "{count} sensitive changes within {span}",
  span_minutes: "{n} min",
  span_hours: "{n} h",
  notMe: "This wasn't me",
  noneMe: "None of this was me",
  wasMe: "It was me",
  confirmTitle: "Secure your account?",
  confirmIntro: "Choose what to undo now:",
  remedy_password_changed: "Ask for a new password",
  remedy_new_device: "Sign that device out",
  remedy_sign_in: "Sign that device out",
  remedy_two_factor_off: "Turn 2-step verification back on",
  remedy_two_factor_on: "Remove the new 2-step method",
  remedy_recovery_changed: "Put back your previous recovery details",
  remedy_email_changed: "Restore your previous account email",
  remedy_api_key_created: "Revoke the new API key",
  remedy_passkey_added: "Remove the new passkey",
  remedy_always: "Sign out everywhere except this device",
  requiredRemedy: "always done",
  chooseOne: "Pick at least one step.",
  secure: "Secure my account",
  cancel: "Cancel",
  reported: "Reported",
  confirmed: "Marked as you",
  reportedAnnounce: "Reported. Your account is being secured.",
  reportError: "Couldn't reach the server. Your account isn't secured yet. Try again.",
  confirmError: "Couldn't save that. Try again.",
  showMore: "Show {count} older",
}

export type SecurityEventMessages = typeof SECURITY_EVENT_MESSAGES

const ICONS: Record<string, LucideIcon> = {
  password_changed: KeyRound,
  new_device: MonitorSmartphone,
  two_factor_off: ShieldOff,
  two_factor_on: ShieldCheck,
  recovery_changed: LifeBuoy,
  email_changed: Mail,
  api_key_created: KeySquare,
  passkey_added: Fingerprint,
  sign_in: LogIn,
}

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const linkClass = "inline-flex min-h-6 items-center rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"

export interface SecurityEventLogProps extends Omit<React.ComponentProps<"section">, "onChange"> {
  /** Security events, any order. Entries without an id or a real time are skipped. */
  events: SecurityEvent[]
  /** The account's time zone. Days and times follow it, not the browser. Defaults to the device zone after mount. */
  timeZone?: string
  /** "Now" in epoch ms, for deterministic rendering. Read from the clock every minute when omitted. */
  now?: number
  /** Locale for dates and times. */
  locale?: string
  /** Risky changes this close together read as one incident. */
  windowMinutes?: number
  /** "This wasn't me": secure the account for these events with the steps the user kept ticked. May return a Promise; a rejection shows a retry. */
  onReport: (events: SecurityEvent[], remedies: SecurityRemedy[]) => void | Promise<void>
  /** Remedy keys that are always done and can't be unticked, e.g. ["sign_out_all"]. */
  requiredRemedies?: string[]
  /** "It was me". */
  onConfirm?: (events: SecurityEvent[]) => void | Promise<void>
  /** Events shown before "Show older". */
  limit?: number
  /** Any visible string. */
  messages?: Partial<SecurityEventMessages>
}

/**
 * Stops a takeover going unnoticed in a list of routine entries: risky changes from other devices are
 * highlighted, and when they come close together (a new device, then 2-step verification off, then a
 * new recovery email) they are grouped and named for what they are. Every row has a "This wasn't me"
 * path that lists each step it will take, and the user picks which ones. Times follow the account's zone, with relative time.
 */
export function SecurityEventLog({ events, timeZone: zoneProp, now: nowProp, locale, windowMinutes = 60, onReport, onConfirm, requiredRemedies = [], limit = 8, messages, className, ...props }: SecurityEventLogProps) {
  const t = { ...SECURITY_EVENT_MESSAGES, ...messages }
  const [clock, setClock] = React.useState<number>()
  const [deviceZone, setDeviceZone] = React.useState<string>()
  const [reported, setReported] = React.useState<Set<string>>(() => new Set())
  const [confirmed, setConfirmed] = React.useState<Set<string>>(() => new Set())
  const [open, setOpen] = React.useState<string>()
  const [chosen, setChosen] = React.useState<Set<string>>(() => new Set())
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [confirmFailed, setConfirmFailed] = React.useState<string>()
  const [announcement, setAnnouncement] = React.useState("")
  const [shown, setShown] = React.useState(limit)
  const rootRef = React.useRef<HTMLElement>(null)
  const headingId = React.useId()

  React.useEffect(() => {
    setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    if (nowProp !== undefined) return
    setClock(Date.now())
    const id = setInterval(() => setClock(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [nowProp])

  const timeZone = (() => {
    const zone = zoneProp ?? deviceZone
    try {
      if (zone) new Intl.DateTimeFormat("en", { timeZone: zone })
      return zone
    } catch {
      return deviceZone
    }
  })()
  const now = nowProp ?? clock
  const groups = groupEvents(events, windowMinutes)
  const zoneName = timeZone ? new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "long" }).formatToParts(0).find((p) => p.type === "timeZoneName")?.value : undefined

  const isDone = (e: SecurityEvent) => reported.has(e.id) || confirmed.has(e.id) || !!e.status
  const remedyLabel = (key: string) => (t as Record<string, string>)[key === "sign_out_all" ? "remedy_always" : key === "sign_out_device" ? "remedy_new_device" : `remedy_${key}`]
  const label = (e: SecurityEvent) => (t as Record<string, string>)[`type_${e.type}`] ?? e.title ?? t.type_unknown
  const clockText = (time: number) => !timeZone ? "" : new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(time)
  const fullText = (time: number) => new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "full", timeStyle: "long" }).format(time)
  const relative = (time: number) => {
    if (now === undefined) return ""
    const minutes = Math.round((time - now) / 60_000)
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute")
    if (Math.abs(minutes) < 1440) return rtf.format(Math.round(minutes / 60), "hour")
    return rtf.format(Math.round(minutes / 1440), "day")
  }
  const dayLabel = (time: number) => {
    // Until the zone is known (before mount, with no timeZone prop) no day or time is shown, so SSR matches.
    if (!timeZone) return ""
    const key = dayKey(time, timeZone)
    if (now !== undefined && key === dayKey(now, timeZone)) return t.today
    if (now !== undefined && key === dayKey(now - 86_400_000, timeZone)) return t.yesterday
    return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "numeric", month: "short" }).format(time)
  }
  const span = (g: EventGroup) => {
    const minutes = Math.max(1, Math.round((g.start - g.end) / 60_000))
    return minutes < 120 ? fill(t.span_minutes, { n: minutes }) : fill(t.span_hours, { n: Math.round(minutes / 60) })
  }

  const focusNext = () =>
    requestAnimationFrame(() => {
      const next = rootRef.current?.querySelector<HTMLElement>("[data-report]")
      ;(next ?? rootRef.current?.querySelector<HTMLElement>("h3") ?? rootRef.current)?.focus()
    })

  const openConfirm = (key: string, list: SecurityEvent[]) => {
    setOpen(key)
    setChosen(new Set(remediesFor(list).map((r) => r.key)))
    setError(undefined)
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-secure]")?.focus())
  }

  const cancel = (key: string) => {
    setOpen(undefined)
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-report="${CSS.escape(key)}"]`)?.focus())
  }

  const secure = async (list: SecurityEvent[]) => {
    const steps = remediesFor(list).filter((r) => chosen.has(r.key) || requiredRemedies.includes(r.key))
    if (pending || !steps.length) return
    setPending(true)
    setError(undefined)
    try {
      await onReport(list, steps)
      setReported((s) => new Set([...s, ...list.map((e) => e.id)]))
      setOpen(undefined)
      setAnnouncement(t.reportedAnnounce)
      focusNext()
    } catch {
      setError(t.reportError)
    } finally {
      setPending(false)
    }
  }

  const confirm = async (key: string, list: SecurityEvent[]) => {
    if (pending) return
    setPending(true)
    setConfirmFailed(undefined)
    try {
      await onConfirm?.(list)
      setConfirmed((s) => new Set([...s, ...list.map((e) => e.id)]))
      setOpen(undefined)
      focusNext()
    } catch {
      setConfirmFailed(key)
    } finally {
      setPending(false)
    }
  }

  const panel = (key: string, list: SecurityEvent[]) => {
    const remedies = remediesFor(list)
    const none = !remedies.some((r) => chosen.has(r.key) || requiredRemedies.includes(r.key))
    const titleId = `${headingId}-${key}`
    return (
      <div role="group" aria-labelledby={titleId} onKeyDown={(e) => e.key === "Escape" && !pending && (e.stopPropagation(), cancel(key))} className="mt-2 grid gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs text-foreground">
        <p id={titleId} className="text-sm font-medium">{t.confirmTitle}</p>
        <fieldset className="grid min-w-0 gap-1">
          <legend className="mb-1 text-muted-foreground">{t.confirmIntro}</legend>
          {remedies.map((r) => {
            const locked = requiredRemedies.includes(r.key)
            return (
              <label key={r.key} className="flex min-h-6 min-w-0 cursor-pointer items-start gap-2 rounded-sm has-[:disabled]:cursor-default has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
                <input
                  type="checkbox"
                  data-remedy={r.key}
                  checked={locked || chosen.has(r.key)}
                  disabled={locked || pending}
                  onChange={(ev) => {
                    const checked = ev.currentTarget.checked
                    setChosen((s) => {
                      const next = new Set(s)
                      if (checked) next.add(r.key)
                      else next.delete(r.key)
                      return next
                    })
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-red-600 outline-none"
                />
                <span className="min-w-0 break-words">
                  {remedyLabel(r.key)}
                  {locked && <span className="text-muted-foreground"> ({t.requiredRemedy})</span>}
                </span>
              </label>
            )
          })}
        </fieldset>
        {none && <p aria-live="polite" className="text-muted-foreground">{t.chooseOne}</p>}
        {error && <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" data-secure onClick={() => secure(list)} disabled={pending || none} aria-busy={pending} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-white transition-colors outline-none hover:bg-destructive/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60">
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {t.secure}
          </button>
          <button type="button" onClick={() => cancel(key)} disabled={pending} className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t.cancel}
          </button>
        </div>
      </div>
    )
  }

  const row = (e: SecurityEvent, inBurst: boolean) => {
    const time = toTime(e.at) as number
    const Icon = ICONS[e.type] ?? ShieldAlert
    const done = reported.has(e.id) || e.status === "reported" ? t.reported : confirmed.has(e.id) || e.status === "confirmed" ? t.confirmed : ""
    const risky = isRisky(e) && !done
    const meta = [e.device, e.location && fill(t.approx, { location: e.location }), e.detail].filter(Boolean).join(" · ")
    return (
      <li key={e.id} data-row className={cn("min-w-0", !inBurst && "rounded-md border p-3", !inBurst && risky && "border-amber-500/40")}>
        <div className="flex min-w-0 gap-2.5">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", risky ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-medium break-words">{label(e)}</span>
              <time dateTime={new Date(time).toISOString()} title={fullText(time)} className="text-xs text-muted-foreground tabular-nums">
                {clockText(time)}
                {relative(time) && ` · ${relative(time)}`}
              </time>
            </p>
            {(meta || e.thisDevice) && (
              <p className="text-xs break-words text-muted-foreground">
                {e.thisDevice && <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{t.thisDevice}</span>}
                {meta}
              </p>
            )}
            <p className="text-xs">
              {done ? (
                <span className="text-muted-foreground">{done}</span>
              ) : (
                <button type="button" data-report={e.id} onClick={() => openConfirm(e.id, [e])} disabled={pending} className={cn(linkClass, risky ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
                  {t.notMe}
                </button>
              )}
            </p>
            {open === e.id && panel(e.id, [e])}
          </div>
        </div>
      </li>
    )
  }

  // Cut on whole groups so an incident is never split by "Show older".
  let count = 0
  const visible = groups.filter((g) => (count < shown ? ((count += g.events.length), true) : false))
  const hidden = groups.slice(visible.length).reduce((n, g) => n + g.events.length, 0)
  let lastDay = ""

  return (
    <section ref={rootRef} data-slot="security-event-log" aria-labelledby={headingId} className={cn("grid w-full max-w-md min-w-0 gap-3 text-sm", className)} {...props}>
      <span aria-live="polite" className="sr-only">{announcement}</span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 id={headingId} tabIndex={-1} className="font-medium outline-none">{t.heading}</h3>
        {zoneName && <p className="text-xs text-muted-foreground">{fill(t.zone, { zone: zoneName })}</p>}
      </div>
      {!groups.length && <p className="text-muted-foreground">{t.empty}</p>}
      {visible.map((g) => {
        const day = dayLabel(g.start)
        const heading = day && day !== lastDay ? <p className="text-xs font-medium text-muted-foreground">{day}</p> : null
        lastDay = day
        const open_ = g.events.filter((e) => !isDone(e))
        const active = g.burst && open_.length > 0
        if (!g.burst) return <React.Fragment key={g.id}>{heading}<ul>{row(g.events[0], false)}</ul></React.Fragment>
        const changes = [...g.events].reverse().filter((e) => LOCKOUT_TYPES.has(e.type)).map((e) => label(e).replace(/^\p{Lu}(?!\p{Lu})/u, (c) => c.toLocaleLowerCase(locale)))
        return (
          <React.Fragment key={g.id}>
            {heading}
            <div data-burst className={cn("grid gap-2 rounded-md border p-3", active && "border-red-500/50 bg-red-500/5")}>
              {active && (
                <div className="flex gap-2 text-red-700 dark:text-red-400">
                  <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <div className="grid min-w-0 gap-0.5">
                    <p className="font-medium break-words">{g.takeover ? t.takeoverTitle : fill(t.burstTitle, { count: g.events.length, span: span(g) })}</p>
                    {g.takeover && <p className="text-xs break-words">{fill(t.takeoverBody, { changes: changes.join(", "), span: span(g) })}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs">
                      <button type="button" data-report={g.id + ":all"} onClick={() => openConfirm(g.id + ":all", open_)} disabled={pending} className={cn(linkClass, "underline")}>
                        {t.noneMe}
                      </button>
                      {onConfirm && (
                        <button type="button" onClick={() => confirm(g.id, open_)} disabled={pending} className={cn(linkClass, "text-muted-foreground")}>
                          {t.wasMe}
                        </button>
                      )}
                    </div>
                    {confirmFailed === g.id && <p role="alert" className="text-xs">{t.confirmError}</p>}
                    {open === g.id + ":all" && panel(g.id + ":all", open_)}
                  </div>
                </div>
              )}
              <ul className={cn("grid gap-3", active && "border-t border-red-500/20 pt-3")}>{g.events.map((e) => row(e, true))}</ul>
            </div>
          </React.Fragment>
        )
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => {
            const before = rootRef.current?.querySelectorAll("[data-row]").length ?? 0
            setShown((n) => n + limit)
            requestAnimationFrame(() => rootRef.current?.querySelectorAll<HTMLElement>("[data-row]")[before]?.querySelector<HTMLElement>("button")?.focus())
          }}
          className="inline-flex h-8 w-fit items-center rounded-md border px-3 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {fill(t.showMore, { count: hidden })}
        </button>
      )}
    </section>
  )
}
