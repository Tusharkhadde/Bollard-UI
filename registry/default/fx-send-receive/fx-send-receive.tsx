"use client"

// Bollard UI — fx-send-receive · MIT licence · https://bollard-ui.vercel.app/components/fx-send-receive

import * as React from "react"
import { ArrowDown, CircleCheck, Info, Lock, TriangleAlert } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { minorUnits, parseAmount, readTransfer, type FxAmountValue, type FxCharges, type FxExpected, type FxProblem, type FxQuote, type FxReadback } from "./fx"

export { minorUnits, parseAmount, readTransfer } from "./fx"
export type { FxAmountValue, FxCharges, FxExpected, FxProblem, FxQuote, FxReadback, FxSide } from "./fx"

/** Every visible string. Placeholders in braces are filled in. */
export const FX_SEND_RECEIVE_MESSAGES = {
  youSend: "You send",
  theyReceive: "{name} receives",
  recipient: "They",
  fixedSide: "Fixed",
  mustArrive: "{label}: {amount} must arrive",
  invoice: "Invoice",
  feeLine: "{fee} fee included",
  rateLine: "1 {from} = {rate} {to} · 1 {to} = {inverse} {from}",
  wrongBox: "You typed {typed} as what you send, so after the fee and conversion only {receive} arrives. Did you mean they receive {expected}?",
  wrongBoxOver: "You typed {typed} as what you send, so {receive} arrives, more than the {expected} owed. Did you mean they receive {expected}?",
  short: "{receive} arrives, {by} short of the {label}.",
  shortWorst: "Banks along the way may take up to {upTo}, so as little as {least} could arrive, {by} short of the {label}.",
  deductions: "Banks along the way may take up to {upTo}, so less than {receive} could arrive.",
  over: "{by} more than the {label} will arrive.",
  currency: "The {label} is in {expected}, but they'd receive {to}.",
  fixReceive: "Make them receive {amount}",
  fixExact: "Receive exactly {amount}",
  fixOur: "I pay all bank charges (+{fee})",
  fixCurrency: "Receive {currency} instead",
  chargesLabel: "Who pays the banks along the way",
  chargesOur: "I pay all (OUR)",
  chargesSha: "Shared (SHA)",
  chargesBen: "They pay all (BEN)",
  ok: "{amount} arrives in full.",
  meterLabel: "Arrives vs {label}",
  readback: "You pay {send}. {name} gets {receive}{least}.",
  readbackLeast: ", or as little as {least} after bank deductions",
  changed: "Now fixed: they receive {amount}. You send {send}.",
}

export type FxSendReceiveMessages = typeof FX_SEND_RECEIVE_MESSAGES

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

/** Arrow keys move the choice in a radiogroup of buttons, as the ARIA radio pattern expects. */
function radioKeys<T>(e: React.KeyboardEvent<HTMLElement>, options: readonly T[], current: T, pick: (v: T) => void) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
  if (!step) return
  e.preventDefault()
  const next = options[(options.indexOf(current) + step + options.length) % options.length]
  pick(next)
  const group = e.currentTarget
  requestAnimationFrame(() => group.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus())
}

const fixClass =
  "inline-flex min-h-6 max-w-full items-center py-0.5 text-left rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface FxSendReceiveProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Sending currency (ISO code). */
  from: string
  /** Receiving currency (ISO code). */
  to: string
  /** Rate and fees from your provider. `rate` is receiving units per one sending unit. */
  quote: FxQuote
  /** What must arrive, e.g. the invoice. Turns on the wrong-box, short and over checks. */
  expected?: FxExpected | null
  /** Word for what must arrive, e.g. "invoice" or "rent". */
  expectedLabel?: string
  /** Recipient's name for the readback. */
  recipientName?: string
  /** Controlled amount and the side it was typed on. */
  value?: FxAmountValue
  /** Initial amount when uncontrolled. */
  defaultValue?: FxAmountValue
  /** Called with the new value and the full readback (both amounts, fee, problems). */
  onValueChange?: (value: FxAmountValue, readback: FxReadback) => void
  /** Controlled SWIFT charge option. Leave all three charge props out to hide the switch. */
  charges?: FxCharges
  /** Initial charge instruction when uncontrolled. */
  defaultCharges?: FxCharges
  /** Called when the user picks OUR, SHA or BEN. */
  onChargesChange?: (charges: FxCharges) => void
  /** Offer a one-tap switch of the receiving currency when the expected amount is in another one. */
  onReceiveCurrencyChange?: (currency: string) => void
  /** BCP 47 locale for number and currency formatting. */
  locale?: string
  /** Override any visible string. */
  messages?: Partial<FxSendReceiveMessages>
}

/**
 * Stops the "I sent 1,200, they got 1,187" transfer. The invoice figure typed into "You send" quietly
 * shrinks after the fee and conversion, and SHA transfers lose more to banks along the way. This puts
 * both sides together with a lock on the side you fixed, measures what arrives against what must arrive,
 * catches the amount typed in the wrong box and an expected amount in another currency, and fixes each in
 * one tap: the lock slides to "They receive" with the right amount, or the sender takes on the bank charges.
 */
export function FxSendReceive({
  from: fromProp,
  to: toProp,
  quote,
  expected,
  expectedLabel,
  recipientName,
  value: valueProp,
  defaultValue = { side: "send", amount: null },
  onValueChange,
  charges: chargesProp,
  defaultCharges,
  onChargesChange,
  onReceiveCurrencyChange,
  locale,
  messages,
  className,
  "aria-describedby": describedBy,
  ...props
}: FxSendReceiveProps) {
  const t = { ...FX_SEND_RECEIVE_MESSAGES, ...messages }
  const from = String(fromProp ?? "").toUpperCase()
  const to = String(toProp ?? "").toUpperCase()
  const [inner, setInner] = React.useState<FxAmountValue>(defaultValue)
  const [innerCharges, setInnerCharges] = React.useState<FxCharges>(defaultCharges ?? "SHA")
  const value = valueProp ?? inner
  const charges = chargesProp ?? innerCharges
  const showCharges = chargesProp !== undefined || defaultCharges !== undefined || onChargesChange !== undefined
  const [text, setText] = React.useState(value.amount == null ? "" : String(value.amount))
  const [status, setStatus] = React.useState("")
  const sendRef = React.useRef<HTMLInputElement>(null)
  const receiveRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()
  const reduceMotion = useReducedMotion()
  const read = readTransfer(value, quote, from, to, charges, expected)
  const label = expectedLabel ?? t.invoice.toLowerCase()
  const name = recipientName ?? t.recipient

  // Keep what the user typed while it still means this amount; replace it when the value changes from outside.
  React.useEffect(() => {
    setText((current) => (parseAmount(current, locale) === value.amount && current.trim() ? current : value.amount == null ? "" : String(value.amount)))
  }, [value.amount, value.side])

  const money = (n: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
    } catch {
      return `${n} ${currency}`
    }
  }
  const plain = (n: number, currency: string) => new Intl.NumberFormat(locale, { minimumFractionDigits: minorUnits(currency), maximumFractionDigits: minorUnits(currency) }).format(n)
  const rateText = (n: number) => new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(n)

  const commit = (next: FxAmountValue, nextCharges = charges) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next, readTransfer(next, quote, from, to, nextCharges, expected))
  }
  const type = (side: FxAmountValue["side"], raw: string) => {
    const clipped = raw.slice(0, 24)
    setText(clipped)
    commit({ side, amount: parseAmount(clipped, locale) })
  }
  const setCharges = (next: FxCharges) => {
    if (chargesProp === undefined) setInnerCharges(next)
    onChargesChange?.(next)
  }
  /** The one-tap fix: fix the receiving side at the expected amount and hand focus to it. */
  const receiveExactly = (amount: number, nextCharges = charges) => {
    const next = { side: "receive" as const, amount }
    setText(String(amount))
    commit(next, nextCharges)
    const r = readTransfer(next, quote, from, to, nextCharges, expected)
    setStatus(fill(t.changed, { amount: money(r.receive, to), send: money(r.send, from) }))
    requestAnimationFrame(() => receiveRef.current?.focus())
  }

  const problemText = (p: FxProblem) => {
    const v = { label, receive: money(read.receive, to), to, least: money(read.arrivesAtLeast, to), upTo: money(Number(quote?.intermediaryFee) || 0, to), expected: expected ? money(expected.amount, expected.currency) : "" }
    switch (p.kind) {
      case "wrongBox": return fill(expected && read.receive > expected.amount ? t.wrongBoxOver : t.wrongBox, { ...v, typed: money(p.typed, from) })
      case "short": return fill(p.worstCase ? t.shortWorst : t.short, { ...v, by: money(p.by, to) })
      case "deductions": return fill(t.deductions, v)
      case "over": return fill(t.over, { ...v, by: money(p.by, to) })
      case "currency": return fill(t.currency, { ...v, expected: p.expected })
    }
  }
  // BEN is only listed when it is the current value, so a controlled "BEN" never shows an empty switch.
  const chargeOptions: FxCharges[] = charges === "BEN" ? ["OUR", "SHA", "BEN"] : ["OUR", "SHA"]
  const canOur = showCharges && charges !== "OUR" && Number(quote?.ourFee) >= 0
  const fixesFor = (p: FxProblem): { label: string; run: () => void }[] => {
    const fixes: { label: string; run: () => void }[] = []
    const target = expected?.currency.toUpperCase() === to ? expected.amount : null
    if ((p.kind === "wrongBox" || (p.kind === "short" && !p.worstCase)) && target) fixes.push({ label: fill(t.fixReceive, { amount: money(target, to) }), run: () => receiveExactly(target) })
    if (((p.kind === "short" && p.worstCase) || p.kind === "deductions") && canOur)
      fixes.push({ label: fill(t.fixOur, { fee: money(Number(quote.ourFee) || 0, from) }), run: () => { setCharges("OUR"); target ? receiveExactly(target, "OUR") : sendRef.current?.focus() } })
    if (p.kind === "over" && target) fixes.push({ label: fill(t.fixExact, { amount: money(target, to) }), run: () => receiveExactly(target) })
    if (p.kind === "currency" && onReceiveCurrencyChange && expected) fixes.push({ label: fill(t.fixCurrency, { currency: expected.currency }), run: () => { onReceiveCurrencyChange(expected.currency); receiveRef.current?.focus() } })
    return fixes
  }
  // A short or over arrival already explained by the wrong box doesn't need its own line.
  const wrongBox = read.problems.some((q) => q.kind === "wrongBox")
  const shown = read.problems.filter((p) => !(wrongBox && ((p.kind === "short" && !p.worstCase) || p.kind === "over")))
  const warn = shown.filter((p) => p.kind !== "over" && p.kind !== "deductions")
  const ok = !!expected && expected.currency.toUpperCase() === to && read.receive > 0 && shown.length === 0

  const summary = shown.map(problemText).join(" ")
  React.useEffect(() => {
    // Only announce new problems: clearing the region would cut off "Now fixed…" mid-sentence.
    if (!summary) return
    const timer = setTimeout(() => setStatus(summary), 700)
    return () => clearTimeout(timer)
  }, [summary])

  const describe = [describedBy, shown.length ? `${id}-problems` : ""].filter(Boolean).join(" ") || undefined
  const box = (side: FxAmountValue["side"]) => {
    const fixed = value.side === side
    const currency = side === "send" ? from : to
    const computed = side === "send" ? read.send : read.receive
    return (
      <div className={cn("relative rounded-lg border bg-background p-3 shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30", side === "receive" && warn.length > 0 && "border-amber-500/60")}>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <label htmlFor={`${id}-${side}`}>{side === "send" ? t.youSend : fill(t.theyReceive, { name })}</label>
          {fixed && (
            <motion.span layoutId={`${id}-lock`} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
              <Lock aria-hidden className="size-3" />
              {t.fixedSide}
            </motion.span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            ref={side === "send" ? sendRef : receiveRef}
            id={`${id}-${side}`}
            inputMode="decimal"
            autoComplete="off"
            value={fixed ? text : computed > 0 ? plain(computed, currency) : ""}
            placeholder="0"
            onChange={(e) => type(side, e.target.value)}
            aria-describedby={describe}
            aria-invalid={side === "receive" && warn.length > 0 ? true : undefined}
            className="h-9 min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/60"
          />
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-sm font-medium">{currency}</span>
        </div>
      </div>
    )
  }

  const meterMax = expected && expected.currency.toUpperCase() === to ? Math.max(expected.amount, read.receive) : 0
  const pct = (n: number) => `${meterMax > 0 ? Math.min(100, Math.max(0, (n / meterMax) * 100)) : 0}%`
  const tone = warn.length ? "bg-amber-500" : "bg-emerald-500"

  return (
    <div data-slot="fx-send-receive" className={cn("w-full min-w-0 max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      {expected && expected.amount > 0 && (
        <p className="text-xs text-muted-foreground">{fill(t.mustArrive, { label: label.charAt(0).toUpperCase() + label.slice(1), amount: money(expected.amount, expected.currency) })}</p>
      )}

      <div className="space-y-1.5">
        {box("send")}
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <ArrowDown aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 break-words">
            {read.fee > 0 && <>{fill(t.feeLine, { fee: money(read.fee, from) })} · </>}
            {Number(quote?.rate) > 0 && fill(t.rateLine, { from, to, rate: rateText(quote.rate), inverse: rateText(1 / quote.rate) })}
          </span>
        </div>
        {box("receive")}
      </div>

      {meterMax > 0 && read.receive > 0 && (
        <div aria-hidden className="space-y-1">
          <div className="text-[11px] text-muted-foreground">{fill(t.meterLabel, { label })}</div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <motion.div className={cn("absolute inset-y-0 left-0 rounded-full", tone)} initial={false} animate={{ width: pct(read.arrivesAtLeast) }} transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.2, 0, 0, 1] }} />
            {read.receive > read.arrivesAtLeast && (
              <motion.div className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,theme(colors.amber.500/.55)_0_3px,transparent_3px_6px)]" initial={false} animate={{ left: pct(read.arrivesAtLeast), width: `calc(${pct(read.receive)} - ${pct(read.arrivesAtLeast)})` }} transition={{ duration: reduceMotion ? 0 : 0.35 }} />
            )}
            <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `calc(${pct(expected!.amount)} - 1px)` }} />
          </div>
        </div>
      )}

      {showCharges && (Number(quote?.intermediaryFee) > 0 || charges === "OUR") && (
        <div role="radiogroup" aria-label={t.chargesLabel} onKeyDown={(e) => radioKeys(e, chargeOptions, charges, setCharges)} className={cn("grid gap-1 rounded-lg bg-muted p-1 text-xs", chargeOptions.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {chargeOptions.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={charges === c} tabIndex={charges === c ? 0 : -1} onClick={() => setCharges(c)} className="relative rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:text-foreground">
              {charges === c && <motion.span layoutId={`${id}-charges`} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-md bg-background shadow-xs" />}
              <span className="relative">{c === "OUR" ? t.chargesOur : c === "SHA" ? t.chargesSha : t.chargesBen}</span>
            </button>
          ))}
        </div>
      )}

      <div id={`${id}-problems`}>
        <AnimatePresence initial={false}>
          {shown.map((p) => (
            <motion.div
              key={p.kind}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: [0.2, 0, 0, 1] }}
              className="overflow-hidden"
            >
              <div className={cn("mt-1.5 flex items-start gap-2 text-xs", p.kind === "over" || p.kind === "deductions" ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300")}>
                {p.kind === "over" || p.kind === "deductions" ? <Info aria-hidden className="mt-px size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1 basis-40 break-words">{problemText(p)}</span>
                {fixesFor(p).map((f) => (
                  <button key={f.label} type="button" data-fix onClick={f.run} className={fixClass}>{f.label}</button>
                ))}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {ok && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            {fill(t.ok, { amount: money(read.receive, to) })}
          </p>
        )}
      </div>

      {read.receive > 0 && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {fill(t.readback, { send: money(read.send, from), name, receive: money(read.receive, to), least: read.arrivesAtLeast < read.receive ? fill(t.readbackLeast, { least: money(read.arrivesAtLeast, to) }) : "" })}
        </p>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
