"use client"

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { TriangleAlert } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const tail = rest < 20 ? ONES[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : "")
  return [hundreds ? `${ONES[hundreds]} hundred` : "", tail].filter(Boolean).join(" ")
}

/** Spells out a whole number, in lakh/crore (`indian`) or million/billion (`international`). */
export function numberToWords(n: number, system: "indian" | "international" = "international"): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return "zero"
  const parts: string[] = []
  if (system === "indian") {
    const crore = Math.floor(n / 1e7)
    if (crore) parts.push(`${numberToWords(crore, "indian")} crore`)
    const lakh = Math.floor(n / 1e5) % 100
    const thousand = Math.floor(n / 1e3) % 100
    if (lakh) parts.push(`${below1000(lakh)} lakh`)
    if (thousand) parts.push(`${below1000(thousand)} thousand`)
    if (n % 1000) parts.push(below1000(n % 1000))
  } else {
    const scales = ["", "thousand", "million", "billion", "trillion"]
    for (let i = scales.length - 1; i >= 0; i--) {
      const chunk = Math.floor(n / 1000 ** i) % 1000
      if (chunk) parts.push([below1000(chunk), scales[i]].filter(Boolean).join(" "))
    }
  }
  return parts.join(" ")
}

/**
 * Compares an amount with the usual one and returns the factor of ten it is off by
 * (positive: extra zeros, negative: missing zeros), or 0 when it looks normal.
 */
export function zerosOff(amount: number, typical: number): number {
  if (amount <= 0 || typical <= 0) return 0
  const ratio = amount / typical
  if (ratio >= 10) return Math.floor(Math.log10(ratio))
  if (ratio <= 0.1) return -Math.floor(Math.log10(1 / ratio))
  return 0
}

/** Cheque style: "Rupees Twelve Lakh Only", keeping "and" lowercase. */
const titleCase = (text: string) =>
  text.replace(/(^|[\s-])([a-z]+)/g, (_, gap: string, word: string) => gap + (word === "and" ? word : word[0].toUpperCase() + word.slice(1)))

function formatInfo(locale: string, currency: string) {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 0 })
  const parts = money.formatToParts(1234567.5)
  const name = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "name" }).formatToParts(2).find((p) => p.type === "currency")?.value
  return {
    money,
    symbol: parts.find((p) => p.type === "currency")?.value ?? currency,
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    fraction: money.resolvedOptions().maximumFractionDigits ?? 2,
    whole: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    name: name ?? currency,
  }
}

export interface AmountInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled amount. `null` means empty. */
  value?: number | null
  /** Initial amount when uncontrolled. */
  defaultValue?: number | null
  /** Called with the parsed number, or `null` when the field is empty. */
  onValueChange?: (value: number | null) => void
  /** BCP 47 locale used for grouping, e.g. `en-IN` for 12,34,567. */
  locale?: string
  /** ISO 4217 currency code. */
  currency?: string
  /** Number system for the amount in words, or `false` to hide it. Defaults to `indian` for `-IN` locales. */
  words?: "indian" | "international" | false
  /** The usual amount for this field. 10× above or below it gets an "extra zero?" or "missing zero?" warning. */
  typical?: number
  /** Warning text; `ratio` is like "10×" and `usual` is the formatted typical amount. */
  tooHighMessage?: (ratio: string, usual: string) => string
  /** Warning text when the amount is far below the usual one. */
  tooLowMessage?: (ratio: string, usual: string) => string
  /** Label of the one-tap fix; `amount` is the formatted fixed amount. */
  fixLabel?: (amount: string) => string
  /** Show the amount as an animated figure above the words, so a fix visibly drops or adds the zero. Default true. */
  readback?: boolean
}

const fieldClass =
  "flex h-9 w-full min-w-0 items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A money field that makes an extra (or missing) zero hard to miss: live
 * grouping as you type (lakh/crore for en-IN), the amount spelled out like on
 * a cheque, and a warning with a one-tap fix when it's 10× off the usual amount.
 */
export function AmountInput({
  label = "Amount",
  value,
  defaultValue = null,
  onValueChange,
  locale = "en-IN",
  currency = "INR",
  words,
  typical,
  tooHighMessage = (ratio, usual) => `That's ${ratio} the usual ${usual}. Extra zero?`,
  tooLowMessage = (ratio, usual) => `That's ${ratio} the usual ${usual}. Missing a zero?`,
  fixLabel = (amount) => `Use ${amount}`,
  readback = true,
  name,
  id,
  className,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: AmountInputProps) {
  const info = React.useMemo(() => formatInfo(locale, currency), [locale, currency])
  const reduce = useReducedMotion()
  const pad = (r: string) => (r.includes(".") ? r.padEnd(r.indexOf(".") + 1 + info.fraction, "0") : r)
  const toRaw = (n: number | null | undefined) => (n == null ? "" : pad(String(Number(n.toFixed(info.fraction)))))
  const [raw, setRaw] = React.useState(() => toRaw(value ?? defaultValue))
  const [lastValue, setLastValue] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const amount = raw === "" || raw === "." ? null : Number(raw)

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  // Follow the parent when it changes the value, without clobbering "12." mid-typing.
  if (value !== lastValue) {
    setLastValue(value)
    if (value !== undefined && value !== amount) setRaw(toRaw(value))
  }

  const display = (r: string) => {
    if (!r) return ""
    const [int, frac] = r.split(".")
    const grouped = int ? info.whole.format(Number(int)) : "0"
    return frac === undefined ? grouped : `${grouped}${info.decimal}${frac}`
  }

  const commit = (next: string) => {
    setRaw(next)
    onValueChange?.(next === "" || next === "." ? null : Number(next))
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    const caret = event.target.selectionStart ?? text.length
    const keep = (s: string) => s.replace(new RegExp(`[^\\d${info.decimal === "." ? "\\." : info.decimal}]`, "g"), "")
    const [head = "", ...rest] = keep(text).split(info.decimal)
    const int = head.replace(/^0+(?=\d)/, "").slice(0, 15)
    const frac = rest.join("").slice(0, info.fraction)
    commit(rest.length && info.fraction ? `${int}.${frac}` : int)
    // Put the caret back after the same number of digits it followed before formatting.
    const significant = keep(text.slice(0, caret)).length
    requestAnimationFrame(() => {
      const shown = inputRef.current?.value ?? ""
      let pos = 0
      for (let seen = 0; pos < shown.length && seen < significant; pos++) {
        if (/\d/.test(shown[pos]) || shown[pos] === info.decimal) seen++
      }
      inputRef.current?.setSelectionRange(pos, pos)
    })
  }

  const system = words ?? (/-IN\b/i.test(locale) ? "indian" : "international")
  let spelled = ""
  if (system && amount !== null && amount > 0) {
    const whole = Math.floor(amount)
    const scale = 10 ** info.fraction
    const minor = Math.round((amount - whole) * scale)
    const main = numberToWords(whole, system)
    spelled = titleCase(
      currency === "INR"
        ? `Rupees ${main}${minor ? ` and ${numberToWords(minor)} paise` : ""} only`
        : `${main} ${info.name}${minor ? ` and ${String(minor).padStart(info.fraction, "0")}/${scale}` : ""} only`
    )
  }

  let warning: { text: string; fix?: number } | null = null
  const off = typical && amount ? zerosOff(amount, typical) : 0
  if (typical && amount && off) {
    const fix = amount / 10 ** off
    const usual = info.money.format(typical)
    warning = {
      text: off > 0 ? tooHighMessage(`${Math.floor(amount / typical)}×`, usual) : tooLowMessage(`1/${Math.floor(typical / amount)} of`, usual),
      // Only offer a fix that is exactly the amount with the zeros moved.
      fix: Number(fix.toFixed(info.fraction)) === fix ? fix : undefined,
    }
  }

  return (
    <div data-slot="amount-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div data-warning={warning ? "" : undefined} className={fieldClass}>
        <span aria-hidden className="pl-3 text-sm text-muted-foreground">
          {info.symbol}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          value={display(raw)}
          onChange={handleChange}
          onBlur={(event) => {
            // "1250.5" reads as 1,250.50 once you leave, and a dangling "12." loses its dot.
            if (raw.includes(".")) setRaw(raw.endsWith(".") ? raw.slice(0, -1) : pad(raw))
            onBlur?.(event)
          }}
          aria-describedby={cn(`${inputId}-words ${inputId}-warning`, describedBy)}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-base tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          {...props}
        />
        <span aria-hidden className="pr-3 text-xs text-muted-foreground">
          {currency}
        </span>
      </div>
      {name && <input type="hidden" name={name} value={amount ?? ""} />}
      <div className="min-h-6 text-xs">
        {spelled && (
          <p id={`${inputId}-words`} className="py-1 text-muted-foreground">
            {readback && amount !== null && Number.isFinite(amount) && (
              <>
                <NumberFlow
                  aria-hidden
                  value={amount}
                  locales={locale}
                  format={{ style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: amount % 1 ? info.fraction : 0, maximumFractionDigits: info.fraction }}
                  className={cn("font-semibold text-foreground tabular-nums", warning && "text-amber-700 dark:text-amber-400")}
                />
                <span aria-hidden> · </span>
              </>
            )}
            {spelled}
          </p>
        )}
        <div id={`${inputId}-warning`} aria-live="polite">
          <AnimatePresence initial={false}>
          {warning && (
            <motion.p
              key="warning"
              initial={reduce ? false : { opacity: 0, height: 0, x: -6 }}
              animate={{ opacity: 1, height: "auto", x: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="flex gap-1.5 overflow-hidden text-amber-700 dark:text-amber-400"
            >
              <span className="flex h-6 shrink-0 items-center">
                <TriangleAlert aria-hidden className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">{warning.text}</span>
                {warning.fix !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      if (warning.fix !== undefined) commit(toRaw(warning.fix))
                      inputRef.current?.focus()
                    }}
                    className={fixClass}
                  >
                    {fixLabel(info.money.format(warning.fix))}
                  </button>
                )}
              </span>
            </motion.p>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
