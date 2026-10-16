"use client"

import * as React from "react"
import { TriangleAlert, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  checkPrice,
  convertPrice,
  parsePrice,
  type BillingPeriod,
  type PriceBasis,
  type PriceReference,
  type PriceSlip,
} from "@/registry/default/billing-period-input/billing-period"

export * from "@/registry/default/billing-period-input/billing-period"

/** Default messages. `{price}`, `{ratio}`, `{reference}`, `{seats}`, `{each}`, `{period}` are filled in. Period names in readbacks come from the period ids. */
export const BILLING_PERIOD_MESSAGES = {
  period: "{price} is {ratio}× {reference}. Is it a {period} price?",
  "total-as-seat": "{price} per seat is {ratio}× {reference}. Is it the total for {seats} seats?",
  "seat-as-total": "{price} for all {seats} seats is only {each} each. Is it per seat?",
  jump: "{price} is {ratio}× {reference}. Double-check the amount.",
  usePeriod: "It's per {period}",
  useTotal: "It's the total",
  useSeat: "It's per seat",
  reference: "the current price",
  perSeat: "per seat",
  total: "total for {seats}",
  forSeats: "{seats} seats:",
  eachSeat: "{each} per seat",
  periodLabel: "Billing period",
  per: "per {period}",
  perMonth: "{price}/month",
}

const UNITS: Record<BillingPeriod, { unit: string; adjective: string; short: string }> = {
  week: { unit: "week", adjective: "weekly", short: "Week" },
  month: { unit: "month", adjective: "monthly", short: "Month" },
  quarter: { unit: "quarter", adjective: "quarterly", short: "Quarter" },
  year: { unit: "year", adjective: "yearly", short: "Year" },
}

/** The field's value: the amount as typed, the period it is billed every, and whether it is per seat. */
export interface BillingPriceValue {
  amount: string
  period: BillingPeriod
  basis: PriceBasis
}

export interface BillingPeriodInputProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled value. */
  value?: BillingPriceValue
  /** Initial value when uncontrolled. */
  defaultValue?: Partial<BillingPriceValue>
  /** Called with the value and the parsed amount (null while it isn't a number). */
  onValueChange?: (value: BillingPriceValue, amount: number | null) => void
  /** ISO currency code. */
  currency?: string
  /** Locale for amounts, e.g. "en-IN" for ₹1,49,900 grouping. */
  locale?: string
  /** Periods offered, shortest first. All of them are read back. */
  periods?: BillingPeriod[]
  /** Seats on the plan. When set, the price can be per seat or a total and the team total is read back. */
  seats?: number
  /** A known price to compare against, which turns on the slip warnings. */
  reference?: PriceReference
  /** Override any of the default messages. */
  messages?: Partial<typeof BILLING_PERIOD_MESSAGES>
}

const control =
  "h-9 min-w-0 rounded-md border bg-transparent text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const keyframes = `@keyframes cui-billing-period-input-flash{0%{background-color:rgb(16 185 129 / .3)}100%{background-color:transparent}}`
const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

/**
 * A recurring-price field that reads the price back in every period ("₹499/month = ₹5,988/year")
 * and, given a reference price, catches the classic pricing slips: a yearly price typed into the
 * monthly field (or the reverse, with discounted annual plans in mind), a team total entered as a
 * per-seat price and the other way round, and any implausible jump. Each comes with a one-tap fix.
 */
export function BillingPeriodInput({
  label = "Price",
  value,
  defaultValue,
  onValueChange,
  currency = "INR",
  locale = "en-IN",
  periods = ["week", "month", "quarter", "year"],
  seats,
  reference,
  messages,
  id,
  className,
  ...props
}: BillingPeriodInputProps) {
  const [inner, setInner] = React.useState<BillingPriceValue>({ amount: "", period: "month", basis: seats ? "seat" : "total", ...defaultValue })
  const [flash, setFlash] = React.useState(0)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const t = { ...BILLING_PERIOD_MESSAGES, ...messages }
  const current = value ?? inner
  const amount = parsePrice(current.amount)
  const team = seats && seats > 1 ? seats : 0
  const basis = team ? current.basis : "total"

  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 && n < 1000 ? 2 : 0, minimumFractionDigits: 0 }).format(n)
  const symbol = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency

  const commit = (patch: Partial<BillingPriceValue>, applied = false) => {
    const next = { ...current, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next, parsePrice(next.amount))
    if (applied) setFlash((n) => n + 1)
  }

  const slips = amount === null ? [] : checkPrice({ amount, period: current.period, basis, seats: team || 1 }, reference, periods)
  const price = amount === null ? "" : `${money(amount)}/${UNITS[current.period].unit}`
  const refText = reference
    ? `${reference.label ?? t.reference} (${money(reference.amount)}/${UNITS[reference.period].unit}${reference.basis === "seat" ? ` ${t.perSeat}` : ""})`
    : ""
  const ratio = (r: number) => (r >= 1 ? (r >= 10 ? Math.round(r) : Math.round(r * 10) / 10) : `1/${Math.round(1 / r)}`)

  const describe = (slip: PriceSlip) => {
    const values = { price, ratio: ratio(slip.ratio), reference: refText, seats: team, each: amount === null ? "" : money(amount / (team || 1)) }
    if (slip.kind === "period") {
      const fix = { label: fill(t.usePeriod, { period: UNITS[slip.meant].unit }), run: () => commit({ period: slip.meant }, true) }
      return { text: fill(t.period, { ...values, period: UNITS[slip.meant].adjective }), fix }
    }
    if (slip.kind === "total-as-seat") return { text: fill(t[slip.kind], values), fix: { label: t.useTotal, run: () => commit({ basis: "total" }, true) } }
    if (slip.kind === "seat-as-total") return { text: fill(t[slip.kind], values), fix: { label: t.useSeat, run: () => commit({ basis: "seat" }, true) } }
    return { text: fill(t.jump, values), fix: null }
  }

  const perSeatAmount = amount === null ? null : basis === "seat" ? amount : amount / (team || 1)
  const teamAmount = amount === null ? null : basis === "seat" ? amount * (team || 1) : amount

  return (
    <div data-slot="billing-period-input" className={cn("grid content-start w-full max-w-sm gap-1.5", className)} {...props}>
      <style>{keyframes}</style>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <div
          data-warning={slips.length ? "" : undefined}
          className={cn(control, "flex flex-1 items-center focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 data-warning:border-amber-500 dark:data-warning:border-amber-400")}
        >
          <span aria-hidden className="pl-3 text-muted-foreground">{symbol}</span>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={current.amount}
            onChange={(event) => commit({ amount: event.target.value })}
            aria-describedby={`${inputId}-status`}
            className="h-full w-full min-w-0 bg-transparent px-2 tabular-nums outline-none"
          />
        </div>
        <select
          aria-label={t.periodLabel}
          value={current.period}
          onChange={(event) => commit({ period: event.target.value as BillingPeriod })}
          className={cn(control, "w-28 px-2")}
        >
          {periods.map((p) => <option key={p} value={p}>{fill(t.per, { period: UNITS[p].unit })}</option>)}
        </select>
      </div>
      {team > 0 && (
        <div role="radiogroup" aria-label="Price basis" className="flex w-fit rounded-md border p-0.5 text-xs">
          {(["seat", "total"] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={basis === b}
              onClick={() => commit({ basis: b })}
              className="h-7 rounded-sm px-2.5 font-medium text-muted-foreground transition-colors aria-checked:bg-accent aria-checked:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {b === "seat" ? t.perSeat : fill(t.total, { seats: team })}
            </button>
          ))}
        </div>
      )}
      <div id={`${inputId}-status`} aria-live="polite" className="grid gap-1.5 text-xs">
        {amount !== null && amount > 0 && (
          <dl key={flash} className={cn("grid grid-cols-2 overflow-hidden rounded-md border sm:grid-cols-4", flash > 0 && "motion-safe:animate-[cui-billing-period-input-flash_400ms_ease-out]")}>
            {periods.map((p) => (
              <div key={p} data-current={p === current.period || undefined} className="px-2 py-1.5 transition-colors duration-300 even:border-l data-current:bg-muted [&:nth-child(n+3)]:border-t sm:border-l sm:first:border-l-0 sm:[&:nth-child(n+3)]:border-t-0">
                <dt className="text-muted-foreground">{UNITS[p].short}</dt>
                <dd className="truncate font-medium tabular-nums text-foreground">{money(convertPrice(amount, current.period, p))}</dd>
              </div>
            ))}
          </dl>
        )}
        {team > 0 && perSeatAmount !== null && teamAmount !== null && perSeatAmount > 0 && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Users aria-hidden className="size-3.5 shrink-0" />
            <span>
              {fill(t.forSeats, { seats: team })}{" "}
              <span className="font-medium text-foreground tabular-nums">{fill(t.perMonth, { price: money(convertPrice(teamAmount, current.period, "month")) })}</span>
              {" · "}
              {fill(t.eachSeat, { each: fill(t.perMonth, { price: money(convertPrice(perSeatAmount, current.period, "month")) }) })}
            </span>
          </p>
        )}
        {slips.map((slip) => {
          const { text, fix } = describe(slip)
          return (
            <p key={slip.kind + ("meant" in slip ? slip.meant : "")} data-warning-id={slip.kind} className="flex gap-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="py-1">{text}</span>
                {fix && <button type="button" onClick={fix.run} className={fixClass}>{fix.label}</button>}
              </span>
            </p>
          )
        })}
      </div>
    </div>
  )
}
