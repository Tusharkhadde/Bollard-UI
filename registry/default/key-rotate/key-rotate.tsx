"use client"

// Bollard UI — key-rotate · MIT licence · https://bollard-ui.vercel.app/components/key-rotate

import * as React from "react"
import { CircleCheck, Clock, KeyRound, LoaderCircle, OctagonX, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

type When = Date | number | string

export interface KeyClient {
  id: string
  /** e.g. "Billing worker". */
  name: string
  /** Last request made with the old key, if any. */
  lastUsedOld?: When | null
  /** Last request made with the new key, if any. */
  lastUsedNew?: When | null
  /** How often it calls (ms), for jobs that run rarely, like a weekly export. */
  every?: number
}

/** `switched`: seen on the new key. `old`: still on the old key. `late`: next call lands after the old key expires, so nobody will see it switch in time. */
export type ClientStatus = "switched" | "old" | "late" | "idle"

const ms = (d?: When | null) => (d == null ? null : new Date(d).getTime())

/** When a client with a known rhythm will call next. */
export function nextCall(client: KeyClient, now: number) {
  const last = Math.max(ms(client.lastUsedOld) ?? -Infinity, ms(client.lastUsedNew) ?? -Infinity)
  if (!client.every || !Number.isFinite(last)) return null
  return last + Math.max(1, Math.ceil((now - last) / client.every)) * client.every
}

export function clientStatus(client: KeyClient, now: number, expiresAt: number): ClientStatus {
  const oldAt = ms(client.lastUsedOld)
  const newAt = ms(client.lastUsedNew)
  if (newAt != null && (oldAt == null || newAt >= oldAt)) return "switched"
  const next = nextCall(client, now)
  if (next != null && next > expiresAt) return "late"
  return oldAt != null ? "old" : "idle"
}

/** The shortest offered window that lets every rarely-calling client call at least once before expiry (with an hour to spare). */
export function suggestOverlap(clients: KeyClient[], now: number, start: number, options: number[]) {
  const latest = Math.max(...clients.filter((c) => clientStatus(c, now, Infinity) !== "switched").map((c) => nextCall(c, now) ?? 0), 0)
  return [...options].sort((a, b) => a - b).find((o) => start + o >= latest + 3_600_000) ?? null
}

/** The most recent request made with the old key. */
export function lastOldUse(clients: KeyClient[]) {
  return clients.reduce<{ client: KeyClient; at: number } | null>((best, c) => {
    const at = ms(c.lastUsedOld)
    return at != null && (!best || at > best.at) ? { client: c, at } : best
  }, null)
}

/** Every user-visible string. Durations come in as ms plus a ready-made `duration` text. */
export const KEY_ROTATE_MESSAGES = {
  duration: (ms: number) =>
    ms < 60_000 ? "under a minute" : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : ms < 172_800_000 ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / 86_400_000)} days`,
  ago: (duration: string, ms: number) => (ms < 60_000 ? "just now" : `${duration} ago`),
  title: (keyName: string, started: boolean) => (started ? `Rotating ${keyName}` : `Rotate ${keyName}?`),
  overlapLegend: "Keep the old key working for",
  option: (overlap: number, duration: string) => (overlap ? duration : "Now"),
  bothWork: (until: string) => `Old and new keys both work until ${until}.`,
  cutImmediately: "The old key stops working the moment the new one is issued.",
  expired: "The old key has expired.",
  expiresIn: (left: string, at: string) => `Old key expires in ${left}, ${at}.`,
  switchedCount: (switched: number, total: number) => `${switched} of ${total} clients have switched.`,
  clientsHeading: "Clients using this key",
  onNew: (ago: string) => `On new key · ${ago}`,
  lateCall: (day: string) => `Next call ${day}, after expiry`,
  lastUsed: (ago: string) => `Last used · ${ago}`,
  stillOld: (ago: string) => `Still on old key · ${ago}`,
  notUsed: "Not used yet",
  lateWarning: (names: string[]) => `${names.join(", ")} won’t call before the old key expires, so you can’t see ${names.length === 1 ? "it" : "them"} switch.`,
  inUse: (client: string, ago: string, quietFor: string) =>
    `${client} used the old key ${ago}. Cutting it off now breaks every client not on the new key; wait until it has been unused for ${quietFor}.`,
  extend: (duration: string, _overlap: number) => `Extend to ${duration}`,
  rotate: (overlap: number): string => (overlap ? "Rotate key" : "Rotate and expire old key"),
  revoke: "Revoke old key now",
  leaked: "This key leaked. Cut it off even though that breaks clients.",
}
export type KeyRotateMessages = typeof KEY_ROTATE_MESSAGES

const button =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none transition-[color,background-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-busy:cursor-progress aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
const fix =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
const tone = { switched: "text-emerald-700 dark:text-emerald-400", old: "text-muted-foreground", late: "text-amber-700 dark:text-amber-400", idle: "text-muted-foreground" }

export interface KeyRotateProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "title"> {
  /** e.g. "Production secret key". */
  keyName: string
  /** Who calls with this key and when they last did. */
  clients: KeyClient[]
  /** Overlap window in ms (0 = the old key stops working immediately). Controlled. */
  value?: number
  /** Initial overlap window in ms when uncontrolled. */
  defaultValue?: number
  /** Called with the chosen overlap window in ms. */
  onValueChange?: (overlap: number) => void
  /** Windows to offer, in ms. */
  options?: number[]
  /** When the new key was issued. Set it once rotation has started to show the overlap phase. */
  rotatedAt?: When
  /** The old key must go unused this long (ms) before it can be cut off immediately. */
  quietFor?: number
  /** Starts the rotation with the chosen window. A returned promise shows a pending state; a rejection is caught. */
  onRotate: (overlap: number) => void | Promise<void>
  /** Revokes the old key during the overlap. */
  onRevokeOld?: () => void | Promise<void>
  /** BCP 47 locale for dates and times. Defaults to the viewer's. */
  locale?: string
  /** Every visible string (see `KEY_ROTATE_MESSAGES`). The single-string props below still work and win. */
  messages?: Partial<KeyRotateMessages>
  /** @deprecated Use `messages.option`. */
  optionLabel?: (overlap: number) => string
  /** @deprecated Use `messages.rotate`. */
  rotateLabel?: (overlap: number) => string
  /** @deprecated Use `messages.revoke`. */
  revokeLabel?: string
  /** @deprecated Use `messages.leaked`. */
  leakedLabel?: string
  /** @deprecated Use `messages.extend`. */
  extendLabel?: (overlap: number) => string
}

/**
 * Key rotation with an overlap window instead of a hard cut-over: old and new
 * keys both work until a stated time, each client shows whether it has been
 * seen on the new key, jobs that won't call again before expiry are flagged
 * with a one-tap longer window, and cutting the old key off now is blocked
 * while it is still in use, unless you say the key leaked.
 */
export function KeyRotate({
  keyName,
  clients,
  value,
  defaultValue = 86_400_000,
  onValueChange,
  options = [0, 3_600_000, 86_400_000, 604_800_000],
  rotatedAt,
  quietFor = 3_600_000,
  onRotate,
  onRevokeOld,
  locale,
  messages,
  optionLabel,
  rotateLabel,
  revokeLabel,
  leakedLabel,
  extendLabel,
  className,
  ...props
}: KeyRotateProps) {
  const t: KeyRotateMessages = {
    ...KEY_ROTATE_MESSAGES,
    ...messages,
    ...(optionLabel && { option: (o: number) => optionLabel(o) }),
    ...(rotateLabel && { rotate: rotateLabel }),
    ...(revokeLabel !== undefined && { revoke: revokeLabel }),
    ...(leakedLabel !== undefined && { leaked: leakedLabel }),
    ...(extendLabel && { extend: (_d: string, o: number) => extendLabel(o) }),
  }
  const span = t.duration
  const ago = (d: number) => t.ago(span(d), d)
  const stamp = (at: number) => new Date(at).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  const day = (at: number) => new Date(at).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
  const [inner, setInner] = React.useState(defaultValue)
  const [now, setNow] = React.useState(0)
  const [leaked, setLeaked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const baseId = React.useId()
  const overlap = value ?? inner
  const started = ms(rotatedAt)
  const start = started ?? now
  const expiresAt = start + overlap

  React.useEffect(() => {
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(tick)
  }, [])

  const setOverlap = (next: number) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  // With no overlap there is no window to switch in, so "after expiry" says nothing new.
  const statuses = clients.map((c) => {
    const s = clientStatus(c, now, expiresAt)
    return s === "late" && !overlap ? "old" : s
  })
  const late = now ? clients.filter((_, i) => statuses[i] === "late") : []
  const switched = statuses.filter((s) => s === "switched").length
  const suggested = late.length ? suggestOverlap(clients, now, start, options) : null
  const recent = lastOldUse(clients)
  const busy = !!recent && now - recent.at < quietFor
  const cutting = started == null ? overlap === 0 : true
  const blocked = cutting && busy && !leaked

  const run = async (action?: () => void | Promise<void>) => {
    if (pending || blocked || !action) return
    setPending(true)
    try {
      await action()
    } catch {
      // The caller reports the error; the panel stays usable.
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      data-slot="key-rotate"
      aria-labelledby={`${baseId}-title`}
      className={cn("w-full max-w-md space-y-4 rounded-xl border bg-card p-4 text-card-foreground sm:p-5", className)}
      {...props}
    >
      <style>{"@keyframes cui-key-rotate-flash{from{background-color:rgb(16 185 129 / .18)}}"}</style>
      <h3 id={`${baseId}-title`} className="flex items-center gap-2 font-medium">
        <KeyRound aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        {t.title(keyName, started != null)}
      </h3>

      {started == null ? (
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{t.overlapLegend}</legend>
          <div className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
            {options.map((o) => (
              <label key={o} className="relative flex h-7 cursor-pointer items-center justify-center rounded-md text-xs font-medium text-muted-foreground transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                <input type="radio" name={`${baseId}-overlap`} checked={overlap === o} onChange={() => setOverlap(o)} className="sr-only" />
                {t.option(o, span(o))}
              </label>
            ))}
          </div>
          <p className="text-sm">{now ? (overlap ? t.bothWork(stamp(expiresAt)) : t.cutImmediately) : "\u00a0"}</p>
        </fieldset>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm">
            {now >= expiresAt ? t.expired : t.expiresIn(span(expiresAt - now), stamp(expiresAt))}{" "}
            <span className="text-muted-foreground">{t.switchedCount(switched, clients.length)}</span>
          </p>
          <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/70 motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out" style={{ width: `${overlap ? Math.max(0, Math.min(1, (expiresAt - now) / overlap)) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">{t.clientsHeading}</h4>
        <ul aria-live="polite" className="divide-y rounded-md border">
          {clients.map((c, i) => {
            const s = statuses[i]
            const next = nextCall(c, now)
            const seen = s === "switched" ? ms(c.lastUsedNew) : ms(c.lastUsedOld)
            const text = !now ? "" : s === "switched" ? t.onNew(ago(now - (seen ?? now)))
              : s === "late" ? t.lateCall(day(next ?? 0))
              : seen != null ? (started == null ? t.lastUsed : t.stillOld)(ago(now - seen)) : t.notUsed
            return (
              <li key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm", s === "switched" && started != null && "motion-safe:animate-[cui-key-rotate-flash_400ms_ease-out]")}>
                <span className="min-w-0 flex-1 basis-36 truncate font-medium">{c.name}</span>
                <span className={cn("flex shrink-0 items-center gap-1 text-xs tabular-nums", tone[s])}>
                  {s === "switched" ? <CircleCheck aria-hidden className="size-3.5" /> : s === "late" ? <TriangleAlert aria-hidden className="size-3.5" /> : <Clock aria-hidden className="size-3.5" />}
                  {text}
                </span>
              </li>
            )
          })}
        </ul>
        <div aria-live="polite" className="min-h-6 text-xs">
          {late.length > 0 && overlap > 0 && (
            <p className="mt-1.5 flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">{t.lateWarning(late.map((c) => c.name))}</span>
                {suggested != null && suggested > overlap && (
                  <button type="button" onClick={() => setOverlap(suggested)} className={fix}>{t.extend(span(suggested), suggested)}</button>
                )}
              </span>
            </p>
          )}
        </div>
      </div>

      {cutting && busy && recent && (
        <div role={blocked ? "alert" : undefined} className="space-y-2 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/60 dark:text-red-200">
          <p className="flex gap-2">
            <OctagonX aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              {t.inUse(recent.client.name, ago(now - recent.at), span(quietFor))}
            </span>
          </p>
          <label className="flex items-start gap-2 pl-6 text-xs">
            <input type="checkbox" checked={leaked} onChange={(e) => setLeaked(e.target.checked)} className="mt-px size-3.5 accent-red-600" />
            {t.leaked}
          </label>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end">
        {started == null ? (
          <button type="button" aria-disabled={blocked || undefined} aria-busy={pending || undefined} onClick={() => void run(() => onRotate(overlap))}
            className={cn(button, overlap ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60")}>
            {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {t.rotate(overlap)}
          </button>
        ) : (
          onRevokeOld && (
            <button type="button" aria-disabled={blocked || undefined} aria-busy={pending || undefined} onClick={() => void run(onRevokeOld)}
              className={cn(button, "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60")}>
              {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {t.revoke}
            </button>
          )
        )}
      </div>
    </section>
  )
}
