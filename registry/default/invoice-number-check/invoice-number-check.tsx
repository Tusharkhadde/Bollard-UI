"use client"

// Bollard UI — invoice-number-check · MIT licence · https://bollard-ui.vercel.app/components/invoice-number-check

import * as React from "react"
import { CircleAlert, Hash, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface IssuedInvoice {
  number: string
  date: Date | number | string
  /** Cancelled numbers still count as used: a GST portal won't take the same number twice in a year. */
  cancelled?: boolean
}

/** Reads a date, taking a bare "2026-04-01" as that calendar day locally (not UTC midnight, which is 31 March west of Greenwich). */
export function toDate(date: Date | number | string) {
  const m = typeof date === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim()) : null
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(date)
}
const valid = (date: Date | number | string) => !Number.isNaN(toDate(date).getTime())

/** Indian financial year (1 April – 31 March) of a date, e.g. `{ start: 2026, label: "2026-27", short: "26-27" }`. */
export function financialYear(date: Date | number | string) {
  const d = toDate(date)
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  const end = String((start + 1) % 100).padStart(2, "0")
  return { start, label: `${start}-${end}`, short: `${String(start % 100).padStart(2, "0")}-${end}` }
}

const FY = /(?<!\d)(\d{2}|\d{4})([-/])(\d{2})(?!\d)/
interface Parsed { head: string; fy?: { text: string; start: number; long: boolean; sep: string }; counter?: { text: string; n: number }; tail: string }

/** Splits a number into prefix, an optional financial-year token ("26-27", "2026-27") and the running counter. */
export function parseInvoiceNumber(value: string): Parsed {
  let fy: Parsed["fy"]
  let rest = value
  const m = FY.exec(value)
  if (m) {
    const a = Number(m[1].length === 2 ? `20${m[1]}` : m[1])
    if ((a + 1) % 100 === Number(m[3])) {
      fy = { text: m[0], start: a, long: m[1].length === 4, sep: m[2] }
      rest = value.slice(0, m.index) + "\u0000".repeat(m[0].length) + value.slice(m.index + m[0].length)
    }
  }
  const runs = [...rest.matchAll(/\d+/g)]
  const last = runs[runs.length - 1]
  if (!last || last.index === undefined) return { head: value, fy, tail: "" }
  return { head: value.slice(0, last.index), fy, counter: { text: last[0], n: Number(last[0]) }, tail: value.slice(last.index + last[0].length) }
}

/** What identifies a series: everything but the counter value and the year, compared case-insensitively. */
const seriesKey = (p: Parsed) => `${(p.fy ? p.head.replace(p.fy.text, "{fy}") : p.head).toUpperCase()}#${p.tail.toUpperCase()}`
const pad = (n: number, width: number) => String(n).padStart(width, "0")
const withYear = (p: Parsed, start: number) => {
  if (!p.fy) return p.head
  const end = pad((start + 1) % 100, 2)
  return p.head.replace(p.fy.text, `${p.fy.long ? start : pad(start % 100, 2)}${p.fy.sep}${end}`)
}

export type InvoiceIssue =
  | { code: "chars"; chars: string[]; fix: string }
  | { code: "length"; length: number; fix?: string }
  | { code: "start"; fix?: string }
  | { code: "duplicate"; match: IssuedInvoice; caseOnly: boolean }
  | { code: "year"; typed: string; expected: string; fix: string }
  | { code: "skip"; from: string; to: string }
  | { code: "behind"; last: string }

export interface InvoiceCheckOptions {
  issued?: IssuedInvoice[]
  /** Date of the invoice being numbered; decides its financial year. */
  date?: Date | number | string
  /** E-invoice (IRP) rule: the number may not start with 0, / or -. */
  einvoice?: boolean
}

/**
 * Checks an invoice number against CGST Rule 46(b): at most 16 characters, only letters,
 * digits, "-" and "/", unique within the financial year (case-insensitive, as the GST
 * portals treat it), plus the year token, the place in its series and the gaps in it.
 */
export function checkInvoiceNumber(value: string, { issued: list, date = new Date(), einvoice = true }: InvoiceCheckOptions = {}) {
  const issued = Array.isArray(list) ? list.filter((i) => i && typeof i.number === "string") : []
  const fy = financialYear(valid(date) ? date : new Date())
  const sameYear = issued.filter((i) => typeof i.number === "string" && valid(i.date) && financialYear(i.date).start === fy.start)
  const issues: InvoiceIssue[] = []
  const v = typeof value === "string" ? value.trim() : ""
  const p = parseInvoiceNumber(v)
  const key = seriesKey(p)

  // The series to continue: the typed one if it has a counter, else the most recently issued one.
  const latest = [...issued].filter((i) => typeof i.number === "string").sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())[0]
  const base = p.counter ? p : latest ? parseInvoiceNumber(latest.number) : undefined
  const members = base?.counter ? sameYear.map((i) => parseInvoiceNumber(i.number)).filter((q) => q.counter && seriesKey(q) === seriesKey(base)) : []
  const counters = [...new Set(members.map((q) => q.counter!.n))].sort((a, b) => a - b)
  const width = base?.counter ? Math.max(base.counter.text.length, ...members.map((q) => q.counter!.text.length)) : 4
  const max = counters[counters.length - 1] ?? 0
  // Take the series' own spelling (capitals, padding) from its latest member, not from what was typed.
  const model = members.length ? members.reduce((a, b) => (b.counter!.n > a.counter!.n ? b : a)) : base
  const next = model?.counter ? `${withYear(model, fy.start)}${pad(max + 1, width)}${model.tail}` : undefined
  const missing = counters.length ? Array.from({ length: max - counters[0] + 1 }, (_, i) => counters[0] + i).filter((n) => !counters.includes(n)).map((n) => pad(n, width)) : []

  if (!v) return { issues, next, missing, fy }
  const bad = [...new Set([...v].filter((c) => !/[A-Za-z0-9/-]/.test(c)))]
  if (bad.length) issues.push({ code: "chars", chars: bad, fix: v.normalize("NFKC").replace(/[‐-―−]/g, "-").replace(/[^A-Za-z0-9/-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "") })
  if (v.length > 16) {
    const short = p.fy?.long ? v.replace(p.fy.text, `${pad(p.fy.start % 100, 2)}${p.fy.sep}${p.fy.text.slice(-2)}`) : v
    issues.push({ code: "length", length: v.length, fix: short.length <= 16 && short !== v ? short : undefined })
  }
  if (einvoice && /^[0/-]/.test(v)) {
    const fix = v.replace(/^[0/-]+/, "")
    issues.push({ code: "start", fix: fix || undefined })
  }
  const dup = sameYear.find((i) => i.number.trim().toUpperCase() === v.toUpperCase())
  if (dup) issues.push({ code: "duplicate", match: dup, caseOnly: dup.number.trim() !== v })
  if (p.fy && p.fy.start !== fy.start) issues.push({ code: "year", typed: p.fy.text, expected: p.fy.long ? fy.label : fy.short, fix: v.replace(p.fy.text, withYear({ ...p, head: p.fy.text }, fy.start)) })
  else if (!dup && p.counter && members.length && key === seriesKey(members[0])) {
    if (p.counter.n > max + 1) issues.push({ code: "skip", from: pad(max + 1, width), to: pad(p.counter.n - 1, width) })
    else if (p.counter.n <= max) issues.push({ code: "behind", last: pad(max, width) })
  }
  return { issues, next, missing, fy }
}

/** Every visible string. Functions get values already formatted. */
export const INVOICE_NUMBER_CHECK_MESSAGES = {
  label: "Invoice number",
  count: (n: number) => `${n}/16`,
  chars: (chars: string) => `${chars} can't be in a GST invoice number. Only letters, digits, - and / are allowed.`,
  charName: (c: string) => (c === " " ? "Spaces" : c === "_" ? "Underscores" : `“${c}”`),
  length: (n: number) => `${n} characters. GST invoice numbers stop at 16.`,
  start: "E-invoices can't start with 0, / or -.",
  duplicate: (number: string, date: string) => `${number} was already used on ${date}.`,
  duplicateCancelled: (number: string, date: string) => `${number} was issued and cancelled on ${date}. A cancelled number can't be used again this year.`,
  duplicateCase: (number: string, date: string) => `GST portals ignore capitals, so this is the same as ${number} from ${date}.`,
  year: (typed: string, fy: string) => `Says ${typed}, but this invoice's date is in FY ${fy}.`,
  skip: (from: string, to: string) => (from === to ? `Skips ${from}. Numbers should run in order.` : `Skips ${from}–${to}. Numbers should run in order.`),
  behind: (last: string) => `Behind the series: ${last} is already out.`,
  fixTo: (value: string) => `Use ${value}`,
  next: "Next in series",
  newYear: (fy: string) => `FY ${fy} starts a new series`,
  gaps: (list: string, more: number) => `Missing from this year's series: ${list}${more ? ` +${more} more` : ""}. Report unused numbers as cancelled in GSTR-1.`,
}
export type InvoiceNumberCheckMessages = typeof INVOICE_NUMBER_CHECK_MESSAGES

export interface InvoiceNumberCheckProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "size"> {
  /** Controlled invoice number. */
  value?: string
  /** Initial invoice number when uncontrolled. */
  defaultValue?: string
  /** Called with the number on every change. */
  onValueChange?: (value: string) => void
  /** Invoices already issued under this GSTIN, any year. */
  issued?: IssuedInvoice[]
  /** This invoice's date; its financial year decides uniqueness and the reset. Defaults to today after mount. */
  date?: Date | number | string
  /** Apply the e-invoice rule that a number can't start with 0, / or -. */
  einvoice?: boolean
  /** BCP 47 locale for dates in messages. */
  locale?: string
  /** Override any visible string. */
  messages?: Partial<InvoiceNumberCheckMessages>
  /** Classes for the wrapper; `className` styles the input. */
  wrapperClassName?: string
}

const fixClass =
  "inline-flex h-6 max-w-full items-center rounded-md border px-2 font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const ERRORS = new Set(["chars", "length", "duplicate"])

/**
 * An invoice number field that keeps a GST series legal: it names the character
 * that breaks Rule 46, counts to 16, catches a number already used this financial
 * year (even in different capitals), a year token left over from last year, a
 * skipped or reused counter and the gaps a return will ask about, and always offers
 * the next number in the series, restarting it on 1 April.
 */
export function InvoiceNumberCheck({
  value,
  defaultValue = "",
  onValueChange,
  issued = [],
  date,
  einvoice = true,
  locale = "en-IN",
  messages,
  id,
  className,
  wrapperClassName,
  "aria-describedby": describedBy,
  ...props
}: InvoiceNumberCheckProps) {
  const t = { ...INVOICE_NUMBER_CHECK_MESSAGES, ...messages }
  const [inner, setInner] = React.useState(defaultValue)
  const [today, setToday] = React.useState<Date>()
  const [settled, setSettled] = React.useState("")
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => setToday(new Date()), [])
  const text = typeof (value ?? inner) === "string" ? (value ?? inner) : ""
  const autoId = React.useId()
  const inputId = id ?? autoId
  const when = date ?? today
  const { issues, next, missing, fy } = checkInvoiceNumber(text, { issued, date: when, einvoice })
  const fresh = next && !issued.some((i) => valid(i.date) && financialYear(i.date).start === fy.start)
  const day = (d: IssuedInvoice["date"]) => {
    const parsed = toDate(d)
    return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(parsed)
  }

  const set = (next: string, focus = false) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    if (focus) requestAnimationFrame(() => ref.current?.focus())
  }

  const say = (issue: InvoiceIssue): [string, string | undefined] => {
    switch (issue.code) {
      case "chars": return [t.chars(issue.chars.map(t.charName).join(", ")), issue.fix || undefined]
      case "length": return [t.length(issue.length), issue.fix]
      case "start": return [t.start, issue.fix]
      case "duplicate": return [issue.match.cancelled && !issue.caseOnly ? t.duplicateCancelled(issue.match.number, day(issue.match.date)) : issue.caseOnly ? t.duplicateCase(issue.match.number, day(issue.match.date)) : t.duplicate(issue.match.number, day(issue.match.date)), next]
      case "year": return [t.year(issue.typed, fy.label), issue.fix]
      case "skip": return [t.skip(issue.from, issue.to), next]
      case "behind": return [t.behind(issue.last), next]
    }
  }
  const lines = issues.map((issue) => ({ issue, error: ERRORS.has(issue.code), text: say(issue) }))
  const top = lines.find((l) => l.error) ?? lines[0]

  // Announce once typing pauses, not on every keystroke.
  const summary = top ? top.text[0] : ""
  React.useEffect(() => {
    const id = setTimeout(() => setSettled(summary), 700)
    return () => clearTimeout(id)
  }, [summary])

  return (
    <div data-slot="invoice-number-check" className={cn("grid w-full min-w-0 max-w-sm gap-1.5", wrapperClassName)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">{t.label}</label>
        <span className={cn("text-xs tabular-nums text-muted-foreground", text.trim().length > 16 && "font-medium text-red-700 dark:text-red-400")}>{t.count(text.trim().length)}</span>
      </div>
      <input
        ref={ref}
        id={inputId}
        value={text}
        onChange={(e) => set(e.target.value)}
        spellCheck={false}
        autoCapitalize="characters"
        autoComplete="off"
        aria-invalid={lines.some((l) => l.error) || undefined}
        aria-describedby={[`${inputId}-hint`, describedBy].filter(Boolean).join(" ")}
        data-warning={lines.length && !lines.some((l) => l.error) ? "" : undefined}
        className={cn(
          "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 font-mono text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400",
          className,
        )}
        {...props}
      />
      <div id={`${inputId}-hint`} className="grid gap-1 text-xs">
        {lines.map(({ issue, error, text: [message, fix] }) => (
          <p key={issue.code} className={cn("flex gap-1.5", error ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
            <span className="flex h-6 shrink-0 items-center">{error ? <CircleAlert aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}</span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1 break-words">{message}</span>
              {fix && fix !== text && (
                <button type="button" onClick={() => set(fix, true)} className={cn(fixClass, error ? "border-red-500/40 text-red-900 hover:bg-red-500/10 dark:text-red-200" : "border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200")}>
                  <span className="truncate font-mono">{t.fixTo(fix)}</span>
                </button>
              )}
            </span>
          </p>
        ))}
        {!lines.length && next && next.toUpperCase() !== text.trim().toUpperCase() && (
          <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
            <Hash aria-hidden className="size-3.5 shrink-0" />
            <span className="py-1">{fresh ? t.newYear(fy.label) : t.next}</span>
            <button type="button" onClick={() => set(next, true)} className={cn(fixClass, "font-mono hover:bg-accent dark:border-input")}>{next}</button>
          </p>
        )}
        {missing.length > 0 && <p className="py-1 text-muted-foreground">{t.gaps(missing.slice(0, 4).join(", "), Math.max(0, missing.length - 4))}</p>}
      </div>
      <span aria-live="polite" className="sr-only">{settled}</span>
    </div>
  )
}
