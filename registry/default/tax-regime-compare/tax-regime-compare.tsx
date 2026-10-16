"use client"

import * as React from "react"
import { ExternalLink, IndianRupee, Scale, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { compareRegimes, HRA_FIFTY_PERCENT_CITIES, type DeductionKey, type Regime, type TaxComparison, type TaxInput, type TaxIssue, type TaxOptions } from "./tax"

export { compareRegimes, HRA_FIFTY_PERCENT_CITIES, LIMITS, regimeTax, type AgeBand, type DeductionKey, type Regime, type RegimeTax, type TaxComparison, type TaxInput, type TaxIssue, type TaxOptions } from "./tax"

/** Every visible string. `{…}` placeholders are filled in. */
export const TAX_REGIME_MESSAGES = {
  heading: "Old vs new regime · tax year 2026-27",
  salary: "Gross salary (year)",
  basic: "Basic + DA (year)",
  hraReceived: "HRA received",
  rent: "Rent paid",
  city: "You rent in",
  otherCity: "Another city",
  otherIncome: "Other income",
  deductions: "Deductions",
  labels: { hra: "HRA", d80C: "80C", d80D: "80D (self, family)", d80DParents: "80D (parents)", homeLoanInterest: "Home loan interest", nps: "NPS 80CCD(1B)", employerNps: "Employer NPS", professionalTax: "Professional tax", standard: "Standard deduction" } as Record<DeductionKey, string>,
  choice: "You're choosing",
  old: "Old regime",
  new: "New regime",
  taxable: "Taxable {amount}",
  wins: "Saves {amount} a year",
  tie: "Both cost the same.",
  breakEven: "The old regime wins only if your deductions top {amount}. You claim {claimed}.",
  neverOld: "The old regime can't beat the new one at this salary.",
  alwaysOld: "The old regime wins even with no deductions.",
  costsMore: "The {chosen} costs you {amount} more this year.",
  switchTo: "Switch to {regime}",
  notInNew: "These don't count under the new regime: {items}. Only employer NPS and the standard deduction do.",
  overCap: "{label}: only {cap} counts, not {claimed}.",
  capAt: "Cap at {cap}",
  hraNoRent: "HRA is only exempt if you pay rent. Add the rent you pay.",
  hraOverBasic: "Add your basic pay: the HRA exemption depends on it, so we assumed half your salary.",
  marginal: "Just over ₹12 lakh, marginal relief caps your new-regime tax at the {over} above it.",
  oldRebateGap: "Old regime: {gap} more under 80C brings your taxable income to ₹5 lakh and the tax to zero.",
  note: "Estimate for a resident salaried individual. Slabs from the Finance Bill 2026 memorandum; HRA 50% cities from Income-tax Rules 2026, rule 279. Section names are the 1961 Act ones.",
  verify: "Verify at incometax.gov.in",
}
export type TaxRegimeMessages = typeof TAX_REGIME_MESSAGES

const fill = (s: string, v: Record<string, string | number | undefined>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const field = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 [&>option]:bg-popover"
const SOURCE = "https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1"
const AMOUNTS = ["salary", "basic", "hra", "rent", "otherIncome", "d80C", "d80D", "d80DParents", "homeLoanInterest", "nps", "employerNps", "professionalTax"] as const
type AmountKey = (typeof AMOUNTS)[number]

/** "15L", "1.5 lakh", "2 cr", "₹15,00,000" → rupees. Garbage → 0. */
export function parseRupees(text: string): number {
  const s = String(text ?? "").toLowerCase().replace(/[₹,\s]|rs\.?|inr/g, "")
  const m = /^(\d*\.?\d+)(l|lakh|lakhs|lac|k|cr|crore|crores)?$/.exec(s)
  if (!m) return 0
  const n = Number(m[1]) * (m[2]?.startsWith("l") ? 1e5 : m[2] === "k" ? 1e3 : m[2]?.startsWith("c") ? 1e7 : 1)
  return Number.isFinite(n) ? Math.min(Math.round(n), 1e11) : 0
}

export interface TaxRegimeCompareProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> {
  /** Controlled salary, deductions and chosen regime. */
  value?: TaxInput
  /** Initial input when uncontrolled. */
  defaultValue?: Partial<TaxInput>
  /** Called on every edit or fix. */
  onValueChange?: (value: TaxInput) => void
  /** Called when the comparison changes. */
  onCompare?: (result: TaxComparison) => void
  /** Age band, senior parents and government employer. */
  options?: TaxOptions
  /** Locale for money. */
  locale?: string
  /** Any visible string; `labels` may be partial. */
  messages?: Partial<Omit<TaxRegimeMessages, "labels">> & { labels?: Partial<TaxRegimeMessages["labels"]> }
}

/**
 * Stops salaried people in India picking the tax regime that costs them more. It works out FY 2026-27 tax under
 * the old and new regimes from salary, HRA, 80C, 80D, NPS and home-loan interest, shows the break-even
 * deductions, flags a choice that costs more, deductions that don't count under the new regime and claims over
 * their limit, each with a one-tap fix.
 */
export function TaxRegimeCompare({ value, defaultValue, onValueChange, onCompare, options = {}, locale = "en-IN", messages, className, ...props }: TaxRegimeCompareProps) {
  const t = { ...TAX_REGIME_MESSAGES, ...messages, labels: { ...TAX_REGIME_MESSAGES.labels, ...messages?.labels } }
  const [inner, setInner] = React.useState<TaxInput>({ salary: 0, ...defaultValue })
  const input = value ?? inner
  const result = compareRegimes(input, options)
  const rootRef = React.useRef<HTMLElement>(null)
  const [drafts, setDrafts] = React.useState<Partial<Record<AmountKey, string>>>({})
  const [status, setStatus] = React.useState("")
  const id = React.useId()
  const rupees = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.round(n))
  const regimeName = (r: Regime) => (r === "old" ? t.old : t.new)

  const commit = (patch: Partial<TaxInput>) => {
    const next = { ...input, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  /** After a fix, go to the next fix, else the regime choice. */
  const refocus = () =>
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? rootRef.current?.querySelector<HTMLElement>("input[type=radio]:checked") ?? rootRef.current?.querySelector<HTMLElement>("input"))?.focus())
  const fix = (label: string, patch: Partial<TaxInput>) => (
    <button key={label} type="button" data-fix onClick={() => { setDrafts({}); commit(patch); refocus() }}
      className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200">
      {label}
    </button>
  )

  const render = (issue: TaxIssue): [string, React.ReactNode[]] => {
    switch (issue.kind) {
      case "costsMore": {
        const other: Regime = issue.chosen === "old" ? "new" : "old"
        return [fill(t.costsMore, { chosen: regimeName(issue.chosen).toLowerCase(), amount: rupees(issue.extra) }), [fix(fill(t.switchTo, { regime: regimeName(other).toLowerCase() }), { regime: other })]]
      }
      case "notInNew": return [fill(t.notInNew, { items: issue.items.map((x) => `${t.labels[x.key]} ${rupees(x.amount)}`).join(", ") }), []]
      case "overCap": return [fill(t.overCap, { label: t.labels[issue.key], cap: rupees(issue.cap), claimed: rupees(issue.claimed) }), [fix(fill(t.capAt, { cap: rupees(issue.cap) }), { [issue.key]: issue.cap })]]
      case "hraNoRent": return [t.hraNoRent, []]
      case "hraOverBasic": return [t.hraOverBasic, []]
      case "marginal": return [fill(t.marginal, { over: rupees(issue.over) }), []]
      case "oldRebateGap": return [fill(t.oldRebateGap, { gap: rupees(issue.gap) }), []]
    }
  }

  const key = JSON.stringify(result)
  const onCompareRef = React.useRef(onCompare)
  onCompareRef.current = onCompare
  React.useEffect(() => {
    onCompareRef.current?.(JSON.parse(key) as TaxComparison)
  }, [key])

  const winnerLine = result.winner === "tie" ? t.tie : `${regimeName(result.winner)}: ${fill(t.wins, { amount: rupees(result.saving) })}`
  const breakEvenLine = result.breakEven === null ? t.neverOld : result.breakEven === 0 ? t.alwaysOld : fill(t.breakEven, { amount: rupees(result.breakEven), claimed: rupees(result.claimed) })
  const spoken = num(input.salary) ? [winnerLine, breakEvenLine, ...result.issues.map((i) => render(i)[0])].join(" ") : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(spoken), 700)
    return () => clearTimeout(timer)
  }, [spoken])

  const amount = (k: AmountKey, label: string) => {
    const capped = result.issues.some((i) => i.kind === "overCap" && i.key === k)
    const shown = drafts[k] ?? (input[k] ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(input[k])) : "")
    return (
      <div key={k} className="grid min-w-0 content-end gap-1.5">
        <label htmlFor={`${id}-${k}`} className="text-xs font-medium">{label}</label>
        <input id={`${id}-${k}`} type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={shown} aria-invalid={capped || undefined}
          onChange={(e) => { setDrafts((d) => ({ ...d, [k]: e.target.value })); commit({ [k]: parseRupees(e.target.value) }) }}
          onBlur={() => setDrafts((d) => ({ ...d, [k]: undefined }))} className={cn(field, "tabular-nums")} />
      </div>
    )
  }

  const card = (r: Regime) => {
    const tax = result[r]
    const wins = result.winner === r
    return (
      <div className={cn("grid min-w-0 gap-0.5 rounded-md border px-3 py-2", wins ? "border-emerald-500/50 bg-emerald-500/5" : "bg-muted/40", input.regime === r && "ring-2 ring-primary/40")}>
        <span className="text-xs text-muted-foreground">{regimeName(r)}</span>
        <span className="text-base font-semibold tabular-nums">{rupees(tax.total)}</span>
        <span className="text-xs break-words text-muted-foreground tabular-nums">{fill(t.taxable, { amount: rupees(tax.taxable) })}</span>
        {wins && <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{fill(t.wins, { amount: rupees(result.saving) })}</span>}
      </div>
    )
  }

  return (
    <section ref={rootRef} aria-labelledby={`${id}-h`} data-slot="tax-regime-compare" data-state={result.issues.length ? "warning" : "ok"}
      className={cn("@container grid w-full max-w-md min-w-0 gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-xs", className)} {...props}>
      <h3 id={`${id}-h`} className="flex items-center gap-2 font-medium">
        <Scale aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">{t.heading}</span>
      </h3>

      <div className="grid min-w-0 grid-cols-2 gap-3">
        {amount("salary", t.salary)}
        {amount("basic", t.basic)}
        {amount("hra", t.hraReceived)}
        {amount("rent", t.rent)}
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-city`} className="text-xs font-medium">{t.city}</label>
          <select id={`${id}-city`} value={HRA_FIFTY_PERCENT_CITIES.includes(input.city ?? "") ? input.city : ""} onChange={(e) => commit({ city: e.target.value })} className={field}>
            {HRA_FIFTY_PERCENT_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="">{t.otherCity}</option>
          </select>
        </div>
        {amount("otherIncome", t.otherIncome)}
      </div>

      <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{t.deductions}</legend>
        <div className="grid min-w-0 grid-cols-2 gap-3">
          {(["d80C", "d80D", "d80DParents", "homeLoanInterest", "nps", "employerNps", "professionalTax"] as const).map((k) => amount(k, t.labels[k]))}
        </div>
      </fieldset>

      <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <legend className="mb-1.5 text-xs font-medium">{t.choice}</legend>
        {(["new", "old"] as const).map((r) => (
          <label key={r} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
            <input type="radio" name={`${id}-regime`} value={r} checked={input.regime === r} onChange={() => commit({ regime: r })} className="size-3.5 accent-primary outline-none" />
            {regimeName(r)}
          </label>
        ))}
      </fieldset>

      {num(input.salary) > 0 && (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">{card("old")}{card("new")}</div>
          <p className="flex gap-1.5 text-xs text-muted-foreground">
            <IndianRupee aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">{breakEvenLine}</span>
          </p>
          {result.issues.length > 0 && (
            <ul className="grid gap-2">
              {result.issues.map((issue, i) => {
                const [text, fixes] = render(issue)
                return (
                  <li key={`${issue.kind}-${i}`} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 space-y-1">
                      <span className="block break-words">{text}</span>
                      {fixes.length > 0 && <span className="flex flex-wrap gap-2">{fixes}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        {t.note}{" "}
        <a href={SOURCE} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {t.verify}<ExternalLink aria-hidden className="size-3" />
        </a>
      </p>
      <span aria-live="polite" className="sr-only">{status}</span>
    </section>
  )
}

const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0)
