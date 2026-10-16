"use client"

// Bollard UI — duplicate-payment-guard · MIT licence · https://bollard-ui.vercel.app/components/duplicate-payment-guard

import * as React from "react"
import { Check, CircleCheck, Hourglass, LoaderCircle, Repeat, Search } from "lucide-react"

import { cn } from "@/lib/utils"

/** `pending` covers a UPI "processing" state and a request that timed out with no answer. */
export type PaymentStatus = "success" | "pending" | "failed"

export interface PastPayment {
  /** Stable payee identity, e.g. a UPI ID or account + IFSC. Compared case-insensitively. */
  payeeId: string
  amount: number
  at: Date | number | string
  /** Defaults to `success`. */
  status?: PaymentStatus
  /** Transaction ID / UTR, passed back to `onCheckStatus`. */
  reference?: string
}

export interface RepeatMatch {
  /** `pending`: an earlier one may still land. `recent`: it already went through. `failed`: safe to retry. */
  kind: "pending" | "recent" | "failed"
  payment: PastPayment
}

const time = (at: PastPayment["at"]) => new Date(at).getTime()
const paise = (n: number) => Math.round(n * 100)

/**
 * The earlier payment that makes paying this payee this amount again risky, if any.
 * A pending one wins (it can still be debited), then a success, then a failure.
 * Pending payments are looked at for `pendingWindow` (UPI can take up to 48 h to settle).
 */
export function findRepeat(payments: PastPayment[], payeeId: string, amount: number, now: number, window = 30 * 60_000, pendingWindow = 48 * 3_600_000): RepeatMatch | undefined {
  const id = payeeId.trim().toLowerCase()
  const same = payments
    .filter((p) => p.payeeId.trim().toLowerCase() === id && paise(p.amount) === paise(amount) && Number.isFinite(time(p.at)))
    .sort((a, b) => time(b.at) - time(a.at))
  const within = (p: PastPayment, ms: number) => now - time(p.at) <= ms && now - time(p.at) >= -60_000
  const pending = same.find((p) => p.status === "pending" && within(p, pendingWindow))
  if (pending) return { kind: "pending", payment: pending }
  const recent = same.find((p) => (p.status ?? "success") === "success" && within(p, window))
  if (recent) return { kind: "recent", payment: recent }
  const failed = same.find((p) => p.status === "failed" && within(p, window))
  return failed && { kind: "failed", payment: failed }
}

const ago = (ms: number) => (ms < 60_000 ? "just now" : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min ago` : `${Math.round(ms / 3_600_000)} h ago`)

/** Every visible string. Functions get values already formatted for the locale. */
export const DUPLICATE_PAYMENT_GUARD_MESSAGES = {
  pay: (amount: string) => `Pay ${amount}`,
  payAgain: (amount: string) => `Pay ${amount} again`,
  paying: "Paying…",
  paid: "Paid",
  ago,
  recent: (payee: string, amount: string, when: string) => `You paid ${payee} ${amount} ${when}.`,
  recentHint: "Press again only if you mean to send it twice.",
  pending: (payee: string, amount: string, when: string) => `Your ${amount} to ${payee} from ${when} hasn't confirmed yet.`,
  pendingHint: "It can still go through. Check it before paying again.",
  failed: (amount: string, when: string) => `The ${amount} attempt ${when} failed, so paying now is safe.`,
  checkStatus: "Check status",
  checking: "Checking…",
  checkFailed: "Couldn't check right now. Try again in a minute.",
  checkIn: (seconds: number) => `Check in ${seconds} s`,
  checksUsed: "Still pending after several checks. Your bank will settle or refund it, usually by the next working day.",
  doubleTap: "Caught a second tap. You were charged once.",
  doubleTapArmed: "Caught a second tap. Nothing was sent yet; press again if you do mean to pay twice.",
  cancel: "Cancel",
}
export type DuplicatePaymentGuardMessages = typeof DUPLICATE_PAYMENT_GUARD_MESSAGES

export interface DuplicatePaymentGuardProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Who is being paid; `name` is what the warning shows. */
  payee: { id: string; name: string }
  /** Amount to pay, in major units. */
  amount: number
  /** ISO 4217 currency code. */
  currency?: string
  /** BCP 47 locale for money and times. */
  locale?: string
  /** Recent payments from your history, any payee, any order. Payments made here are remembered too. */
  payments?: PastPayment[]
  /** A successful payment of the same amount to the same payee within this many ms needs a deliberate second press. */
  window?: number
  /** How long a pending payment keeps blocking a blind retry. */
  pendingWindow?: number
  /** Presses closer together than this are one tap. */
  doubleTapMs?: number
  /** After this many ms with no answer the attempt counts as pending and the button frees up; a late answer still updates it. */
  timeoutMs?: number
  /** Sends the money. Resolve with the outcome (nothing means success); a rejection or timeout is treated as pending. */
  onPay: () => void | PaymentStatus | Promise<void | PaymentStatus>
  /** Looks up a pending payment's real status. Without it the pending warning has no Check button. */
  onCheckStatus?: (payment: PastPayment) => PaymentStatus | Promise<PaymentStatus>
  /** Wait this long after a payment before its status can be checked (NPCI: first status check after 90 s). */
  checkAfterMs?: number
  /** Status checks allowed per pending payment before the button gives way to a "wait for the bank" note (NPCI allows 3). */
  maxChecks?: number
  /** Merged onto the pay button. */
  "aria-describedby"?: string
  /** Override any visible string. */
  messages?: Partial<DuplicatePaymentGuardMessages>
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:text-amber-200"

/**
 * A pay button that won't pay the same person the same amount twice by accident.
 * It tells three repeats apart: a double tap (swallowed, charged once), a retry
 * after a timeout (the first may still land, so it asks you to check its status
 * first), and a deliberate repeat ("You paid Ravi ₹2,400 12 min ago", needing a
 * second, separate press).
 */
export function DuplicatePaymentGuard({
  payee,
  amount,
  currency = "INR",
  locale = "en-IN",
  payments = [],
  window = 30 * 60_000,
  pendingWindow = 48 * 3_600_000,
  doubleTapMs = 800,
  timeoutMs = 30_000,
  onPay,
  onCheckStatus,
  checkAfterMs = 90_000,
  maxChecks = 3,
  "aria-describedby": describedBy,
  messages,
  className,
  ...props
}: DuplicatePaymentGuardProps) {
  const t = { ...DUPLICATE_PAYMENT_GUARD_MESSAGES, ...messages }
  const [mine, setMine] = React.useState<PastPayment[]>([])
  const [checked, setChecked] = React.useState<Record<string, PaymentStatus>>({})
  const [phase, setPhase] = React.useState<"idle" | "armed" | "paying" | "paid">("idle")
  const [checking, setChecking] = React.useState(false)
  const [note, setNote] = React.useState<"doubleTap" | "doubleTapArmed" | "checkFailed" | null>(null)
  const [checks, setChecks] = React.useState<Record<string, number>>({})
  const [live, setLive] = React.useState("")
  const [now, setNow] = React.useState<number>()
  const lastPress = React.useRef(-Infinity)
  const busy = React.useRef(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const hintId = React.useId()

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])
  React.useEffect(() => {
    if (phase !== "paid") return
    const id = setTimeout(() => setPhase("idle"), 1600)
    return () => clearTimeout(id)
  }, [phase])

  React.useEffect(() => {
    if (!note) return
    const id = setTimeout(() => setNote(null), 5000)
    return () => clearTimeout(id)
  }, [note])

  const keyOf = (p: PastPayment) => p.reference ?? `${p.payeeId}|${time(p.at)}`
  const all = [...payments, ...mine].map((p) => (checked[keyOf(p)] ? { ...p, status: checked[keyOf(p)] } : p))
  const valid = Number.isFinite(amount) && amount > 0
  const match = now === undefined || !valid ? undefined : findRepeat(all, payee.id, amount, now, window, pendingWindow)
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
    } catch {
      return String(n)
    }
  }
  const when = match && now !== undefined ? t.ago(Math.max(0, now - time(match.payment.at))) : ""
  const gated = match?.kind === "pending" || match?.kind === "recent"
  const matchKey = match ? keyOf(match.payment) : ""
  const checksUsed = checks[matchKey] ?? 0
  const waitMs = match && now !== undefined ? time(match.payment.at) + checkAfterMs - now : 0
  const canCheck = match?.kind === "pending" && !!onCheckStatus && checksUsed < maxChecks
  const hint = match
    ? `${match.kind === "pending" ? t.pending(payee.name, money(amount), when) : match.kind === "recent" ? t.recent(payee.name, money(amount), when) : t.failed(money(amount), when)} ${
        match.kind === "pending" ? (onCheckStatus && checksUsed >= maxChecks ? t.checksUsed : t.pendingHint) : match.kind === "recent" && phase === "armed" ? t.recentHint : ""
      }`.trim()
    : ""

  // Tick each second only while a Check button is counting down.
  React.useEffect(() => {
    if (!canCheck || waitMs <= 0) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [canCheck, waitMs > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Announce a warning when it appears or changes meaning, not each time "12 min ago" ticks over.
  const hintRef = React.useRef(hint)
  hintRef.current = hint
  const liveKey = match && phase !== "paying" && phase !== "paid" ? `${match.kind}|${matchKey}|${phase}|${checksUsed >= maxChecks}` : ""
  React.useEffect(() => setLive(liveKey ? hintRef.current : ""), [liveKey])

  const press = async () => {
    const at = performance.now()
    const tooSoon = at - lastPress.current < doubleTapMs
    lastPress.current = at
    if (busy.current || phase === "paid" || !valid) {
      if (busy.current || (phase === "paid" && tooSoon)) setNote("doubleTap")
      return
    }
    if (gated && phase !== "armed") return setPhase("armed")
    if (phase === "armed" && tooSoon) return setNote("doubleTapArmed")
    busy.current = true
    setNote(null)
    setPhase("paying")
    const attempt: PastPayment = { payeeId: payee.id, amount, at: Date.now(), reference: `local-${Date.now()}` }
    const outcome = Promise.resolve()
      .then(onPay)
      .then((s) => s || "success", () => "pending" as const)
    let timer: ReturnType<typeof setTimeout> | undefined
    const status = await Promise.race([outcome, new Promise<"pending">((resolve) => (timer = setTimeout(() => resolve("pending"), timeoutMs)))])
    clearTimeout(timer)
    // A payment that answers after the timeout still gets its real status.
    void outcome.then((late) => late !== status && setChecked((c) => ({ ...c, [attempt.reference!]: late })))
    busy.current = false
    setMine((list) => [...list, { ...attempt, status }])
    setNow(Date.now())
    setPhase(status === "success" ? "paid" : "idle")
  }

  const check = async () => {
    if (!match || !onCheckStatus || checking || !canCheck || waitMs > 0) return
    setChecking(true)
    setNote(null)
    setChecks((c) => ({ ...c, [matchKey]: (c[matchKey] ?? 0) + 1 }))
    try {
      const status = await onCheckStatus(match.payment)
      setChecked((c) => ({ ...c, [keyOf(match.payment)]: status }))
      setPhase("idle")
      // The Check button is about to go away; keep focus on the decision.
      if (status !== "pending") requestAnimationFrame(() => buttonRef.current?.focus())
    } catch {
      setNote("checkFailed")
    } finally {
      setChecking(false)
    }
  }

  const disarm = () => {
    setPhase("idle")
    buttonRef.current?.focus()
  }

  const Icon = phase === "paying" ? LoaderCircle : phase === "paid" ? Check : phase === "armed" ? Repeat : null
  const tone = match?.kind === "failed" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"

  return (
    <div data-slot="duplicate-payment-guard" data-state={phase} data-repeat={match?.kind} className={cn("grid w-full gap-1.5", className)} {...props}>
      <div className="flex gap-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => void press()}
          onKeyDown={(e) => {
            if (e.key === "Escape" && phase === "armed") disarm()
            if (e.key === "Enter" && e.repeat) e.preventDefault()
          }}
          aria-disabled={!valid || undefined}
          aria-busy={phase === "paying" || undefined}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
          className={cn(
            "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
            phase === "armed"
              ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {Icon && <Icon aria-hidden className={cn("size-4", phase === "paying" && "animate-spin")} />}
          <span className="truncate">{phase === "paying" ? t.paying : phase === "paid" ? t.paid : phase === "armed" ? t.payAgain(money(amount)) : t.pay(money(amount))}</span>
        </button>
        {phase === "armed" && (
          <button type="button" onClick={disarm} className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium shadow-xs transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
            {t.cancel}
          </button>
        )}
      </div>

      <div id={hintId} className="text-xs empty:hidden">
        {match && phase !== "paying" && phase !== "paid" && (
          <p className={cn("flex gap-1.5", tone)}>
            <span className="flex h-6 shrink-0 items-center">
              {match.kind === "pending" ? <Hourglass aria-hidden className="size-3.5" /> : match.kind === "recent" ? <Repeat aria-hidden className="size-3.5" /> : <CircleCheck aria-hidden className="size-3.5" />}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{hint}</span>
              {canCheck && (
                <button type="button" onClick={() => void check()} disabled={checking || waitMs > 0} className={cn(fixClass, "tabular-nums")}>
                  {checking ? <LoaderCircle aria-hidden className="size-3 animate-spin" /> : <Search aria-hidden className="size-3" />}
                  {checking ? t.checking : waitMs > 0 ? t.checkIn(Math.ceil(waitMs / 1000)) : t.checkStatus}
                </button>
              )}
            </span>
          </p>
        )}
        {note && <p className="py-1 text-muted-foreground">{t[note]}</p>}
      </div>
      <span aria-live="polite" className="sr-only">{note ? t[note] : live}</span>
    </div>
  )
}
