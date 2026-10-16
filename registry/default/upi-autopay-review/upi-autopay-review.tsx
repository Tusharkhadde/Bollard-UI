"use client"

import * as React from "react"
import { CalendarClock, ChevronDown, Loader2, Repeat, ShieldAlert, Store, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"
import { endAfter, pinFreeLimit, reviewMandate, suggestedCap, toTime, worstCaseYear, type AutopayIssue, type Mandate, type MandateFrequency, type MandatePlan } from "./autopay"

export { CYCLES_PER_YEAR, endAfter, pinFreeLimit, reviewMandate, suggestedCap, toTime, worstCaseYear, type AutopayIssue, type Mandate, type MandateCategory, type MandateFrequency, type MandatePlan } from "./autopay"

/** Every visible string. `{cap}`, `{price}`, `{times}`, `{plan}`, `{mandate}`, `{years}`, `{limit}`, `{expected}`, `{actual}` and `{amount}` are filled in. */
export const UPI_AUTOPAY_MESSAGES = {
  heading: "Review AutoPay",
  eachDebit: "Each debit",
  upTo: "Up to {cap}",
  exactly: "Exactly {cap}",
  planPrice: "Your plan is {price}",
  howOften: "How often",
  valid: "Valid",
  untilCancel: "until you cancel",
  worstCase: "Most it can take in a year",
  noYearLimit: "No limit: the merchant picks the dates",
  frequency: {
    onetime: "Once", daily: "Every day", weekly: "Every week", fortnightly: "Every 2 weeks", monthly: "Every month",
    bimonthly: "Every 2 months", quarterly: "Every 3 months", halfyearly: "Every 6 months", yearly: "Every year",
    aspresented: "Whenever the merchant asks",
  } as Record<MandateFrequency, string>,
  capHigh: "The cap is {times}× your {price} plan. The merchant could charge up to {cap} without asking again.",
  fixedHigh: "Every debit is exactly {cap}, but your plan is {price}.",
  asPresented: "“As presented” has no fixed schedule, so debits can come on any day, any number of times.",
  frequencyMismatch: "Your plan bills {plan}, but this mandate allows debits {mandate}.",
  noEnd: "No end date: it runs until you cancel, even after you stop using the service.",
  longEnd: "It stays valid for {years} years.",
  badDates: "The end date is before the start date. Ask the merchant to send it again.",
  merchant: "You meant to pay {expected}, but this mandate is from {actual}.",
  overPinFree: "Debits above {limit} will ask for your UPI PIN each time.",
  lowerCap: "Cap at {amount}",
  endInYear: "End after 1 year",
  summaryIssues: "Check before you approve",
  summaryOk: "Matches your plan",
  rightsTitle: "Your rights on this mandate",
  rights: [
    "Your bank must tell you at least 24 hours before each debit: merchant, amount and date.",
    "You can skip a single debit from that alert, change the end date or cap, or cancel the mandate any time in your UPI app.",
    "Debits up to {limit} go through without your PIN; anything above asks for it.",
    "Setting up AutoPay is free. Nobody may charge you for it.",
  ],
  capped: "Cap lowered to {amount}.",
  ended: "Now ends on {amount}.",
  approve: "Approve",
  approveAnyway: "Approve anyway",
  decline: "Decline",
}

export type UpiAutopayMessages = typeof UPI_AUTOPAY_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const buttonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"

export interface UpiAutopayReviewProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled mandate, as it will be approved. */
  value?: Mandate
  /** Initial mandate when uncontrolled: what the merchant sent. */
  defaultValue?: Mandate
  /** Called after a one-tap fix changes the cap or end date. */
  onValueChange?: (mandate: Mandate) => void
  /** What the user signed up for, to compare the cap, schedule and merchant against. */
  plan?: MandatePlan | null
  /** "Now" in epoch ms, for deterministic rendering. Read from the clock after mount when omitted. */
  now?: number
  /** How far above the plan price the cap may sit before it's flagged. Default 1.5. */
  capRatio?: number
  /** Locale for money and dates. */
  locale?: string
  /** Called on Approve. With warnings, the first press goes to the first fix and the second approves. May return a Promise. */
  onApprove?: (mandate: Mandate) => void | Promise<void>
  /** Called on Decline. */
  onDecline?: () => void
  /** Any visible string. */
  messages?: Partial<UpiAutopayMessages>
}

/**
 * Reads a UPI AutoPay mandate back in plain words before the PIN: the cap against the plan price,
 * how often, until when and who. Flags a cap far above the plan, "as presented" schedules, no end
 * date and the wrong merchant, with one-tap fixes to cap it at the plan price or end it in a year.
 */
export function UpiAutopayReview({
  value,
  defaultValue,
  onValueChange,
  plan,
  now: nowProp,
  capRatio,
  locale = "en-IN",
  onApprove,
  onDecline,
  messages,
  className,
  "aria-describedby": describedBy,
  ...props
}: UpiAutopayReviewProps) {
  const t = { ...UPI_AUTOPAY_MESSAGES, ...messages, frequency: { ...UPI_AUTOPAY_MESSAGES.frequency, ...messages?.frequency } }
  const [inner, setInner] = React.useState<Mandate | undefined>(defaultValue)
  const [clock, setClock] = React.useState<number>()
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const [flash, setFlash] = React.useState<"cap" | "end">()
  const busy = React.useRef(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const approveRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const raw = value ?? inner
  const mandate: Mandate = raw && typeof raw === "object" ? raw : { merchant: "", maxAmount: 0, frequency: "monthly" }
  const now = nowProp ?? clock

  React.useEffect(() => {
    if (nowProp === undefined) setClock(Date.now())
  }, [nowProp])

  const issues = reviewMandate(mandate, plan, { now, capRatio })
  const warnings = issues.filter((issue) => issue.kind !== "overPinFree")
  const danger = issues.some((issue) => issue.kind === "merchant" || issue.kind === "badDates")
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
  const day = (time: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(time)
  const freq = (f: MandateFrequency) => t.frequency[f] ?? f
  const start = toTime(mandate.start) ?? now
  const end = toTime(mandate.end)
  const yearly = worstCaseYear(mandate)
  const limit = pinFreeLimit(mandate.category)

  const describe = (issue: AutopayIssue) => {
    switch (issue.kind) {
      case "capHigh": return fill(issue.fixed ? t.fixedHigh : t.capHigh, { times: Math.round(issue.ratio * 10) / 10, price: money(issue.price), cap: money(issue.cap) })
      case "asPresented": return t.asPresented
      case "frequency": return fill(t.frequencyMismatch, { plan: freq(issue.plan).toLowerCase(), mandate: freq(issue.mandate).toLowerCase() })
      case "noEnd": return t.noEnd
      case "longEnd": return fill(t.longEnd, { years: issue.years })
      case "badDates": return t.badDates
      case "merchant": return fill(t.merchant, { expected: issue.expected, actual: issue.actual })
      case "overPinFree": return fill(t.overPinFree, { limit: money(issue.limit) })
    }
  }

  const commit = (next: Mandate, kind: "cap" | "end", message: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setAsked(false)
    setStatus(message)
    setFlash(kind)
    // Focus goes to the next fix, else Approve; never lost.
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? approveRef.current)?.focus())
  }

  const fixFor = (issue: AutopayIssue) => {
    if (issue.kind === "capHigh") {
      const cap = issue.fixed ? issue.price : suggestedCap(issue.price)
      return { label: fill(t.lowerCap, { amount: money(cap) }), run: () => commit({ ...mandate, maxAmount: cap }, "cap", fill(t.capped, { amount: money(cap) })) }
    }
    if ((issue.kind === "noEnd" || issue.kind === "longEnd") && now !== undefined) {
      const next = endAfter(mandate, 1, now)
      return { label: t.endInYear, run: () => commit({ ...mandate, end: next }, "end", fill(t.ended, { amount: day(next) })) }
    }
    return null
  }

  const approve = async () => {
    if (warnings.length && !asked) {
      setAsked(true)
      setStatus(`${t.summaryIssues}: ${warnings.map(describe).join(" ")}`)
      ;(rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? approveRef.current)?.focus()
      return
    }
    if (!onApprove || busy.current) return
    busy.current = true
    setPending(true)
    try {
      await onApprove(mandate)
    } catch {
      // The caller shows approval errors; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const tone = danger ? "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300" : "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300"
  const flashClass = (kind: "cap" | "end") => flash === kind && "rounded-sm motion-safe:animate-[cui-upi-autopay-review-flash_400ms_ease-out]"

  return (
    <div ref={rootRef} data-slot="upi-autopay-review" data-state={danger ? "danger" : warnings.length ? "warning" : "ok"} className={cn("w-full max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <style>{`@keyframes cui-upi-autopay-review-flash{from{background:color-mix(in oklab,var(--color-amber-400) 45%,transparent)}to{background:transparent}}`}</style>
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><Store aria-hidden className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs text-muted-foreground">{t.heading}</h3>
          <p className="font-medium [overflow-wrap:anywhere]">{mandate.merchant}</p>
          {mandate.merchantVpa && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{mandate.merchantVpa}</p>}
        </div>
      </div>

      <dl className="grid gap-2 rounded-md border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground"><Wallet aria-hidden className="size-3.5" />{t.eachDebit}</dt>
          <dd className="text-right">
            <span className={cn("px-0.5 font-medium tabular-nums", flashClass("cap"))} onAnimationEnd={() => setFlash(undefined)}>
              {fill(mandate.amountRule === "fixed" ? t.exactly : t.upTo, { cap: money(Math.max(0, Number(mandate.maxAmount) || 0)) })}
            </span>
            {plan && Number.isFinite(plan.price) && <span className="block text-xs text-muted-foreground">{fill(t.planPrice, { price: money(plan.price) })}</span>}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground"><Repeat aria-hidden className="size-3.5" />{t.howOften}</dt>
          <dd className="font-medium">{freq(mandate.frequency)}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock aria-hidden className="size-3.5" />{t.valid}</dt>
          <dd className={cn("px-0.5 font-medium", flashClass("end"))} onAnimationEnd={() => setFlash(undefined)}>
            {start !== undefined && start !== null ? day(start) : "…"} → {end !== null && issues.every((i) => i.kind !== "noEnd") ? day(end) : t.untilCancel}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t pt-2">
          <dt className="text-muted-foreground">{t.worstCase}</dt>
          <dd className="font-medium tabular-nums">{yearly === null ? t.noYearLimit : money(yearly)}</dd>
        </div>
      </dl>

      {issues.length > 0 && (
        <div className={cn("space-y-2 rounded-md border p-3", warnings.length ? tone : "border-border text-muted-foreground")}>
          {warnings.length > 0 && <p id={`${id}-summary`} className="flex items-center gap-1.5 font-medium"><ShieldAlert aria-hidden className="size-4 shrink-0" />{t.summaryIssues}</p>}
          <ul className="space-y-2 text-xs">
            {issues.map((issue) => {
              const fix = fixFor(issue)
              return (
                <li key={issue.kind} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span id={`${id}-${issue.kind}`} className="min-w-0 flex-1 basis-56 break-words">{describe(issue)}</span>
                  {fix && <button type="button" data-fix onClick={fix.run} disabled={pending} aria-describedby={`${id}-${issue.kind}`} className={fixClass}>{fix.label}</button>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <details className="group rounded-md border px-3 py-2 text-xs">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          {t.rightsTitle}
          <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          {t.rights.map((line) => <li key={line}>{fill(line, { limit: money(limit) })}</li>)}
        </ul>
      </details>

      <span role="status" className="sr-only">{status}</span>
      <div className="flex flex-wrap justify-end gap-2">
        {onDecline && <button type="button" onClick={onDecline} disabled={pending} className={cn(buttonClass, "border bg-background hover:bg-accent dark:bg-input/30")}>{t.decline}</button>}
        <button
          ref={approveRef}
          type="button"
          onClick={approve}
          aria-disabled={pending || undefined}
          aria-describedby={[describedBy, warnings.length ? `${id}-summary` : ""].filter(Boolean).join(" ") || undefined}
          className={cn(buttonClass, asked && warnings.length ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {asked && warnings.length ? t.approveAnyway : t.approve}
        </button>
      </div>
    </div>
  )
}
