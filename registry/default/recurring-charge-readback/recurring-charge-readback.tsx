"use client"

// Bollard UI — recurring-charge-readback · MIT licence · https://bollard-ui.vercel.app/components/recurring-charge-readback

import * as React from "react"
import { Repeat, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { auditChargeLabel, planCharges, type ChargeInterval } from "@/registry/default/recurring-charge-readback/schedule"

export * from "@/registry/default/recurring-charge-readback/schedule"

/** Every sentence the readback shows. Override any of them to reword or translate. */
export const RECURRING_CHARGE_MESSAGES = {
  every: (interval: ChargeInterval, count: number) => (count === 1 ? `every ${interval}` : `every ${count} ${interval}s`),
  today: (amount: string) => `${amount} today`,
  plain: (today: string, every: string, from: string) => `${today}, then ${every} from ${from}.`,
  trial: (today: string, first: string, date: string, every: string) => `${today}. ${first} on ${date} when the trial ends, then ${every}.`,
  intro: (until: string, full: string, every: string) => `From ${until} the price goes up to ${full} ${every}.`,
  renews: "Renews automatically.",
  cancelBy: (deadline: React.ReactNode, amount: string): React.ReactNode => <>Cancel before {deadline} and you won&apos;t be charged {amount}.</>,
  cancelClosed: (amount: string, date: string) =>
    `There isn't time to cancel before the first charge: ${amount} on ${date} is certain once you subscribe.`,
  monthEnd: "In shorter months it renews on the last day.",
  bankNotice: "Your bank will alert you at least 24 hours before each charge.",
  bankApprove: (limit: string) => `Above ${limit}, your bank asks you to approve each renewal with an OTP or PIN.`,
  stepTitle: { today: "Today", first: "Trial ends", "step-up": "Full price" },
  times: (ratio: string) => `${ratio}× more`,
  labelFree: (amount: string) => `The button says "free", but ${amount} is charged today.`,
  labelAmount: (said: string, real: string) => `The button says ${said}, but the charge is ${real}.`,
  labelPeriod: (every: string) => `The button shows a monthly price, but billing is ${every}, all at once.`,
}

export interface RecurringChargeReadbackProps extends React.ComponentProps<"div"> {
  /** The regular price per period. */
  amount: number
  /** Billing period unit, e.g. "month" or "year". */
  interval?: ChargeInterval
  /** Periods per renewal, e.g. 3 with `interval="month"` for quarterly. */
  intervalCount?: number
  /** When a trial ends and the first real charge lands. */
  trialEndsAt?: Date | string
  /** Charged today for the trial, e.g. a ₹2 card check. Defaults to 0. */
  trialAmount?: number
  /** An intro price for the first paid periods: `{ amount: 99, periods: 3 }`. */
  intro?: { amount: number; periods: number }
  /** How many hours before a renewal a cancellation must land. */
  cancelNoticeHours?: number
  /** The text on the subscribe button next to this, so a mismatch ("Start free", "₹399/mo") is caught. */
  buttonLabel?: string
  /** Show India's e-mandate notes (24-hour pre-debit alert, OTP above the limit). Defaults on for INR. */
  mandateNotes?: boolean
  /** Per-charge amount above which Indian banks need approval for each renewal (RBI e-mandate). */
  mandateLimit?: number
  /** The moment of subscribing. Pass it for deterministic rendering; otherwise read after mount. */
  now?: Date | string
  /** ISO 4217 currency code. INR turns on the e-mandate notes by default. */
  currency?: string
  /** Locale for money and date formatting. */
  locale?: string
  /** Time zone for every date and time shown. Defaults to the viewer's. */
  timeZone?: string
  /**
   * Zone whose calendar the biller renews on. Defaults to `timeZone`, so a plan bought at
   * 00:30 IST on the 1st renews on the 1st, not the 31st. Pass "UTC" for billers that count in UTC.
   */
  billingTimeZone?: string
  /** Reword or translate any sentence. */
  messages?: Partial<typeof RECURRING_CHARGE_MESSAGES>
}

/**
 * A one-glance readback that sits beside a subscribe button: what's charged today, when
 * the first real charge lands, when an intro price steps up, and the exact cancel-by
 * moment with time and zone. It warns when a trial is too short to cancel in time and
 * when the button's own words ("free", "₹399/mo") disagree with the actual charge.
 * Give the button `aria-describedby` with this element's `id`.
 */
export function RecurringChargeReadback({
  amount,
  interval = "month",
  intervalCount = 1,
  trialEndsAt,
  trialAmount = 0,
  intro,
  cancelNoticeHours = 24,
  buttonLabel,
  currency = "INR",
  mandateNotes = currency === "INR",
  mandateLimit = 15000,
  now: nowProp,
  locale = "en-IN",
  timeZone,
  billingTimeZone,
  messages,
  className,
  ...props
}: RecurringChargeReadbackProps) {
  const m = { ...RECURRING_CHARGE_MESSAGES, ...messages }
  const [mounted, setMounted] = React.useState<Date>()
  React.useEffect(() => setMounted(new Date()), [])
  const now = nowProp ? new Date(nowProp) : mounted
  if (!now || Number.isNaN(now.getTime())) return <div data-slot="recurring-charge-readback" className={cn("min-h-16 text-sm", className)} {...props} />

  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : undefined
  const zone = billingTimeZone ?? timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const plan = planCharges({ amount, interval, intervalCount, now, trialEndsAt: trialEnd, trialAmount, intro, cancelNoticeHours, timeZone: zone })
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
  // Dates in another year carry the year, so "14 Oct" a year out can't read as today.
  const year = (d: Date) => (d.getTime() - now.getTime() > 300 * 86_400_000 ? { year: "numeric" as const } : {})
  const day = (d: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...year(d), timeZone }).format(d)
  const moment = (d: Date) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...year(d), hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" }).format(d)
  // "Cancel before 21 Oct, 12:00 am" reads as the wrong night; show the last minute of the day before.
  const lastMinute = (d: Date) => {
    const [h, min] = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hourCycle: "h23", timeZone }).format(d).split(":").map(Number)
    return h % 24 === 0 && min === 0 ? new Date(d.getTime() - 60_000) : d
  }
  const every = m.every(interval, intervalCount)
  const first = intro ? intro.amount : amount
  const today = plan.steps[0].amount

  const sentence = plan.trial
    ? m.trial(m.today(money(today)), money(first), day(plan.nextCharge), every)
    : m.plain(m.today(money(today)), `${intro && intro.periods > 1 ? money(first) : money(amount)} ${every}`, day(plan.nextCharge))
  const labelIssues = buttonLabel ? auditChargeLabel(buttonLabel, { today, amounts: [amount, first], interval, intervalCount }) : []
  const warnings = [
    plan.cancelClosed && m.cancelClosed(money(plan.nextAmount), day(plan.nextCharge)),
    ...labelIssues.map((issue) =>
      issue.kind === "free" ? m.labelFree(money(today)) : issue.kind === "amount" ? m.labelAmount(money(issue.said!), `${money(today)} today, then ${money(amount)} ${every}`) : m.labelPeriod(`${money(amount)} ${every}`),
    ),
  ].filter(Boolean) as string[]
  const showSteps = plan.steps.length > 1

  return (
    <div data-slot="recurring-charge-readback" aria-live="polite" className={cn("grid w-full max-w-sm gap-2 text-sm", className)} {...props}>
      <p className="flex gap-2">
        <Repeat aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>
          <span className="font-medium">{sentence}</span>{" "}
          {plan.stepUpAt && (plan.trial || intro!.periods > 1) && <span className="font-medium">{m.intro(day(plan.stepUpAt), money(amount), every)} </span>}
          <span className="text-muted-foreground">
            {m.renews}{" "}
            {!plan.cancelClosed && (
              <>
                {m.cancelBy(<span className="font-medium whitespace-nowrap text-foreground">{moment(lastMinute(plan.cancelBy))}</span>, money(plan.nextAmount))}
              </>
            )}
            {plan.monthEnd && ` ${m.monthEnd}`}
          </span>
        </span>
      </p>

      {showSteps && (
        <ol className="ml-6 flex items-stretch gap-1 text-xs">
          {plan.steps.map((step, i) => {
            const jump = step.kind === "step-up" && first > 0 ? amount / first : 0
            return (
              <li key={step.kind} className="flex min-w-0 flex-1 items-center gap-1">
                {i > 0 && <span aria-hidden className="h-px w-2 shrink-0 bg-border" />}
                <span className={cn("min-w-0 flex-1 rounded-md border px-2 py-1", jump >= 2 && "border-amber-500/50 bg-amber-50 dark:bg-amber-950/30")}>
                  <span className="block text-muted-foreground">{i === 0 ? m.stepTitle.today : `${day(step.at)} · ${m.stepTitle[step.kind]}`}</span>
                  <span className="block font-medium tabular-nums">
                    {money(step.amount)}
                    {jump >= 2 && <span className="ml-1 font-normal text-amber-700 dark:text-amber-400">{m.times(new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(jump))}</span>}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {warnings.map((warning) => (
        <p key={warning} className="ml-6 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      ))}

      {mandateNotes && (
        <p className="ml-6 text-xs text-muted-foreground">
          {m.bankNotice}
          {Math.max(amount, first) > mandateLimit && ` ${m.bankApprove(money(mandateLimit))}`}
        </p>
      )}
    </div>
  )
}
