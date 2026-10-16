"use client"

import * as React from "react"
import { CircleAlert, Info, TriangleAlert, Wallet } from "lucide-react"

import { cn } from "@/lib/utils"

/** Annual amounts carved out of the headline CTC. Fixed pay is whatever is left. */
export interface CtcParts {
  ctc: number
  variable: number
  esop: number
  joiningBonus: number
  gratuity: number
  /** Employer's PF contribution. */
  pf: number
}
export type CtcPart = Exclude<keyof CtcParts, "ctc">

export interface InHandAssumptions {
  /** Basic pay as a share of fixed pay. */
  basicShare?: number
  /** PF on full basic instead of the ₹15,000/month wage ceiling. */
  pfOnFullBasic?: boolean
  /** Professional tax per year. Defaults to ₹2,500 (₹200 a month, ₹300 in February: Maharashtra, and Karnataka since April 2025). */
  professionalTax?: number
  standardDeduction?: number
}

const LAKH = 100_000
/**
 * Reads "24L", "24 lakh", "1.2 Cr", "18k", "24,00,000" or "₹24,00,000" as rupees.
 * Returns null when empty and NaN when it isn't an amount.
 */
export function parseRupees(text: string) {
  const s = String(text ?? "").normalize("NFKC").toLowerCase().replace(/₹|rs\.?|inr|,|\s/g, "")
  if (!s) return null
  const m = /^(\d+(?:\.\d+)?|\.\d+)(l|lac|lacs|lakh|lakhs|lpa|cr|crore|crores|cpa|k)?(?:pa|\/yr|\/year|peryear|perannum)?$/.exec(s)
  if (!m) return Number.NaN
  const unit = m[2] ?? ""
  const mult = unit.startsWith("c") ? 100 * LAKH : unit === "k" ? 1000 : unit ? LAKH : 1
  return Math.round(Number(m[1]) * mult)
}

const slabTax = (income: number) =>
  [4, 8, 12, 16, 20, 24].reduce((tax, l, i, all) => tax + Math.max(0, Math.min(income, (all[i + 1] ?? Infinity) * LAKH) - l * LAKH) * 0.05 * (i + 1), 0)
/** New-regime surcharge bands: above ₹50 L, ₹1 Cr and ₹2 Cr (capped at 25%). */
const SURCHARGE: [number, number][] = [[200 * LAKH, 0.25], [100 * LAKH, 0.15], [50 * LAKH, 0.1]]

/**
 * New-regime income tax on taxable income: FY 2026-27 slabs (unchanged by Budget 2026), the 87A rebate up
 * to ₹12 L with marginal relief, surcharge with marginal relief, and 4% cess.
 */
export function newRegimeTax(taxable: number) {
  if (!Number.isFinite(taxable) || taxable <= 12 * LAKH) return 0
  let tax = Math.min(slabTax(taxable), taxable - 12 * LAKH)
  const band = SURCHARGE.find(([at]) => taxable > at)
  if (band) {
    const [at, rate] = band
    const below = SURCHARGE.find(([b]) => at > b)?.[1] ?? 0
    // Crossing a band may not cost more in tax than the income above it.
    tax = Math.min(tax * (1 + rate), slabTax(at) * (1 + below) + taxable - at)
  }
  return Math.round(tax * 1.04)
}

/** Gratuity (4.81% of basic) and employer PF (12% of basic, capped at ₹15,000/month unless on full basic) for what's left after variable, ESOP and bonus. */
export function estimateStatutory(rest: number, { basicShare = 0.5, pfOnFullBasic = false }: InHandAssumptions = {}) {
  const g = 0.0481 * basicShare
  let fixed = rest / (1 + g + 0.12 * basicShare)
  if (!pfOnFullBasic && fixed * basicShare > 180_000) fixed = (rest - 21_600) / (1 + g)
  const basic = Math.max(0, fixed * basicShare)
  return { gratuity: Math.round(basic * 0.0481), pf: Math.round(pfOnFullBasic ? basic * 0.12 : Math.min(basic, 180_000) * 0.12) }
}

/**
 * Splits the CTC and estimates monthly in-hand pay: fixed pay minus your own PF (equal to the
 * employer's, or estimated from basic when the offer lists none), professional tax and income tax, over 12.
 */
export function computeInHand(parts: CtcParts, { professionalTax = 2500, standardDeduction = 75_000, basicShare = 0.5, pfOnFullBasic = false }: InHandAssumptions = {}) {
  const n = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0)
  const ctc = n(parts.ctc)
  const carved = n(parts.variable) + n(parts.esop) + n(parts.joiningBonus) + n(parts.gratuity) + n(parts.pf)
  const fixed = ctc - carved
  const tax = newRegimeTax(Math.max(0, fixed - standardDeduction))
  const basic = Math.max(0, fixed * basicShare)
  const ownPf = n(parts.pf) || Math.round((pfOnFullBasic ? basic : Math.min(basic, 180_000)) * 0.12)
  const monthly = Math.max(0, Math.round((fixed - ownPf - Math.min(professionalTax, Math.max(0, fixed)) - tax) / 12))
  return { ctc, fixed, tax, monthly, ratio: ctc ? (monthly * 12) / ctc : 0, yearTwo: ctc - n(parts.joiningBonus) }
}

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`
const lakh = (n: number) => {
  const abs = Math.abs(n)
  const text = abs >= 100 * LAKH ? `${+(abs / (100 * LAKH)).toFixed(2)} Cr` : abs >= LAKH ? `${+(abs / LAKH).toFixed(2)} L` : new Intl.NumberFormat("en-IN").format(Math.round(abs))
  return `${n < 0 ? "−" : ""}₹${text}`
}

/** Every visible string. Amounts arrive formatted. */
export const CTC_BREAKDOWN_INPUT_MESSAGES = {
  legend: "Offer breakdown",
  ctc: "CTC (per year)",
  parts: { variable: "Variable pay", esop: "ESOPs", joiningBonus: "Joining bonus", gratuity: "Gratuity", pf: "Employer PF" } as Record<CtcPart, string>,
  fixed: "Fixed pay (what's left)",
  perYear: "per year",
  estimate: (amount: string) => `Use ${amount}`,
  notAmount: "Enter an amount like 24L, 1.2 Cr or 24,00,000.",
  over: (amount: string) => `These parts add up to ${amount} more than the CTC.`,
  inHand: "In hand, about",
  perMonth: "/ month",
  ratio: (pct: number, headline: string) => `${pct}% of the ${headline} headline reaches your bank.`,
  lowRatio: (pct: number, monthly: string, naive: string) => `Only ${pct}% of the headline is monthly cash: about ${monthly} a month, not the ${naive} the CTC suggests.`,
  variable: (amount: string, pct: number) => `${amount} (${pct}%) is variable, paid only if targets are met.`,
  esop: (amount: string) => `${amount} in ESOPs isn't cash. It's worth something only once it vests and you can sell.`,
  joiningBonus: (amount: string, yearTwo: string) => `The ${amount} joining bonus is one-time, often with a clawback. Year two is ${yearTwo}.`,
  gratuity: (amount: string) => `${amount} gratuity is paid only when you leave after 5 years here (1 year on a fixed-term contract).`,
  assumptions: "How this is estimated",
  assumptionList: ({ basicPct, pfFull, pt, sd }: { basicPct: number; pfFull: boolean; pt: string; sd: string }) => [
    `New tax regime, FY 2026-27 slabs, ${sd} standard deduction, 87A rebate, surcharge above ₹50 L, 4% cess.`,
    `Basic pay is ${basicPct}% of fixed pay (the labour codes count at least half of pay as wages).`,
    pfFull ? "Your PF is 12% of full basic, matching the employer's." : "Your PF matches the employer's: 12% of basic, capped at ₹15,000 a month.",
    `Professional tax of ${pt} a year.`,
    "Variable pay, ESOPs and the joining bonus are left out of monthly pay. No HRA, NPS or other deductions.",
  ],
}
export type CtcBreakdownInputMessages = typeof CTC_BREAKDOWN_INPUT_MESSAGES

export interface CtcBreakdownInputProps extends Omit<React.ComponentProps<"fieldset">, "defaultValue" | "onChange"> {
  value?: Partial<CtcParts>
  defaultValue?: Partial<CtcParts>
  onValueChange?: (parts: CtcParts) => void
  /** Flag the offer when monthly in-hand × 12 is below this share of CTC. */
  minInHandRatio?: number
  /** Flag variable pay above this share of CTC. */
  maxVariableShare?: number
  assumptions?: InHandAssumptions
  /** Merged onto the CTC input. */
  "aria-describedby"?: string
  messages?: Partial<CtcBreakdownInputMessages>
}

const KEYS: CtcPart[] = ["variable", "esop", "joiningBonus", "gratuity", "pf"]
const COLORS: Record<CtcPart | "fixed", string> = { fixed: "bg-emerald-500", variable: "bg-amber-400", esop: "bg-violet-400", joiningBonus: "bg-sky-400", gratuity: "bg-zinc-400", pf: "bg-zinc-300 dark:bg-zinc-500" }
const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-right text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
const toText = (n?: number) => (n ? new Intl.NumberFormat("en-IN").format(n) : "")

/**
 * A CTC split that shows what an offer really pays. Type the headline and the
 * parts carved out of it (variable, ESOPs, joining bonus, gratuity, PF); fixed
 * pay is what's left, gratuity and PF are one tap to estimate, and the monthly
 * in-hand figure is worked out with every assumption written down. Offers whose
 * in-hand is far below the headline are called out in plain numbers.
 */
export function CtcBreakdownInput({
  value,
  defaultValue = {},
  onValueChange,
  minInHandRatio = 0.7,
  maxVariableShare = 0.2,
  assumptions = {},
  "aria-describedby": describedBy,
  messages,
  className,
  ...props
}: CtcBreakdownInputProps) {
  const t = { ...CTC_BREAKDOWN_INPUT_MESSAGES, ...messages, parts: { ...CTC_BREAKDOWN_INPUT_MESSAGES.parts, ...messages?.parts } }
  const keys = ["ctc", ...KEYS] as (keyof CtcParts)[]
  const [texts, setTexts] = React.useState<Record<keyof CtcParts, string>>(() => Object.fromEntries(keys.map((k) => [k, toText((value ?? defaultValue)[k])])) as Record<keyof CtcParts, string>)
  const [settled, setSettled] = React.useState("")
  const refs = React.useRef<Partial<Record<keyof CtcParts, HTMLInputElement | null>>>({})
  const id = React.useId()

  // Follow a controlled value when it changes from outside.
  const external = value ? keys.map((k) => value[k] ?? 0).join("|") : ""
  React.useEffect(() => {
    if (!value) return
    setTexts((prev) => Object.fromEntries(keys.map((k) => [k, (parseRupees(prev[k]) ?? 0) === (value[k] ?? 0) ? prev[k] : toText(value[k])])) as Record<keyof CtcParts, string>)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external])

  const nums = Object.fromEntries(keys.map((k) => [k, parseRupees(texts[k])])) as Record<keyof CtcParts, number | null>
  const parts = Object.fromEntries(keys.map((k) => [k, Number.isFinite(nums[k]) ? (nums[k] as number) : 0])) as unknown as CtcParts
  const r = computeInHand(parts, assumptions)
  const est = estimateStatutory(parts.ctc - parts.variable - parts.esop - parts.joiningBonus, assumptions)
  const pct = (n: number) => Math.round((n / (r.ctc || 1)) * 100)
  const over = r.ctc > 0 && r.fixed < 0

  const set = (key: keyof CtcParts, text: string, focus = false) => {
    const next = { ...texts, [key]: text }
    setTexts(next)
    const parsed = Object.fromEntries(keys.map((k) => [k, parseRupees(next[k])])) as Record<keyof CtcParts, number | null>
    onValueChange?.(Object.fromEntries(keys.map((k) => [k, Number.isFinite(parsed[k]) ? parsed[k] : 0])) as unknown as CtcParts)
    if (focus) requestAnimationFrame(() => refs.current[key]?.focus())
  }

  const flags: { tone: "red" | "amber" | "muted"; text: string }[] = []
  if (r.ctc > 0 && !over) {
    if (r.ratio < minInHandRatio) flags.push({ tone: "red", text: t.lowRatio(Math.round(r.ratio * 100), rupees(r.monthly), rupees(r.ctc / 12)) })
    if (parts.variable / r.ctc > maxVariableShare) flags.push({ tone: "amber", text: t.variable(lakh(parts.variable), pct(parts.variable)) })
    if (parts.esop > 0) flags.push({ tone: "amber", text: t.esop(lakh(parts.esop)) })
    if (parts.joiningBonus > 0) flags.push({ tone: "amber", text: t.joiningBonus(lakh(parts.joiningBonus), lakh(r.yearTwo)) })
    if (parts.gratuity > 0) flags.push({ tone: "muted", text: t.gratuity(lakh(parts.gratuity)) })
  }
  const summary = over ? t.over(lakh(-r.fixed)) : r.ctc > 0 ? `${t.inHand} ${rupees(r.monthly)} ${t.perMonth}. ${flags[0]?.tone === "red" ? flags[0].text : ""}` : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(summary), 800)
    return () => clearTimeout(timer)
  }, [summary])

  const row = (key: keyof CtcParts, label: string, extra?: React.ReactNode) => {
    const bad = Number.isNaN(nums[key])
    return (
      <div key={key} className="grid gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-${key}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            {key !== "ctc" && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", COLORS[key as CtcPart])} />}
            <span className={cn("truncate", key === "ctc" && "font-medium")}>{label}</span>
          </label>
          <input
            ref={(el) => void (refs.current[key] = el)}
            id={`${id}-${key}`}
            inputMode="decimal"
            autoComplete="off"
            value={texts[key]}
            placeholder="0"
            onChange={(e) => set(key, e.target.value)}
            onBlur={() => Number.isFinite(nums[key]) && nums[key] !== null && set(key, toText(nums[key] as number))}
            aria-invalid={bad || (key === "ctc" && over) || undefined}
            aria-describedby={[bad && `${id}-${key}-error`, key === "ctc" && `${id}-result`, key === "ctc" && describedBy].filter(Boolean).join(" ") || undefined}
            className={cn(fieldClass, "w-32 shrink-0 sm:w-36")}
          />
        </div>
        {bad && <p id={`${id}-${key}-error`} className="text-right text-xs text-red-700 dark:text-red-400">{t.notAmount}</p>}
        {extra}
      </div>
    )
  }

  return (
    <fieldset data-slot="ctc-breakdown-input" className={cn("grid w-full min-w-0 max-w-sm gap-3 rounded-xl border bg-card p-4 text-card-foreground", className)} {...props}>
      <legend className="sr-only">{t.legend}</legend>
      {row("ctc", t.ctc)}
      {r.ctc > 0 && (
        <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-muted">
          {(["fixed", ...KEYS] as const).map((k) => {
            const amount = k === "fixed" ? r.fixed : parts[k]
            return amount > 0 ? <span key={k} className={cn("h-full transition-[width] duration-300 ease-out", COLORS[k])} style={{ width: `${Math.min(100, pct(amount))}%` }} /> : null
          })}
        </div>
      )}
      <div className="grid gap-2 border-t pt-3">
        {KEYS.map((key) =>
          row(
            key,
            t.parts[key],
            (key === "gratuity" || key === "pf") && r.ctc > 0 && est[key] > 0 && parts[key] !== est[key] ? (
              <div className="flex justify-end">
                <button type="button" onClick={() => set(key, toText(est[key]), true)} className="inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input">
                  {t.estimate(lakh(est[key]))}
                </button>
              </div>
            ) : null,
          ),
        )}
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2 rounded-full", COLORS.fixed)} />
            {t.fixed}
          </span>
          <span className={cn("tabular-nums font-medium", over && "text-red-700 dark:text-red-400")}>{lakh(r.fixed)}</span>
        </div>
      </div>

      <div id={`${id}-result`} className="grid gap-2 border-t pt-3 text-xs">
        {over ? (
          <p className="flex gap-1.5 text-red-700 dark:text-red-400">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.over(lakh(-r.fixed))}
          </p>
        ) : r.ctc > 0 ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <Wallet aria-hidden className="size-4 self-center text-muted-foreground" />
              <span className="text-muted-foreground">{t.inHand}</span>
              <span className="text-xl font-semibold tabular-nums">{rupees(r.monthly)}</span>
              <span className="text-muted-foreground">{t.perMonth}</span>
            </p>
            {flags.map((f) => (
              <p key={f.text} className={cn("flex gap-1.5", f.tone === "red" ? "font-medium text-red-700 dark:text-red-400" : f.tone === "amber" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                {f.tone === "muted" ? <Info aria-hidden className="mt-px size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
                <span>{f.text}</span>
              </p>
            ))}
            {!flags.some((f) => f.tone === "red") && <p className="text-muted-foreground">{t.ratio(Math.round(r.ratio * 100), lakh(r.ctc))}</p>}
          </>
        ) : null}
        <details className="group text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">{t.assumptions}</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {t.assumptionList({ basicPct: Math.round((assumptions.basicShare ?? 0.5) * 100), pfFull: !!assumptions.pfOnFullBasic, pt: rupees(assumptions.professionalTax ?? 2500), sd: lakh(assumptions.standardDeduction ?? 75_000) }).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      </div>
      <span aria-live="polite" className="sr-only">{settled}</span>
    </fieldset>
  )
}
