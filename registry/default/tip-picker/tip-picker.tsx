"use client"

// Bollard UI — tip-picker · MIT licence · https://bollard-ui.vercel.app/components/tip-picker

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { HandCoins, TriangleAlert } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export type TipBase = "pre-tax" | "post-tax"
export type TipMode = "percent" | "amount"

export interface TipProblem {
  /** `amountInPercent`: 250 typed as a percent where ₹250 was meant. `percentInAmount`: 15 typed as money where 15% was meant. `high`: a real but unusually large tip. */
  kind: "amountInPercent" | "percentInAmount" | "high"
  /** The tip amount the problem would give, and the likely intended amount. */
  amount: number
  fix?: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Turns a typed tip into money and flags the classic slips: an amount typed in the % field, a percent typed in the money field, and a tip at or above `highPercent`. */
export function checkTip(typed: number, mode: TipMode, base: number, highPercent = 30): TipProblem | null {
  if (!(base > 0) || !(typed > 0)) return null
  const amount = round2(mode === "percent" ? (base * typed) / 100 : typed)
  const share = (amount / base) * 100
  if (mode === "percent" && typed > 50 && (typed / base) * 100 >= 1 && (typed / base) * 100 <= 40) return { kind: "amountInPercent", amount, fix: typed }
  if (mode === "amount" && share < 2 && Number.isInteger(typed) && typed >= 5 && typed <= 30) return { kind: "percentInAmount", amount, fix: round2((base * typed) / 100) }
  if (share >= highPercent) return { kind: "high", amount }
  return null
}

export interface TipPickerProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  /** Items total before tax and service charge. */
  subtotal: number
  /** Tax on the bill. */
  tax?: number
  /** A service charge already on the bill, e.g. `{ label: "Service charge (10%)", amount: 200 }`. */
  serviceCharge?: { label: string; amount: number }
  /** Preset percentages. */
  presets?: number[]
  /** Controlled tip base. */
  base?: TipBase
  /** Initial tip base when uncontrolled. Etiquette and most guidance say pre-tax. */
  defaultBase?: TipBase
  /** Called when the tip base (pre- or post-tax) changes. */
  onBaseChange?: (base: TipBase) => void
  /** Hide the pre-tax / post-tax switch when the merchant fixes the base. */
  allowBaseSwitch?: boolean
  /** Controlled tip amount. A flagged custom tip is only reported once it's fixed or confirmed. */
  value?: number
  /** Starting tip amount when uncontrolled. */
  defaultValue?: number
  /** Called with the tip amount. */
  onValueChange?: (amount: number) => void
  /** Custom text the picker opens with, e.g. a value restored from a draft. */
  defaultCustomText?: string
  /** Whether a custom tip starts in percent or money. */
  defaultCustomMode?: TipMode
  /** Tips at or above this percent of the base need a second tap. */
  highPercent?: number
  /** ISO 4217 currency code. */
  currency?: string
  /** Locale for money formatting. */
  locale?: string
  /** Legend of the tip fieldset. */
  legend?: string
  /** Label of the no-tip option. */
  noTipLabel?: string
  /** Label of the custom-tip option. */
  customLabel?: string
  /** Notice when a service charge is already on the bill. */
  includedText?: (charge: string, percent: string) => string
  /** Receives the typed percent, the tip it gives and the likely meant amount. */
  amountInPercentText?: (typed: string, tip: string, meant: string) => string
  /** Warning when a percent was typed as money. */
  percentInAmountText?: (typed: string, percent: string) => string
  /** Warning for an unusually large tip. */
  highText?: (amount: string, percent: string) => string
  /** Label of the keep-this-tip confirmation. */
  keepLabel?: (amount: string) => string
  /** Accessible name of the pre-tax / post-tax choice. */
  baseGroupLabel?: string
  /** Accessible label of the custom tip field. */
  customTipLabel?: string
  /** Accessible name of the % / amount choice for a custom tip. */
  customUnitLabel?: string
}

const chip =
  "inline-flex flex-col items-center justify-center rounded-md border px-2 py-1.5 text-sm shadow-xs outline-none transition-[color,background-color,box-shadow] hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground dark:border-input dark:bg-input/30 dark:aria-pressed:bg-primary"
const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A tip selector that is honest about its maths. It says whether the percent is
 * on the pre-tax or post-tax amount (and lets the payer switch), shows every
 * preset in money, says up front when a service charge is already on the bill,
 * and catches the accidental huge tip: 250 typed in the % field, 15 typed as
 * money, or 100% that doubles the bill, each with a one-tap fix.
 */
export function TipPicker({
  subtotal,
  tax = 0,
  serviceCharge,
  presets = [10, 15, 18, 20],
  base: baseProp,
  defaultBase = "pre-tax",
  onBaseChange,
  allowBaseSwitch = true,
  value,
  defaultValue = 0,
  onValueChange,
  defaultCustomText = "",
  defaultCustomMode = "percent",
  highPercent = 30,
  currency = "INR",
  locale = "en-IN",
  legend = "Add a tip",
  noTipLabel = "No tip",
  customLabel = "Custom",
  includedText = (charge, percent) => `${charge} (${percent}) is already on this bill. Anything you add here is extra.`,
  amountInPercentText = (typed, tip, meant) => `${typed} is a ${tip} tip. Did you mean ${meant}?`,
  percentInAmountText = (typed, percent) => `${typed} is a very small tip. Did you mean ${percent}?`,
  highText = (amount, percent) => `${amount} is ${percent} of the bill.`,
  keepLabel = (amount) => `Yes, tip ${amount}`,
  baseGroupLabel = "Tip is calculated on",
  customTipLabel = "Custom tip",
  customUnitLabel = "Custom tip unit",
  className,
  ...props
}: TipPickerProps) {
  const [innerBase, setInnerBase] = React.useState(defaultBase)
  const [innerAmount, setInnerAmount] = React.useState(defaultValue)
  const [percent, setPercent] = React.useState<number | null>(null)
  const [custom, setCustom] = React.useState<{ mode: TipMode; text: string } | null>(defaultCustomText ? { mode: defaultCustomMode, text: defaultCustomText } : null)
  const [confirmed, setConfirmed] = React.useState<number | null>(null)
  const id = React.useId()
  const reduceMotion = useReducedMotion()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const tipBase = baseProp ?? innerBase
  const baseAmount = tipBase === "pre-tax" ? subtotal : subtotal + tax
  const amount = value ?? innerAmount

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
  const pct = (n: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)}%`
  /** Money that rolls to its new value, so a changed base or tip is seen changing rather than swapped silently. */
  const flow = (n: number) => (
    <>
      <span className="sr-only">{money(n)}</span>
      <NumberFlow
        aria-hidden
        value={n}
        locales={locale}
        format={{ style: "currency", currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }}
        animated={!reduceMotion}
      />
    </>
  )
  const presetAmount = (p: number) => round2((baseAmount * p) / 100)
  const symbol = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currency

  const commit = (next: number) => {
    if (value === undefined) setInnerAmount(next)
    onValueChange?.(next)
  }

  const pick = (p: number | null) => {
    setCustom(null)
    setPercent(p)
    commit(p === null ? 0 : presetAmount(p))
  }

  const typed = custom ? Number(custom.text.replace(/[,\s%₹$€£]/g, "")) : NaN
  const problem = custom && typed > 0 ? checkTip(typed, custom.mode, baseAmount, highPercent) : null
  const pending = problem && confirmed !== problem.amount ? problem : null

  const editCustom = (next: { mode: TipMode; text: string }) => {
    setCustom(next)
    setPercent(null)
    const n = Number(next.text.replace(/[,\s%₹$€£]/g, ""))
    const found = n > 0 ? checkTip(n, next.mode, baseAmount, highPercent) : null
    if (!found) commit(n > 0 ? round2(next.mode === "percent" ? (baseAmount * n) / 100 : n) : 0)
  }

  const switchBase = (next: TipBase) => {
    if (baseProp === undefined) setInnerBase(next)
    onBaseChange?.(next)
    const nextBase = next === "pre-tax" ? subtotal : subtotal + tax
    // A chosen percent stays the same percent, so its money moves with the base.
    if (percent !== null) commit(round2((nextBase * percent) / 100))
    else if (custom?.mode === "percent" && typed > 0 && !checkTip(typed, "percent", nextBase, highPercent)) commit(round2((nextBase * typed) / 100))
  }

  const total = subtotal + tax + (serviceCharge?.amount ?? 0) + (pending ? 0 : amount)
  const service = (serviceCharge?.amount ?? 0) + (pending ? 0 : amount)

  return (
    <fieldset data-slot="tip-picker" className={cn("w-full min-w-0 max-w-sm space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <legend className="sr-only">{legend}</legend>
      <p className="font-medium" aria-hidden>{legend}</p>

      {serviceCharge && serviceCharge.amount > 0 && (
        <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50">
          <HandCoins aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{includedText(`${serviceCharge.label} of ${money(serviceCharge.amount)}`, pct((serviceCharge.amount / subtotal) * 100))}</span>
        </p>
      )}

      {allowBaseSwitch && tax > 0 ? (
        <div role="radiogroup" aria-label={baseGroupLabel} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs">
          {(["pre-tax", "post-tax"] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={tipBase === b}
              onClick={() => switchBase(b)}
              className="relative rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:text-foreground"
            >
              {tipBase === b && (
                <motion.span
                  layoutId={`${id}-base`}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-md bg-background shadow-xs"
                />
              )}
              <span className="relative">
                % of <span className="font-medium tabular-nums">{money(b === "pre-tax" ? subtotal : subtotal + tax)}</span> {b === "pre-tax" ? "before tax" : "after tax"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Percentages are of {money(baseAmount)}, {tipBase === "pre-tax" ? "before tax" : "after tax"}.</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button type="button" aria-pressed={!custom && amount === 0} onClick={() => pick(null)} className={chip}>
          <span className="font-medium">{noTipLabel}</span>
          <span className="text-xs opacity-75">{money(0)}</span>
        </button>
        {presets.map((p) => (
          <button key={p} type="button" aria-pressed={!custom && percent === p} onClick={() => pick(p)} className={chip}>
            <span className="font-medium">{serviceCharge ? "+" : ""}{p}%</span>
            <span className="text-xs tabular-nums opacity-75">{flow(presetAmount(p))}</span>
          </button>
        ))}
        <button type="button" aria-pressed={!!custom} onClick={() => setCustom((c) => c ?? { mode: "percent", text: "" })} className={chip}>
          <span className="font-medium">{customLabel}</span>
          <span className="text-xs opacity-75">% or {symbol}</span>
        </button>
      </div>

      {custom && (
        <div>
          <label htmlFor={`${id}-custom`} className="sr-only">{customTipLabel}</label>
          <div className={cn("flex h-9 items-center rounded-md border shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30", pending && "border-amber-500 dark:border-amber-400")}>
            <input
              ref={inputRef}
              id={`${id}-custom`}
              inputMode="decimal"
              autoComplete="off"
              value={custom.text}
              onChange={(e) => editCustom({ ...custom, text: e.target.value })}
              aria-describedby={`${id}-hint`}
              placeholder={custom.mode === "percent" ? "e.g. 12" : "e.g. 250"}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none md:text-sm"
            />
            <div role="radiogroup" aria-label={customUnitLabel} className="mr-1 flex gap-0.5 rounded-md bg-muted p-0.5 text-xs">
              {(["percent", "amount"] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={custom.mode === m} onClick={() => editCustom({ ...custom, mode: m })} className="h-6 rounded px-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:shadow-xs">
                  {m === "percent" ? "%" : symbol}
                </button>
              ))}
            </div>
          </div>
          <div id={`${id}-hint`} aria-live="polite" className="min-h-6 text-xs">
            <AnimatePresence initial={false}>
              {pending && (
                <motion.p
                  key="warning"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: [0.2, 0, 0, 1] }}
                  className="flex gap-1.5 overflow-hidden pt-1.5 text-amber-700 dark:text-amber-400"
                >
                  <TriangleAlert aria-hidden className="mt-1 size-3.5 shrink-0" />
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="py-1">
                      {pending.kind === "amountInPercent"
                        ? amountInPercentText(`${custom.text}%`, money(pending.amount), money(pending.fix ?? 0))
                        : pending.kind === "percentInAmount"
                          ? percentInAmountText(money(typed), `${typed}% (${money(pending.fix ?? 0)})`)
                          : highText(money(pending.amount), pct((pending.amount / baseAmount) * 100))}
                    </span>
                    {pending.fix !== undefined && (
                      <button type="button" className={fixClass} onClick={() => {
                        editCustom(pending.kind === "amountInPercent" ? { mode: "amount", text: String(pending.fix) } : { mode: "percent", text: String(typed) })
                        inputRef.current?.focus() // the fix buttons disappear; keep focus on the field
                      }}>
                        Use {money(pending.fix)}
                      </button>
                    )}
                    <button type="button" className={fixClass} onClick={() => {
                        setConfirmed(pending.amount)
                        commit(pending.amount)
                        inputRef.current?.focus()
                      }}>
                      {keepLabel(money(pending.amount))}
                    </button>
                  </span>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <dl className="space-y-1 border-t pt-3">
        <div className="flex justify-between gap-3 text-muted-foreground">
          <dt>Tip{pending ? " (not added yet)" : ""}</dt>
          <dd className="tabular-nums">
            {pending && <s className="mr-1.5 text-amber-700/80 dark:text-amber-400/80">{money(pending.amount)}</s>}
            {flow(pending ? 0 : amount)}{!pending && amount > 0 ? ` · ${pct((amount / baseAmount) * 100)} ${tipBase === "pre-tax" ? "before tax" : "after tax"}` : ""}</dd>
        </div>
        {serviceCharge && (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <dt>Service + tip</dt>
            <dd className="tabular-nums">{flow(service)} · {pct((service / subtotal) * 100)} of food</dd>
          </div>
        )}
        <div className="flex justify-between gap-3 text-base font-medium">
          <dt>You pay</dt>
          <dd className="tabular-nums">{flow(round2(total))}</dd>
        </div>
      </dl>
    </fieldset>
  )
}
