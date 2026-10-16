"use client"

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { CircleCheck, Info, TriangleAlert, Undo2 } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { splitBill, type Receipt, type SplitPerson, type SplitProblem, type SplitValue } from "./split"

export { allocate, splitBill } from "./split"
export type { Receipt, ReceiptItem, ReceiptTax, SplitPerson, SplitProblem, SplitResult, SplitShare, SplitValue } from "./split"

/** Every visible string. Placeholders in braces are filled in; "one|other" picks by {count}. */
export const BILL_SPLIT_CHECK_MESSAGES = {
  items: "Who had what",
  had: "{name} had {item}",
  subtotal: "Items",
  inPrices: "in prices",
  service: "Service charge",
  remove: "Remove",
  restore: "Restore",
  adjust: "Adjustment",
  roundOff: "Round off",
  tip: "Tip",
  total: "Total",
  receiptSays: "receipt {amount}",
  receiptPlusTip: "receipt {amount} + {tip} tip",
  unclaimed: "{names} ({amount}) isn't claimed, so it's spread over everyone by what they ate.|{names} ({amount}) aren't claimed, so they're spread over everyone by what they ate.",
  shareEqually: "Share equally",
  taxTwice: "The item prices already include the {amount} tax, so adding it again overcharges everyone.",
  pricesInclude: "Prices include tax",
  tipOnService: "There's already a {service} service charge, so a {tip} tip pays for service twice.",
  serviceNote: "In India a service charge can't be added by default and can be removed on request (CCPA guidelines, July 2022; upheld by the Delhi High Court in March 2025, now under appeal).",
  dropTip: "Drop the tip",
  removeService: "Remove service charge",
  missing: "The receipt says {printed} but the lines add up to {computed}. {gap} is unaccounted for: check for an item you didn't enter.",
  extra: "The lines add up to {computed}, {gap} more than the receipt's {printed}. Is there a discount?",
  rounding: "The receipt rounds the total to {printed}; the lines add up to {computed}.",
  shareMissing: "Share {gap} by what each ate",
  applyDiscount: "Take {gap} off by share",
  nobody: "{names} hasn't claimed anything yet, so pays nothing.|{names} haven't claimed anything yet, so pay nothing.",
  mode: "How to split",
  byItem: "By item",
  equally: "Equally",
  lightest: "An equal split costs {name} {extra} more than what they had.",
  shares: "Shares",
  paid: "paid {amount}",
  owes: "owes {payer}",
  addsUp: "Shares add up to {amount}",
  changed: "Updated. {name} now owes {amount}.",
  undo: "Undo",
}

export type BillSplitCheckMessages = typeof BILL_SPLIT_CHECK_MESSAGES

const fill = (tpl: string, v: Record<string, string | number>) =>
  (tpl.includes("|") ? tpl.split("|")[Number(v.count) === 1 ? 0 : 1] : tpl).replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
/** Arrow keys move the choice in a radiogroup of buttons, as the ARIA radio pattern expects. */
function radioKeys<T>(e: React.KeyboardEvent<HTMLElement>, options: readonly T[], current: T, pick: (v: T) => void) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
  if (!step) return
  e.preventDefault()
  pick(options[(options.indexOf(current) + step + options.length) % options.length])
  const group = e.currentTarget
  requestAnimationFrame(() => group.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus())
}
const fixClass =
  "inline-flex min-h-6 max-w-full items-center py-0.5 text-left rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
const TONES = ["bg-sky-600", "bg-violet-600", "bg-emerald-600", "bg-rose-600", "bg-amber-600", "bg-cyan-700", "bg-fuchsia-600", "bg-lime-700"]
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"
const EMPTY: SplitValue = { claims: {}, tip: 0, mode: "items", taxInclusive: false, service: true, adjust: 0 }

export interface BillSplitCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** The receipt as printed: items, tax lines, service charge and total. */
  receipt: Receipt
  /** Everyone at the table. */
  people: SplitPerson[]
  /** Who paid the bill; every other row says what they owe this person. */
  payerId: string
  /** ISO currency code. */
  currency: string
  /** Controlled claims, tip and options. */
  value?: SplitValue
  defaultValue?: Partial<SplitValue>
  onValueChange?: (value: SplitValue) => void
  /** Show the India service-charge note with the tip warning. Default true when currency is INR. */
  showServiceNote?: boolean
  locale?: string
  messages?: Partial<BillSplitCheckMessages>
}

/**
 * Stops a bill split that quietly overcharges someone. Each item is claimed by the people who had it and
 * checked against the printed receipt: unclaimed items, tax counted twice, a tip on top of a service charge,
 * a total that doesn't match and what an equal split costs the lightest eater are each caught with a one-tap
 * fix. Shares are rounded by largest remainder so they always add up, and each row says who owes the payer what.
 */
export function BillSplitCheck({
  receipt,
  people,
  payerId,
  currency,
  value: valueProp,
  defaultValue,
  onValueChange,
  showServiceNote,
  locale,
  messages,
  className,
  ...props
}: BillSplitCheckProps) {
  const t = { ...BILL_SPLIT_CHECK_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<SplitValue>({ ...EMPTY, ...defaultValue })
  const value = valueProp ?? inner
  const [tipText, setTipText] = React.useState(value.tip ? String(value.tip) : "")
  const [undo, setUndo] = React.useState<SplitValue | null>(null)
  const [status, setStatus] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLInputElement>(null)
  const id = React.useId()
  const reduce = useReducedMotion()
  const digits = (() => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2
    } catch {
      return 2
    }
  })()
  const r = splitBill(receipt, people, value, digits)
  const payer = people.find((p) => p.id === payerId)
  const items = receipt?.items ?? []

  React.useEffect(() => {
    setTipText((cur) => (Number(cur.replace(/,/g, "")) === value.tip ? cur : value.tip ? String(value.tip) : ""))
  }, [value.tip])

  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
    } catch {
      return `${n} ${currency}`
    }
  }
  const fmt = { style: "currency", currency, maximumFractionDigits: digits } as const
  const list = (names: string[]) => names.join(", ")

  const commit = (next: SplitValue) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
  }
  /** A one-tap fix: keep an Undo, say what changed, and send focus to the next fix or the tip field. */
  const fix = (next: SplitValue) => {
    setUndo(value)
    commit(next)
    const after = splitBill(receipt, people, next, digits)
    const p = after.shares.find((s) => s.person.id !== payerId && s.share > 0)
    setStatus(p ? fill(t.changed, { name: p.person.name, amount: money(p.share) }) : "")
    // Pick the next fix from the new result: a line that is animating out must not take focus.
    const nextKind = after.problems.find((q) => q.kind !== "nobodyItems")?.kind
    requestAnimationFrame(() => ((nextKind && rootRef.current?.querySelector<HTMLElement>(`[data-fix="${nextKind}"]`)) || tipRef.current)?.focus())
  }
  const toggle = (itemId: string, personId: string) => {
    const cur = value.claims[itemId] ?? []
    commit({ ...value, claims: { ...value.claims, [itemId]: cur.includes(personId) ? cur.filter((p) => p !== personId) : [...cur, personId] } })
    setUndo(null)
  }

  const fixes = (p: SplitProblem): { label: string; run: () => void }[] => {
    switch (p.kind) {
      case "unclaimed":
        return [{ label: t.shareEqually, run: () => fix({ ...value, claims: { ...value.claims, ...Object.fromEntries(p.items.map((i) => [i.id, people.map((x) => x.id)])) } }) }]
      case "taxTwice":
        return [{ label: t.pricesInclude, run: () => fix({ ...value, taxInclusive: true }) }]
      case "tipOnService":
        return [
          { label: t.dropTip, run: () => fix({ ...value, tip: 0 }) },
          { label: t.removeService, run: () => fix({ ...value, service: false }) },
        ]
      case "wrongTotal":
        return [{ label: fill(p.gap > 0 ? t.shareMissing : t.applyDiscount, { gap: money(Math.abs(p.gap)) }), run: () => fix({ ...value, adjust: Math.round((value.adjust + p.gap) * 10 ** digits) / 10 ** digits }) }]
      default:
        return []
    }
  }
  const text = (p: SplitProblem) => {
    switch (p.kind) {
      case "unclaimed": return fill(t.unclaimed, { count: p.items.length, names: list(p.items.map((i) => i.name)), amount: money(p.amount) })
      case "taxTwice": return fill(t.taxTwice, { amount: money(p.amount) })
      case "tipOnService": return fill(t.tipOnService, { service: money(p.service), tip: money(p.tip) })
      case "wrongTotal": return fill(p.rounding ? t.rounding : p.gap > 0 ? t.missing : t.extra, { printed: money(p.printed), computed: money(p.computed), gap: money(Math.abs(p.gap)) })
      case "nobodyItems": return fill(t.nobody, { count: p.people.length, names: list(p.people.map((x) => x.name)) })
    }
  }
  const unclaimedIds = new Set(r.problems.flatMap((p) => (p.kind === "unclaimed" ? p.items.map((i) => i.id) : [])))
  const note = showServiceNote ?? currency === "INR"
  const summary = r.problems.map(text).join(" ")
  React.useEffect(() => {
    const h = setTimeout(() => setStatus(summary), 800)
    return () => clearTimeout(h)
  }, [summary])

  const row = "flex items-center justify-between gap-2"
  const printed = Math.max(0, (Number(receipt?.total) || 0) - (value.service !== false ? 0 : Number(receipt?.serviceCharge) || 0))
  const matches = printed > 0 && !r.problems.some((p) => p.kind === "wrongTotal" || p.kind === "taxTwice")

  return (
    <div ref={rootRef} data-slot="bill-split-check" className={cn("@container w-full min-w-0 max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div>
        <h3 className="text-xs font-medium text-muted-foreground">{t.items}</h3>
        <ul className="mt-1.5 divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className={cn("grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5 px-3 py-2 transition-colors @sm:grid-cols-[1fr_auto_auto]", unclaimedIds.has(item.id) && "bg-amber-500/10")}>
              <span className="min-w-0 break-words text-xs">
                {item.name}
                {item.qty && item.qty > 1 ? <span className="text-muted-foreground"> × {item.qty}</span> : null}
              </span>
              <div className="order-3 col-span-2 flex flex-wrap items-center gap-1 @sm:order-none @sm:col-span-1">
                {people.map((p, k) => {
                  const on = (value.claims[item.id] ?? []).includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={fill(t.had, { name: p.name, item: item.name })}
                      title={p.name}
                      onClick={() => toggle(item.id, p.id)}
                      className={cn("grid size-7 place-items-center rounded-full text-[10px] font-semibold outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50", on ? `${TONES[k % TONES.length]} text-white` : "border border-dashed text-muted-foreground hover:bg-accent")}
                    >
                      {initials(p.name)}
                    </button>
                  )
                })}
              </div>
              <span className="text-right text-xs font-medium tabular-nums @sm:w-20">{money(Number(item.price) || 0)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1 text-xs">
        <div className={row}><span className="text-muted-foreground">{t.subtotal}</span><span className="tabular-nums">{money(r.subtotal)}</span></div>
        {(receipt?.taxes ?? []).map((tx, i) => (
          <div key={i} className={row}>
            <span className="text-muted-foreground">{tx.label}{value.taxInclusive && <span> · {t.inPrices}</span>}</span>
            <span className={cn("tabular-nums", value.taxInclusive && "text-muted-foreground line-through")}>{money(Number(tx.amount) || 0)}</span>
          </div>
        ))}
        {Number(receipt?.serviceCharge) > 0 && (
          <div className={row}>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {t.service}
              <button type="button" onClick={() => fix({ ...value, service: !value.service })} className="rounded px-1 text-[11px] underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">{value.service ? t.remove : t.restore}</button>
            </span>
            <span className={cn("tabular-nums", !value.service && "text-muted-foreground line-through")}>{money(Number(receipt.serviceCharge))}</span>
          </div>
        )}
        {Number(receipt?.roundOff) ? <div className={row}><span className="text-muted-foreground">{t.roundOff}</span><span className="tabular-nums">{money(Number(receipt.roundOff))}</span></div> : null}
        {value.adjust !== 0 && <div className={row}><span className="text-muted-foreground">{t.adjust}</span><span className="tabular-nums">{money(value.adjust)}</span></div>}
        <div className={row}>
          <label htmlFor={`${id}-tip`} className="text-muted-foreground">{t.tip}</label>
          <input
            ref={tipRef}
            id={`${id}-tip`}
            inputMode="decimal"
            value={tipText}
            placeholder="0"
            onChange={(e) => {
              const raw = e.target.value.slice(0, 12)
              setTipText(raw)
              const n = Number(raw.replace(/[,\s]/g, ""))
              commit({ ...value, tip: Number.isFinite(n) && n > 0 ? n : 0 })
            }}
            aria-invalid={r.problems.some((p) => p.kind === "tipOnService") || undefined}
            className="h-8 w-24 rounded-md border bg-transparent px-2 text-right text-base tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-amber-500 md:text-xs dark:bg-input/30"
          />
        </div>
        <div className={cn(row, "border-t pt-1.5 text-sm font-medium")}>
          <span className="flex items-center gap-1.5">
            {t.total}
            {printed > 0 && <span className={cn("text-[11px] font-normal", matches ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>{fill(r.toPay !== r.bill ? t.receiptPlusTip : t.receiptSays, { amount: money(printed), tip: money(r.toPay - r.bill) })}</span>}
          </span>
          <span className="tabular-nums">{money(r.toPay)}</span>
        </div>
      </div>

      <div>
        <AnimatePresence initial={false}>
          {r.problems.map((p) => {
            const info = p.kind === "nobodyItems"
            return (
              <motion.div key={p.kind} initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: reduce ? 0.1 : 0.22, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
                <div className={cn("mt-1.5 flex items-start gap-2 text-xs", info ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300")}>
                  {info ? <Info aria-hidden className="mt-px size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 basis-40 break-words">
                    {text(p)}
                    {p.kind === "tipOnService" && note && <span className="mt-0.5 block text-muted-foreground">{t.serviceNote}</span>}
                  </span>
                  {fixes(p).map((f) => <button key={f.label} type="button" data-fix={p.kind} onClick={f.run} className={fixClass}>{f.label}</button>)}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {undo && (
          <button type="button" onClick={() => { commit(undo); setUndo(null) }} className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Undo2 aria-hidden className="size-3.5" />
            {t.undo}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div role="radiogroup" aria-label={t.mode} onKeyDown={(e) => radioKeys(e, ["items", "equal"] as const, value.mode, (m) => commit({ ...value, mode: m }))} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs">
          {(["items", "equal"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={value.mode === m} tabIndex={value.mode === m ? 0 : -1} onClick={() => commit({ ...value, mode: m })} className="relative rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:text-foreground">
              {value.mode === m && <motion.span layoutId={`${id}-mode`} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-md bg-background shadow-xs" />}
              <span className="relative">{m === "items" ? t.byItem : t.equally}</span>
            </button>
          ))}
        </div>
        {r.lightest && r.lightest.extra >= 1 && (
          <p className={cn("text-xs", value.mode === "equal" ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>{fill(t.lightest, { name: r.lightest.person.name, extra: money(r.lightest.extra) })}</p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted-foreground">{t.shares}</h3>
        <ul className="mt-1.5 space-y-1">
          {r.shares.map((s, k) => {
            const isPayer = s.person.id === payerId
            return (
              <li key={s.person.id} className="flex items-center gap-2 text-xs">
                <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white", TONES[k % TONES.length])}>{initials(s.person.name)}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{s.person.name}</span>{" "}
                  <span className="text-muted-foreground">{isPayer ? fill(t.paid, { amount: money(r.toPay) }) : fill(t.owes, { payer: payer?.name ?? "" })}</span>
                </span>
                <NumberFlow value={s.share} format={fmt} locales={locale} className={cn("font-semibold tabular-nums", isPayer && "text-muted-foreground")} />
              </li>
            )
          })}
        </ul>
        <p className="mt-2 flex items-center gap-1.5 border-t pt-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CircleCheck aria-hidden className="size-3.5 shrink-0" />
          {fill(t.addsUp, { amount: money(r.shares.reduce((a, s) => a + Math.round(s.share * 10 ** digits), 0) / 10 ** digits) })}
        </p>
      </div>
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
