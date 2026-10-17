"use client"

// Bollard UI — salary-input · MIT licence · https://bollard-ui.vercel.app/components/salary-input

import * as React from "react"
import { TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { amountInWords, checkSalary, parseSalary, toYearly, type SalaryPeriod, type SalarySlip } from "./salary"

export * from "./salary"

/** Default messages. `{amount}`, `{monthly}`, `{yearly}`, `{lakhs}`, `{fixed}`, `{factor}`, `{range}` are filled in. */
export const SALARY_MESSAGES = {
  lakhsYear: "{amount} a year? Did you mean {lakhs} LPA?",
  lakhsMonth: "{amount} a month? Did you mean {lakhs} LPA, or {thousands} a month?",
  useLakhs: "Use {lakhs} LPA",
  useThousands: "{thousands}/month",
  thousandsYear: "{amount} a year? Did you mean {thousands}?",
  thousandsMonth: "{amount} a month? Did you mean {thousands}?",
  useThousandsFixed: "Use {thousands}",
  periodYear: "{amount} a year is only {monthly} a month. Is it a monthly salary?",
  periodMonth: "{amount} a month is {yearly} a year. Is it a yearly figure?",
  useMonth: "It's per month",
  useYear: "It's per year",
  zeros: "That's {factor}× the range for this role ({range}). Did you mean {fixed}?",
  zerosLow: "That's far below the range for this role ({range}). Did you mean {fixed}?",
  useFixed: "Use {fixed}",
  above: "That's above the usual range for this role ({range}).",
  below: "That's below the usual range for this role ({range}).",
  keep: "Keep it as typed",
  month: "Month",
  year: "Year",
  periodLabel: "Pay period",
  aYear: "a year",
  aMonth: "a month",
  unreadable: "Enter one amount, like 12 LPA, 85k/month or 12,00,000.",
}

const fill = (s: string, d: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => d[k] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium whitespace-nowrap text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** The field's value: the amount as typed and the period it is paid in. */
export interface SalaryValue {
  text: string
  period: SalaryPeriod
}

export interface SalaryInputProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Controlled value. */
  value?: SalaryValue
  /** Initial value when uncontrolled. */
  defaultValue?: Partial<SalaryValue>
  /** Called with the value and the amount it means per year and per month (null while it isn't an amount). */
  onValueChange?: (value: SalaryValue, amount: { yearly: number; monthly: number } | null) => void
  /** ISO currency. INR reads back in lakh and crore with Indian digit grouping. */
  currency?: string
  /** The yearly range expected for this role, e.g. [800000, 1400000]. Enables the extra-zero check. */
  expectedRange?: [number, number]
  /** Yearly range any salary in this currency falls in, used when there is no expectedRange. Defaults by currency; null turns the generic check off. */
  plausibleRange?: [number, number] | null
  /** Pause in ms before warnings appear while typing. Leaving the field shows them at once. */
  delay?: number
  /** Override any message or label. */
  messages?: Partial<typeof SALARY_MESSAGES>
}

/**
 * A salary field that catches the period and unit slips that sink offers and
 * filters: a monthly figure in a yearly field (and back), "12" meant as 12 LPA,
 * and an extra zero against the role's range. It reads every amount back in
 * lakh/crore and per month and per year, and every fix is one tap.
 */
export function SalaryInput({
  label = "Expected salary",
  value,
  defaultValue,
  onValueChange,
  currency = "INR",
  expectedRange,
  plausibleRange,
  delay = 600,
  messages,
  id,
  className,
  onBlur,
  ref,
  "aria-describedby": describedBy,
  ...props
}: SalaryInputProps) {
  const t = { ...SALARY_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<SalaryValue>({ text: "", period: "year", ...defaultValue })
  const current = value ?? inner
  const [settled, setSettled] = React.useState(current.text)
  const [dismissed, setDismissed] = React.useState<string>()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoId = React.useId()
  const inputId = id ?? autoId
  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(current.text), delay)
    return () => clearTimeout(timer)
  }, [current.text, delay])

  const indian = currency === "INR"
  const money = React.useMemo(() => new Intl.NumberFormat(indian ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }), [currency, indian])
  const plain = (n: number) => n.toLocaleString(indian ? "en-IN" : "en-US")
  const words = (n: number) => amountInWords(n, indian ? "indian" : "international")
  const lpa = (n: number) => Math.round(n / 1e3) / 100
  const rangeText = expectedRange && (indian ? `${lpa(expectedRange[0])}–${lpa(expectedRange[1])} LPA` : `${money.format(expectedRange[0])}–${money.format(expectedRange[1])}`)

  const update = (next: SalaryValue, settle = false, picked = false) => {
    const parsed = parseSalary(next.text)
    // A period written in the text ("12 LPA", "85k/month") moves the picker with it. Picking the
    // other period afterwards wins, and the text is rewritten as a plain amount so the two agree.
    const synced =
      parsed?.period && parsed.period !== next.period
        ? picked ? { ...next, text: plain(parsed.amount) } : { ...next, period: parsed.period }
        : next
    if (value === undefined) setInner(synced)
    if (settle) setSettled(synced.text)
    const yearly = parsed ? toYearly(parsed.amount, synced.period) : 0
    onValueChange?.(synced, parsed ? { yearly, monthly: Math.round(yearly / 12) } : null)
  }
  const apply = (next: SalaryValue, picked = false) => {
    update(next, true, picked)
    inputRef.current?.focus()
  }

  const parsed = parseSalary(current.text)
  const ready = settled === current.text
  const key = `${current.text}|${current.period}`
  const slip: SalarySlip | null = ready && parsed && key !== dismissed ? checkSalary(parsed, current.period, expectedRange, { currency, plausible: plausibleRange }) : null
  const yearly = parsed ? toYearly(parsed.amount, current.period) : 0
  const d: Record<string, string> = parsed
    ? {
        amount: money.format(parsed.amount),
        monthly: money.format(Math.round(parsed.amount / 12)),
        yearly: indian ? `₹${words(parsed.amount * 12)}` : money.format(parsed.amount * 12),
        lakhs: String(parsed.amount),
        thousands: money.format(slip?.kind === "thousands" ? slip.thousands : parsed.amount * 1000),
        fixed: slip?.kind === "zeros" ? money.format(slip.fixed) : "",
        factor: slip?.kind === "zeros" ? String(slip.factor) : "",
        range: rangeText ?? "",
      }
    : {}

  const fixes: { label: string; next: SalaryValue }[] = []
  let message = ""
  if (slip?.kind === "lakhs") {
    message = fill(slip.period === "year" ? t.lakhsYear : t.lakhsMonth, d)
    fixes.push({ label: fill(t.useLakhs, d), next: { text: plain(slip.lakhs * 1e5), period: "year" } })
    if (slip.period === "month") fixes.push({ label: fill(t.useThousands, d), next: { text: plain(slip.lakhs * 1e3), period: "month" } })
  } else if (slip?.kind === "thousands") {
    message = fill(slip.period === "year" ? t.thousandsYear : t.thousandsMonth, d)
    fixes.push({ label: fill(t.useThousandsFixed, d), next: { text: plain(slip.thousands), period: slip.period } })
  } else if (slip?.kind === "period") {
    message = fill(slip.period === "year" ? t.periodYear : t.periodMonth, d)
    fixes.push({ label: slip.other === "month" ? t.useMonth : t.useYear, next: { ...current, period: slip.other } })
  } else if (slip?.kind === "zeros") {
    message = fill(slip.factor >= 1 ? t.zeros : t.zerosLow, d)
    fixes.push({ label: fill(t.useFixed, d), next: { text: plain(slip.fixed), period: current.period } })
  } else if (slip?.kind === "range") message = fill(slip.direction === "above" ? t.above : t.below, d)

  const periodButton = (p: SalaryPeriod) => (
    <button
      key={p}
      type="button"
      role="radio"
      aria-checked={current.period === p}
      tabIndex={current.period === p ? 0 : -1}
      onClick={() => apply({ ...current, period: p }, true)}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault()
          const other = p === "month" ? "year" : "month"
          update({ ...current, period: other }, false, true)
          ;(e.currentTarget.parentElement?.querySelector(`[data-period="${other}"]`) as HTMLElement | null)?.focus()
        }
      }}
      data-period={p}
      className={cn(
        "h-7 rounded-[5px] px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        current.period === p ? "bg-background text-foreground shadow-xs dark:bg-input/60" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {p === "month" ? t.month : t.year}
    </button>
  )

  return (
    <div data-slot="salary-input" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          autoComplete="off"
          placeholder={indian ? "e.g. 12 LPA or 1,00,000" : "e.g. 85,000"}
          value={current.text}
          onChange={(e) => update({ ...current, text: e.target.value })}
          onBlur={(e) => {
            setSettled(current.text)
            onBlur?.(e)
          }}
          aria-describedby={[parsed && parsed.amount > 0 && `${inputId}-readback`, `${inputId}-status`, describedBy].filter(Boolean).join(" ")}
          data-warning={slip ? "" : undefined}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
          {...props}
        />
        <div role="radiogroup" aria-label={t.periodLabel} className="flex h-9 shrink-0 items-center gap-0.5 rounded-md border bg-muted p-0.5">
          {periodButton("month")}
          {periodButton("year")}
        </div>
      </div>
      <div className="grid min-h-6 gap-1 text-xs">
        {/* Updates on every keystroke, so it sits outside the live region; the settled reading is announced below. */}
        {parsed && parsed.amount > 0 && (
          <p id={`${inputId}-readback`} className="flex flex-wrap gap-x-1.5 py-1 text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">{money.format(yearly)} {t.aYear}</span>
            {yearly >= 1000 && (
              <>
                <span aria-hidden>·</span>
                <span>{words(yearly)}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{money.format(Math.round(yearly / 12))} {t.aMonth}</span>
          </p>
        )}
        <div id={`${inputId}-status`} aria-live="polite" className="grid gap-1">
        {ready && !slip && parsed && parsed.amount > 0 && (
          <span className="sr-only">{`${money.format(yearly)} ${t.aYear}, ${money.format(Math.round(yearly / 12))} ${t.aMonth}`}</span>
        )}
        {ready && !parsed && current.text.trim() && <p className="py-1 text-muted-foreground">{t.unreadable}</p>}
        {slip && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{message}</span>
              {fixes.map((f) => (
                <button key={f.label} type="button" onClick={() => apply(f.next)} className={fixClass}>{f.label}</button>
              ))}
              <button
                type="button"
                onClick={() => setDismissed(key)}
                aria-label={t.keep}
                title={t.keep}
                className="grid size-6 place-items-center rounded-md transition-colors hover:bg-amber-500/10 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          </p>
        )}
        </div>
      </div>
    </div>
  )
}
