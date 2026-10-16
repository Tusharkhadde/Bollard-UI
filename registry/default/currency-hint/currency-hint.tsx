"use client"

// Bollard UI — currency-hint · MIT licence · https://bollard-ui.vercel.app/components/currency-hint

import * as React from "react"
import { ArrowRightLeft, CreditCard, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** Exchange rates in the shape ECB-based feeds (Frankfurter, exchangerate.host) return: units per 1 `base`. */
export interface ExchangeRates {
  base: string
  /** The day the rates are for, "2026-10-09". */
  date: string
  rates: Record<string, number>
}

/** How many `to` one `from` buys, or null when either currency is missing. Works across any base. */
export function crossRate(rates: ExchangeRates, from: string, to: string) {
  const per = (code: string) => (code === rates.base ? 1 : rates.rates[code])
  const a = per(from)
  const b = per(to)
  return a && b ? b / a : null
}

/** Formats money. `approximate` drops false precision: ₹4,519.76 reads ₹4,520 (three figures), ₹69.90 reads ₹70. */
export function formatMoney(amount: number, currency: string, locale?: string, approximate = false) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(!approximate ? {} : Math.abs(amount) >= 100 ? { maximumSignificantDigits: 3 } : Math.abs(amount) >= 10 ? { maximumFractionDigits: 0 } : {}),
  }).format(amount)
}

/** Extra paid when a merchant converts for you: `{ extra, percent }` against the reference amount. */
export function dccMarkup(dccAmount: number, referenceAmount: number) {
  const extra = dccAmount - referenceAmount
  return { extra, percent: referenceAmount > 0 ? (extra / referenceAmount) * 100 : 0 }
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface CurrencyHintProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Price in the merchant's currency. */
  amount: number
  /** Merchant's currency, ISO 4217 ("EUR"). */
  currency: string
  /** The viewer's home or card currency ("INR"). */
  viewerCurrency: string
  /** Reference rates (mid-market), passed in by you. */
  rates: ExchangeRates
  /** Controlled currency the card will be charged in. */
  value?: string
  /** Initial charge currency when uncontrolled. Defaults to `currency`. */
  defaultValue?: string
  /** Called when the viewer picks the other charge currency. */
  onValueChange?: (currency: string) => void
  /** The merchant's own quote in `viewerCurrency` (dynamic currency conversion). Adds a "Pay in" choice. */
  dccAmount?: number
  /** The card's foreign transaction fee in percent, e.g. 3.5. */
  cardFeePercent?: number
  /** Tax charged on that fee in percent, e.g. 18 (GST in India). */
  feeTaxPercent?: number
  /** Warn when the rates are older than this many days. */
  staleAfterDays?: number
  /** Locale for numbers and dates, e.g. "en-IN" for ₹4,52,000 grouping. */
  locale?: string
  /** Name of the rate source, e.g. "ECB". */
  source?: string
  /** Templates. `{rate}`, `{date}`, `{source}`, `{extra}`, `{percent}`, `{fee}`, `{days}` and `{currency}` are filled in. */
  approxText?: string
  /** Warning when the rate is older than staleAfterDays. */
  staleText?: string
  /** Message comparing the merchant's conversion with the reference rate. */
  dccText?: string
  /** Message when the merchant's converted amount is unknown. */
  dccUnknownText?: string
  /** Message estimating card fees. */
  feeText?: string
  /** Label for the pay-in currency choice. */
  payInLabel?: string
  /** Small text under the local-currency option. */
  localHint?: string
  /** Small text under the converted option. */
  merchantHint?: string
  /** Text for switching back to local currency. */
  fixLabel?: string
}

/**
 * A foreign price with an honest conversion: "€49.00 ≈ ₹4,520", rounded to three
 * figures and labelled with the rate and its date, so nobody budgets on a number
 * their bank won't honour. When the merchant offers to charge in your currency it
 * prices that dynamic conversion against the reference rate and offers one tap
 * back to the local currency; otherwise it estimates your card's foreign fee.
 */
export function CurrencyHint({
  amount,
  currency,
  viewerCurrency,
  rates,
  value,
  defaultValue,
  onValueChange,
  dccAmount,
  cardFeePercent,
  feeTaxPercent = 0,
  staleAfterDays = 4,
  locale,
  source,
  approxText = "Approximate, at {rate}{source} on {date}. Your bank sets the final amount.",
  staleText = "This rate is {days} days old.",
  dccText = "Paying in {currency} costs about {extra} ({percent}) more than paying in the local currency.",
  dccUnknownText = "Paying in {currency} uses the merchant's own rate, usually 3–8% worse than your card's.",
  feeText = "Your card may add about {fee} in foreign transaction fees.",
  payInLabel = "Pay in",
  localHint = "local currency",
  merchantHint = "merchant's rate",
  fixLabel = "Pay in {currency}",
  className,
  ...props
}: CurrencyHintProps) {
  const [inner, setInner] = React.useState(defaultValue ?? currency)
  const charge = value ?? inner
  const [now, setNow] = React.useState<number>()
  const flashRef = React.useRef<HTMLParagraphElement>(null)
  const name = React.useId()
  React.useEffect(() => setNow(Date.now()), [])

  const choose = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const rate = crossRate(rates, currency, viewerCurrency)
  const converted = rate === null ? null : amount * rate
  const dcc = charge === viewerCurrency && viewerCurrency !== currency
  const quoted = dcc && dccAmount !== undefined
  const money = (n: number, approx = true, code = viewerCurrency) => formatMoney(n, code, locale, approx)

  // Flash the price when the charge currency changes, so the new total is noticed.
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) return void (first.current = false)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    flashRef.current?.animate([{ backgroundColor: "rgb(245 158 11 / 0.3)" }, { backgroundColor: "rgb(245 158 11 / 0)" }], { duration: 400, easing: "ease-out" })
  }, [charge])

  if (viewerCurrency === currency || rate === null || converted === null) {
    return (
      <div data-slot="currency-hint" className={cn("text-base font-semibold tabular-nums", className)} {...props}>
        {formatMoney(amount, currency, locale)}
      </div>
    )
  }

  const rateDay = new Date(`${rates.date}T00:00:00Z`)
  const days = now === undefined ? 0 : Math.floor((now - rateDay.getTime()) / 86_400_000)
  const markup = dccAmount === undefined ? null : dccMarkup(dccAmount, converted)
  const fee = cardFeePercent ? (converted * cardFeePercent * (1 + feeTaxPercent / 100)) / 100 : 0
  const values = {
    rate: `${formatMoney(1, currency, locale).replace(/[.,]00$/, "")} = ${formatMoney(rate, viewerCurrency, locale)}`,
    source: source ? ` (${source})` : "",
    date: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(rateDay),
    currency: viewerCurrency,
    days: String(days),
    extra: markup ? money(markup.extra) : "",
    percent: markup ? `${markup.percent.toFixed(1)}%` : "",
    fee: money(fee),
  }

  return (
    <div data-slot="currency-hint" data-dcc={dcc || undefined} className={cn("grid w-full max-w-sm gap-1.5 text-sm", className)} {...props}>
      <p ref={flashRef} className="-mx-1 flex flex-wrap items-baseline gap-x-2 rounded-md px-1">
        <span className="text-base font-semibold tabular-nums">{quoted ? money(dccAmount, false) : formatMoney(amount, currency, locale)}</span>
        <span className="text-muted-foreground tabular-nums">
          {quoted ? `for ${formatMoney(amount, currency, locale)}` : `≈ ${money(converted)}`}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{fill(approxText, values)}</p>

      {dccAmount !== undefined && (
        <fieldset className="@container mt-1.5">
          <legend className="mb-1.5 text-xs font-medium">{payInLabel}</legend>
          <div className="grid gap-2 @xs:grid-cols-2">
            {[currency, viewerCurrency].map((code) => (
              <label
                key={code}
                className={cn(
                  "flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 shadow-xs transition-colors has-checked:border-primary has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 dark:bg-input/30",
                  code === viewerCurrency && "has-checked:border-amber-500 dark:has-checked:border-amber-400",
                )}
              >
                <input type="radio" name={name} value={code} checked={charge === code} onChange={() => choose(code)} className="accent-primary outline-none" />
                <span className="grid min-w-0">
                  <span className="truncate font-medium tabular-nums">
                    {code === currency ? formatMoney(amount, currency, locale) : money(dccAmount, false)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {code} · {code === currency ? localHint : merchantHint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div aria-live="polite" className="grid gap-1 text-xs empty:hidden">
        {dcc && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <ArrowRightLeft aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(markup && markup.extra > 0 ? dccText : dccUnknownText, values)}</span>
              <button type="button" onClick={() => choose(currency)} className={fixClass}>
                {fill(fixLabel, { currency })}
              </button>
            </span>
          </p>
        )}
        {!dcc && fee > 0 && (
          <p className="flex items-start gap-1.5 py-1 text-muted-foreground">
            <CreditCard aria-hidden className="mt-px size-3.5 shrink-0" />
            {fill(feeText, values)}
          </p>
        )}
        {days > staleAfterDays && (
          <p className="flex items-start gap-1.5 py-1 text-amber-700 dark:text-amber-400">
            <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {fill(staleText, values)}
          </p>
        )}
      </div>
    </div>
  )
}
