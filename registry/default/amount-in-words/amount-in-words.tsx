"use client"

import * as React from "react"
import { Check, CircleAlert, Copy, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { amountToWords, integerToWords, parseAmountWords, type NumberSystem } from "./words"

export { amountToWords, integerToWords, parseAmountWords, CURRENCY_WORDS, type NumberSystem } from "./words"

/** Place value of each digit group, right to left. Indian groups past crore are hundreds of crores. */
const GROUP_NAMES: Record<NumberSystem, string[]> = {
  indian: ["", "thousand", "lakh", "crore", "hundred crore", "ten thousand crore", "ten lakh crore"],
  international: ["", "thousand", "million", "billion", "trillion"],
}

/** "10× more", "100× less", or just "more"/"less" when the two aren't a power of ten apart. */
function describeGap(words: number, figure: number) {
  const direction = words > figure ? "more" : "less"
  const power = Math.log10(Math.max(words / figure, figure / words))
  return Math.abs(power - Math.round(power)) < 1e-9 ? `${10 ** Math.round(power)}× ${direction}` : direction
}

export interface AmountInWordsProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** The amount in figures, in major units (250000.5 is ₹2,50,000.50). */
  amount: number
  /** ISO currency code. INR, USD, EUR, GBP, AED and SGD have cheque wording built in. */
  currency?: string
  /** Number system for grouping and words. Defaults to `indian` for INR, `international` otherwise. */
  system?: NumberSystem
  /** Shows the amount in the other system too (2.5 lakh = 250 thousand) for readers used to it. */
  showOtherSystem?: boolean
  /** Shows a field that checks words someone typed or wrote against the figure. */
  verify?: boolean
  /** Controlled words typed into the check field. */
  value?: string
  /** Initial words when uncontrolled. */
  defaultValue?: string
  /** Called with the words as they are typed or fixed. */
  onValueChange?: (value: string) => void
  /** Label of the check field. */
  verifyLabel?: string
  /** Shown when the words describe a different amount. Receives the amount the words describe. */
  mismatchMessage?: (wordsAmount: string, gap: string) => string
  /** Why a mismatch matters. Indian law (NI Act §18) pays the amount in words. */
  mismatchNote?: string
  /** Shown when the words match the figure. */
  matchMessage?: string
  /** Shown when the words don't end in "Only". */
  onlyMessage?: string
}

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 aria-invalid:border-destructive data-warning:border-amber-500 dark:data-warning:border-amber-400"
const fixClass =
  "inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-2 text-left font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * Shows an amount the way it goes on a cheque or transfer: every digit group named
 * (2 lakh · 50 thousand), the words in cheque style, and the other number system
 * alongside, so ₹2,50,000 can't be read as ₹25,00,000. It also checks words someone
 * wrote against the figure, because on a cheque the words are what the bank pays.
 */
export function AmountInWords({
  amount,
  currency = "INR",
  system = currency === "INR" ? "indian" : "international",
  showOtherSystem = true,
  verify = true,
  value,
  defaultValue = "",
  onValueChange,
  verifyLabel = "Amount in words, as written",
  mismatchMessage = (words, gap) => `These words say ${words}, ${gap} than the figure.`,
  mismatchNote = "If they differ, the amount in words is the one paid.",
  matchMessage = "Words match the figure.",
  onlyMessage = "End with “Only” so nothing can be added after it.",
  className,
  ...props
}: AmountInWordsProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [copied, setCopied] = React.useState(false)
  const id = React.useId()
  const typed = value ?? inner
  const minorUnits = Math.round(Math.abs(amount) * 100)
  const words = amountToWords(minorUnits, currency, system)
  const locale = system === "indian" ? "en-IN" : "en-US"
  const money = (minor: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(minor / 100)

  const parts = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(minorUnits / 100)
  const groups = parts.filter((p) => p.type === "integer").map((p) => p.value)
  const names = GROUP_NAMES[system]
  const symbol = parts.find((p) => p.type === "currency")?.value ?? ""
  const fraction = parts.find((p) => p.type === "fraction")?.value
  const other = integerToWords(Math.floor(minorUnits / 100), system === "indian" ? "international" : "indian")

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(words)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const parsed = typed.trim() ? parseAmountWords(typed) : null
  const unknown = parsed?.unknown[0]
  const mismatch = parsed?.minorUnits != null && parsed.minorUnits !== minorUnits
  const status = !parsed ? null : unknown ? "unknown" : mismatch ? "mismatch" : parsed.minorUnits == null ? null : parsed.endsWithOnly ? "match" : "only"

  return (
    <div data-slot="amount-in-words" className={cn("grid w-full max-w-md gap-3", className)} {...props}>
      <div className="rounded-lg border bg-card p-3">
        <p className="flex flex-wrap items-start gap-x-1 font-mono text-2xl font-semibold tabular-nums" aria-label={money(minorUnits)}>
          <span className="-mr-1 leading-8">{symbol}</span>
          {groups.map((group, i) => (
            <span key={i} className="inline-flex flex-col items-center">
              <span className="leading-8">
                {group}
                {i < groups.length - 1 ? <span className="text-muted-foreground">,</span> : fraction ? <span className="text-muted-foreground">.{fraction}</span> : null}
              </span>
              <span aria-hidden className="font-sans text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {names[groups.length - 1 - i] || "\u00a0"}
              </span>
            </span>
          ))}
        </p>
        <div className="mt-2 flex items-start gap-2">
          <p key={words} className="min-w-0 flex-1 text-sm font-medium motion-safe:animate-[cui-amount-in-words-in_250ms_ease-out]">
            {words}
          </p>
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy words"}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {copied ? <Check aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Copy aria-hidden className="size-4" />}
          </button>
        </div>
        {showOtherSystem ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {system === "indian" ? "International" : "Indian"}: {other}
          </p>
        ) : null}
      </div>

      {verify ? (
        <div className="grid gap-1.5">
          <label htmlFor={id} className="w-fit text-sm font-medium">
            {verifyLabel}
          </label>
          <input
            id={id}
            value={typed}
            onChange={(e) => update(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={status === "mismatch" || undefined}
            aria-describedby={`${id}-status`}
            data-warning={status === "unknown" || status === "only" ? "" : undefined}
            className={fieldClass}
          />
          <div id={`${id}-status`} aria-live="polite" className="min-h-6 text-xs">
            {status === "mismatch" && parsed?.minorUnits != null ? (
              <div role="alert" className="flex gap-1.5 text-destructive motion-safe:animate-[cui-amount-in-words-in_250ms_ease-out]">
                <CircleAlert aria-hidden className="mt-1 size-3.5 shrink-0" />
                <div className="grid min-w-0 gap-1.5">
                  <p className="py-0.5">
                    <span className="font-medium">{mismatchMessage(money(parsed.minorUnits), describeGap(parsed.minorUnits, minorUnits))}</span> {mismatchNote}
                  </p>
                  <button type="button" onClick={() => update(words)} className={cn(fixClass, "h-auto min-h-6 border-red-500/40 py-0.5 hover:bg-red-500/10")}>
                    Use “{words}”
                  </button>
                </div>
              </div>
            ) : status === "unknown" && unknown ? (
              <p className="flex flex-wrap items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                <span className="py-1">Can’t read “{unknown.word}”.</span>
                {unknown.suggestion ? (
                  <button
                    type="button"
                    onClick={() => update(typed.replace(new RegExp(`\\b${unknown.word}\\b`, "i"), unknown.suggestion as string))}
                    className={cn(fixClass, "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}
                  >
                    Use “{unknown.suggestion}”
                  </button>
                ) : null}
              </p>
            ) : status === "only" ? (
              <p className="flex flex-wrap items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                <span className="py-1">{onlyMessage}</span>
                <button
                  type="button"
                  onClick={() => update(`${typed.trim().replace(/[.\s]+$/, "")} Only`)}
                  className={cn(fixClass, "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}
                >
                  Add “Only”
                </button>
              </p>
            ) : status === "match" ? (
              <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
                <Check aria-hidden className="size-3.5" />
                {matchMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <style>{`@keyframes cui-amount-in-words-in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}
