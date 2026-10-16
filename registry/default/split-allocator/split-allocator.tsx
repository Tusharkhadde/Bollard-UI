"use client"

// Bollard UI — split-allocator · MIT licence · https://bollard-ui.vercel.app/components/split-allocator

import * as React from "react"
import { Check, CircleAlert, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Largest remainder (Hamilton) rounding: splits `total` in proportion to `weights` at `precision`
 * decimals so the parts always add up to exactly `total`. 100 / 3 → 34, 33, 33, never 99.
 * Ties go to the earlier item, so the result is deterministic.
 */
export function largestRemainder(total: number, weights: number[], precision = 0): number[] {
  const scale = 10 ** precision
  const units = Math.round(total * scale)
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0)
  if (!weights.length) return []
  const exact = weights.map((w) => (sum > 0 ? (Math.max(0, w) / sum) * units : units / weights.length))
  const parts = exact.map(Math.floor)
  let left = units - parts.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => ({ i, frac: x - parts[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; left > 0; k++, left--) parts[order[k % order.length].i]++
  return parts.map((p) => p / scale)
}

/** What's still unassigned, computed in whole units so 33.33 + 33.33 + 33.34 is exactly 100. */
export function splitRemaining(total: number, values: number[], precision = 0) {
  const scale = 10 ** precision
  const used = values.reduce((a, v) => a + Math.round((v || 0) * scale), 0)
  return (Math.round(total * scale) - used) / scale
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

export interface SplitItem {
  /** Stable key for the row. */
  id: string
  /** Who or what gets this share, e.g. "Priya". */
  label: string
}

export interface SplitAllocatorProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Rows to split across. */
  items: SplitItem[]
  /** The amount being split: 100 for percentages, or a sum of money. */
  total?: number
  /** Decimal places each share is rounded to (2 for rupees and paise). */
  precision?: number
  /** Shown before each amount, e.g. "₹". */
  prefix?: string
  /** Shown after each amount, e.g. "%". */
  suffix?: string
  /** Number formatting locale. */
  locale?: string
  /** Visible legend. */
  label?: string
  /** Controlled shares by item id. */
  value?: Record<string, number>
  /** Initial shares when uncontrolled. */
  defaultValue?: Record<string, number>
  /** Called with every row's share on each change. */
  onValueChange?: (value: Record<string, number>) => void
  /** Templates: `{amount}`, `{total}`, `{label}` and `{labels}` are filled in. */
  remainingText?: string
  /** Shown when the parts exceed the total. */
  overText?: string
  /** Shown when the parts add up exactly. */
  doneText?: string
  /** Warning for a row left on zero. */
  zeroText?: string
  /** Label of the give-the-rest fix. */
  giveRestLabel?: string
  /** Label of the take-the-excess fix. */
  takeOverLabel?: string
  /** Label of the scale-to-total fix. */
  scaleLabel?: string
  /** Label of the split-evenly button. */
  evenLabel?: string
}

/**
 * Splitting 100% (or ₹1,000) by hand ends in 99%, 101% or someone left on 0. This shows what's
 * left as you type, gives the rest to any row in one tap, flags over-allocation with a
 * proportional scale-down and 0% rows once nothing is left to give, and rounds every automatic
 * split with largest remainder so it always adds up to the total exactly.
 */
export function SplitAllocator({
  items,
  total = 100,
  precision = 0,
  prefix = "",
  suffix = "%",
  locale = "en-IN",
  label = "Split",
  value,
  defaultValue = {},
  onValueChange,
  remainingText = "{amount} left to assign",
  overText = "Over by {amount}.",
  doneText = "All {total} assigned",
  zeroText = "{labels} would get nothing.",
  giveRestLabel = "Give the remaining {amount} to {label}",
  takeOverLabel = "Take the extra {amount} from {label}",
  scaleLabel = "Scale down to fit",
  evenLabel = "Split evenly",
  className,
  ...props
}: SplitAllocatorProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const shares = value ?? inner
  const id = React.useId()
  const numbers = React.useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: precision }),
    [locale, precision],
  )
  const fmt = (n: number) => `${n < 0 ? "−" : ""}${prefix}${numbers.format(Math.abs(n))}${suffix}`
  const of = (itemId: string) => shares[itemId] ?? 0
  const remaining = splitRemaining(total, items.map((i) => of(i.id)), precision)
  const zeros = remaining <= 0 ? items.filter((i) => of(i.id) === 0) : []

  const update = (next: Record<string, number>) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
  }
  const assign = (parts: number[]) => {
    setDrafts({})
    update(Object.fromEntries(items.map((item, i) => [item.id, parts[i]])))
  }
  const setOne = (itemId: string, n: number) => update({ ...Object.fromEntries(items.map((i) => [i.id, of(i.id)])), [itemId]: n })

  const handleChange = (itemId: string, text: string) => {
    const clean = text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
    const [int, frac] = clean.split(".")
    const typed = frac === undefined || precision === 0 ? int : `${int}.${frac.slice(0, precision)}`
    setDrafts((d) => ({ ...d, [itemId]: typed }))
    setOne(itemId, typed === "" || typed === "." ? 0 : Number(typed))
  }

  const status =
    remaining > 0
      ? { tone: "warn", text: fill(remainingText, { amount: fmt(remaining) }) }
      : remaining < 0
        ? { tone: "error", text: fill(overText, { amount: fmt(-remaining) }) }
        : { tone: "done", text: fill(doneText, { total: fmt(total) }) }
  const fixClass =
    "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div
      data-slot="split-allocator"
      role="group"
      aria-labelledby={`${id}-label`}
      className={cn("grid w-full max-w-sm min-w-0 gap-3", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
        <button
          type="button"
          onClick={() => assign(largestRemainder(total, items.map(() => 1), precision))}
          className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {evenLabel}
        </button>
      </div>

      <div aria-hidden className={cn("flex h-2 overflow-hidden rounded-full bg-muted", remaining < 0 && "ring-2 ring-red-500/60")}>
        {items.map((item, i) => (
          <span
            key={item.id}
            className="h-full bg-primary transition-[width] first:rounded-l-full"
            style={{ width: `${Math.max(0, (of(item.id) / Math.max(total, total - remaining)) * 100)}%`, opacity: 1 - (i % 4) * 0.22 }}
          />
        ))}
      </div>

      <ul className="grid gap-2">
        {items.map((item) => {
          const share = of(item.id)
          const inputId = `${id}-${item.id}`
          const zero = zeros.includes(item)
          const canTake = remaining < 0 && share >= -remaining
          const shown = drafts[item.id] ?? (share ? share.toFixed(precision) : "")
          return (
            <li key={item.id} className="flex items-center gap-2">
              <label htmlFor={inputId} className="min-w-0 flex-1 truncate text-sm">
                {item.label}
              </label>
              {(remaining > 0 || canTake) && (
                <button
                  type="button"
                  onClick={() => setOne(item.id, splitRemaining(share, [-remaining], precision))}
                  aria-label={fill(remaining > 0 ? giveRestLabel : takeOverLabel, { amount: fmt(Math.abs(remaining)), label: item.label })}
                  title={fill(remaining > 0 ? giveRestLabel : takeOverLabel, { amount: fmt(Math.abs(remaining)), label: item.label })}
                  className="h-7 shrink-0 rounded-md border border-dashed px-2 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:border-solid hover:bg-accent hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {remaining > 0 ? "+" : "−"}
                  {fmt(Math.abs(remaining))}
                </button>
              )}
              <div
                data-warning={zero ? "" : undefined}
                className="flex h-9 w-28 shrink-0 items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
              >
                {prefix && <span aria-hidden className="pl-3 text-sm text-muted-foreground">{prefix}</span>}
                <input
                  id={inputId}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={shown}
                  onChange={(e) => handleChange(item.id, e.target.value)}
                  onBlur={() => setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([key]) => key !== item.id)))}
                  aria-invalid={remaining < 0 || undefined}
                  aria-describedby={`${id}-status`}
                  className="h-full w-full min-w-0 bg-transparent px-3 text-right text-base tabular-nums outline-none placeholder:text-muted-foreground md:text-sm"
                />
                {suffix && <span aria-hidden className="pr-3 text-sm text-muted-foreground">{suffix}</span>}
              </div>
            </li>
          )
        })}
      </ul>

      <div id={`${id}-status`} aria-live="polite" className="grid gap-1 text-xs">
        <p
          className={cn(
            "flex gap-1.5",
            status.tone === "done" && "text-emerald-700 dark:text-emerald-400",
            status.tone === "warn" && "text-amber-700 dark:text-amber-400",
            status.tone === "error" && "text-red-700 dark:text-red-400",
          )}
        >
          <span className="flex h-6 shrink-0 items-center">
            {status.tone === "error" ? (
              <CircleAlert aria-hidden className="size-3.5" />
            ) : status.tone === "warn" ? (
              <TriangleAlert aria-hidden className="size-3.5" />
            ) : (
              <Check aria-hidden className="size-3.5" />
            )}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="py-1 font-medium tabular-nums">{status.text}</span>
            {remaining < 0 && (
              <button
                type="button"
                onClick={() => assign(largestRemainder(total, items.map((i) => of(i.id)), precision))}
                className={cn(fixClass, "border-red-500/40 text-red-900 hover:bg-red-500/10 dark:text-red-200")}
              >
                {scaleLabel}
              </button>
            )}
          </span>
        </p>
        {zeros.length > 0 && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center">
              <TriangleAlert aria-hidden className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2">
              <span className="py-1">
                {fill(zeroText, { labels: new Intl.ListFormat(locale, { type: "conjunction" }).format(zeros.map((z) => z.label)) })}
              </span>
              {remaining === 0 && (
                <button type="button" onClick={() => assign(largestRemainder(total, items.map(() => 1), precision))} className={fixClass}>
                  {evenLabel}
                </button>
              )}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
