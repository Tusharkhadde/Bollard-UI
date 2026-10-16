"use client"

import * as React from "react"
import { Check, Scissors, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface PaymentRail {
  id: string
  label: string
  /** Characters the rail carries in the reference or remark field. */
  maxLength: number
  /** One allowed character, as a single-character class. Anything else is stripped. */
  allowed: RegExp
  /** True when the rail upper-cases references (UK Faster Payments / Bacs). */
  uppercase?: boolean
  /** How the payee's statement line starts; `{payer}` is replaced with the payer's name. */
  statementPrefix: string
  /** A caveat about this rail, shown while it's selected. */
  note?: string
}

const SWIFT = /[A-Za-z0-9/\-?:().,'+ ]/

/**
 * Sensible defaults; check your bank's own limits. UPI notes: 50 characters, special
 * characters dropped (NPCI). NEFT/RTGS: SWIFT-style character set; many net-banking
 * remark boxes stop at 30. Faster Payments: 18 characters. SEPA: 140 characters.
 */
export const DEFAULT_RAILS: PaymentRail[] = [
  { id: "upi", label: "UPI", maxLength: 50, allowed: /[A-Za-z0-9 ]/, statementPrefix: "UPI/CR/{payer}/" },
  { id: "imps", label: "IMPS", maxLength: 30, allowed: /[A-Za-z0-9 ]/, statementPrefix: "IMPS/{payer}/" },
  { id: "neft", label: "NEFT", maxLength: 30, allowed: SWIFT, statementPrefix: "NEFT CR-{payer}-", note: "Some banks show only the sender and UTR on statements; the remark may need to be requested." },
  { id: "rtgs", label: "RTGS", maxLength: 140, allowed: SWIFT, statementPrefix: "RTGS CR-{payer}-" },
  { id: "fps", label: "UK FPS", maxLength: 18, allowed: /[A-Za-z0-9 /\-.&]/, uppercase: true, statementPrefix: "{payer} " },
  { id: "sepa", label: "SEPA", maxLength: 140, allowed: SWIFT, statementPrefix: "SEPA CT {payer} " },
]

const loose = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase()

export type ReferenceIssue = "missing" | "wrong" | "format" | "altered" | "cut"

/** What the payee receives on a rail, and whether the invoice number survives it intact. */
export function checkReference(text: string, rail: PaymentRail, pattern: RegExp, expected?: string) {
  const shown = rail.uppercase ? text.toUpperCase() : text
  const stripped = [...new Set([...shown].filter((ch) => !rail.allowed.test(ch)))]
  const clean = [...shown].filter((ch) => rail.allowed.test(ch)).join("").replace(/ {2,}/g, " ").trim()
  const sent = clean.slice(0, rail.maxLength)
  const cut = clean.slice(rail.maxLength)
  const flags = pattern.flags.replace("g", "")
  const typedId = text.match(new RegExp(pattern.source, flags))?.[0]
  const sentId = sent.match(new RegExp(pattern.source, flags))?.[0]
  let issue: ReferenceIssue | null = null
  if (expected && !typedId && loose(text).includes(loose(expected))) issue = "format"
  else if (!typedId) issue = "missing"
  else if (expected && loose(typedId) !== loose(expected)) issue = "wrong"
  else if (!sentId && loose(clean).includes(loose(typedId))) issue = loose(sent).includes(loose(typedId)) ? "altered" : "cut"
  else if (!sentId) issue = "altered"
  return { sent, cut, stripped, typedId, issue }
}

export interface PaymentReferenceProps extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "pattern"> {
  label?: string
  /** Controlled value. */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** The invoice or order number format the payee matches on. */
  pattern?: RegExp
  /** Human-readable form of `pattern`, e.g. "INV-2026-0142". */
  formatHint?: string
  /** The invoice this payment is for, when known. Enables one-tap fixes. */
  expected?: string
  rails?: PaymentRail[]
  /** Controlled rail id. */
  rail?: string
  defaultRail?: string
  onRailChange?: (id: string) => void
  /** Payer name as banks print it, for the statement preview. */
  payerName?: string
  messages?: Partial<Record<ReferenceIssue, (id: string, rail: string) => string>>
}

const fixClass =
  "inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

const MESSAGES: Record<ReferenceIssue, (id: string, rail: string) => string> = {
  missing: (id) => `No invoice number. Without ${id}, the payee can't match this payment.`,
  wrong: (id) => `That's a different invoice. This payment is for ${id}.`,
  format: (id) => `Write it exactly as ${id} so it matches automatically.`,
  altered: (id, rail) => `${rail} changes the invoice number, so ${id} won't match as written.`,
  cut: (id, rail) => `${rail} cuts the reference before ${id} ends.`,
}

/**
 * A payment reference field that stops unmatched bank transfers. It requires the
 * invoice or order number in the expected format, checks the reference against
 * each rail's length limit and character set (UPI drops symbols, Faster Payments
 * keeps 18 characters), shows exactly how it lands on the payee's statement, and
 * fixes a cut-off invoice number by moving it to the front.
 */
export function PaymentReference({
  label = "Payment reference",
  value,
  defaultValue = "",
  onValueChange,
  pattern = /INV-\d{4}-\d{4}/,
  formatHint = "INV-2026-0142",
  expected,
  rails = DEFAULT_RAILS,
  rail,
  defaultRail,
  onRailChange,
  payerName = "Your name",
  messages,
  id,
  className,
  ...props
}: PaymentReferenceProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [innerRail, setInnerRail] = React.useState(defaultRail ?? rails[0]?.id)
  const autoId = React.useId()
  const inputId = id ?? autoId
  const text = value ?? inner
  const active = rails.find((r) => r.id === (rail ?? innerRail)) ?? rails[0]
  const result = checkReference(text, active, pattern, expected)
  const target = expected ?? result.typedId ?? formatHint
  const say = { ...MESSAGES, ...messages }

  const update = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const pickRail = (next: string) => {
    if (rail === undefined) setInnerRail(next)
    onRailChange?.(next)
  }

  const rest = (id: string) => text.replace(id, "").replace(/[^A-Za-z0-9]+$/, "").replace(/\s{2,}/g, " ").trim()
  const fix =
    !result.issue || (!expected && result.issue !== "cut")
      ? null
      : result.issue === "cut"
        ? { label: `Put ${target} first`, next: `${target} ${rest(result.typedId ?? target)}`.trim() }
        : result.issue === "wrong" && result.typedId
          ? { label: `Use ${expected}`, next: text.replace(result.typedId, expected ?? "") }
          : result.issue === "missing" || result.issue === "format"
            ? { label: result.issue === "missing" ? `Add ${expected}` : `Use ${expected}`, next: result.issue === "missing" ? `${expected} ${text}`.trim() : expected ?? "" }
            : null
  const prefix = active.statementPrefix.replace("{payer}", payerName.toUpperCase().slice(0, 16))
  const used = result.sent.length

  return (
    <div data-slot="payment-reference" className={cn("grid w-full min-w-0 max-w-sm gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">{label}</label>
        <span className={cn("text-xs tabular-nums text-muted-foreground", result.cut && "text-amber-700 dark:text-amber-400")}>
          {used + result.cut.length}/{active.maxLength}
        </span>
      </div>
      <input
        id={inputId}
        value={text}
        onChange={(e) => update(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder={`${formatHint} …`}
        aria-describedby={`${inputId}-hint`}
        data-warning={result.issue ? "" : undefined}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
        {...props}
      />
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 text-xs">
        {result.issue ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <TriangleAlert aria-hidden className="mt-1 size-3.5 shrink-0" />
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{say[result.issue](target, active.label)}</span>
              {fix && <button type="button" className={fixClass} onClick={() => update(fix.next)}>{fix.label}</button>}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 py-1 text-emerald-700 dark:text-emerald-400">
            <Check aria-hidden className="size-3.5" /> {result.typedId} reaches the payee intact.
          </p>
        )}
      </div>

      <div role="radiogroup" aria-label="Paying by" className="flex flex-wrap gap-1.5">
        {rails.map((r) => {
          const fits = checkReference(text, r, pattern, expected)
          const ok = !fits.issue && !fits.cut
          return (
            <button key={r.id} type="button" role="radio" aria-checked={r.id === active.id} onClick={() => pickRail(r.id)}
              aria-label={`${r.label}: ${ok ? "fits" : fits.issue === "cut" || fits.cut ? "gets cut" : "changed"}`}
              className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-primary aria-checked:bg-accent dark:border-input dark:bg-input/30">
              {ok ? <Check aria-hidden className="size-3 text-emerald-600 dark:text-emerald-400" /> : fits.cut ? <Scissors aria-hidden className="size-3 text-amber-600 dark:text-amber-400" /> : <TriangleAlert aria-hidden className="size-3 text-amber-600 dark:text-amber-400" />}
              {r.label}
            </button>
          )
        })}
      </div>

      <figure className="mt-1.5 space-y-1 rounded-lg bg-muted/60 p-2.5 text-xs">
        <figcaption className="text-muted-foreground">On the payee&apos;s statement ({active.label})</figcaption>
        <p className="font-mono break-all">
          <span className="text-muted-foreground">{prefix}</span>
          {result.sent}
          {result.cut && <del title="Cut by the bank" className="text-red-600/70 decoration-red-600/70 dark:text-red-400/70">{result.cut}</del>}
        </p>
        {result.stripped.length > 0 && (
          <p className="text-muted-foreground">
            {active.label} removes {result.stripped.map((c) => (c === " " ? "space" : `“${c}”`)).join(" ")}{active.uppercase ? " and capitalises letters" : ""}.
          </p>
        )}
        {active.note && <p className="text-muted-foreground">{active.note}</p>}
      </figure>
    </div>
  )
}
