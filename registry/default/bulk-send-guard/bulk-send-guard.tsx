"use client"

import * as React from "react"
import { Check, CircleAlert, LoaderCircle, Moon, Send, TrendingUp, UserX, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"

export type BulkChannel = "sms" | "whatsapp" | "email"

export interface BulkAudience {
  /** Everyone on the list, before exclusions. */
  total: number
  /** Unsubscribed, replied STOP, or on a do-not-disturb register. Never sent to. */
  optedOut: number
  /** Unreachable addresses or numbers, also excluded. */
  invalid?: number
  /** Recipients who will get it, counted per IANA time zone ("Asia/Kolkata"). Unknown zones use `fallbackTimeZone`. */
  byTimeZone: Record<string, number>
}

/**
 * Local hours when sending is held, e.g. `{ start: 21, end: 10 }`. Fractions are minutes (`9.5` is 9:30).
 * India (TRAI TCCCPR): promotional SMS and calls are blocked 21:00–10:00 by default. US (TCPA): 21 → 8.
 */
export interface QuietHours {
  start: number
  end: number
}

/** Builds a `BulkAudience` from a recipient list. */
export function summarizeRecipients(list: { timeZone?: string; optedOut?: boolean; invalid?: boolean }[], fallbackTimeZone = "UTC"): BulkAudience {
  const byTimeZone: Record<string, number> = {}
  let optedOut = 0
  let invalid = 0
  for (const r of list) {
    if (r.optedOut) optedOut++
    else if (r.invalid) invalid++
    else byTimeZone[r.timeZone || fallbackTimeZone] = (byTimeZone[r.timeZone || fallbackTimeZone] ?? 0) + 1
  }
  return { total: list.length, optedOut, invalid, byTimeZone }
}

/** Minutes past local midnight in a zone, or null for an unknown zone. */
function localMinutes(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    return (get("hour") % 24) * 60 + get("minute")
  } catch {
    return null
  }
}

/** Splits recipients into those who can get it now and, per zone, those in quiet hours with when their quiet hours end. */
export function splitByQuietHours(byTimeZone: Record<string, number>, now: Date, quiet: QuietHours | null, fallbackTimeZone = "UTC") {
  const held: { timeZone: string; count: number; minutes: number; resumeAt: Date }[] = []
  let awake = 0
  for (const [zone, raw] of Object.entries(byTimeZone)) {
    const count = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
    if (!count) continue
    const timeZone = localMinutes(now, zone) === null ? fallbackTimeZone : zone
    const m = localMinutes(now, timeZone) ?? now.getUTCHours() * 60 + now.getUTCMinutes()
    const [s, e] = quiet ? [quiet.start * 60, quiet.end * 60] : [0, 0]
    const inQuiet = quiet !== null && (s > e ? m >= s || m < e : m >= s && m < e)
    if (!inQuiet) {
      awake += count
      continue
    }
    const wait = m < e ? e - m : 24 * 60 - m + e
    const at = new Date(Math.ceil((now.getTime() + wait * 60_000) / 60_000) * 60_000)
    const existing = held.find((h) => h.timeZone === timeZone)
    if (existing) existing.count += count
    else held.push({ timeZone, count, minutes: m, resumeAt: at })
  }
  return { awake, held: held.sort((a, b) => b.count - a.count) }
}

/** Every visible string. Numbers and amounts arrive formatted. */
export const BULK_SEND_GUARD_MESSAGES = {
  channel: { sms: "SMS", whatsapp: "WhatsApp", email: "email" } as Record<BulkChannel, string>,
  reaches: "Reaches",
  people: (n: number) => (n === 1 ? "person" : "people"),
  excluded: (optedOut: string, invalid: string | null) => `${optedOut} opted out${invalid ? ` and ${invalid} unreachable` : ""}, left out.`,
  quiet: (count: string) => `${count} are in quiet hours right now:`,
  zone: (zone: string, time: string, count: string) => `${count} in ${zone} (${time})`,
  hold: (time: string) => `Hold them until ${time} their time`,
  sendAll: "Send to everyone now",
  cost: (amount: string, detail: string) => `About ${amount} (${detail}).`,
  costDetail: (count: string, unit: string, segments: number) => `${count} × ${unit}${segments > 1 ? ` × ${segments} parts` : ""}`,
  jump: (factor: string, last: string, date: string) => `${factor}× your last send (${last} on ${date}). Check the list before going on.`,
  review: (count: string) => `Send to ${count}…`,
  readback: ({ now, later, channel, cost }: { now: string; later: string; channel: string; cost: string }) =>
    `${now} ${channel} messages go now${later ? `, ${later} when their quiet hours end` : ""}.${cost ? ` About ${cost}.` : ""}`,
  confirmTitle: "Ready to send?",
  typeToConfirm: (count: string) => `Type ${count} to confirm`,
  confirm: (count: string) => `Send ${count} now`,
  back: "Back",
  sending: "Sending…",
  sent: "Sent",
  failed: "Sending failed. Check what went out before you try again, so nobody gets it twice.",
  nobody: "Nobody on this list can get it.",
}
export type BulkSendGuardMessages = typeof BULK_SEND_GUARD_MESSAGES

export interface BulkSendPlan {
  now: number
  held: { timeZone: string; count: number; at: Date }[]
  cost?: number
}

export interface BulkSendGuardProps extends Omit<React.ComponentProps<"section">, "children"> {
  channel: BulkChannel
  audience: BulkAudience
  /** Cost of one message (one part, for SMS). Leave out to hide the estimate. */
  costPerMessage?: number
  /** SMS parts per message. */
  segments?: number
  currency?: string
  locale?: string
  /** Quiet hours in each recipient's local time. Defaults to 21 → 10 for SMS and WhatsApp (TRAI's default for promotional SMS), none for email. Pass `null` for transactional or service messages, which TRAI allows at any hour. */
  quietHours?: QuietHours | null
  fallbackTimeZone?: string
  /** The previous blast, for the jump check. */
  lastSend?: { count: number; at: Date | number | string }
  /** Flag a send this many times bigger than the last one, and ask for the count to be typed. */
  jumpFactor?: number
  /** Pass for deterministic rendering; otherwise the clock is read after mount and every 30 s. */
  now?: Date
  /** Sends it. Return a promise for a pending state; a rejection returns to the confirm step. */
  onSend: (plan: BulkSendPlan) => void | Promise<void>
  messages?: Partial<BulkSendGuardMessages>
}

const btn = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

/**
 * A pre-send check for SMS, WhatsApp and email blasts. It states who it reaches,
 * who is left out for opting out, who is asleep in their own time zone (held until
 * morning by default), what it will cost and whether it is far bigger than the
 * last send, then asks for an explicit confirm: typing the count when the jump is big.
 */
export function BulkSendGuard({
  channel,
  audience,
  costPerMessage,
  segments = 1,
  currency = "INR",
  locale = "en-IN",
  quietHours,
  fallbackTimeZone = "UTC",
  lastSend,
  jumpFactor = 2,
  now: nowProp,
  onSend,
  messages,
  className,
  ...props
}: BulkSendGuardProps) {
  const t = { ...BULK_SEND_GUARD_MESSAGES, ...messages, channel: { ...BULK_SEND_GUARD_MESSAGES.channel, ...messages?.channel } }
  const [clock, setClock] = React.useState<Date>()
  const [hold, setHold] = React.useState(true)
  const [step, setStep] = React.useState<"review" | "confirm" | "sending" | "sent">("review")
  const [typed, setTyped] = React.useState("")
  const [error, setError] = React.useState(false)
  const enteredAt = React.useRef(0)
  const confirmRef = React.useRef<HTMLParagraphElement>(null)
  const typedRef = React.useRef<HTMLInputElement>(null)
  const reviewRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (nowProp) return
    setClock(new Date())
    const timer = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [nowProp])

  const now = nowProp ?? clock
  const quiet = quietHours === undefined ? (channel === "email" ? null : { start: 21, end: 10 }) : quietHours
  const num = (n: number) => new Intl.NumberFormat(locale).format(n)
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n)
    } catch {
      return num(n)
    }
  }
  const zoneTime = (d: Date, timeZone: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(d)
    } catch {
      return ""
    }
  }
  const city = (zone: string) => zone.split("/").pop()?.replace(/_/g, " ") ?? zone
  const safe = (n?: number) => (Number.isFinite(n) && (n as number) > 0 ? Math.floor(n as number) : 0)

  const split = now ? splitByQuietHours(audience.byTimeZone ?? {}, now, quiet, fallbackTimeZone) : { awake: 0, held: [] }
  const quietCount = split.held.reduce((sum, h) => sum + h.count, 0)
  const reach = split.awake + quietCount
  const sendingNow = hold ? split.awake : reach
  const unit = safe(segments) || 1
  const cost = costPerMessage !== undefined && Number.isFinite(costPerMessage) ? reach * unit * costPerMessage : undefined
  const last = lastSend && safe(lastSend.count) ? lastSend : undefined
  const factor = last ? reach / last.count : 0
  const jumped = factor >= jumpFactor
  const lastDate = last ? new Date(last.at) : undefined
  const holdUntil = quiet ? zoneTime(new Date(Date.UTC(2000, 0, 1) + Math.round(quiet.end * 60) * 60_000), "UTC") : ""
  const typedOk = !jumped || typed.replace(/[^\d]/g, "") === String(reach)

  const goConfirm = () => {
    if (!reach || !now) return
    enteredAt.current = performance.now()
    setTyped("")
    setError(false)
    setStep("confirm")
    requestAnimationFrame(() => (typedRef.current ?? confirmRef.current)?.focus())
  }
  const goBack = () => {
    setStep("review")
    requestAnimationFrame(() => reviewRef.current?.focus())
  }
  const send = async () => {
    // A double click on "Send to…" must not land here as a confirm.
    if (step !== "confirm" || !typedOk || performance.now() - enteredAt.current < 400) return
    setStep("sending")
    try {
      await onSend({ now: sendingNow, held: hold ? split.held.map((h) => ({ timeZone: h.timeZone, count: h.count, at: h.resumeAt })) : [], cost })
      setStep("sent")
    } catch {
      setError(true)
      setStep("confirm")
    }
  }

  return (
    <section data-slot="bulk-send-guard" data-state={step} aria-labelledby={`${id}-reach`} className={cn("grid w-full min-w-0 max-w-sm gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <p id={`${id}-reach`} className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-muted-foreground">{t.reaches}</span>
        <span className="text-2xl font-semibold tabular-nums">{now ? num(reach) : "…"}</span>
        <span className="text-muted-foreground">{t.people(reach)} · {t.channel[channel]}</span>
      </p>

      <ul className="grid gap-2 text-xs">
        {safe(audience.optedOut) + safe(audience.invalid) > 0 && (
          <li className="flex gap-1.5 text-muted-foreground">
            <UserX aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.excluded(num(safe(audience.optedOut)), safe(audience.invalid) ? num(safe(audience.invalid)) : null)}
          </li>
        )}
        {jumped && last && lastDate && (
          <li className="flex gap-1.5 font-medium text-red-700 dark:text-red-400">
            <TrendingUp aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.jump(factor >= 10 ? num(Math.round(factor)) : factor.toFixed(1), num(last.count), Number.isNaN(lastDate.getTime()) ? "—" : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(lastDate))}
          </li>
        )}
        {cost !== undefined && reach > 0 && (
          <li className="flex gap-1.5 text-muted-foreground">
            <Wallet aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.cost(money(cost), t.costDetail(num(reach), money(costPerMessage ?? 0), unit))}
          </li>
        )}
        {quietCount > 0 && now && (
          <li className="grid gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex gap-1.5">
              <Moon aria-hidden className="mt-px size-3.5 shrink-0" />
              <span id={`${id}-quiet`}>{t.quiet(num(quietCount))}</span>
            </span>
            <span className="pl-5">{split.held.slice(0, 3).map((h) => t.zone(city(h.timeZone), zoneTime(now, h.timeZone), num(h.count))).join(" · ")}{split.held.length > 3 ? " …" : ""}</span>
            <fieldset disabled={step !== "review"} aria-labelledby={`${id}-quiet`} className="grid gap-1 pl-5 text-foreground">
              {[true, false].map((value) => (
                <label key={String(value)} className="flex items-center gap-2">
                  <input type="radio" name={`${id}-hold`} checked={hold === value} onChange={() => setHold(value)} className="size-4 accent-(--primary)" />
                  {value ? t.hold(holdUntil) : t.sendAll}
                </label>
              ))}
            </fieldset>
          </li>
        )}
        {now && !reach && (
          <li className="flex gap-1.5 text-red-700 dark:text-red-400">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.nobody}
          </li>
        )}
      </ul>

      {step === "review" ? (
        <button ref={reviewRef} type="button" onClick={goConfirm} disabled={!reach || !now} className={cn(btn, "w-full bg-primary text-primary-foreground hover:bg-primary/90")}>
          <Send aria-hidden className="size-4" />
          {t.review(num(reach))}
        </button>
      ) : step === "sent" ? (
        <p role="status" className="flex items-center justify-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden className="size-4" />
          {t.sent}
        </p>
      ) : (
        <div className="grid gap-2 rounded-lg border bg-muted/40 p-3" onKeyDown={(e) => e.key === "Escape" && step === "confirm" && goBack()}>
          <p ref={confirmRef} tabIndex={-1} className="font-medium outline-none">{t.confirmTitle}</p>
          <p className="text-xs">{t.readback({ now: num(sendingNow), later: hold && quietCount ? num(quietCount) : "", channel: t.channel[channel], cost: cost !== undefined ? money(cost) : "" })}</p>
          {jumped && (
            <label className="grid gap-1 text-xs">
              {t.typeToConfirm(num(reach))}
              <input
                ref={typedRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                disabled={step === "sending"}
                className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              />
            </label>
          )}
          {error && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{t.failed}</p>}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <button type="button" onClick={() => void send()} disabled={!typedOk || step === "sending"} aria-busy={step === "sending" || undefined} className={cn(btn, "min-w-0 bg-destructive px-3 text-white hover:bg-destructive/90")}>
              {step === "sending" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
              {step === "sending" ? t.sending : t.confirm(num(sendingNow))}
            </button>
            <button type="button" onClick={goBack} disabled={step === "sending"} className={cn(btn, "border bg-background hover:bg-accent dark:bg-input/30")}>
              {t.back}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
