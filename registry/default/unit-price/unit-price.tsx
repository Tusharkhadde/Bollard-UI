"use client"

// Bollard UI — unit-price · MIT licence · https://bollard-ui.vercel.app/components/unit-price

import * as React from "react"
import { BadgeCheck, PackageMinus, Scale, Tags, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type PriceUnit = "g" | "kg" | "ml" | "l" | "pc"
export type Dimension = "mass" | "volume" | "count"

export interface PriceOption {
  id: string
  name: string
  /** Price of one pack. */
  price: number
  /** Net quantity of one pack, in `unit`. */
  size: number
  unit: PriceUnit
  /** A multi-buy offer, e.g. 3 for ₹435. */
  multiBuy?: { count: number; price: number }
  /** The pack before it changed, to catch shrinkflation. */
  was?: { size: number; price: number }
}

const UNITS: Record<PriceUnit, [Dimension, number]> = { g: ["mass", 1], kg: ["mass", 1000], ml: ["volume", 1], l: ["volume", 1000], pc: ["count", 1] }
/** Quantity (in g, ml or pieces) each dimension is priced per. */
export const DEFAULT_BASIS: Record<Dimension, { quantity: number; label: string }> = {
  mass: { quantity: 100, label: "100 g" },
  volume: { quantity: 1000, label: "litre" },
  count: { quantity: 1, label: "piece" },
}

/** Price per basis quantity, e.g. ₹ per 100 g, from a pack price and size. */
export function unitPrice(price: number, size: number, unit: PriceUnit, basis = DEFAULT_BASIS) {
  const [dimension, factor] = UNITS[unit]
  return (price / (size * factor)) * basis[dimension].quantity
}

/** Every option on a common unit price, with the true cheapest per dimension and the tricks found. */
export function compareUnitPrices(options: PriceOption[], basis = DEFAULT_BASIS) {
  const rows = options.map((o) => {
    const [dimension, factor] = UNITS[o.unit]
    const single = unitPrice(o.price, o.size, o.unit, basis)
    const deal = o.multiBuy ? unitPrice(o.multiBuy.price, o.size * o.multiBuy.count, o.unit, basis) : null
    const dealExtra = o.multiBuy ? o.multiBuy.price - o.multiBuy.count * o.price : 0
    const was = o.was ? unitPrice(o.was.price, o.was.size, o.unit, basis) : null
    const shrank = o.was && was !== null && o.size < o.was.size && single > was * 1.005 ? { from: o.was.size, rise: single / was - 1 } : null
    return { option: o, dimension, base: o.size * factor, single, deal, dealExtra, best: deal !== null && deal < single ? deal : single, shrank }
  })
  const cheapest: Partial<Record<Dimension, string>> = {}
  for (const r of rows) {
    const current = rows.find((x) => x.option.id === cheapest[r.dimension])
    if (!current || r.best < current.best - 1e-9) cheapest[r.dimension] = r.option.id
  }
  return rows.map((r) => {
    const top = rows.find((x) => x.option.id === cheapest[r.dimension])!
    // A bigger pack that costs more per unit than a smaller one of the same kind.
    const smaller = rows.filter((x) => x.dimension === r.dimension && x.base < r.base && x.single < r.single).sort((a, b) => a.single - b.single)[0]
    return { ...r, isCheapest: top === r, vsCheapest: r.best / top.best - 1, cheapestRow: top, bulkTrap: smaller ? { than: smaller, extra: r.single / smaller.single - 1 } : null }
  })
}

const sizeText = (size: number, unit: PriceUnit) => (unit === "pc" ? `${size} pcs` : `${size} ${unit === "l" ? "L" : unit}`)
/** "Assam tea 500 g", unless the name already says its size. */
const optionLabel = (o: PriceOption) => (o.name.includes(sizeText(o.size, o.unit)) ? o.name : `${o.name} ${sizeText(o.size, o.unit)}`)
const pct = (x: number) => `${Math.round(x * 100)}%`
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const DIMENSION_LABEL: Record<Dimension, string> = { mass: "Sold by weight", volume: "Sold by volume", count: "Sold by piece" }

export interface UnitPriceProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Packs to compare, with price, size and unit. */
  options: PriceOption[]
  /** Controlled id of the chosen option. */
  value?: string
  /** Initial choice when uncontrolled. */
  defaultValue?: string
  /** Called with the chosen option id. */
  onValueChange?: (id: string) => void
  /** Override the quantity each kind is priced per (e.g. per kg). */
  basis?: Record<Dimension, { quantity: number; label: string }>
  /** ISO 4217 currency code. */
  currency?: string
  /** Locale for money formatting. */
  locale?: string
  /** Visible label of the options. */
  label?: string
  /** Templates. `{name}`, `{amount}`, `{size}`, `{pct}`, `{offer}` are filled in. */
  cheapestLabel?: string
  /** Warning when a multi-buy costs more per unit. */
  dealWorseText?: string
  /** Warning when a bigger pack costs more per unit. */
  bulkTrapText?: string
  /** Warning when a pack shrank at the same price. */
  shrankText?: string
  /** Readback of the picked option against the cheapest. */
  pickedText?: string
  /** Label of the switch-to-cheapest fix. */
  switchLabel?: string
}

/**
 * Stops shoppers picking the pack that only looks cheaper. Every option is shown at a common unit
 * price (₹ per 100 g, per litre or per piece, to two decimals as India's Legal Metrology rules ask),
 * the true cheapest is marked, and it catches bigger packs that cost more per unit, multi-buys that
 * cost more than the singles, and packs that shrank at the same price, with a one-tap switch.
 */
export function UnitPrice({
  options, value, defaultValue, onValueChange, basis = DEFAULT_BASIS, currency = "INR", locale = "en-IN",
  label = "Compare by unit price",
  cheapestLabel = "Cheapest",
  dealWorseText = "{offer} costs {amount} more than buying singles.",
  bulkTrapText = "Bigger isn't cheaper: {pct} more per {size} than {name}.",
  shrankText = "Pack shrank from {size}: {pct} more per unit at the same price.",
  pickedText = "The same amount of {name} costs {amount} less.",
  switchLabel = "Switch to {name}",
  className,
  ...props
}: UnitPriceProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const id = React.useId()
  const selected = value ?? inner
  const rows = React.useMemo(() => compareUnitPrices(options, basis), [options, basis])
  const money = (x: number, digits = 0) => x.toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
  const choose = (id: string) => {
    if (value === undefined) setInner(id)
    onValueChange?.(id)
  }
  const dimensions = [...new Set(rows.map((r) => r.dimension))]
  const picked = rows.find((r) => r.option.id === selected)
  const saving = picked && !picked.isCheapest ? ((picked.best - picked.cheapestRow.best) * picked.base) / basis[picked.dimension].quantity : 0

  const move = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = rows[(index + step + rows.length) % rows.length].option.id
    choose(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }

  return (
    <div data-slot="unit-price" className={cn("grid w-full max-w-md gap-3 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-unit-price-pop{from{opacity:0;transform:scale(.8)}}"}</style>
      <div className="flex items-center gap-2">
        <Scale aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p id={`${id}-label`} className="min-w-0 flex-1 text-sm font-medium">{label}</p>
      </div>
      {dimensions.map((dimension) => (
        <div key={dimension} className="grid gap-1.5">
          {dimensions.length > 1 && <p className="text-xs font-medium text-muted-foreground">{DIMENSION_LABEL[dimension]} · per {basis[dimension].label}</p>}
          <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid divide-y rounded-md border">
            {rows.map((r, index) => {
              if (r.dimension !== dimension) return null
              const o = r.option
              const checked = selected === o.id
              const per = basis[dimension].label
              const notes: { icon: typeof Tags; text: string }[] = []
              if (r.option.multiBuy && r.dealExtra >= 0)
                notes.push({ icon: Tags, text: fill(dealWorseText, { offer: `${o.multiBuy!.count} for ${money(o.multiBuy!.price)}`, amount: money(r.dealExtra) }) })
              if (r.bulkTrap) notes.push({ icon: TriangleAlert, text: fill(bulkTrapText, { pct: pct(r.bulkTrap.extra), size: per, name: sizeText(r.bulkTrap.than.option.size, r.bulkTrap.than.option.unit) }) })
              if (r.shrank) notes.push({ icon: PackageMinus, text: fill(shrankText, { size: sizeText(r.shrank.from, o.unit), pct: pct(r.shrank.rise) }) })
              return (
                <button
                  key={o.id}
                  id={`${id}-${o.id}`}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked || (!selected && index === 0) ? 0 : -1}
                  onClick={() => choose(o.id)}
                  onKeyDown={(e) => move(e, index)}
                  className={cn("grid gap-1 px-3 py-2 text-left text-sm transition-colors outline-none first:rounded-t-md last:rounded-b-md hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset", checked && "bg-accent")}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-full border", checked && "border-primary")}>
                      {checked && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                    <span className="shrink-0 tabular-nums">{money(o.price)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-xs tabular-nums">
                    <span className="text-muted-foreground">{sizeText(o.size, o.unit)}</span>
                    <span className={cn("font-medium", r.isCheapest ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                      {money(r.single, 2)} / {per}
                    </span>
                    {r.deal !== null && r.deal < r.single && <span className="text-muted-foreground">{money(r.deal, 2)} with {o.multiBuy!.count}-for deal</span>}
                    {r.isCheapest ? (
                      <span key={o.id} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-800 motion-safe:animate-[cui-unit-price-pop_250ms_ease-out] dark:text-emerald-300">
                        <BadgeCheck aria-hidden className="size-3" />
                        {cheapestLabel}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">+{pct(r.vsCheapest)}</span>
                    )}
                  </span>
                  {notes.map((n) => (
                    <span key={n.text} className="flex gap-1.5 pl-6 text-xs text-amber-700 dark:text-amber-400">
                      <n.icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {n.text}
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div aria-live="polite" className="min-h-6 text-xs">
        {picked && !picked.isCheapest && saving >= 0.5 && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">{fill(pickedText, { name: optionLabel(picked.cheapestRow.option), amount: money(saving) })}</span>
              <button type="button" onClick={() => choose(picked.cheapestRow.option.id)} className={fixClass}>
                {fill(switchLabel, { name: optionLabel(picked.cheapestRow.option) })}
              </button>
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
