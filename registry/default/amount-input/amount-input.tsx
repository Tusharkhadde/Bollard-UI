"use client"

// Bollard UI — amount-input · MIT licence · https://bollard-ui.vercel.app/components/amount-input

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

/** Exact forms of the amount, for money maths without float rounding. */
export interface AmountDetail {
  /** Decimal string padded to the currency's decimals, e.g. "1250.50". */
  decimal: string
  /** Integer string in minor units, e.g. "125050". Pass it to `BigInt()` if you need arithmetic. */
  minor: string
}

/** What a custom `wordsFormatter` receives. */
export interface AmountWordsParts {
  /** Whole units as a digit string, e.g. "1250". */
  whole: string
  /** Minor units padded to the currency's decimals, e.g. "50" (empty for zero-decimal currencies). */
  minor: string
  /** The exact decimal string, e.g. "1250.50". */
  decimal: string
  currency: string
  locale: string
  system: "indian" | "international"
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Turns typed or pasted text into a plain "1234.5" string using the locale's decimal mark. */
export function normalizeAmount(text: string, decimal: string, fraction: number, maxDigits = 15) {
  const [head = "", ...rest] = text.replace(new RegExp(`[^\\d${escape(decimal)}]`, "g"), "").split(decimal)
  const intAll = head.replace(/^0+(?=\d)/, "")
  const fracAll = rest.join("")
  const truncated: "digits" | "decimals" | null = intAll.length > maxDigits ? "digits" : fracAll.length > fraction ? "decimals" : null
  const int = intAll.slice(0, maxDigits)
  return { raw: rest.length && fraction ? `${int}.${fracAll.slice(0, fraction)}` : int, truncated }
}

/**
 * Checks a pasted amount that could be read two ways (`1.250,50` in an en-IN field,
 * `1.250.000`, `12,5`). Returns the swapped-separator reading when it is plausible and
 * differs from the default one, else `null`.
 */
export function readPastedAmount(text: string, decimal: string, fraction: number, maxDigits = 15): { usual: string; swapped: string } | null {
  const other = decimal === "," ? "." : ","
  const s = text.replace(new RegExp(`[^\\d${escape(decimal)}${escape(other)}]`, "g"), "")
  const lastDecimal = s.lastIndexOf(decimal)
  const decimals = s.split(decimal).length - 1
  const afterDecimal = lastDecimal < 0 ? "" : (s.slice(lastDecimal + 1).match(/^\d*/)?.[0] ?? "")
  const lastGroup = s.lastIndexOf(other)
  const groupTail = lastGroup < 0 ? "" : (s.slice(lastGroup + 1).match(/^\d*/)?.[0] ?? "")
  const suspicious =
    (lastGroup > lastDecimal && lastDecimal >= 0) || // other separator after the decimal mark: 1.250,50
    decimals > 1 || // repeated decimal mark: 1.250.000
    (decimals === 1 && afterDecimal.length === 3 && fraction < 3) || // 1.250 in a 2-decimal currency
    (lastGroup >= 0 && groupTail.length !== 3) // group separator without 3 digits after it: 12,5
  if (!suspicious || s.split(other).length > 2) return null
  const usual = normalizeAmount(s, decimal, fraction, maxDigits).raw
  const swapped = normalizeAmount(s.split(decimal).join("").replace(other, decimal), decimal, fraction, maxDigits).raw
  return toDecimal(usual, fraction) === toDecimal(swapped, fraction) ? null : { usual, swapped }
}

/** "1250.5" → "1250.50"; "12." → "12"; "" → "". */
function toDecimal(raw: string, fraction: number) {
  if (raw === "" || raw === ".") return ""
  const [int, frac] = raw.split(".")
  return frac === undefined || fraction === 0 ? int || "0" : `${int || "0"}.${frac.padEnd(fraction, "0")}`
}

/** Moves the decimal point (`places` > 0 multiplies by 10^places) and trims zeros. */
function shift(raw: string, places: number) {
  const [int = "", frac = ""] = raw.split(".")
  let digits = int + frac
  let point = int.length + places
  if (point < 0) {
    digits = "0".repeat(-point) + digits
    point = 0
  }
  if (point > digits.length) digits = digits.padEnd(point, "0")
  return { int: digits.slice(0, point).replace(/^0+(?=\d)/, "") || "0", frac: digits.slice(point).replace(/0+$/, "") }
}

/** Cheque style: "Rupees Twelve Lakh Only", keeping "and" lowercase. */
const titleCase = (text: string) =>
  text.replace(/(^|[\s-])([a-z]+)/g, (_, gap: string, word: string) => gap + (word === "and" ? word : word[0].toUpperCase() + word.slice(1)))

const unitName = (locale: string, currency: string, count: number) =>
  new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "name", minimumFractionDigits: 0 })
    .formatToParts(count)
    .find((p) => p.type === "currency")?.value ?? currency

/** Default English words: "Rupees Twelve Lakh Only", "One US Dollar and 50/100 Only". */
export function defaultAmountWords({ whole, minor, currency, locale, system }: AmountWordsParts): string {
  const n = Number(whole)
  const main = numberToWords(n, system)
  if (currency === "INR") return titleCase(`rupees ${main}${Number(minor) ? ` and ${numberToWords(Number(minor))} paise` : ""} only`)
  const one = new Intl.PluralRules(locale).select(n) === "one"
  const name = unitName(locale, currency, one ? 1 : 2)
  return titleCase(`${main} ${name}${Number(minor) ? ` and ${minor}/${10 ** minor.length}` : ""} only`)
}

function formatInfo(locale: string, currency: string) {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 0 })
  const parts = money.formatToParts(1234567.5)
  return {
    money,
    symbol: parts.find((p) => p.type === "currency")?.value ?? currency,
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    fraction: money.resolvedOptions().maximumFractionDigits ?? 2,
    whole: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    ratio: new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }),
  }
}

export interface AmountInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> {
  /** Visible label. */
  label?: string
  /** Controlled amount: a number or an exact decimal string like "1250.50". `null` means empty. */
  value?: number | string | null
  /** Initial amount when uncontrolled (number or decimal string). */
  defaultValue?: number | string | null
  /** Called with the parsed number (or `null` when empty) and, when not empty, the exact decimal and minor-unit strings. */
  onValueChange?: (value: number | null, detail?: AmountDetail) => void
  /** BCP 47 locale used for grouping, e.g. `en-IN` for 12,34,567. Defaults to India. */
  locale?: string
  /** ISO 4217 currency code. Defaults to INR. */
  currency?: string
  /** Number system for the amount in words, or `false` to hide it. Defaults to `indian` for `-IN` locales. */
  words?: "indian" | "international" | false
  /** Builds the amount in words; defaults to English cheque style. Use it to translate. */
  wordsFormatter?: (parts: AmountWordsParts) => string
  /** The usual amount for this field. Amounts `threshold`× above or below it get a warning. */
  typical?: number
  /** How many times off `typical` an amount must be to warn. Default 10. */
  threshold?: number
  /** Warning text; `ratio` is like "16×", `usual` the formatted typical amount, `zeros` how many zeros it looks off by (0 when not a zero slip). */
  tooHighMessage?: (ratio: string, usual: string, zeros: number) => string
  /** Warning text when the amount is far below the usual one (`zeros` is negative or 0). */
  tooLowMessage?: (ratio: string, usual: string, zeros: number) => string
  /** Label of the one-tap fix; `amount` is the formatted fixed amount. */
  fixLabel?: (amount: string) => string
  /** Most digits accepted before the decimal point. Default 15. */
  maxDigits?: number
  /** Hint shown when typed digits were dropped. */
  truncatedMessage?: (kind: "digits" | "decimals", limit: number) => string
  /** Question shown when a paste could be read two ways. */
  pasteMessage?: (pasted: string) => string
  /** Show the ISO code after the field. Default true. */
  showCurrencyCode?: boolean
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
 * a cheque, a warning with a one-tap fix when it's far off the usual amount,
 * and a "which did you mean?" check for pastes in another locale's format.
 */
export function AmountInput({
  label = "Amount",
  value,
  defaultValue = null,
  onValueChange,
  locale = "en-IN",
  currency = "INR",
  words,
  wordsFormatter = defaultAmountWords,
  typical,
  threshold = 10,
  tooHighMessage = (ratio, usual, zeros) => `That's ${ratio} the usual ${usual}.${zeros > 0 ? " Extra zero?" : ""}`,
  tooLowMessage = (ratio, usual, zeros) => `That's ${ratio} the usual ${usual}.${zeros < 0 ? " Missing a zero?" : ""}`,
  fixLabel = (amount) => `Use ${amount}`,
  maxDigits = 15,
  truncatedMessage = (kind, limit) =>
    kind === "digits" ? `Only ${limit} digits fit before the decimal point; the rest were dropped.` : limit ? `Only ${limit} decimal places; extra digits were dropped.` : "This currency has no decimals; they were dropped.",
  pasteMessage = (pasted) => `You pasted "${pasted}". Which did you mean?`,
  showCurrencyCode = true,
  readback = true,
  name,
  id,
  className,
  onBlur,
  onPaste,
  ref,
  "aria-describedby": describedBy,
  ...props
}: AmountInputProps) {
  const info = React.useMemo(() => formatInfo(locale, currency), [locale, currency])
  const reduce = useReducedMotion()
  const toRaw = (v: number | string | null | undefined) => {
    if (v == null || (typeof v === "number" && !Number.isFinite(v))) return ""
    const s = typeof v === "number" ? Math.abs(v).toFixed(info.fraction) : v.replace(/[^\d.]/g, "")
    const exact = toDecimal(normalizeAmount(s, ".", info.fraction, maxDigits).raw, info.fraction)
    return /\.0*$/.test(exact) ? exact.replace(/\.0*$/, "") : exact
  }
  const [raw, setRaw] = React.useState(() => toRaw(value ?? defaultValue))
  const [lastValue, setLastValue] = React.useState(value)
  const [truncated, setTruncated] = React.useState<"digits" | "decimals" | null>(null)
  const [paste, setPaste] = React.useState<{ text: string; usual: string; swapped: string } | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const decimal = toDecimal(raw, info.fraction)
  const amount = decimal === "" ? null : Number(decimal)

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  // "25000.00" and "25000" are the same amount; don't rewrite what the user typed.
  const same = (d: string) => (d.includes(".") ? d.replace(/\.?0+$/, "") : d)

  // Follow the parent when it changes the value, without clobbering "12." mid-typing.
  if (value !== lastValue) {
    setLastValue(value)
    if (value !== undefined && same(toRaw(value)) !== same(decimal)) setRaw(toRaw(value))
  }

  const display = (r: string) => {
    if (!r) return ""
    const [int, frac] = r.split(".")
    const grouped = int ? info.whole.format(BigInt(int)) : "0"
    return frac === undefined ? grouped : `${grouped}${info.decimal}${frac}`
  }
  /** Always padded to the currency's decimals: "25000" → "25000.00". */
  const padded = (r: string) => {
    const d = toDecimal(r, info.fraction)
    return d && info.fraction && !d.includes(".") ? `${d}.${"0".repeat(info.fraction)}` : d
  }
  const formatRaw = (r: string) => info.money.format(Number(toDecimal(r, info.fraction)))

  const commit = (next: string) => {
    setRaw(next)
    const exact = padded(next)
    if (exact === "") return onValueChange?.(null)
    const minor = exact.replace(".", "").replace(/^0+(?=\d)/, "")
    onValueChange?.(Number(exact), { decimal: exact, minor })
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    const caret = event.target.selectionStart ?? text.length
    const next = normalizeAmount(text, info.decimal, info.fraction, maxDigits)
    setTruncated(next.truncated)
    setPaste(null)
    commit(next.raw)
    // Put the caret back after the same number of digits it followed before formatting.
    const significant = text.slice(0, caret).replace(new RegExp(`[^\\d${escape(info.decimal)}]`, "g"), "").length
    requestAnimationFrame(() => {
      const shown = inputRef.current?.value ?? ""
      let pos = 0
      for (let seen = 0; pos < shown.length && seen < significant; pos++) {
        if (/\d/.test(shown[pos]) || shown[pos] === info.decimal) seen++
      }
      inputRef.current?.setSelectionRange(pos, pos)
    })
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event)
    const el = event.currentTarget
    const replacesAll = el.value === "" || (el.selectionStart === 0 && el.selectionEnd === el.value.length)
    const text = event.clipboardData.getData("text").trim()
    const check = replacesAll && !event.defaultPrevented ? readPastedAmount(text, info.decimal, info.fraction, maxDigits) : null
    if (!check) return
    event.preventDefault()
    setTruncated(null)
    commit(check.usual)
    setPaste({ text, ...check })
  }

  const system = words ?? (/-IN\b/i.test(locale) ? "indian" : "international")
  let spelled = ""
  if (system && amount !== null && amount > 0) {
    const exact = padded(raw)
    const [whole, minor = ""] = exact.split(".")
    spelled = wordsFormatter({ whole, minor, decimal: exact, currency, locale, system })
  }

  let warning: { text: string; fix?: string } | null = null
  if (typical && typical > 0 && amount && amount > 0) {
    const ratio = amount / typical
    const limit = Math.max(threshold, 1)
    const zeros = zerosOff(amount, typical)
    if (ratio >= limit || ratio <= 1 / limit) {
      const usual = info.money.format(typical)
      const moved = zeros ? shift(raw, -zeros) : null
      // Only offer a fix that is exactly the amount with the zeros moved.
      const fixable = moved && moved.frac.length <= info.fraction && moved.int.length <= maxDigits
      warning = {
        text: ratio >= 1 ? tooHighMessage(`${info.ratio.format(ratio)}×`, usual, zeros) : tooLowMessage(`1/${info.ratio.format(1 / ratio)} of`, usual, zeros),
        fix: fixable ? (moved.frac ? `${moved.int}.${moved.frac}` : moved.int) : undefined,
      }
    }
  }

  const hasNotice = Boolean(warning || truncated || paste)
  const describedByIds = [spelled ? `${inputId}-words` : "", hasNotice ? `${inputId}-warning` : "", describedBy ?? ""].filter(Boolean).join(" ") || undefined

  return (
    <div data-slot="amount-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">
        {label}
      </label>
      <div data-warning={warning || paste ? "" : undefined} className={fieldClass}>
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
          onPaste={handlePaste}
          onBlur={(event) => {
            // "1250.5" reads as 1,250.50 once you leave, and a dangling "12." loses its dot.
            if (raw.includes(".")) setRaw(decimal)
            onBlur?.(event)
          }}
          aria-describedby={describedByIds}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-base tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
          {...props}
        />
        {showCurrencyCode && (
          <span aria-hidden className="pr-3 text-xs text-muted-foreground">
            {currency}
          </span>
        )}
      </div>
      {name && <input type="hidden" name={name} value={padded(raw)} />}
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
          {truncated && <p className="py-1 text-muted-foreground">{truncatedMessage(truncated, truncated === "digits" ? maxDigits : info.fraction)}</p>}
          {paste && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 text-amber-700 dark:text-amber-400">
              <span>{pasteMessage(paste.text)}</span>
              {[paste.swapped, paste.usual].map((choice) => (
                <button key={choice} type="button" className={fixClass} onClick={() => {
                    commit(choice)
                    setPaste(null)
                    inputRef.current?.focus()
                  }}>
                  {formatRaw(choice)}
                </button>
              ))}
            </p>
          )}
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
                      if (warning.fix !== undefined) commit(warning.fix)
                      inputRef.current?.focus()
                    }}
                    className={fixClass}
                  >
                    {fixLabel(formatRaw(warning.fix))}
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
