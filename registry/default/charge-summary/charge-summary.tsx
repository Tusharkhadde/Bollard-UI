"use client"

// Bollard UI — charge-summary · MIT licence · https://bollard-ui.vercel.app/components/charge-summary

import * as React from "react"
import { CalendarClock, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ChargeLine {
  label: string
  /** Amount in major units (499 for ₹499). Use a negative amount for credits, proration or discounts. */
  amount: number
  /** False for one-time lines (setup fee, proration, first-month discount). Defaults to true. */
  recurring?: boolean
}

export interface ChargeTax {
  label: string
  /** Percentage, e.g. 18 for 18% GST. */
  rate: number
  /** The line amounts already include this tax (common for GST and VAT prices). It is shown, not added. */
  inclusive?: boolean
}

export type ChargeInterval = "day" | "week" | "month" | "year"

/** Every sentence the summary shows. Override any of them to reword or translate. */
export const CHARGE_SUMMARY_MESSAGES = {
  region: "Charge summary",
  oneTime: "one-time",
  taxAdded: (label: string, rate: string) => `${label} (${rate}%)`,
  taxIncluded: (label: string, rate: string) => `Includes ${label} (${rate}%)`,
  totalToday: "Total today",
  firstCharge: (date: string) => `First charge, ${date}`,
  renews: (date: string) => `Renews ${date}, incl. tax`,
  period: (interval: ChargeInterval, count: number) => (count === 1 ? interval : `${count} ${interval}s`),
  cancelBefore: (date: string) => `Cancel before ${date} and you won't be charged.`,
  priceRises: (renewal: string, diff: string) =>
    `Renewals cost ${renewal}, ${diff} more than the first charge, because one-time credits or discounts don't repeat.`,
  trialSentence: (zero: string, date: string, first: string, renewal: string | null, period: string) =>
    `${zero} today. On ${date}, when your trial ends, you're charged ${first}, then ${renewal ? `${renewal} ` : ""}every ${period} until you cancel.`,
  sentence: (today: string, renewal: string, period: string, date: string) =>
    `${today} today. Then ${renewal} every ${period}, starting ${date}, until you cancel.`,
}

export interface ChargeSummaryProps extends React.ComponentProps<"section"> {
  /** Every line that makes up the charge, fees included, so nothing appears later. */
  lines: ChargeLine[]
  /** Taxes as percentages of the subtotal, e.g. `{ label: "GST", rate: 18 }`, or `inclusive: true` when prices already include it. */
  taxes?: ChargeTax[]
  /** ISO 4217 code. */
  currency?: string
  /** Locale for amounts and dates. */
  locale?: string
  /** Billing period. */
  interval?: ChargeInterval
  /** How many periods each renewal covers, e.g. 3 for quarterly with `interval="month"`. */
  intervalCount?: number
  /** When the free trial ends. Nothing is charged before then. */
  trialEndsAt?: Date | string
  /** The checkout moment. Pass it for deterministic rendering; otherwise the current time is read after mount. */
  now?: Date | string
  /** Time zone used for every date shown. */
  timeZone?: string
  /** Heading above the big number. */
  todayLabel?: string
  /** Reword or translate any sentence. */
  messages?: Partial<typeof CHARGE_SUMMARY_MESSAGES>
}

/** Parses a Date or date string, returning undefined instead of an Invalid Date. */
const toDate = (value?: Date | string) => {
  const date = value === undefined ? undefined : new Date(value)
  return date && !Number.isNaN(date.getTime()) ? date : undefined
}

function addInterval(date: Date, interval: ChargeInterval, count: number) {
  const next = new Date(date)
  if (interval === "day" || interval === "week") {
    next.setDate(next.getDate() + count * (interval === "week" ? 7 : 1))
    return next
  }
  const months = count * (interval === "year" ? 12 : 1)
  const day = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  // Clamp Jan 31 + 1 month to Feb 28/29 instead of rolling into March.
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay))
  return next
}

/**
 * Sums the lines and taxes, rounding each tax to the currency's minor unit (2 for INR, 0 for JPY).
 * Added taxes are charged on top; inclusive taxes are carved out of the subtotal and only reported.
 */
export function chargeTotals(lines: ChargeLine[], taxes: ChargeTax[], digits = 2) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits
  const subtotal = round(lines.reduce((sum, line) => sum + line.amount, 0))
  const base = Math.max(0, subtotal)
  const inclusiveRate = taxes.filter((tax) => tax.inclusive).reduce((sum, tax) => sum + tax.rate, 0)
  const net = base / (1 + inclusiveRate / 100)
  const taxLines = taxes.map((tax) => ({
    label: tax.label,
    rate: tax.rate,
    inclusive: !!tax.inclusive,
    amount: round(((tax.inclusive ? net : base) * tax.rate) / 100),
  }))
  const added = taxLines.filter((tax) => !tax.inclusive).reduce((sum, tax) => sum + tax.amount, 0)
  const total = round(Math.max(0, subtotal + added))
  return { subtotal, taxLines, total }
}

/**
 * An honest checkout summary: what you pay today, when the first real charge
 * lands, what every renewal costs (with tax), and a plain sentence tying it
 * together. Flags when the renewal price is higher than today's so an intro
 * discount or a free trial never turns into a surprise charge.
 */
export function ChargeSummary({
  lines,
  taxes = [],
  currency = "INR",
  locale = "en-IN",
  interval = "month",
  intervalCount = 1,
  trialEndsAt,
  now,
  timeZone,
  todayLabel = "You pay today",
  messages,
  className,
  ...props
}: ChargeSummaryProps) {
  const t = { ...CHARGE_SUMMARY_MESSAGES, ...messages }
  // Without `now`, the clock is read after mount so server and client markup match.
  const [clock, setClock] = React.useState<Date>()
  React.useEffect(() => setClock(new Date()), [])
  const today = toDate(now) ?? clock

  const money = new Intl.NumberFormat(locale, { style: "currency", currency })
  const digits = money.resolvedOptions().maximumFractionDigits ?? 2
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const formatDate = (date?: Date) =>
    date ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone }).format(date) : "…"

  const first = chargeTotals(lines, taxes, digits)
  const renewal = chargeTotals(lines.filter((line) => line.recurring !== false), taxes, digits)
  const trialEnd = toDate(trialEndsAt)
  const firstChargeDate = trialEnd ?? today
  const renewalDate = firstChargeDate && addInterval(firstChargeDate, interval, intervalCount)
  const payToday = trialEnd ? 0 : first.total
  const period = t.period(interval, intervalCount)
  const priceRises = renewal.total > first.total
  const sameAfter = renewal.total === first.total

  const sentence = trialEnd
    ? t.trialSentence(money.format(0), formatDate(trialEnd), money.format(first.total), sameAfter ? null : money.format(renewal.total), period)
    : t.sentence(money.format(payToday), money.format(renewal.total), period, formatDate(renewalDate))

  const row = "flex items-baseline justify-between gap-4 [&>dd]:shrink-0 [&>dd]:whitespace-nowrap"

  return (
    <section
      aria-label={t.region}
      data-slot="charge-summary"
      className={cn("w-full max-w-sm space-y-4 rounded-xl border bg-card p-5 text-sm text-card-foreground", className)}
      {...props}
    >
      <div>
        <p className="text-muted-foreground">{todayLabel}</p>
        <p className="text-3xl font-semibold tabular-nums">{money.format(payToday)}</p>
        {trialEnd && <p className="mt-1 text-muted-foreground">{t.cancelBefore(formatDate(trialEnd))}</p>}
      </div>

      <dl className="space-y-1.5 border-t pt-3">
        {lines.map((line, index) => (
          <div key={index} className={row}>
            <dt className="text-muted-foreground">
              {line.label}
              {line.recurring === false && <span className="ml-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] whitespace-nowrap">{t.oneTime}</span>}
            </dt>
            <dd className={cn("shrink-0 whitespace-nowrap tabular-nums", line.amount < 0 && "text-emerald-700 dark:text-emerald-400")}>{money.format(line.amount)}</dd>
          </div>
        ))}
        {first.taxLines.map((tax) => (
          <div key={tax.label} className={cn(row, tax.inclusive && "text-xs")}>
            <dt className="text-muted-foreground">{(tax.inclusive ? t.taxIncluded : t.taxAdded)(tax.label, percent.format(tax.rate))}</dt>
            <dd className={cn("tabular-nums", tax.inclusive && "text-muted-foreground")}>{money.format(tax.amount)}</dd>
          </div>
        ))}
        <div className={cn(row, "border-t pt-2 font-medium")}>
          <dt>{trialEnd ? t.firstCharge(formatDate(trialEnd)) : t.totalToday}</dt>
          <dd className="tabular-nums">{money.format(first.total)}</dd>
        </div>
        <div className={row}>
          <dt className="text-muted-foreground">{t.renews(formatDate(renewalDate))}</dt>
          <dd className="tabular-nums">{money.format(renewal.total)}</dd>
        </div>
      </dl>

      {priceRises && (
        <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t.priceRises(money.format(renewal.total), money.format(renewal.total - first.total))}</span>
        </p>
      )}

      <p className="flex gap-2 rounded-lg bg-muted/60 p-2.5">
        <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>{sentence}</span>
      </p>
    </section>
  )
}
