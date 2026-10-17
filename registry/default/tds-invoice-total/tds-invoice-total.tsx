"use client"

// Bollard UI — tds-invoice-total · MIT licence · https://bollard-ui.vercel.app/components/tds-invoice-total

import * as React from "react"
import { Check, Copy, ReceiptIndianRupee, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { computeTds, NEW_ACT_FROM, parseAmount, type TdsInvoice, type TdsIssue, type TdsKind, type TdsPayer } from "./tds"

export { baseRate, computeTds, NEW_ACT_FROM, parseAmount, sectionFor, type TdsInvoice, type TdsIssue, type TdsKind, type TdsPayer, type TdsResult } from "./tds"

/** Every visible string. `{rate}`, `{amount}`, `{base}`, `{section}`, `{old}`, `{total}`, `{threshold}`, `{deducted}`, `{right}` and `{diff}` are filled in. */
export const TDS_INVOICE_MESSAGES = {
  fee: "Your fee (before GST)",
  kind: "Work",
  kinds: { professional: "Professional fees · 10%", technical: "Technical services · 2%", contract: "Contract work · 1% / 2%" } as Record<TdsKind, string>,
  payer: "Client",
  payers: { business: "Indian business", personal: "A person, for personal use", abroad: "Outside India" } as Record<TdsPayer, string>,
  gstRegistered: "I'm GST registered",
  panShared: "Client has my PAN",
  paidThisYear: "Already invoiced this client this year",
  clientTds: "TDS the client deducted",
  optional: "optional",
  feeLine: "Fee",
  gstLine: "GST {rate}%",
  gstExport: "GST (export, zero-rated)",
  totalLine: "Invoice total",
  tdsLine: "TDS {rate}% on {base}",
  tdsTaken: "TDS deducted",
  sectionNew: "Sec {section}, was {old}",
  sectionOld: "Sec {section}",
  netLine: "You receive",
  shouldBe: "Should be: {line}",
  noTds: "no TDS",
  below: "No TDS yet: {total} from this client this year is within {threshold}.",
  applies: "TDS applies: {total} this year is over {threshold}. It's credited to your PAN; claim it when you file.",
  personal: "No TDS: a person paying for their own use doesn't deduct it.",
  personalLarge: "TDS applies: a person paying over {threshold} in a year for contract or professional work deducts 2%, even for personal use.",
  catchUp: "Includes {amount} on your earlier invoices: once the year crosses {threshold}, TDS is due on the whole amount. That's allowed, and all of it is credited to your PAN.",
  invalidAmount: "Enter an amount like 50,000 or 1.2 lakh.",
  abroad: "No Indian TDS from a client abroad, and no GST on an export of services (file an LUT).",
  noPan: "Without your PAN the client must deduct 20%, not {rate}%. Share it to get the difference now instead of at refund time.",
  sharedPan: "I've shared my PAN",
  onGst: "The client took {deducted}, which is TDS on the GST too. With GST shown separately it's {right} (CBDT Circular 23/2017). You're short {diff}.",
  wrongRate: "The client took {deducted} at {rate}%. For this work it's {right}. Check which kind of work they booked it as.",
  notRequired: "The client took {deducted}, though TDS isn't due yet. It still counts as tax you paid; check it shows against your PAN.",
  mismatch: "The client took {deducted}; it should be {right}. Ask how they worked it out.",
  copyNote: "Copy note for client",
  copied: "Copied",
  clientNote: "Hi, TDS on invoice total {total} should be {right} ({rate}% on the fee of {base}, excluding GST, per CBDT Circular 23/2017). {deducted} was deducted. Could you release the {diff} difference?",
  announce: "You receive {amount}.",
}

export type TdsInvoiceMessages = typeof TDS_INVOICE_MESSAGES

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

const fieldClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs md:text-sm outline-none transition-[color,box-shadow] dark:bg-input/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface TdsInvoiceTotalProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled invoice. */
  value?: TdsInvoice
  /** Initial invoice when uncontrolled. */
  defaultValue?: TdsInvoice
  /** Called with the invoice after any edit or fix. */
  onValueChange?: (invoice: TdsInvoice) => void
  /** Invoice date: picks the 1961 or 2025 Act section. Defaults to today after mount. */
  invoiceDate?: Date | string | number
  /** Locale for money. */
  locale?: string
  /** Pause in ms before the new "You receive" is announced while typing. */
  delay?: number
  /** Any visible string. */
  messages?: Partial<TdsInvoiceMessages>
}

/**
 * The invoice a freelancer in India actually gets paid on: fee, GST if registered, TDS at the right
 * rate and section for the date (10% professional, 2% technical, 1%/2% contract), the yearly
 * threshold, and the net. Flags TDS taken on the GST, the wrong rate, and the 20% rate without a
 * PAN, with a one-tap fix or a ready note for the client.
 */
export function TdsInvoiceTotal({
  value,
  defaultValue = { fee: 0 },
  onValueChange,
  invoiceDate,
  locale = "en-IN",
  delay = 700,
  messages,
  className,
  id,
  "aria-describedby": describedBy,
  ...props
}: TdsInvoiceTotalProps) {
  const t = { ...TDS_INVOICE_MESSAGES, ...messages, kinds: { ...TDS_INVOICE_MESSAGES.kinds, ...messages?.kinds }, payers: { ...TDS_INVOICE_MESSAGES.payers, ...messages?.payers } }
  const [inner, setInner] = React.useState<TdsInvoice>(defaultValue)
  const invoice: TdsInvoice = (value ?? inner) && typeof (value ?? inner) === "object" ? (value ?? inner) : { fee: 0 }
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [clock, setClock] = React.useState<number>()
  const [status, setStatus] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const autoId = React.useId()
  const baseId = id ?? autoId
  const rootRef = React.useRef<HTMLDivElement>(null)
  const feeRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => setClock(Date.now()), [])
  const parsedDate = invoiceDate instanceof Date ? invoiceDate.getTime() : typeof invoiceDate === "string" ? Date.parse(invoiceDate) : invoiceDate
  const date = Number.isFinite(parsedDate) ? (parsedDate as number) : (clock ?? NEW_ACT_FROM)
  const r = computeTds(invoice, { date })
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)

  // Announce the net once typing pauses; never per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(r.fee ? fill(t.announce, { amount: money(r.net) }) : ""), delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.net, delay])

  const commit = (patch: Partial<TdsInvoice>) => {
    const next = { ...invoice, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setCopied(false)
  }

  const amountField = (key: "fee" | "paidThisYear" | "clientTds", label: string, optional = false) => {
    const current = invoice[key]
    const text = drafts[key] ?? (typeof current === "number" && Number.isFinite(current) && current > 0 ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(current) : key === "clientTds" && current === 0 ? "0" : "")
    const parsed = parseAmount(text)
    const invalid = text.trim() !== "" && !Number.isFinite(parsed)
    const fieldId = `${baseId}-${key}`
    const errorId = `${fieldId}-error`
    const described = [key === "fee" ? describedBy : "", invalid ? errorId : "", key === "fee" ? `${baseId}-reason` : ""].filter(Boolean).join(" ")
    return (
      <div className="grid gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {label}
          {optional && <span className="font-normal text-muted-foreground"> · {t.optional}</span>}
        </label>
        <input
          ref={key === "fee" ? feeRef : undefined}
          id={fieldId}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={described || undefined}
          onChange={(event) => {
            const raw = event.target.value
            setDrafts((d) => ({ ...d, [key]: raw }))
            const n = parseAmount(raw)
            if (raw.trim() === "") commit({ [key]: key === "clientTds" ? null : 0 })
            else if (Number.isFinite(n)) commit({ [key]: n })
          }}
          onBlur={() => setDrafts(({ [key]: _, ...rest }) => rest)}
          className={fieldClass}
        />
        {invalid && <p id={errorId} className="text-xs text-destructive">{t.invalidAmount}</p>}
      </div>
    )
  }

  const describe = (issue: TdsIssue) => {
    switch (issue.kind) {
      case "noPan": return fill(t.noPan, { rate: issue.normalRate })
      case "onGst": return fill(t.onGst, { deducted: money(issue.deducted), right: money(issue.right), diff: money(issue.deducted - issue.right) })
      case "wrongRate": return fill(t.wrongRate, { deducted: money(issue.deducted), rate: issue.usedRate, right: money(issue.right) })
      case "notRequired": return fill(t.notRequired, { deducted: money(issue.deducted) })
      case "mismatch": return fill(t.mismatch, { deducted: money(issue.deducted), right: money(issue.right) })
    }
  }

  const sharePan = () => {
    commit({ panShared: true })
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? feeRef.current)?.focus())
  }

  const copyNote = async (issue: Extract<TdsIssue, { kind: "onGst" }>) => {
    const note = fill(t.clientNote, { total: money(r.gross), right: money(issue.right), rate: r.rate, base: money(r.fee), deducted: money(issue.deducted), diff: money(Math.abs(issue.deducted - issue.right)) })
    try {
      await navigator.clipboard.writeText(note)
      setCopied(true)
      setStatus(t.copied)
    } catch {
      // Clipboard blocked: nothing to undo; the button keeps focus.
    }
  }

  const row = (label: React.ReactNode, amount: string, strong = false, sub?: string) => (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "border-t pt-2 font-semibold")}>
      <dt className="min-w-0">{label}{sub && <span className="block text-xs font-normal text-muted-foreground">{sub}</span>}</dt>
      <dd className="shrink-0 whitespace-nowrap tabular-nums">{amount}</dd>
    </div>
  )
  const select = <K extends string>(key: "kind" | "payer", label: string, options: Record<K, string>, current: K) => (
    <div className="grid gap-1.5">
      <label htmlFor={`${baseId}-${key}`} className="text-sm font-medium">{label}</label>
      <select id={`${baseId}-${key}`} value={current} onChange={(e) => commit({ [key]: e.target.value })} className={cn(fieldClass, "px-2")}>
        {(Object.keys(options) as K[]).map((k) => <option key={k} value={k}>{options[k]}</option>)}
      </select>
    </div>
  )
  const check = (key: "gstRegistered" | "panShared", label: string, checked: boolean) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => commit({ [key]: e.target.checked })} className="size-4 rounded border accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />
      {label}
    </label>
  )
  const taken = Math.max(0, r.gross - r.net)
  const due = r.tds + r.catchUp
  const reasonText = { applies: t.applies, below: t.below, personal: t.personal, personalLarge: t.personalLarge, abroad: t.abroad }[r.reason]

  return (
    <div ref={rootRef} data-slot="tds-invoice-total" data-state={r.issues.length ? "warning" : "ok"} className={cn("w-full max-w-md space-y-3 text-sm", className)} {...props}>
      {amountField("fee", t.fee)}
      <div className="grid gap-3 sm:grid-cols-2">
        {select("kind", t.kind, t.kinds, (invoice.kind ?? "professional") as TdsKind)}
        {select("payer", t.payer, t.payers, (invoice.payer ?? "business") as TdsPayer)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {check("gstRegistered", t.gstRegistered, !!invoice.gstRegistered)}
        {check("panShared", t.panShared, invoice.panShared !== false)}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2">
        {amountField("paidThisYear", t.paidThisYear, true)}
        {amountField("clientTds", t.clientTds, true)}
      </div>

      <dl className="space-y-2 rounded-md border bg-card p-3">
        {row(t.feeLine, money(r.fee))}
        {invoice.gstRegistered && row(r.gst ? fill(t.gstLine, { rate: r.gstRate }) : t.gstExport, `+ ${money(r.gst)}`)}
        {row(t.totalLine, money(r.gross), true)}
        {(r.rate > 0 || taken > 0) && row(
          r.rate && !r.catchUp && Math.abs(taken - r.tds) < 1 ? fill(t.tdsLine, { rate: r.rate, base: money(r.fee) }) : t.tdsTaken,
          `− ${money(taken)}`,
          false,
          fill(r.section.old ? t.sectionNew : t.sectionOld, { section: r.section.current, old: r.section.old ?? "" }),
        )}
        {Math.abs(taken - due) >= 1 && (
          <p className="flex justify-between gap-3 text-xs text-amber-700 dark:text-amber-400"><span>{r.rate ? fill(t.shouldBe, { line: fill(t.tdsLine, { rate: r.rate, base: money(r.fee) }) }) : fill(t.shouldBe, { line: t.noTds })}</span><span className="shrink-0 whitespace-nowrap tabular-nums">− {money(r.tds)}</span></p>
        )}
        {row(<span className="flex items-center gap-1.5"><ReceiptIndianRupee aria-hidden className="size-4" />{t.netLine}</span>, money(r.net), true)}
        <p id={`${baseId}-reason`} className="text-xs text-muted-foreground">
          {fill(reasonText, { total: money(r.yearTotal), threshold: money(r.threshold) })}
          {r.catchUp > 0 && ` ${fill(t.catchUp, { amount: money(r.catchUp), threshold: money(r.threshold) })}`}
        </p>
      </dl>

      {r.issues.length > 0 && (
        <ul className="space-y-2">
          {r.issues.map((issue) => (
            <li key={issue.kind} className="flex gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <div className="min-w-0 space-y-1.5">
                <p className="break-words">{describe(issue)}</p>
                {issue.kind === "noPan" && <button type="button" data-fix onClick={sharePan} className={fixClass}>{t.sharedPan}</button>}
                {issue.kind === "onGst" && (
                  <button type="button" data-fix onClick={() => copyNote(issue)} className={fixClass}>
                    {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
                    {copied ? t.copied : t.copyNote}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
