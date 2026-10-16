"use client"

import * as React from "react"
import { CalendarCheck, CalendarX, Landmark } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkCheque, fromDayNumber, parseChequeDate, withYear, type ChequeCorrection, type ChequeDetails, type ChequeIssue, type ChequeMode, type ChequeRules } from "./cheque"

export { checkCheque, dayNumber, fromDayNumber, lastValidDay, parseChequeDate, sameDateLimit, withYear, type ChequeCorrection, type ChequeDetails, type ChequeIssue, type ChequeMode, type ChequeReadback, type ChequeRules, type ParsedChequeDate } from "./cheque"

/** Every visible string. `{date}`, `{from}`, `{until}`, `{days}`, `{year}` and `{fixed}` are filled in. */
export const CHEQUE_CHECK_MESSAGES = {
  dateLabel: "Date on the cheque",
  datePlaceholder: "DD MM YYYY",
  amountLabel: "Amount",
  correctedLabel: "Anything crossed out or overwritten?",
  corrections: { none: "Nothing", date: "The date", amount: "The amount", payee: "The payee name" } as Record<ChequeCorrection, string>,
  windowReceive: "Deposit between {from} and {until}",
  windowIssue: "They can deposit it from {from} to {until}",
  windowHint: "Valid for {months} months from its date (RBI).",
  incomplete: "Write the date in full: day, month and year.",
  month: "There's no month {month}. Check the middle two boxes.",
  noSuchDay: "There's no {date}. The bank will return it: correct the date and sign in full beside it.",
  shortYear: "Write the year in full ({year}). The boxes have room for four digits, and a two-digit year is easy to alter.",
  stale: "Too late: the last safe day to deposit was {date}. Banks don't pay a cheque more than {months} months after its date, so ask for a fresh one.",
  staleIssue: "Dated more than {months} months ago, so the bank won't pay it. Write today's date instead.",
  fixToday: "Use today, {date}",
  lastDay: "Today, {date}, is exactly {months} months from its date. On the usual legal reading it still counts, but some banks treat it as expired: deposit it at the branch today, or ask for a fresh cheque.",
  lastYear: "This date is a year ago, so the cheque is already expired. Did you mean {year}?",
  soon: "Only {days} left: deposit it by {date}. A cheque that misses the date has to be reissued.",
  postDated: "Post-dated: the bank won't pay it before {date}. Hold it and deposit on or after that day.",
  postDatedIssue: "Post-dated to {date}. Keep the money in the account on that day: a bounced cheque can lead to a case under section 138 of the Negotiable Instruments Act.",
  corrected: "A cheque with a changed {field} is rejected in clearing. Only the date may be corrected, so write a fresh cheque.",
  correctedFields: { amount: "amount", payee: "payee name" },
  dateCorrected: "Date corrections are allowed. Sign in full beside the change, or the bank may return it.",
  positivePayIssue: "Confirm this cheque in your bank's Positive Pay (app, net banking or branch) before you hand it over.",
  positivePayIssueMandatory: "Confirm it in Positive Pay first: many banks return cheques of {limit} and above without it.",
  positivePayReceive: "Ask the payer to confirm it in their bank's Positive Pay, or it may be returned.",
  fixYear: "Use {year}",
  fixLastDay: "Use {fixed}",
  fixFullYear: "Write {year}",
  fixed: "Date changed to {fixed}.",
  ok: "Fine to deposit.",
  okIssue: "Looks right.",
  days: (n: number) => (n === 1 ? "1 day" : `${n} days`),
}

export type ChequeCheckMessages = typeof CHEQUE_CHECK_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const inputClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 md:text-sm"
const fixClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface ChequeCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled cheque details. */
  value?: ChequeDetails
  /** Initial details when uncontrolled. */
  defaultValue?: ChequeDetails
  /** Called on every edit and one-tap fix. */
  onValueChange?: (value: ChequeDetails) => void
  /** "receive": you are about to deposit it. "issue": you are writing it. Default "receive". */
  mode?: ChequeMode
  /** "Today" in epoch ms, for deterministic rendering. Read from the clock after mount when omitted. */
  now?: number
  /** Validity, Positive Pay thresholds and the "deposit soon" window. */
  rules?: ChequeRules
  /** Locale for dates and money. */
  locale?: string
  /** ISO currency code for the amount. */
  currency?: string
  /** Hides the amount field when the amount doesn't matter to you. */
  showAmount?: boolean
  /** Any visible string. */
  messages?: Partial<ChequeCheckMessages>
}

/**
 * Stops a cheque being deposited after it has expired, before its date, or with a correction clearing will reject.
 * It reads the date the way it's written in the boxes (so 31 April is caught), shows the exact deposit window under
 * RBI's 3-month rule, catches a January cheque carrying last year's date, and says when Positive Pay is needed.
 */
export function ChequeCheck({
  value,
  defaultValue,
  onValueChange,
  mode = "receive",
  now: nowProp,
  rules,
  locale = "en-IN",
  currency = "INR",
  showAmount = true,
  messages,
  className,
  "aria-describedby": describedBy,
  ...props
}: ChequeCheckProps) {
  const t = { ...CHEQUE_CHECK_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<ChequeDetails>(defaultValue ?? { date: "" })
  const [clock, setClock] = React.useState<number>()
  const [status, setStatus] = React.useState("")
  const dateRef = React.useRef<HTMLInputElement>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const details: ChequeDetails = value && typeof value === "object" ? value : inner
  const nowMs = nowProp ?? clock

  React.useEffect(() => {
    if (nowProp === undefined) setClock(Date.now())
  }, [nowProp])

  const today = nowMs === undefined || !Number.isFinite(nowMs) ? undefined : (() => {
    const d = new Date(nowMs)
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5)
  })()
  const read = checkCheque(details, today, mode, rules)
  const months = rules?.validityMonths ?? 3
  const day = (n: number) => {
    const { year, month, day: d } = fromDayNumber(n)
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(year, month - 1, d))
  }
  const monthName = (m: number, d: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(Date.UTC(2024, m - 1, Math.min(d, 28))).replace(/\d+/, String(d))

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n)
  // The amount keeps its own text so "12." or "1,00,000" can be typed; the number is what's committed.
  const [amountText, setAmountText] = React.useState(details.amount == null ? "" : String(details.amount))
  React.useEffect(() => {
    const parsed = Number(amountText.replace(/[^\d.]/g, ""))
    if ((details.amount ?? null) !== (amountText.trim() && Number.isFinite(parsed) ? parsed : null)) setAmountText(details.amount == null ? "" : String(details.amount))
    // Only re-sync when the value changes from outside.
  }, [details.amount])

  const commit = (next: ChequeDetails) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }

  // One hidden status, debounced, so typing isn't read out keystroke by keystroke.
  const summary = read.issues.length ? read.issues.map((i) => describe(i)).join(" ") : ""
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(summary), 700)
    return () => clearTimeout(timer)
  }, [summary])

  function describe(issue: ChequeIssue): string {
    switch (issue.kind) {
      case "incomplete": return t.incomplete
      case "month": return fill(t.month, { month: parseChequeDate(details.date).month ?? "" })
      case "noSuchDay": return fill(t.noSuchDay, { date: monthName(issue.month, issue.day) })
      case "shortYear": return fill(t.shortYear, { year: issue.year })
      case "stale": return fill(mode === "issue" ? t.staleIssue : t.stale, { date: day(issue.expired), months })
      case "lastDay": return fill(t.lastDay, { date: day(issue.day), months })
      case "lastYear": return fill(t.lastYear, { year: issue.suggested })
      case "soon": return fill(t.soon, { days: t.days(issue.days), date: day(issue.until) })
      case "postDated": return fill(t.postDated, { date: day(issue.from) })
      case "postDatedIssue": return fill(t.postDatedIssue, { date: day(issue.from) })
      case "corrected": return fill(t.corrected, { field: t.correctedFields[issue.field] })
      case "dateCorrected": return t.dateCorrected
      case "positivePay": return mode === "issue" ? (issue.mandatory ? fill(t.positivePayIssueMandatory, { limit: money(rules?.positivePayMandatoryFrom ?? 500000) }) : t.positivePayIssue) : t.positivePayReceive
    }
  }

  const fixFor = (issue: ChequeIssue): { label: string; date: string } | null => {
    if (issue.kind === "lastYear") return { label: fill(t.fixYear, { year: issue.suggested }), date: withYear(details.date, issue.suggested) }
    if (issue.kind === "stale" && mode === "issue" && today !== undefined) {
      const { year, month, day: d } = fromDayNumber(today)
      return { label: fill(t.fixToday, { date: day(today) }), date: `${String(d).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}` }
    }
    if (issue.kind === "shortYear") return { label: fill(t.fixFullYear, { year: issue.year }), date: withYear(details.date, issue.year) }
    if (issue.kind === "noSuchDay" && mode === "issue") {
      const p = parseChequeDate(details.date)
      const last = new Date(Date.UTC(p.year ?? 2000, issue.month, 0)).getUTCDate()
      const date = `${last}-${String(issue.month).padStart(2, "0")}-${p.year ?? ""}`
      return { label: fill(t.fixLastDay, { fixed: monthName(issue.month, last) }), date }
    }
    return null
  }

  const applyFix = (date: string) => {
    commit({ ...details, date })
    setStatus(fill(t.fixed, { fixed: date }))
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? dateRef.current)?.focus())
  }

  const dateInvalid = read.issues.some((i) => ["incomplete", "month", "noSuchDay", "stale", "lastYear"].includes(i.kind))
  const danger = read.blocked
  // Show what the bank will read: the parsed date when it's readable, else the digits as typed.
  const parsedDate = parseChequeDate(details.date)
  const digits = parsedDate.ok && !parsedDate.shortYear
    ? `${String(parsedDate.day).padStart(2, "0")}${String(parsedDate.month).padStart(2, "0")}${parsedDate.year}`
    : (details.date ?? "").replace(/\D/g, "").slice(0, 8)

  return (
    <div ref={rootRef} data-slot="cheque-check" data-state={danger ? "blocked" : read.issues.length ? "warning" : "ok"} className={cn("w-full max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <label htmlFor={`${id}-date`} className="text-sm font-medium">{t.dateLabel}</label>
          <input
            ref={dateRef}
            id={`${id}-date`}
            value={details.date ?? ""}
            onChange={(e) => commit({ ...details, date: e.target.value.slice(0, 14) })}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t.datePlaceholder}
            aria-invalid={dateInvalid || undefined}
            aria-describedby={[describedBy, read.issues.length ? `${id}-issues` : ""].filter(Boolean).join(" ") || undefined}
            className={cn(inputClass, "mt-1.5 font-mono tracking-wider")}
          />
        </div>
        {/* The CTS date boxes, filled with what was typed, so a missing digit is visible at a glance. */}
        <div aria-hidden className="flex items-end gap-1 font-mono text-sm">
          {["D", "D", "M", "M", "Y", "Y", "Y", "Y"].map((slot, i) => (
            <span key={i} className={cn("grid h-8 w-5 place-items-center sm:w-6 rounded-sm border bg-background tabular-nums dark:bg-input/30", (i === 2 || i === 4) && "ml-1", !digits[i] && "text-muted-foreground/50")}>
              {digits[i] ?? slot}
            </span>
          ))}
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-3", showAmount && "sm:grid-cols-2")}>
        {showAmount && (
          <div className="min-w-0">
            <label htmlFor={`${id}-amount`} className="text-sm font-medium">{t.amountLabel}</label>
            <input
              id={`${id}-amount`}
              inputMode="decimal"
              value={amountText}
              onChange={(e) => {
                const text = e.target.value.slice(0, 20)
                const n = Number(text.replace(/[^\d.]/g, ""))
                setAmountText(text)
                commit({ ...details, amount: text.trim() && Number.isFinite(n) ? n : null })
              }}
              className={cn(inputClass, "mt-1.5 tabular-nums")}
            />
            {Number.isFinite(Number(details.amount)) && Number(details.amount) > 0 && <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">{money(Number(details.amount))}</p>}
          </div>
        )}
        <div className="min-w-0">
          <label htmlFor={`${id}-corrected`} className="text-sm font-medium">{t.correctedLabel}</label>
          <select
            id={`${id}-corrected`}
            value={details.corrected ?? "none"}
            onChange={(e) => commit({ ...details, corrected: e.target.value as ChequeCorrection })}
            className={cn(inputClass, "mt-1.5 pr-2")}
          >
            {(Object.keys(t.corrections) as ChequeCorrection[]).map((k) => <option key={k} value={k}>{t.corrections[k]}</option>)}
          </select>
        </div>
      </div>

      {read.from !== undefined && read.until !== undefined && (
        <div className={cn("flex items-start gap-2 rounded-md border p-3", danger ? "border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300" : "bg-muted/40")}>
          {danger ? <CalendarX aria-hidden className="mt-0.5 size-4 shrink-0" /> : <CalendarCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          <div className="min-w-0">
            <p className={cn("font-medium", danger && "line-through decoration-1")}>{fill(mode === "issue" ? t.windowIssue : t.windowReceive, { from: day(read.from), until: day(read.until) })}</p>
            <p className="text-xs text-muted-foreground">{fill(t.windowHint, { months })}</p>
          </div>
        </div>
      )}

      {read.issues.length > 0 ? (
        <ul id={`${id}-issues`} className="space-y-2">
          {read.issues.map((issue, i) => {
            const fix = fixFor(issue)
            const severe = ["incomplete", "month", "noSuchDay", "stale", "lastYear", "corrected"].includes(issue.kind)
            const info = issue.kind === "dateCorrected" || issue.kind === "positivePay" || issue.kind === "postDatedIssue"
            return (
              <li key={issue.kind + i} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", severe ? "text-red-700 dark:text-red-400" : info ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300")}>
                {issue.kind === "positivePay" ? <Landmark aria-hidden className="size-3.5 shrink-0" /> : <CalendarX aria-hidden className="size-3.5 shrink-0" />}
                <span id={`${id}-i${i}`} className="min-w-0 flex-1 basis-40 break-words">{describe(issue)}</span>
                {fix && <button type="button" data-fix onClick={() => applyFix(fix.date)} aria-describedby={`${id}-i${i}`} className={fixClass}>{fix.label}</button>}
              </li>
            )
          })}
        </ul>
      ) : (
        read.from !== undefined && <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CalendarCheck aria-hidden className="size-3.5" />{mode === "issue" ? t.okIssue : t.ok}</p>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
