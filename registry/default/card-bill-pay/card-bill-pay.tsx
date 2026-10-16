"use client"

import * as React from "react"
import { CircleCheck, CreditCard, Loader2, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { readPayment, toDayNumber, type CardBillOptions, type CardStatement, type PaymentReadback } from "./card-bill"

export { payoffAtMinimum, readPayment, toDayNumber, type CardBillOptions, type CardStatement, type PaymentKind, type PaymentReadback } from "./card-bill"

/** Every visible string. `{amount}`, `{total}`, `{min}`, `{rest}`, `{date}`, `{days}`, `{time}`, `{fee}` are filled in. */
export const CARD_BILL_PAY_MESSAGES = {
  totalDue: "Total due",
  minimumDue: "Minimum due",
  dueDate: "Due",
  choiceLabel: "How much to pay",
  total: "Total",
  minimum: "Minimum",
  other: "Other amount",
  amountLabel: "Amount",
  full: "No interest, and new purchases stay interest-free.",
  partial: "About {amount} interest on your next bill, and new purchases get no interest-free days until this bill is cleared.",
  tinyShort: "Only {rest} short, but unless your statement says a shortfall this small is forgiven, that's enough to lose the interest-free days on the whole bill.",
  forgiven: "{rest} short, within what your card forgives, so no interest. Paying the total clears it completely.",
  short: "{rest} left unpaid.",
  minimumOnly: "Paying only the minimum every month clears it in {time}, with about {amount} in interest.",
  minimumNever: "Paying only the minimum every month never clears it at this rate.",
  belowMinimum: "Below the minimum. Unless {rest} more arrives by {date}, you'll pay a late fee{fee} and the card is reported past due to credit bureaus.",
  over: "{amount} more than the bill. It stays on the card as a credit, not in your bank.",
  late: "{days} after the due date: a late fee{fee} applies, the card is reported past due, and interest runs on the whole bill.",
  inGrace: "After the due date. Within {grace} there's no late fee or credit report, but interest applies to the whole bill.",
  feeAmount: " of {fee}",
  estimate: "Estimate at {rate}% a month plus GST. Your card's terms decide the exact amount.",
  payTotal: "Pay total {total}",
  payMinimum: "Pay minimum {min}",
  payExact: "Pay exactly {total}",
  pay: "Pay {amount}",
  payAnyway: "Pay {amount} anyway",
  paying: "Paying…",
  changed: "Amount set to {amount}.",
  days: (n: number) => (n === 1 ? "1 day" : `${n} days`),
  duration: (months: number) => {
    const y = Math.floor(months / 12)
    const m = months % 12
    return [y && `${y} year${y > 1 ? "s" : ""}`, m && `${m} month${m > 1 ? "s" : ""}`].filter(Boolean).join(" ") || "0 months"
  },
}

export type CardBillPayMessages = typeof CARD_BILL_PAY_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const fixClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:text-amber-200"
const buttonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface CardBillPayProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** The statement being paid. */
  statement: CardStatement
  /** Controlled amount to pay. */
  value?: number | null
  /** Initial amount when uncontrolled. Defaults to the total due. */
  defaultValue?: number | null
  /** Called when the amount changes. */
  onValueChange?: (amount: number | null) => void
  /** Day the payment lands, as "YYYY-MM-DD" or a day number. Defaults to today (from `now`, else the clock after mount). */
  payDate?: string | number
  /** "Now" in epoch ms, for deterministic rendering. */
  now?: number
  /** Card terms: monthly rate, GST, grace days, late fee, minimum due formula. */
  options?: CardBillOptions
  /** Locale for money and dates. */
  locale?: string
  /** ISO currency code. */
  currency?: string
  /** Called on Pay. With anything short of the total, the first press asks again. May return a Promise. */
  onPay?: (amount: number, readback: PaymentReadback) => void | Promise<void>
  /** Any visible string. */
  messages?: Partial<CardBillPayMessages>
}

/**
 * Stops a card bill being paid in a way that quietly costs interest: before Pay it reads back what the chosen amount
 * really does. Anything short of the total (even 40 paise) loses the interest-free days on the whole bill and on new
 * purchases; the minimum is turned into years and rupees of interest; below the minimum or past the 3-day grace shows
 * the late fee and the credit report. One tap pays the total.
 */
export function CardBillPay({
  statement,
  value,
  defaultValue,
  onValueChange,
  payDate,
  now: nowProp,
  options,
  locale = "en-IN",
  currency = "INR",
  onPay,
  messages,
  className,
  "aria-describedby": describedBy,
  ...props
}: CardBillPayProps) {
  const t = { ...CARD_BILL_PAY_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<number | null>(defaultValue === undefined ? Number(statement?.totalDue) || null : defaultValue)
  const amount = value === undefined ? inner : value
  const [text, setText] = React.useState(amount == null ? "" : String(amount))
  const [clock, setClock] = React.useState<number>()
  const [asked, setAsked] = React.useState(false)
  const [otherPicked, setOtherPicked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const busy = React.useRef(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const payRef = React.useRef<HTMLButtonElement>(null)
  const amountRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    if (nowProp === undefined && payDate === undefined) setClock(Date.now())
  }, [nowProp, payDate])
  // Keep the typed text when it already means this amount; replace it when the value changes from outside.
  React.useEffect(() => {
    setText((current) => (Number(current.replace(/[^\d.]/g, "")) === amount && current.trim() ? current : amount == null ? "" : String(amount)))
  }, [amount])

  const nowMs = nowProp ?? clock
  const today = nowMs !== undefined && Number.isFinite(nowMs) ? Math.round(Date.UTC(new Date(nowMs).getFullYear(), new Date(nowMs).getMonth(), new Date(nowMs).getDate()) / 864e5) : undefined
  const payDay = toDayNumber(payDate) ?? today
  const read = readPayment(statement, amount, payDay, options)
  const due = toDayNumber(statement?.dueDate)
  const grace = options?.graceDays ?? 3
  const digits = (n: number) => (Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2)
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits(n), maximumFractionDigits: 2 }).format(n)
  const day = (n: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(n * 864e5)
  const choice = otherPicked ? "other" : read.amount === read.totalDue && read.totalDue > 0 ? "total" : read.amount === read.minimumDue && read.minimumDue > 0 ? "minimum" : "other"
  const fee = read.lateFee ? fill(t.feeAmount, { fee: money(read.lateFee) }) : ""
  const tiny = read.unpaid > 0 && read.unpaid <= Math.max(1, read.totalDue * 0.005)

  const set = (next: number | null, announce = false) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setText(next == null ? "" : String(next))
    setAsked(false)
    setOtherPicked(false)
    if (announce && next != null) {
      setStatus(fill(t.changed, { amount: money(next) }))
      requestAnimationFrame(() => payRef.current?.focus())
    }
  }

  const lines: { tone: "ok" | "warn" | "danger" | "info"; text: string; fixes?: { label: string; to: number }[] }[] = []
  const payTotal = { label: fill(t.payTotal, { total: money(read.totalDue) }), to: read.totalDue }
  if (read.kind === "full") lines.push({ tone: "ok", text: t.full })
  if (read.kind === "over") lines.push({ tone: "info", text: fill(t.over, { amount: money(read.extra) }), fixes: [{ label: fill(t.payExact, { total: money(read.totalDue) }), to: read.totalDue }] })
  if ((read.kind === "belowMinimum" || read.kind === "none") && read.daysLate <= grace)
    lines.push({ tone: "danger", text: fill(t.belowMinimum, { rest: money(Math.round((read.minimumDue - read.amount) * 100) / 100), date: due === null ? "" : day(due + grace), fee }), fixes: [{ label: fill(t.payMinimum, { min: money(read.minimumDue) }), to: read.minimumDue }, payTotal] })
  if (read.forgiven) lines.push({ tone: "info", text: fill(t.forgiven, { rest: money(read.unpaid) }), fixes: [payTotal] })
  else if (read.kind === "partial" || read.kind === "minimum") {
    lines.push({ tone: "warn", text: `${fill(tiny ? t.tinyShort : t.short, { rest: money(read.unpaid) })} ${fill(t.partial, { amount: money(read.interest) })}`, fixes: [payTotal] })
    if (read.kind === "minimum")
      lines.push({ tone: "warn", text: read.minimumOnly ? fill(t.minimumOnly, { time: t.duration(read.minimumOnly.months), amount: money(read.minimumOnly.interest) }) : t.minimumNever })
  }
  if (read.daysLate > grace) lines.push({ tone: "danger", text: fill(t.late, { days: t.days(read.daysLate), fee }) })
  else if (read.inGrace) lines.push({ tone: "warn", text: fill(t.inGrace, { grace: t.days(grace) }) })
  const warnings = lines.filter((l) => l.tone === "warn" || l.tone === "danger")

  const summary = warnings.map((l) => l.text).join(" ")
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(summary), 700)
    return () => clearTimeout(timer)
  }, [summary])

  const pay = async () => {
    if (busy.current || read.amount === 0) return
    if (warnings.length && !asked) {
      setAsked(true)
      setStatus(summary)
      rootRef.current?.querySelector<HTMLElement>("[data-fix]")?.focus()
      return
    }
    if (!onPay) return
    busy.current = true
    setPending(true)
    try {
      await onPay(read.amount, read)
    } catch {
      // The caller shows payment errors; the button becomes usable again.
    } finally {
      busy.current = false
      setPending(false)
      setAsked(false)
    }
  }

  const tones = { ok: "text-emerald-700 dark:text-emerald-400", info: "text-muted-foreground", warn: "text-amber-800 dark:text-amber-300", danger: "text-red-700 dark:text-red-400" }

  return (
    <div ref={rootRef} data-slot="card-bill-pay" data-state={read.kind} className={cn("w-full max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border p-3">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.totalDue}</dt><dd className="font-medium tabular-nums whitespace-nowrap">{money(read.totalDue)}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.minimumDue}</dt><dd className="font-medium tabular-nums whitespace-nowrap">{money(read.minimumDue)}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{t.dueDate}</dt><dd className="font-medium">{due === null ? "—" : day(due)}</dd></div>
      </dl>

      <fieldset className="min-w-0 space-y-2" disabled={pending}>
        <legend className="mb-1.5 text-sm font-medium">{t.choiceLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {([["total", read.totalDue, t.total], ["minimum", read.minimumDue, t.minimum], ["other", null, t.other]] as const).map(([key, to, label]) => (
            <label key={key} className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50", choice === key ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent")}>
              <input type="radio" name={`${id}-choice`} checked={choice === key} onChange={() => {
                  if (to !== null) return set(to)
                  setOtherPicked(true)
                  amountRef.current?.focus()
                }} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        <div>
          <label htmlFor={`${id}-amount`} className="sr-only">{t.amountLabel}</label>
          <div className="flex h-9 items-center rounded-md border shadow-xs transition-[color,box-shadow] focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
            <CreditCard aria-hidden className="ml-3 size-4 shrink-0 text-muted-foreground" />
            <input
              ref={amountRef}
              id={`${id}-amount`}
              inputMode="decimal"
              value={text}
              onChange={(e) => {
                const next = e.target.value.slice(0, 18)
                const n = Number(next.replace(/[^\d.]/g, ""))
                setText(next)
                if (value === undefined) setInner(next.trim() && Number.isFinite(n) ? n : null)
                onValueChange?.(next.trim() && Number.isFinite(n) ? n : null)
                setAsked(false)
              }}
              aria-describedby={[describedBy, warnings.length ? `${id}-lines` : ""].filter(Boolean).join(" ") || undefined}
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-base tabular-nums outline-none md:text-sm"
            />
          </div>
        </div>
      </fieldset>

      {lines.length > 0 && (
        <ul id={`${id}-lines`} className={cn("space-y-2 rounded-md border p-3 text-xs", warnings.some((l) => l.tone === "danger") ? "border-red-500/30 bg-red-500/5" : warnings.length ? "border-amber-500/30 bg-amber-500/5" : "")}>
          {lines.map((line, i) => (
            <li key={i} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", tones[line.tone])}>
              {line.tone === "ok" ? <CircleCheck aria-hidden className="size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 basis-40 break-words">{line.text}</span>
              {line.fixes?.map((fix) => (
                <button key={fix.label} type="button" data-fix disabled={pending} onClick={() => set(fix.to, true)} className={fixClass}>{fix.label}</button>
              ))}
            </li>
          ))}
          {read.interest > 0 && <li className="text-muted-foreground">{fill(t.estimate, { rate: options?.monthlyRate ?? 3.75 })}</li>}
        </ul>
      )}

      <span role="status" className="sr-only">{status}</span>
      <div className="flex justify-end">
        <button
          ref={payRef}
          type="button"
          onClick={pay}
          aria-disabled={pending || read.amount === 0 || undefined}
          className={cn(buttonClass, "aria-disabled:opacity-60", asked && warnings.length ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {pending ? t.paying : fill(asked && warnings.length ? t.payAnyway : t.pay, { amount: money(read.amount) })}
        </button>
      </div>
    </div>
  )
}
