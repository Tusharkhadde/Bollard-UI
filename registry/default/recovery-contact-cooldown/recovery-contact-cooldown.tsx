"use client"

// Bollard UI — recovery-contact-cooldown · MIT licence · https://bollard-ui.vercel.app/components/recovery-contact-cooldown

import * as React from "react"
import { CircleCheck, Hourglass, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

export type DateInput = Date | string | number

/** Milliseconds since epoch, or undefined for anything that isn't a real date. */
export function toTime(input: DateInput | undefined): number | undefined {
  if (input === undefined || input === null || input === "") return undefined
  const ms = input instanceof Date ? input.getTime() : typeof input === "number" ? input : Date.parse(input)
  return Number.isFinite(ms) ? ms : undefined
}

/** "t•••r@gmail.com" or "•••• 8781", enough to recognise without exposing it. */
export function maskContact(contact: string, kind: "email" | "phone" = contact.includes("@") ? "email" : "phone"): string {
  const value = contact.trim()
  if (kind === "email") {
    const at = value.lastIndexOf("@")
    if (at < 1) return value
    const local = value.slice(0, at)
    return `${local[0]}•••${local.length > 2 ? local[local.length - 1] : ""}${value.slice(at)}`
  }
  const digits = value.replace(/\D/g, "")
  return digits.length > 4 ? `•••• ${digits.slice(-4)}` : value
}

/** Default text. `{kind}`, `{next}`, `{previous}`, `{when}`, `{d}`, `{h}`, `{m}`, `{s}` are filled in. */
export const RECOVERY_COOLDOWN_MESSAGES = {
  email: "recovery email",
  phone: "recovery phone",
  pendingTitle: "Your {kind} is changing",
  pendingBody: "It changes to {next} in",
  pendingBodyNoTime: "It changes to {next} soon.",
  when: "Takes effect {when}.",
  oldStillWorks: "Until then, codes still go to {previous}.",
  notified: "We've also told {previous} about this change.",
  urgent: "Less than an hour left to cancel.",
  cancel: "Cancel change",
  cancelling: "Cancelling…",
  report: "This wasn't me",
  cancelled: "Change cancelled. Your {kind} stays {previous}.",
  cancelledNoPrevious: "Change cancelled. Your {kind} wasn't changed.",
  applied: "Your {kind} is now {next}.",
  secure: "Wasn't you? Secure your account",
  cancelError: "Couldn't cancel the change. Try again.",
  days: "{d}d {h}h",
  hours: "{h}h {m}m",
  minutes: "{m}m {s}s",
  seconds: "{s}s",
}

export type RecoveryCooldownMessages = typeof RECOVERY_COOLDOWN_MESSAGES
export type RecoveryCooldownStatus = "pending" | "cancelled" | "applied"

const fill = (s: string, d: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(d[k] ?? m))
const HOUR = 3_600_000

/** "47h 12m", "6d 4h", "12m 30s" or "8s". */
export function formatRemaining(ms: number, t: Pick<RecoveryCooldownMessages, "days" | "hours" | "minutes" | "seconds"> = RECOVERY_COOLDOWN_MESSAGES): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0
  const d = Math.floor(total / 86400)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (total >= 72 * 3600) return fill(t.days, { d, h: h % 24 })
  if (total >= 3600) return fill(t.hours, { h, m })
  return total >= 60 ? fill(t.minutes, { m, s: total % 60 }) : fill(t.seconds, { s: total })
}

export interface RecoveryContactCooldownProps extends React.ComponentProps<"section"> {
  /** Which recovery method is changing. */
  kind?: "email" | "phone"
  /** The current contact, which keeps working during the hold. */
  previous?: string
  /** The contact it is changing to. */
  next: string
  /** Whether the old contact was sent a notice about the change. Turn off if your backend doesn't send one, so the card never claims it did. */
  previousNotified?: boolean
  /** Mask both contacts (t•••r@gmail.com). */
  mask?: boolean
  /** When the change was requested. */
  requestedAt?: DateInput
  /** When it takes effect. Defaults to requestedAt + delayHours. */
  effectiveAt?: DateInput
  /** Length of the hold in hours, when effectiveAt isn't given. */
  delayHours?: number
  /** A fixed clock, for tests and server rendering. Ticks every second when omitted. */
  now?: DateInput
  /** Controlled status. Pending turns into applied by itself when the time is up. */
  status?: RecoveryCooldownStatus
  /** Starting status when uncontrolled. */
  defaultStatus?: RecoveryCooldownStatus
  /** Called when the status changes (cancelled, applied). */
  onStatusChange?: (status: RecoveryCooldownStatus) => void
  /** Cancels the change on the server. May return a Promise; a rejection shows an error. */
  onCancel?: () => void | Promise<void>
  /** "This wasn't me": start securing the account (new password, sign out everywhere). */
  onReport?: () => void
  /** Called once when the hold ends and the change takes effect. */
  onElapsed?: () => void
  /** Formats the effective time. */
  formatWhen?: (date: Date) => string
  /** Override any visible or announced text. */
  messages?: Partial<RecoveryCooldownMessages>
}

/**
 * Shown while a recovery email or phone change is on hold. An attacker who got
 * in swaps the recovery contact first, so the owner can't take the account
 * back; the hold gives the owner time to notice. This makes the hold visible:
 * where it's changing to, a draining countdown, that codes still go to the old
 * contact, and a one-tap cancel plus a "this wasn't me" path.
 */
export function RecoveryContactCooldown({
  kind = "email",
  previous,
  next,
  previousNotified = true,
  mask = true,
  requestedAt,
  effectiveAt,
  delayHours = 48,
  now,
  status,
  defaultStatus = "pending",
  onStatusChange,
  onCancel,
  onReport,
  onElapsed,
  formatWhen = (date) => date.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
  messages,
  className,
  ...props
}: RecoveryContactCooldownProps) {
  const t = { ...RECOVERY_COOLDOWN_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultStatus)
  const [clock, setClock] = React.useState<number | undefined>(undefined)
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const resultRef = React.useRef<HTMLDivElement>(null)
  const moveFocus = React.useRef(false)
  const titleId = React.useId()

  const fixed = toTime(now)
  const start = toTime(requestedAt)
  const hours = Number.isFinite(delayHours) && delayHours > 0 ? delayHours : 48
  const end = toTime(effectiveAt) ?? (start !== undefined ? start + hours * HOUR : undefined)
  const current = fixed ?? clock
  const remaining = end !== undefined && current !== undefined ? end - current : undefined
  const chosen = status ?? inner
  const ended = remaining !== undefined && remaining <= 0
  // A cancel still in flight keeps the card pending, so it never reads "now changed" and then "cancelled".
  const shown: RecoveryCooldownStatus = chosen === "pending" && ended && !pending ? "applied" : chosen

  React.useEffect(() => {
    if (fixed !== undefined || chosen !== "pending" || ended) return
    setClock(Date.now())
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [fixed, chosen, ended])

  const elapsedRef = React.useRef(onElapsed)
  React.useEffect(() => {
    elapsedRef.current = onElapsed
  })
  const fired = React.useRef(false)
  React.useEffect(() => {
    // A new hold (a later effectiveAt, or back to pending) may fire again.
    if (shown === "pending" && !ended) fired.current = false
    if (chosen !== "pending" || shown !== "applied" || fired.current) return
    fired.current = true
    elapsedRef.current?.()
  }, [chosen, shown, ended])

  React.useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    resultRef.current?.focus()
  }, [shown])

  const setStatus = (next: RecoveryCooldownStatus) => {
    if (status === undefined) setInner(next)
    onStatusChange?.(next)
  }
  const cancel = async () => {
    setPending(true)
    setFailed(false)
    try {
      await onCancel?.()
      moveFocus.current = true
      setStatus("cancelled")
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  const show = (contact: string) => (mask ? maskContact(contact, kind) : contact)
  const values = { kind: t[kind], next: show(next), previous: previous ? show(previous) : "" }
  const total = start !== undefined && end !== undefined && end > start ? end - start : undefined
  const left = remaining !== undefined && total ? Math.min(1, Math.max(0, remaining / total)) : undefined
  const urgent = remaining !== undefined && remaining > 0 && remaining < HOUR
  const outcome = shown === "cancelled" ? fill(previous ? t.cancelled : t.cancelledNoPrevious, values) : fill(t.applied, values)
  const secureButton = onReport && (
    <button type="button" onClick={onReport} className="inline-flex min-h-6 w-fit items-center rounded-sm font-medium underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
      {t.secure}
    </button>
  )

  return (
    <section data-slot="recovery-contact-cooldown" data-status={shown} aria-labelledby={titleId} className={cn("grid w-full max-w-sm min-w-0 gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground shadow-xs", shown === "pending" && (urgent ? "border-red-500/50" : "border-amber-500/50"), className)} {...props}>
      {/* Announces a hold that ran out once. A cancel moves focus to its result instead, and the countdown stays quiet. */}
      <span aria-live="polite" className="sr-only">{shown === "applied" ? outcome : ""}</span>
      {shown === "pending" ? (
        <>
          <div className="flex items-start gap-3">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", urgent ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
              <Hourglass aria-hidden className="size-4" />
            </span>
            <div className="grid min-w-0 gap-0.5">
              <h3 id={titleId} className="font-medium">{fill(t.pendingTitle, values)}</h3>
              <p className="break-words text-muted-foreground">
                {remaining !== undefined && remaining > 0 ? (
                  <>
                    {fill(t.pendingBody, values)}{" "}
                    <span role="timer" className={cn("font-medium tabular-nums", urgent ? "text-red-700 dark:text-red-400" : "text-foreground")}>{formatRemaining(remaining, t)}</span>.
                  </>
                ) : (
                  fill(t.pendingBodyNoTime, values)
                )}
              </p>
            </div>
          </div>
          {left !== undefined && (
            <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none", urgent ? "bg-red-500" : "bg-amber-500")} style={{ width: `${left * 100}%` }} />
            </div>
          )}
          <div className="grid gap-1 text-xs text-muted-foreground">
            {end !== undefined && <p suppressHydrationWarning>{fill(t.when, { when: formatWhen(new Date(end)) })}</p>}
            {previous && <p className="break-words">{fill(t.oldStillWorks, values)}{previousNotified && <> {fill(t.notified, values)}</>}</p>}
            {urgent && <p className="font-medium text-red-700 dark:text-red-400">{t.urgent}</p>}
          </div>
          {failed && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400"><ShieldAlert aria-hidden className="size-3.5" />{t.cancelError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={cancel} disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50">
              {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {pending ? t.cancelling : t.cancel}
            </button>
            {onReport && (
              <button type="button" onClick={onReport} className="inline-flex h-9 items-center rounded-md border border-red-500/40 px-4 text-sm font-medium text-red-700 transition-colors outline-none hover:bg-red-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-red-400">
                {t.report}
              </button>
            )}
          </div>
        </>
      ) : (
        <div ref={resultRef} tabIndex={-1} className="flex items-start gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", shown === "cancelled" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
            {shown === "cancelled" ? <CircleCheck aria-hidden className="size-4" /> : <ShieldCheck aria-hidden className="size-4" />}
          </span>
          <div className="grid min-w-0 gap-1">
            <h3 id={titleId} className="font-medium break-words">
              {outcome}
            </h3>
            <span className="text-xs text-muted-foreground">{secureButton}</span>
          </div>
        </div>
      )}
    </section>
  )
}
