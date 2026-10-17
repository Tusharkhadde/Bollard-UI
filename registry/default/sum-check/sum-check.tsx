"use client"

// Bollard UI — sum-check · MIT licence · https://bollard-ui.vercel.app/components/sum-check

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { CircleAlert, CircleCheck, Info } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export type SumCheckKind = "total" | "percent" | "balance"

export interface SumRow {
  id: string
  label: string
  value: number
  /** Balance checks only. */
  side?: "debit" | "credit"
}

export interface SumSuspect {
  id: string
  reason: "transposed" | "slipped" | "sign" | "side" | "left-out" | "doubled" | "unmatched"
  /** The value that would make it add up. */
  corrected?: number
}

export interface SumCheckOptions {
  kind?: SumCheckKind
  /** The stated total ("total"), or the target for "percent" (default 100). */
  total?: number
  /** Decimal places the row values were rounded to. Set it and small gaps are reported as rounding. */
  roundedTo?: number
}

const decimalsOf = (n: number) => (String(n).split(".")[1] ?? "").length

/**
 * Checks rows against their total (or debits against credits) in exact integer
 * arithmetic, then looks for the single-row slip that explains the gap: swapped
 * digits, a shifted decimal point, a flipped sign or side, a row left out or
 * counted twice. A gap that rounding alone can produce is reported as rounding.
 */
export function checkSum(rows: SumRow[], { kind = "total", total, roundedTo }: SumCheckOptions = {}) {
  const decimals = Math.min(6, Math.max(0, roundedTo ?? 0, decimalsOf(total ?? 0), ...rows.map((r) => decimalsOf(r.value))))
  const f = 10 ** decimals
  const int = (n: number) => Math.round(n * f)
  const sign = (row: SumRow) => (kind === "balance" && row.side === "credit" ? -1 : 1)
  const debits = rows.reduce((acc, r) => acc + (sign(r) > 0 ? int(r.value) : 0), 0)
  const credits = rows.reduce((acc, r) => acc + (sign(r) < 0 ? int(r.value) : 0), 0)
  const current = debits - credits
  const target = kind === "balance" ? 0 : int(total ?? (kind === "percent" ? 100 : current / f))
  const gap = target - current
  const tolerance = roundedTo === undefined ? 0 : (rows.length + (kind === "total" ? 1 : 0)) * 0.5 * 10 ** (decimals - roundedTo)
  const status = gap === 0 ? "ok" : Math.abs(gap) <= tolerance ? "rounding" : "off"

  const suspects: SumSuspect[] = []
  if (status === "off") {
    for (const row of rows) {
      const v = int(row.value)
      const s = sign(row)
      const fits = (corrected: number) => s * (corrected - v) === gap
      const digits = String(Math.abs(v))
      const swaps = [...digits.slice(1)].map((_, i) => Math.sign(v) * Number(digits.slice(0, i) + digits[i + 1] + digits[i] + digits.slice(i + 2)))
      const swapped = swaps.find((w) => w !== v && fits(w))
      const slipped = [v * 10, v * 100, v / 10, v / 100].find((w) => Number.isInteger(w) && fits(w))
      const found: Omit<SumSuspect, "id"> | null =
        swapped !== undefined ? { reason: "transposed", corrected: swapped / f }
        : slipped !== undefined ? { reason: "slipped", corrected: slipped / f }
        : -2 * s * v === gap ? (kind === "balance" ? { reason: "side" } : { reason: "sign", corrected: -v / f })
        : -s * v === gap ? { reason: kind === "balance" ? "unmatched" : "left-out" }
        : s * v === gap && kind !== "balance" ? { reason: "doubled" }
        : null
      if (found) suspects.push({ id: row.id, ...found })
    }
  }
  return { decimals, debits: debits / f, credits: credits / f, sum: current / f, target: target / f, gap: gap / f, tolerance: tolerance / f, status, suspects, nines: gap % 9 === 0 && Math.abs(gap) >= 9 } as const
}

/** Rounds raw shares so they add up exactly to `total` (Hare's largest remainder method). */
export function largestRemainder(values: number[], total = 100, decimals = 0) {
  const f = 10 ** decimals
  const sum = values.reduce((a, b) => a + b, 0) || 1
  const raw = values.map((v) => (v / sum) * total * f)
  const floors = raw.map(Math.floor)
  let left = Math.round(total * f) - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => [r - floors[i], i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) if (left-- > 0) floors[i]++
  return floors.map((n) => n / f)
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

const defaultReasons: Record<SumSuspect["reason"], string> = {
  transposed: "digits swapped? Adds up as {corrected}",
  slipped: "decimal point shifted? Adds up as {corrected}",
  sign: "sign flipped? Adds up as {corrected}",
  side: "on the wrong side? Adds up as a {otherSide}",
  "left-out": "left out of the total?",
  doubled: "counted twice in the total?",
  unmatched: "missing its {otherSide} entry?",
}

export interface SumCheckProps extends Omit<React.ComponentProps<"div">, "children">, SumCheckOptions {
  /** Rows to add, and the stated total or debit/credit rows. */
  rows: SumRow[]
  /** Formats amounts. Defaults to the row precision; percent adds "%". */
  format?: (value: number) => string
  /** Offer a one-tap "use the row sum" fix for a wrong stated total. */
  onUseSum?: (sum: number) => void
  /** Called when a likely culprit is picked, so the table can scroll to and highlight that row. */
  onSuspectSelect?: (id: string) => void
  /** Label of the computed sum. */
  sumLabel?: string
  /** Label of the stated total. */
  totalLabel?: string
  /** Label of the debits sum. */
  debitsLabel?: string
  /** Label of the credits sum. */
  creditsLabel?: string
  /** Templates: `{gap}`, `{sum}`, `{total}`, `{higher}`, `{tolerance}`, `{count}`, `{decimals}` are filled in. */
  okText?: string
  /** Shown when the total is off. `{diff}` is filled in. */
  offText?: string
  /** Shown when the gap is only rounding. */
  roundingText?: string
  /** Hint when the gap points to transposed digits. */
  ninesText?: string
  /** Accessible label of the suspects list. */
  suspectsLabel?: string
  /** Label of the use-the-sum fix. */
  useSumLabel?: string
  /** The `{decimals}` in `roundingText`: whole numbers, or `{places}` decimal places. */
  wholeNumbersText?: string
  /** Explains decimal places used for rounding. */
  decimalPlacesText?: string
  /** Text for each kind of suspected slip. */
  reasons?: Partial<Record<SumSuspect["reason"], string>>
}

/**
 * A table summary that stops a wrong total from being trusted. It re-adds the
 * rows, says exactly how far off the total is, points at the rows that would
 * explain the gap (swapped digits, a slipped decimal, a debit on the credit
 * side), and is honest about rounding instead of hiding it.
 */
export function SumCheck({
  rows, kind = "total", total, roundedTo, format, onUseSum, onSuspectSelect,
  sumLabel = "Sum of rows",
  totalLabel = kind === "percent" ? "Should add up to" : "Stated total",
  debitsLabel = "Debits",
  creditsLabel = "Credits",
  okText = kind === "balance" ? "Debits equal credits." : "Adds up.",
  offText = kind === "balance" ? "Off by {gap}: {higher} are higher." : "Off by {gap}: the rows add up to {sum}, not {total}.",
  roundingText = "Off by {gap}, which rounding alone explains: {count} figures rounded to {decimals} can drift by up to {tolerance}. Figures may not add up exactly because of rounding.",
  ninesText = "The gap divides by 9, a typical sign of two swapped digits.",
  suspectsLabel = "Likely cause",
  useSumLabel = "Use {sum}",
  wholeNumbersText = "whole numbers",
  decimalPlacesText = "{places} decimal places",
  reasons,
  className,
  ...props
}: SumCheckProps) {
  const result = React.useMemo(() => checkSum(rows, { kind, total, roundedTo }), [rows, kind, total, roundedTo])
  const reduceMotion = useReducedMotion()
  const statusRef = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef(false)
  // "Use the sum" removes its own button; hand focus to the status that now says it adds up.
  React.useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    statusRef.current?.focus()
  }, [result.status])
  /** Rolls a figure to its new value (unless a custom `format` is given), so a fix is seen landing. */
  const flowNumber = (n: number) =>
    format ? (
      fmt(n)
    ) : (
      <>
        <span className="sr-only">{fmt(n)}</span>
        <NumberFlow
          aria-hidden
          value={Math.abs(n)}
          prefix={n < 0 ? "−" : undefined}
          suffix={kind === "percent" ? "%" : undefined}
          format={{ minimumFractionDigits: result.decimals, maximumFractionDigits: result.decimals }}
          animated={!reduceMotion}
        />
      </>
    )
  const fmt = (n: number) => {
    const text = format ? format(Math.abs(n)) : new Intl.NumberFormat(undefined, { minimumFractionDigits: result.decimals, maximumFractionDigits: result.decimals }).format(Math.abs(n)) + (kind === "percent" ? "%" : "")
    return n < 0 ? `−${text}` : text
  }
  const [offBefore, offAfter = ""] = offText.split("{gap}")
  const places = roundedTo === 0 ? wholeNumbersText : fill(decimalPlacesText, { places: String(roundedTo) })
  const values = {
    gap: fmt(Math.abs(result.gap)),
    sum: fmt(result.sum),
    total: fmt(result.target),
    higher: (result.gap < 0 ? debitsLabel : creditsLabel).toLowerCase(),
    // Rounding drift can be finer than the row precision (3 × 0.5 = 1.5).
    tolerance: format ? format(result.tolerance) : new Intl.NumberFormat(undefined, { maximumFractionDigits: result.decimals + 1 }).format(result.tolerance) + (kind === "percent" ? "%" : ""),
    count: String(rows.length + (kind === "total" ? 1 : 0)),
    decimals: places,
  }
  const lines = kind === "balance"
    ? [[debitsLabel, result.debits], [creditsLabel, result.credits]] as const
    : [[sumLabel, result.sum], [totalLabel, result.target]] as const
  const action = "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div data-slot="sum-check" data-status={result.status} className={cn("w-full rounded-lg border text-sm", className)} {...props}>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2 tabular-nums">
        {lines.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{flowNumber(value)}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div
        ref={statusRef}
        tabIndex={-1}
        aria-live="polite"
        className={cn("border-t px-3 py-2 text-xs outline-none transition-colors duration-300", result.status === "off" && "bg-red-500/5")}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={result.status}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: [0.2, 0, 0, 1] }}
          >
            {result.status === "ok" ? (
              <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CircleCheck aria-hidden className="size-3.5 shrink-0" /> {okText}
              </p>
            ) : result.status === "rounding" ? (
              <p className="flex gap-1.5 text-muted-foreground">
                <Info aria-hidden className="mt-px size-3.5 shrink-0" /> {fill(roundingText, values)}
              </p>
            ) : (
              <div className="grid gap-1.5 text-red-800 dark:text-red-300">
                <p className="flex gap-1.5">
                  <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                  <span>
                    {fill(offBefore, values)}
                    <span className="inline-block font-semibold tabular-nums">{flowNumber(Math.abs(result.gap))}</span>
                    {fill(offAfter, values)}
                    {result.suspects.length === 0 && result.nines && ` ${ninesText}`}
                  </span>
                </p>
                {result.suspects.length > 0 && (
                  <ul aria-label={suspectsLabel} className="grid gap-1 pl-5">
                    {result.suspects.map((s, index) => {
                      const row = rows.find((r) => r.id === s.id)
                      const text = fill(reasons?.[s.reason] ?? defaultReasons[s.reason], {
                        corrected: s.corrected === undefined ? "" : fmt(s.corrected),
                        otherSide: row?.side === "credit" ? "debit" : "credit",
                      })
                      return (
                        <motion.li
                          key={s.id}
                          initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: reduceMotion ? 0 : 0.08 + index * 0.06, duration: 0.2 }}
                        >
                          <button type="button" onClick={() => onSuspectSelect?.(s.id)} className={cn(action, "h-auto min-h-6 px-1.5 py-0.5 text-left font-normal hover:bg-red-500/10")}>
                            <span><span className="font-medium">{row?.label}</span>: {text}</span>
                          </button>
                        </motion.li>
                      )
                    })}
                  </ul>
                )}
                {onUseSum && kind === "total" && (
                  <button
                    type="button"
                    onClick={() => {
                      refocus.current = true
                      onUseSum(result.sum)
                    }}
                    className={cn(action, "ml-5 w-fit border border-red-700/25 hover:bg-red-500/10 dark:border-red-300/25")}>
                    {fill(useSumLabel, values)}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
