"use client"

import * as React from "react"
import { TriangleAlert, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"

export interface TaxPrice {
  /** The number typed in the field, or null when empty. */
  amount: number | null
  /** Tax rate in percent (18 means 18%). */
  rate: number
  /** True when `amount` already contains the tax. */
  includesTax: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Net, tax and gross for a price, rounded to the minor unit. */
export function taxBreakdown({ amount, rate, includesTax }: TaxPrice) {
  if (amount === null || !Number.isFinite(amount)) return null
  const net = round2(includesTax ? amount / (1 + rate / 100) : amount)
  const gross = round2(includesTax ? amount : amount * (1 + rate / 100))
  return { net, tax: round2(gross - net), gross }
}

/** India's GST slabs since 22 Sep 2025 (12% and 28% were removed). */
export const GST_RATES = [0, 5, 18, 40]

/**
 * A rate that is probably a typo: a fraction (0.18), a multiplier (1.18), a slipped
 * digit (180) or anything over 50%. Returns the likely rate, or `null` with a note.
 */
export function checkRate(rate: number, known: number[] = GST_RATES): { likely: number | null; note: string } | null {
  const near = (r: number) => known.find((k) => k > 0 && Math.abs(k - r) < 0.001)
  if (rate > 0 && rate < 1 && near(rate * 100)) return { likely: near(rate * 100)!, note: "{rate}% looks like a fraction." }
  if (rate > 1 && rate < 2 && near((rate - 1) * 100)) return { likely: near((rate - 1) * 100)!, note: "{rate}% looks like a multiplier." }
  if (rate >= 50 && near(rate / 10)) return { likely: near(rate / 10)!, note: "{rate}% is unusually high." }
  if (rate >= 50) return { likely: null, note: "{rate}% is unusually high for a sales tax." }
  if (known.length && !known.includes(rate)) return { likely: null, note: "{rate}% isn't one of the usual rates ({known})." }
  return null
}

/**
 * True when an amount marked "excludes tax" divides back to a round net price,
 * like ₹1,180 at 18% (= ₹1,000): the tax is probably already in it.
 */
export function looksTaxInclusive(amount: number, rate: number, step = 50) {
  if (rate <= 0 || amount % step === 0) return false
  const net = amount / (1 + rate / 100)
  return Math.abs(net - Math.round(net)) < 0.005 && Math.round(net) % step === 0
}

export interface TaxInclusiveInputProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label of the amount field. */
  label?: string
  /** Amount, rate and includes-tax flag (controlled). */
  value?: TaxPrice
  /** Starting price when uncontrolled. */
  defaultValue?: TaxPrice
  /** Called with the price after every change. */
  onValueChange?: (value: TaxPrice) => void
  /** ISO currency code. */
  currency?: string
  /** Locale for money formatting. */
  locale?: string
  /** "GST", "VAT", "sales tax". */
  taxName?: string
  /** Rates that are normal where you sell; others get a gentle note. Pass [] to skip that check. */
  rates?: number[]
  /** Templates: {net}, {tax}, {gross}, {rate}, {taxName} and {amount} are filled in. */
  inclusiveReadback?: string
  /** Readback when the amount excludes tax. */
  exclusiveReadback?: string
  /** Label of the includes-tax option. */
  includesLabel?: string
  /** Label of the excludes-tax option. */
  excludesLabel?: string
  /** Warning when an excludes-tax amount looks already taxed. */
  alreadyTaxedText?: string
  /** Warning when switching mode changed the total. */
  switchedText?: string
  /** Label of the keep-the-total fix. */
  keepTotalLabel?: string
  /** Label of the use-likely-rate fix. */
  useRateLabel?: string
  /** Label of the treat-as-inclusive fix. */
  alreadyTaxedFixLabel?: string
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
const parse = (text: string) => (text.trim() === "" ? null : Number(text.replace(/[,\s]/g, "")))
const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs tabular-nums transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A price field that makes "does this include tax?" an explicit choice and reads the
 * split back (₹1,180 incl. 18% GST = ₹1,000 + ₹180). It catches tax added twice (an
 * "excludes" price that divides back to a round number, or a mode switch that silently
 * changed the total) and rates that are typos (0.18, 1.18, 180), each with a one-tap fix.
 */
export function TaxInclusiveInput({
  label = "Price",
  value,
  defaultValue = { amount: null, rate: 18, includesTax: true },
  onValueChange,
  currency = "INR",
  locale = "en-IN",
  taxName = "GST",
  rates = GST_RATES,
  inclusiveReadback = "{gross} incl. {rate}% {taxName} = {net} + {tax}",
  exclusiveReadback = "{net} + {rate}% {taxName} ({tax}) = {gross}",
  includesLabel = "Includes {taxName}",
  excludesLabel = "Excludes {taxName}",
  alreadyTaxedText = "{amount} is exactly {net} + {rate}%. Is {taxName} already in it?",
  switchedText = "Switching changed the total from {before} to {gross}.",
  keepTotalLabel = "Keep {before}",
  useRateLabel = "Use {rate}%",
  alreadyTaxedFixLabel = "Yes, it includes {taxName}",
  className,
  ...props
}: TaxInclusiveInputProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const price = value ?? inner
  const [text, setText] = React.useState(price.amount?.toString() ?? "")
  const [rateText, setRateText] = React.useState(String(price.rate))
  const [switchedFrom, setSwitchedFrom] = React.useState<number | null>(null)
  const totalRef = React.useRef<HTMLElement>(null)
  const id = React.useId()

  // Follow outside changes (a controlled value, a one-tap fix) without fighting the caret while typing.
  if (parse(text) !== price.amount && !(price.amount === null && text === "")) setText(price.amount?.toString() ?? "")
  if (Number(rateText) !== price.rate) setRateText(String(price.rate))

  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
  const update = (next: TaxPrice) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const breakdown = taxBreakdown(price)
  const vars = breakdown && {
    net: money(breakdown.net), tax: money(breakdown.tax), gross: money(breakdown.gross),
    rate: String(price.rate), taxName, amount: money(price.amount!), before: switchedFrom === null ? "" : money(switchedFrom),
  }
  const rateIssue = checkRate(price.rate, rates)
  const doubleTax = !price.includesTax && price.amount !== null && looksTaxInclusive(price.amount, price.rate)
  const switched = switchedFrom !== null && breakdown && breakdown.gross !== switchedFrom

  React.useEffect(() => {
    if (switchedFrom === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    totalRef.current?.animate([{ backgroundColor: "rgb(245 158 11 / 0.4)" }, {}], { duration: 400, easing: "ease-out" })
  }, [switchedFrom, price.includesTax])

  const setMode = (includesTax: boolean) => {
    if (includesTax === price.includesTax) return
    setSwitchedFrom(breakdown?.gross ?? null)
    update({ ...price, includesTax })
  }
  const keepTotal = () => {
    if (switchedFrom === null) return
    update({ ...price, amount: price.includesTax ? switchedFrom : round2(switchedFrom / (1 + price.rate / 100)) })
    setSwitchedFrom(null)
  }

  const warn = (message: string, action?: React.ReactNode) => (
    <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
      <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2"><span className="py-1">{message}</span>{action}</span>
    </p>
  )

  return (
    <div data-slot="tax-inclusive-input" className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <label htmlFor={`${id}-amount`} className="w-fit text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          id={`${id}-amount`}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.,]/g, "")
            setText(raw)
            setSwitchedFrom(null)
            const amount = parse(raw)
            if (amount === null || Number.isFinite(amount)) update({ ...price, amount })
          }}
          data-warning={doubleTax ? "" : undefined}
          aria-describedby={`${id}-readback`}
          className={fieldClass}
        />
        <div className="relative w-20 shrink-0">
          <input
            aria-label={`${taxName} rate in percent`}
            inputMode="decimal"
            value={rateText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.]/g, "")
              setRateText(raw)
              if (Number.isFinite(Number(raw))) update({ ...price, rate: Number(raw) })
            }}
            data-warning={rateIssue?.likely != null ? "" : undefined}
            className={cn(fieldClass, "pr-7")}
          />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
        </div>
      </div>
      <div role="radiogroup" aria-label={`Does the price include ${taxName}?`} className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {[true, false].map((inc) => (
          <button
            key={String(inc)}
            type="button"
            role="radio"
            aria-checked={price.includesTax === inc}
            onClick={() => setMode(inc)}
            className="h-7 rounded-sm text-sm font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs dark:aria-checked:bg-input/50"
          >
            {fill(inc ? includesLabel : excludesLabel, { taxName })}
          </button>
        ))}
      </div>
      <p id={`${id}-readback`} className="min-h-5 text-sm tabular-nums">
        {vars && (
          <span ref={totalRef} className="rounded-sm">
            {fill(price.includesTax ? inclusiveReadback : exclusiveReadback, vars)}
          </span>
        )}
      </p>
      <div aria-live="polite" className="grid gap-1 text-xs">
        {switched && vars && warn(fill(switchedText, vars), (
          <button type="button" onClick={keepTotal} className={fixClass}><Undo2 aria-hidden className="size-3" />{fill(keepTotalLabel, vars)}</button>
        ))}
        {!switched && doubleTax && vars && warn(fill(alreadyTaxedText, { ...vars, net: money(Math.round(price.amount! / (1 + price.rate / 100))) }), (
          <button type="button" onClick={() => update({ ...price, includesTax: true })} className={fixClass}>{fill(alreadyTaxedFixLabel, { taxName })}</button>
        ))}
        {rateIssue && warn(fill(rateIssue.note, { rate: String(price.rate), known: rates.map((r) => `${r}%`).join(", ") }), rateIssue.likely !== null && (
          <button type="button" onClick={() => update({ ...price, rate: rateIssue.likely! })} className={fixClass}>{fill(useRateLabel, { rate: String(rateIssue.likely) })}</button>
        ))}
      </div>
    </div>
  )
}
