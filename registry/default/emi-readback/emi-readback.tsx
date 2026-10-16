"use client"

// Bollard UI — emi-readback · MIT licence · https://bollard-ui.vercel.app/components/emi-readback

import * as React from "react"
import { CalendarClock, Percent, PiggyBank, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { EMPTY_LOAN, loanIssues, parseAmount, readLoan, type IssueOptions, type LoanIssue, type LoanTerms } from "./emi"

export { EMPTY_LOAN, emiFor, flatToReducing, loanIssues, parseAmount, readLoan, type LoanIssue, type LoanReadback, type LoanTerms } from "./emi"

/** Every visible string. `{…}` placeholders are filled in. */
export const EMI_READBACK_MESSAGES = {
  amount: "Loan amount",
  rate: "Interest rate (% a year)",
  reducing: "Reducing",
  flat: "Flat",
  tenure: "Tenure",
  months: "Months",
  years: "Years",
  fee: "Processing fee",
  percent: "% of loan",
  rupees: "₹",
  rateType: "Rate type",
  tenureUnit: "Tenure in",
  feeUnit: "Fee in",
  otherCharges: "Other upfront charges",
  otherChargesHint: "Insurance, stamp duty, documentation: anything taken before the money reaches you.",
  otherLine: "Other upfront charges",
  emiLine: "{emi} a month",
  emiCount: "for {months} EMIs ({span})",
  interest: "Total interest",
  fees: "Processing fee + {gst}% GST",
  total: "Total you repay",
  disbursed: "Reaches your account",
  apr: "Real yearly cost with fees (APR)",
  empty: "Fill in amount, rate and tenure to see your EMI.",
  outOfRange: "We can't work out a loan from these numbers. Check the tenure (up to 100 years) and the rate (up to 200% a year).",
  noApr: "—",
  tenureYears: "{n} years is longer than any loan: {asTyped} a month. Did you mean {n} months ({years})? That's {fixed} a month.",
  tenureYearsNoEmi: "{n} years is longer than any loan. Did you mean {n} months ({years})? That's {fixed} a month.",
  tenureMonths: "Only {n} months? That's {asTyped} a month. Over {n} years it would be {fixed} a month.",
  monthlyRate: "{rate}% looks like a monthly rate. That's {annual}% a year.",
  flatRate: "A {rate}% flat rate charges interest on the full amount all the way through. It costs the same as {effective}% reducing.",
  prepayTooLate: "The loan ends after {months} EMIs, so this prepayment never happens.",
  prepayTooBig: "This prepays everything still owed at that point, so the loan closes there.",
  prepayWhen: "Add after which EMI you'd prepay to see what it saves.",
  feeTooBig: "The fee and charges take the whole loan: nothing would reach your account. Check the fee.",
  useMonths: "Use {n} months",
  useYears: "Use {n} years",
  useAnnual: "Use {annual}% a year",
  keepMonths: "Yes, {n} months",
  quoteReducing: "It's a reducing rate",
  prepayHeading: "Prepay",
  prepayAmount: "Prepay amount",
  prepayAfter: "After EMI no.",
  shorter: "Finish sooner",
  smaller: "Smaller EMI",
  prepayMode: "After prepaying",
  savedShorter: "Saves {saved} interest and ends {count} EMIs sooner.",
  savedSmaller: "Saves {saved} interest; EMI drops to {emi}.",
  savedCharge: "That's after a {charge} prepayment charge.",
  status: "EMI {emi} a month, total interest {interest}.",
}
export type EmiReadbackMessages = typeof EMI_READBACK_MESSAGES

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
type Field = "amount" | "rate" | "tenure" | "fee" | "otherCharges" | "prepay" | "prepayAfter"
/** Which issues describe which field, so the field can point screen readers at them. */
const FIELD_ISSUES: Partial<Record<Field, LoanIssue["kind"][]>> = {
  rate: ["monthlyRate", "flatRate"], tenure: ["tenureYears", "tenureMonths"], fee: ["feeTooBig"], prepay: ["prepayTooBig"], prepayAfter: ["prepayTooLate", "prepayWhen"],
}

export interface EmiReadbackProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange">, IssueOptions {
  /** Controlled loan terms. */
  value?: LoanTerms
  /** Initial terms when uncontrolled. */
  defaultValue?: Partial<LoanTerms>
  /** Called with the new terms on every edit or fix. */
  onValueChange?: (terms: LoanTerms) => void
  /** Locale for numbers. */
  locale?: string
  /** Currency code for amounts. */
  currency?: string
  /** Pause in ms before the readback is announced to screen readers. */
  announceDelay?: number
  /** Show the "Other upfront charges" field (insurance, stamp duty…), which RBI's KFS counts in the APR. */
  showOtherCharges?: boolean
  /** Any visible string. */
  messages?: Partial<EmiReadbackMessages>
}

/**
 * Reads a loan back before anyone signs: EMI, total interest, fees with GST, what actually reaches the
 * account and the real yearly cost (APR). Catches tenure typed in the wrong unit, a monthly rate typed as
 * yearly and a flat rate that hides a much higher reducing rate, each with the EMI both ways and a one-tap
 * fix, and shows what a prepayment saves.
 */
export function EmiReadback({
  value, defaultValue, onValueChange, locale = "en-IN", currency = "INR", gstRate = 18, prepayCharge = 0,
  maxYears, shortMonths, minAnnualRate, announceDelay = 800, showOtherCharges = false, messages, className, ...props
}: EmiReadbackProps) {
  const t = { ...EMI_READBACK_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<LoanTerms>({ ...EMPTY_LOAN, ...defaultValue })
  const terms: LoanTerms = { ...EMPTY_LOAN, ...(value ?? inner) }
  const [drafts, setDrafts] = React.useState<Partial<Record<Field, string>>>({})
  const [status, setStatus] = React.useState("")
  // Warnings the borrower has confirmed are right ("Yes, 6 months"), keyed by kind and value.
  const [kept, setKept] = React.useState<string[]>([])
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const opts = { gstRate, prepayCharge, maxYears, shortMonths, minAnnualRate }
  const read = readLoan(terms, opts)
  const keyOf = (i: LoanIssue) => (i.kind === "tenureMonths" ? `${i.kind}:${i.months}` : "")
  const issues = loanIssues(terms, opts).filter((i) => !kept.includes(keyOf(i)))

  const money = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0)
  const num = (n: number, digits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n)
  const span = (months: number) => {
    const y = Math.floor(months / 12), m = months % 12
    return [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(" ")
  }

  const commit = (patch: Partial<LoanTerms>) => {
    const next = { ...terms, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  const describe = (issue: LoanIssue) => {
    switch (issue.kind) {
      case "tenureYears": return issue.emiAsTyped
        ? fill(t.tenureYears, { n: issue.months, years: span(issue.months), asTyped: money(issue.emiAsTyped), fixed: money(issue.emiIfFixed) })
        : fill(t.tenureYearsNoEmi, { n: issue.months, years: span(issue.months), fixed: money(issue.emiIfFixed) })
      case "tenureMonths": return fill(t.tenureMonths, { n: issue.months, asTyped: money(issue.emiAsTyped), fixed: money(issue.emiIfFixed) })
      case "monthlyRate": return fill(t.monthlyRate, { rate: num(terms.rate ?? 0), annual: num(issue.annual) })
      case "flatRate": return fill(t.flatRate, { rate: num(terms.rate ?? 0), effective: num(issue.effective, 1) })
      case "prepayTooLate": return fill(t.prepayTooLate, { months: issue.months })
      case "prepayTooBig": return t.prepayTooBig
      case "prepayWhen": return t.prepayWhen
      case "feeTooBig": return t.feeTooBig
    }
  }
  const typed = [terms.amount, terms.rate, terms.tenure].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
  const summary = [read ? fill(t.status, { emi: money(read.emi), interest: money(read.interest) }) : typed ? t.outOfRange : "", ...issues.map(describe)].filter(Boolean).join(" ")
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(summary), announceDelay)
    return () => clearTimeout(timer)
  }, [summary, announceDelay])

  /** After a fix, focus the next fix, else the field the fix changed. */
  const fixed = (field: Field) =>
    requestAnimationFrame(() => {
      const root = rootRef.current
      ;(root?.querySelector<HTMLElement>("[data-fix]") ?? root?.querySelector<HTMLElement>(`[data-field="${field}"]`))?.focus()
    })

  const fixFor = (issue: LoanIssue): { label: string; field: Field; patch: Partial<LoanTerms> } | null => {
    switch (issue.kind) {
      case "tenureYears": return { label: fill(t.useMonths, { n: issue.months }), field: "tenure", patch: { tenureUnit: "months" } }
      case "tenureMonths": return { label: fill(t.useYears, { n: issue.months }), field: "tenure", patch: { tenureUnit: "years" } }
      case "monthlyRate": return { label: fill(t.useAnnual, { annual: num(issue.annual) }), field: "rate", patch: { rate: Math.round(issue.annual * 100) / 100 } }
      case "flatRate": return { label: t.quoteReducing, field: "rate", patch: { rateType: "reducing" } }
      default: return null
    }
  }

  const shown = (field: Field) => {
    if (drafts[field] !== undefined) return drafts[field]
    const n = terms[field]
    return typeof n === "number" && Number.isFinite(n) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n) : ""
  }
  const input = (field: Field, label: string, extra?: React.ReactNode, invalid = false, className?: string) => (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={`${id}-${field}`} className="text-sm font-medium">{label}</label>
      <div className="flex min-w-0 gap-1.5">
        <input
          id={`${id}-${field}`}
          data-field={field}
          inputMode="decimal"
          autoComplete="off"
          value={shown(field)}
          aria-describedby={issues.filter((i) => FIELD_ISSUES[field]?.includes(i.kind)).map((i) => `${id}-issue-${i.kind}`).join(" ") || undefined}
          aria-invalid={invalid || Number.isNaN(terms[field] as number) || undefined}
          onChange={(e) => {
            setDrafts((d) => ({ ...d, [field]: e.target.value }))
            commit({ [field]: parseAmount(e.target.value) })
          }}
          onBlur={() => setDrafts(({ [field]: _, ...rest }) => rest)}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        />
        {extra}
      </div>
    </div>
  )
  const select = <K extends "rateType" | "tenureUnit" | "feeUnit" | "prepayMode">(key: K, label: string, options: [LoanTerms[K], string][]) => (
    <select
      aria-label={label}
      value={terms[key]}
      onChange={(e) => commit({ [key]: e.target.value } as Partial<LoanTerms>)}
      className="h-9 shrink-0 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )

  const tenureIssue = issues.some((i) => i.kind === "tenureYears" || i.kind === "tenureMonths")
  const rateIssue = issues.some((i) => i.kind === "monthlyRate")
  const prepay = read?.prepayment

  return (
    <div ref={rootRef} data-slot="emi-readback" data-state={issues.length ? "warning" : read ? "ok" : "empty"} className={cn("grid w-full max-w-md gap-3 text-sm", className)} {...props}>
      <div className="grid gap-3 sm:grid-cols-2">
        {input("amount", t.amount)}
        {input("rate", t.rate, select("rateType", t.rateType, [["reducing", t.reducing], ["flat", t.flat]]), rateIssue)}
        {input("tenure", t.tenure, select("tenureUnit", t.tenureUnit, [["years", t.years], ["months", t.months]]), tenureIssue)}
        {input("fee", t.fee, select("feeUnit", t.feeUnit, [["percent", t.percent], ["amount", t.rupees]]), issues.some((i) => i.kind === "feeTooBig"))}
        {showOtherCharges && (
          <div className="grid gap-1.5 sm:col-span-2">
            {input("otherCharges", t.otherCharges)}
            <p className="text-xs text-muted-foreground">{t.otherChargesHint}</p>
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <ul className="grid gap-2">
          {issues.map((issue) => {
            const fix = fixFor(issue)
            return (
              <li key={issue.kind} id={`${id}-issue-${issue.kind}`} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                {issue.kind === "flatRate" || issue.kind === "monthlyRate" ? <Percent aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : issue.kind.startsWith("tenure") ? <CalendarClock aria-hidden className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
                <span className="min-w-0 space-y-1">
                  <span className="block break-words">{describe(issue)}</span>
                  {(fix || issue.kind === "tenureMonths") && <span className="flex flex-wrap gap-2">
                    {fix && (
                      <button
                        type="button"
                        data-fix
                        onClick={() => { commit(fix.patch); setDrafts({}); fixed(fix.field) }}
                        className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
                      >
                        {fix.label}
                      </button>
                    )}
                    {issue.kind === "tenureMonths" && (
                      <button
                        type="button"
                        onClick={() => { setKept((k) => [...k, keyOf(issue)]); fixed("tenure") }}
                        className="inline-flex h-6 items-center rounded-md px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
                      >
                        {fill(t.keepMonths, { n: issue.months })}
                      </button>
                    )}
                  </span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <section aria-labelledby={`${id}-emi`} className="rounded-md border bg-muted/40 p-3">
        {read ? (
          <>
            <p id={`${id}-emi`} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xl font-semibold tabular-nums">{fill(t.emiLine, { emi: money(read.emi) })}</span>
              <span className="text-xs text-muted-foreground">{fill(t.emiCount, { months: read.months, span: span(read.months) })}</span>
            </p>
            <dl className="mt-2 grid gap-1 text-xs">
              {([
                [t.interest, money(read.interest)],
                ...(read.feeBeforeGst > 0 ? [[fill(t.fees, { gst: num(gstRate) }), money(read.feeBeforeGst + read.gst)]] : []),
                ...(read.otherCharges > 0 ? [[t.otherLine, money(read.otherCharges)]] : []),
                ...(read.feeBeforeGst + read.otherCharges > 0 ? [[t.disbursed, money(read.disbursed)]] : []),
                [t.total, money(read.totalPayable)],
                [t.apr, read.disbursed > 0 ? `${num(read.apr, 2)}%` : t.noApr],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p id={`${id}-emi`} className="text-muted-foreground">{typed ? t.outOfRange : t.empty}</p>
        )}
      </section>

      <fieldset className="grid gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">{t.prepayHeading}</legend>
        <div className="grid grid-cols-2 gap-3">
          {input("prepay", t.prepayAmount)}
          {input("prepayAfter", t.prepayAfter)}
        </div>
        <div role="group" aria-label={t.prepayMode} className="inline-flex w-fit rounded-md border p-0.5">
          {([["tenure", t.shorter], ["emi", t.smaller]] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={terms.prepayMode === mode}
              onClick={() => commit({ prepayMode: mode })}
              className="h-7 rounded px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {label}
            </button>
          ))}
        </div>
        {prepay && (
          <p className="flex gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <PiggyBank aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">
              {terms.prepayMode === "tenure"
                ? fill(t.savedShorter, { saved: money(prepay.interestSaved), count: prepay.monthsSaved })
                : fill(t.savedSmaller, { saved: money(prepay.interestSaved), emi: money(prepay.newEmi) })}
              {prepay.charge > 0 && <> {fill(t.savedCharge, { charge: money(prepay.charge) })}</>}
            </span>
          </p>
        )}
      </fieldset>
      <span aria-live="polite" className="sr-only">{status}</span>
    </div>
  )
}
