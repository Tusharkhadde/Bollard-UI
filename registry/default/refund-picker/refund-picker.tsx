"use client"

import * as React from "react"
import { CalendarClock, LoaderCircle, Minus, Plus, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RefundItem {
  id: string
  name: string
  /** Units bought. */
  quantity: number
  unitPrice: number
  /** Restocking fee as a percent of the item price, e.g. 10 for an opened box. */
  restockingPercent?: number
  /** Why the restocking fee applies, e.g. "opened". */
  restockingReason?: string
  /** Set to the reason when the item can't be refunded, e.g. "Gift cards can't be refunded". */
  nonRefundable?: string
}

export interface RefundMethod {
  id: string
  /** e.g. "Original card", "UPI", "Store credit". */
  label: string
  /** e.g. "Visa •••• 4242" or "tushar@okhdfcbank". */
  detail?: string
  /** Earliest and latest arrival, in working days (or calendar days when `businessDays` is false). `[0, 0]` means today. */
  days: [number, number]
  businessDays?: boolean
  /** True when this method skips restocking and return-shipping deductions (a common store-credit policy). */
  waivesFees?: boolean
  /** A plain caveat shown with the method, e.g. "Can't be moved to your bank later". */
  caveat?: string
}

/** Every user-visible string. Functions get values already formatted for the locale. */
export const REFUND_PICKER_MESSAGES = {
  title: "Choose what to refund",
  confirm: (amount: string, _method: string) => `Refund ${amount}`,
  itemLine: (quantity: number, unitPrice: string, restockingPercent?: number) =>
    `${quantity} × ${unitPrice}${restockingPercent ? ` · ${restockingPercent}% restocking fee` : ""}`,
  unitsGroup: (item: string) => `Units of ${item} to refund`,
  fewer: (item: string) => `One fewer ${item}`,
  more: (item: string) => `One more ${item}`,
  amountToggle: "Refund a set amount instead",
  amountLabel: (max: string) => `Amount (up to ${max})`,
  amountCancel: "Use the items",
  over: (max: string) => `That's more than these items allow (${max}).`,
  useMax: (max: string) => `Use ${max}`,
  notANumber: "Enter the amount as a number, like 250 or 250.50.",
  refundTo: "Refund to",
  today: "today",
  by: (date: string) => `by ${date}`,
  between: (from: string, to: string) => `${from} – ${to}`,
  noDeductions: "no deductions",
  itemsTotal: "Items",
  delivery: "Delivery charge",
  total: "You get back",
  restocking: (percent: number, item: string, reason?: string) => `${percent}% restocking fee${reason ? ` (${reason} ${item})` : ` on ${item}`}`,
  returnShipping: "Return shipping",
  /** "your Visa •••• 4242" / "your store credit". */
  destination: (method: RefundMethod) => `your ${method.detail ?? method.label.toLowerCase()}`,
  shippingNote: (amount: string) => `The ${amount} delivery charge is refunded only if everything comes back.`,
  /** The one-sentence readback. Plain strings, so a translation can reorder freely. */
  readback: ({ amount, destination, arrival, kept, keptFor, notRefundable, shippingNote }: RefundReadback) =>
    [
      `${amount} back to ${destination}, ${arrival}.`,
      kept ? `${kept} is kept for ${keptFor.map((d) => d.toLowerCase()).join(" and ")}.` : "",
      notRefundable.length ? `${notRefundable.join(", ")} ${notRefundable.length === 1 ? "isn't" : "aren't"} refundable.` : "",
      shippingNote ?? "",
    ].filter(Boolean).join(" "),
  pickOne: "Pick at least one item to refund.",
}
export type RefundPickerMessages = typeof REFUND_PICKER_MESSAGES

export interface RefundReadback {
  amount: string
  destination: string
  arrival: string
  /** Formatted total kept, or "" when nothing is deducted. */
  kept: string
  keptFor: string[]
  notRefundable: string[]
  shippingNote?: string
}

export interface RefundOptions {
  /** Delivery the customer paid, refunded only when everything refundable comes back. */
  shippingPaid?: number
  /** Deducted from the refund for the return label. */
  returnShippingFee?: number
  waivesFees?: boolean
  /** Deduction labels, for translation. */
  messages?: Partial<Pick<RefundPickerMessages, "restocking" | "returnShipping">>
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Reads a typed amount in the locale's own format ("1.250,50" in de-DE, "1,250.50" in en-IN),
 * ignoring currency symbols and spaces. Returns null when empty and NaN when it isn't a number,
 * so "12,50" in German can never silently become 1250.
 */
export function parseAmount(text: string, locale = "en-IN") {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
  const group = parts.find((p) => p.type === "group")?.value ?? ","
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? "."
  // Drop words like "Rs." or "EUR" (with their dot), spaces, and currency signs.
  const cleaned = text.normalize("NFKC").replace(/\p{L}+\.?/gu, "").replace(/[^\d.,'’-]/g, "")
  if (!cleaned) return text.trim() ? Number.NaN : null
  const normal = cleaned.split(group === "." || group === "," ? group : "\u0000").join("").replace(decimal, ".").replace(/['’]/g, "")
  return /^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(normal) ? Number(normal) : Number.NaN
}

/** Works out a refund from the units chosen per item: what comes back and every deduction, each with its reason. */
export function computeRefund(items: RefundItem[], picked: Record<string, number>, { shippingPaid = 0, returnShippingFee = 0, waivesFees = false, messages }: RefundOptions = {}) {
  const say = { ...REFUND_PICKER_MESSAGES, ...messages }
  const refundable = items.filter((item) => !item.nonRefundable)
  const chosen = refundable.map((item) => ({ item, units: Math.min(item.quantity, Math.max(0, picked[item.id] ?? 0)) })).filter((c) => c.units > 0)
  const goods = round2(chosen.reduce((sum, c) => sum + c.units * c.item.unitPrice, 0))
  const deductions = waivesFees || !chosen.length ? [] : [
    ...chosen.filter((c) => c.item.restockingPercent).map((c) => ({ label: say.restocking(c.item.restockingPercent ?? 0, c.item.name, c.item.restockingReason), amount: round2((c.units * c.item.unitPrice * (c.item.restockingPercent ?? 0)) / 100) })),
    ...(returnShippingFee ? [{ label: say.returnShipping, amount: returnShippingFee }] : []),
  ]
  const everything = refundable.length > 0 && refundable.every((item) => (picked[item.id] ?? 0) >= item.quantity)
  const shipping = everything ? shippingPaid : 0
  const kept = round2(deductions.reduce((sum, d) => sum + d.amount, 0))
  return { goods, shipping, deductions, kept, refund: Math.max(0, round2(goods + shipping - kept)), everything }
}

/** Adds working days (skipping Saturday and Sunday) or calendar days. */
export function addRefundDays(from: Date, days: number, business = true) {
  const date = new Date(from)
  for (let left = days; left > 0; ) {
    date.setDate(date.getDate() + 1)
    if (!business || (date.getDay() !== 0 && date.getDay() !== 6)) left--
  }
  return date
}

export interface RefundPickerProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> {
  /** Items on the order, with quantity, price and refund rules. */
  items: RefundItem[]
  /** Where the refund can go, with arrival windows and fees. */
  methods: RefundMethod[]
  /** Controlled units chosen per item id. */
  value?: Record<string, number>
  /** Starting units per item id when uncontrolled. */
  defaultValue?: Record<string, number>
  /** Called with units per item id after every change. */
  onValueChange?: (picked: Record<string, number>) => void
  /** Controlled refund method id. Defaults to the first method, which should be the original payment. */
  method?: string
  /** Starting refund method id when uncontrolled. */
  defaultMethod?: string
  /** Called with the chosen refund method id. */
  onMethodChange?: (id: string) => void
  /** Original shipping charge, refunded when everything is returned. */
  shippingPaid?: number
  /** Return-shipping fee deducted from the refund. */
  returnShippingFee?: number
  /** When the refund is issued, for the arrival dates. Pass it for deterministic rendering; otherwise the clock is read after mount. */
  now?: Date | string
  /** ISO 4217 currency code. */
  currency?: string
  /** Locale for money and date formatting. */
  locale?: string
  /** Issues the refund. Return a promise to show a pending state; a rejection keeps the form. */
  onConfirm?: (refund: { amount: number; method: string; picked: Record<string, number> }) => void | Promise<void>
  /** Every visible string (see `REFUND_PICKER_MESSAGES`). The single-string props below still work and win. */
  messages?: Partial<RefundPickerMessages>
  /** @deprecated Use `messages.title`. */
  title?: string
  /** @deprecated Use `messages.confirm`. Receives the amount and the method label. */
  confirmLabel?: (amount: string, method: string) => string
  /** @deprecated Use `messages.shippingNote`. */
  shippingNote?: (amount: string) => string
  /** @deprecated Use `messages.amountToggle`. */
  amountToggleLabel?: string
  /** @deprecated Use `messages.amountLabel`. */
  amountLabel?: (max: string) => string
  /** @deprecated Use `messages.amountCancel`. */
  amountCancelLabel?: string
  /** @deprecated Use `messages.over`. */
  overText?: (max: string) => string
}

/** Drops undefined entries so legacy single-string props only override what they set. */
const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

const step =
  "grid size-7 place-items-center rounded-md border shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 dark:border-input dark:bg-input/30"

/**
 * A partial refund chooser that never lets the number surprise anyone. Pick units
 * per item; non-refundable items stay visible with the reason; each refund method
 * shows its own net amount and real arrival dates (store credit waiving a fee is
 * shown as a trade, not a trick); and every deduction is named in a plain
 * readback before the refund is issued.
 */
export function RefundPicker({
  items,
  methods,
  value,
  defaultValue = {},
  onValueChange,
  method,
  defaultMethod,
  onMethodChange,
  shippingPaid = 0,
  returnShippingFee = 0,
  now,
  currency = "INR",
  locale = "en-IN",
  onConfirm,
  messages,
  title,
  confirmLabel,
  shippingNote,
  amountToggleLabel,
  amountLabel,
  amountCancelLabel,
  overText,
  className,
  ...props
}: RefundPickerProps) {
  const t = {
    ...REFUND_PICKER_MESSAGES,
    ...messages,
    ...defined({ title, confirm: confirmLabel, shippingNote, amountToggle: amountToggleLabel, amountLabel, amountCancel: amountCancelLabel, over: overText }),
  }
  const [innerPicked, setInnerPicked] = React.useState(defaultValue)
  const [innerMethod, setInnerMethod] = React.useState(defaultMethod ?? methods[0]?.id)
  const [clock, setClock] = React.useState<Date>()
  const [pending, setPending] = React.useState(false)
  const [custom, setCustom] = React.useState<string | null>(null)
  React.useEffect(() => setClock(new Date()), [])
  const picked = value ?? innerPicked
  const methodId = method ?? innerMethod
  const chosen = methods.find((m) => m.id === methodId) ?? methods[0]
  const today = now ? new Date(now) : clock
  const id = React.useId()

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
  const day = (d: Date) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(d)
  const arrival = (m: RefundMethod) => {
    if (!today) return "…"
    if (m.days[1] === 0) return t.today
    const [from, to] = m.days.map((n) => addRefundDays(today, n, m.businessDays !== false))
    return m.days[0] === m.days[1] ? t.by(day(to)) : t.between(day(from), day(to))
  }
  const opts = { shippingPaid, returnShippingFee, messages: t }
  const full = computeRefund(items, picked, { ...opts, waivesFees: chosen?.waivesFees })
  const typed = custom === null ? null : parseAmount(custom, locale)
  const invalid = typed !== null && Number.isNaN(typed)
  const over = typed !== null && !invalid && typed > full.refund
  // A set amount (a price adjustment, a goodwill credit) replaces the item maths, never exceeds it.
  const result = typed !== null && !invalid && !over ? { ...full, refund: round2(typed), deductions: [], kept: 0, shipping: 0, goods: full.goods && typed } : full
  const blocked = items.filter((item) => item.nonRefundable)

  const setUnits = (item: RefundItem, units: number) => {
    const next = { ...picked, [item.id]: Math.min(item.quantity, Math.max(0, units)) }
    if (value === undefined) setInnerPicked(next)
    onValueChange?.(next)
  }
  const pickMethod = (next: string) => {
    if (method === undefined) setInnerMethod(next)
    onMethodChange?.(next)
  }
  const confirm = async () => {
    if (!onConfirm || pending || !chosen) return
    setPending(true)
    try {
      await onConfirm({ amount: result.refund, method: chosen.id, picked })
    } catch {
      // The caller reports the error; the selection stays.
    } finally {
      setPending(false)
    }
  }

  return (
    <section data-slot="refund-picker" aria-labelledby={`${id}-title`} className={cn("w-full min-w-0 max-w-sm space-y-4 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-refund-picker-flash{from{background-color:color-mix(in oklab,var(--color-amber-400) 45%,transparent)}}"}</style>
      <h3 id={`${id}-title`} className="font-medium">{t.title}</h3>

      <ul className="space-y-2">
        {items.map((item) => {
          const units = picked[item.id] ?? 0
          return (
            <li key={item.id} className={cn("flex items-center gap-3", item.nonRefundable && "text-muted-foreground")}>
              <div className="min-w-0 flex-1">
                <p className="truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.nonRefundable ?? t.itemLine(item.quantity, money(item.unitPrice), item.restockingPercent)}
                </p>
              </div>
              {!item.nonRefundable && (
                <div role="group" aria-label={t.unitsGroup(item.name)} className="flex items-center gap-1.5">
                  <button type="button" className={step} disabled={units === 0} onClick={() => setUnits(item, units - 1)} aria-label={t.fewer(item.name)}>
                    <Minus aria-hidden className="size-3.5" />
                  </button>
                  <output aria-live="polite" className="w-8 text-center tabular-nums">{units}/{item.quantity}</output>
                  <button type="button" className={step} disabled={units === item.quantity} onClick={() => setUnits(item, units + 1)} aria-label={t.more(item.name)}>
                    <Plus aria-hidden className="size-3.5" />
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="text-xs">
        {custom === null ? (
          <button type="button" onClick={() => setCustom("")} className="rounded-sm text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {t.amountToggle}
          </button>
        ) : (
          <div className="grid gap-1.5">
            <div className="flex justify-between gap-2">
              <label htmlFor={`${id}-amount`} className="font-medium">{t.amountLabel(money(full.refund))}</label>
              <button type="button" onClick={() => setCustom(null)} className="rounded-sm text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                {t.amountCancel}
              </button>
            </div>
            <input
              id={`${id}-amount`}
              inputMode="decimal"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              autoFocus
              aria-invalid={over || invalid || undefined}
              aria-describedby={`${id}-amount-hint`}
              className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-amber-500 md:text-sm dark:bg-input/30"
            />
            <p id={`${id}-amount-hint`} aria-live="polite" className="min-h-6">
              {invalid && (
                <span className="flex items-center gap-1.5 py-1 text-amber-700 dark:text-amber-400">
                  <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                  {t.notANumber}
                </span>
              )}
              {over && (
                <span className="flex flex-wrap items-center gap-x-2 text-amber-700 dark:text-amber-400">
                  <TriangleAlert aria-hidden className="size-3.5" />
                  <span className="py-1">{t.over(money(full.refund))}</span>
                  <button type="button" onClick={() => setCustom(String(full.refund))} className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200">
                    {t.useMax(money(full.refund))}
                  </button>
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div role="radiogroup" aria-label={t.refundTo} className="space-y-2 border-t pt-3">
        {methods.map((m) => {
          const net = result !== full ? result.refund : computeRefund(items, picked, { ...opts, waivesFees: m.waivesFees }).refund
          return (
            <label key={m.id} className="flex cursor-pointer gap-3 rounded-lg border p-2.5 transition-colors has-checked:border-primary has-checked:bg-accent/60 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 dark:border-input">
              <input type="radio" name={`${id}-method`} value={m.id} checked={m.id === chosen?.id} onChange={() => pickMethod(m.id)} className="mt-0.5 size-4 accent-(--primary)" />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2">
                  <span className="font-medium">{m.label}</span>
                  <span className="tabular-nums">{money(net)}</span>
                </span>
                <span className="block text-xs text-muted-foreground">
                  {m.detail ? `${m.detail} · ` : ""}
                  {arrival(m)}
                  {m.waivesFees && result === full && full.goods > 0 ? ` · ${t.noDeductions}` : ""}
                </span>
                {m.caveat && <span className="block text-xs text-amber-700 dark:text-amber-400">{m.caveat}</span>}
              </span>
            </label>
          )
        })}
      </div>

      <dl className="space-y-1 border-t pt-3">
        <div className="flex justify-between gap-3 text-muted-foreground">
          <dt>{t.itemsTotal}</dt>
          <dd className="tabular-nums">{money(result.goods)}</dd>
        </div>
        {result.shipping > 0 && (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <dt>{t.delivery}</dt>
            <dd className="tabular-nums">{money(result.shipping)}</dd>
          </div>
        )}
        {result.deductions.map((d) => (
          <div key={d.label} className="flex justify-between gap-3 text-red-700 dark:text-red-400">
            <dt>{d.label}</dt>
            <dd className="shrink-0 tabular-nums">−{money(d.amount)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 text-base font-medium">
          <dt>{t.total}</dt>
          <dd key={`${result.refund}`} className="rounded-sm px-1 tabular-nums motion-safe:animate-[cui-refund-picker-flash_400ms_ease-out]">{money(result.refund)}</dd>
        </div>
      </dl>

      {result.goods > 0 && chosen ? (
        <p aria-live="polite" className="flex gap-2 rounded-lg bg-muted/60 p-2.5">
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {t.readback({
              amount: money(result.refund),
              destination: t.destination(chosen),
              arrival: arrival(chosen),
              kept: result.kept > 0 ? money(result.kept) : "",
              keptFor: result.deductions.map((d) => d.label),
              notRefundable: blocked.map((b) => b.name),
              shippingNote: shippingPaid > 0 && !result.everything ? t.shippingNote(money(shippingPaid)) : undefined,
            })}
          </span>
        </p>
      ) : (
        <p className="flex gap-2 text-muted-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {t.pickOne}
        </p>
      )}

      {onConfirm && (
        <button
          type="button"
          disabled={result.goods === 0 || invalid || over}
          aria-busy={pending || undefined}
          onClick={() => void confirm()}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {t.confirm(money(result.refund), chosen?.label ?? "")}
        </button>
      )}
    </section>
  )
}
