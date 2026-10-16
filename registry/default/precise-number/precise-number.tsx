"use client"

import * as React from "react"
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
} from "@floating-ui/react"
import { ArrowLeftRight } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export type NumberSystem = "indian" | "international"

const UNITS: Record<NumberSystem, [number, string, string][]> = {
  // Below a lakh, Indian usage writes the full number (₹45,000), which is also exact.
  indian: [
    [1e7, "Cr", "crore"],
    [1e5, "L", "lakh"],
  ],
  international: [
    [1e12, "T", "trillion"],
    [1e9, "B", "billion"],
    [1e6, "M", "million"],
    [1e3, "K", "thousand"],
  ],
}

const localeFor = (system: NumberSystem) => (system === "indian" ? "en-IN" : "en-US")

/** Cut (never round) to `digits` decimals, so ₹99,99,999 reads "₹99.9 L", not "₹1 Cr". */
function truncate(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.trunc(Number((value * factor).toPrecision(12))) / factor
}

export interface CompactResult {
  /** What to show, e.g. "₹1.2 Cr". */
  text: string
  /** Spoken form, e.g. "about 1.2 crore Indian rupees". */
  spoken: string
  /** Full-precision form, e.g. "₹1,23,45,678.00". */
  exact: string
  /** False when the compact text equals the exact value. */
  approximate: boolean
}

/** Compact a number without ever overstating it. Exported for tables and charts. */
export function formatCompact(value: number, system: NumberSystem, currency?: string, digits = 1): CompactResult {
  const locale = localeFor(system)
  const style = currency ? { style: "currency" as const, currency } : {}
  // Whole amounts drop the ".00": the exact form should be exact, not padded.
  const wholeDigits = Number.isInteger(value) ? { minimumFractionDigits: 0 } : {}
  const exact = new Intl.NumberFormat(locale, { ...style, ...wholeDigits, maximumFractionDigits: 20 }).format(value)
  const unit = UNITS[system].find(([size]) => Math.abs(value) >= size)
  // Small enough to show in full: the compact form is the exact form.
  if (!unit) return { text: exact, spoken: exact, exact, approximate: false }
  const scaled = truncate(value / unit[0], digits)
  const short = new Intl.NumberFormat(locale, { ...style, maximumFractionDigits: digits, minimumFractionDigits: 0 })
  const parts = short.formatToParts(scaled)
  const lastNumber = parts.findLastIndex((p) => ["integer", "fraction", "decimal", "group"].includes(p.type))
  const suffix = `${system === "indian" ? " " : ""}${unit[1]}`
  const text = parts.map((p, i) => p.value + (i === lastNumber ? suffix : "")).join("")

  // Plural currency name ("Indian rupees") so the unit is spoken, not the symbol.
  const currencyName = currency
    ? new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "name", maximumFractionDigits: 20 })
        .formatToParts(scaled)
        .find((p) => p.type === "currency")?.value
    : undefined
  const numberWords = new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(scaled)
  const approximate = Number((scaled * unit[0]).toPrecision(12)) !== value
  const spoken = [approximate && "about", numberWords, unit[2], currencyName].filter(Boolean).join(" ")
  return { text, spoken, exact, approximate }
}

/**
 * Format a ratio as a percentage without lying at the edges: 0.996 never
 * becomes "100%" and 0.0004 never becomes "0%". `bound` shows "<100%" / ">0%";
 * `expand` adds decimals until the value is honest ("99.6%").
 */
export function formatPercent(ratio: number, digits = 0, mode: "bound" | "expand" = "expand") {
  const pct = ratio * 100
  const at = (d: number) => Number(pct.toFixed(d))
  const lies = (d: number) => (at(d) === 100 && ratio < 1) || (at(d) === 0 && ratio > 0)
  let d = digits
  if (lies(d) && mode === "bound") return at(d) === 100 ? "<100%" : ">0%"
  while (lies(d) && d < 6) d++
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(at(d))}%`
}

export interface PreciseNumberProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The exact value. For `percent`, a ratio (0.996 = 99.6%). */
  value: number
  format?: "number" | "percent"
  /** ISO currency code, e.g. "INR" or "USD". */
  currency?: string
  /** Lakh/crore or million/billion (controlled). */
  system?: NumberSystem
  /** Starting system when uncontrolled. Defaults to Indian for INR, international otherwise. */
  defaultSystem?: NumberSystem
  /** Show a button that switches between the two systems. */
  toggleable?: boolean
  /** Called when the toggle switches systems. */
  onSystemChange?: (system: NumberSystem) => void
  /** Decimals shown: compact numbers default to 1 (truncated, never rounded up), percentages to 0. */
  digits?: number
  /** For percentages: "<100%" (`bound`) or "99.6%" (`expand`) near 0% and 100%. */
  edge?: "bound" | "expand"
  /** Screen-reader prefix of the exact value in the tooltip. */
  exactLabel?: string
  /** Accessible name of the system toggle; receives the system it switches to. */
  toggleLabel?: (next: NumberSystem) => string
}

/**
 * Big numbers shown compactly (₹1.2 Cr, $1.2M) without losing precision: the
 * compact form is truncated so it never overstates, the exact value appears
 * on hover and focus, units are spelled out for screen readers, and the
 * lakh/crore and million/billion systems are one tap apart. Percentages
 * never round 99.6% up to 100%.
 */
export function PreciseNumber({
  value,
  format = "number",
  currency,
  system,
  defaultSystem,
  toggleable = false,
  onSystemChange,
  digits,
  edge = "expand",
  exactLabel = "Exactly",
  toggleLabel = (next) => `Show in ${next === "international" ? "million and billion" : "lakh and crore"}`,
  className,
  ...props
}: PreciseNumberProps) {
  const [localSystem, setLocalSystem] = React.useState<NumberSystem>(defaultSystem ?? (currency === "INR" ? "indian" : "international"))
  const [tipOpen, setTipOpen] = React.useState(false)
  const reduceMotion = useReducedMotion()
  const active = system ?? localSystem
  const tipId = React.useId()

  const result: CompactResult =
    format === "percent"
      ? (() => {
          const text = formatPercent(value, digits ?? 0, edge)
          const exact = `${new Intl.NumberFormat("en", { maximumFractionDigits: 6 }).format(value * 100)}%`
          const approximate = text !== exact
          const spoken = `${approximate ? "about " : ""}${text.replace("<", "less than ").replace(">", "more than ").replace("%", " percent")}`
          return { text, exact, approximate, spoken }
        })()
      : formatCompact(value, active, currency, digits ?? 1)

  const { refs, floatingStyles, context, placement } = useFloating({
    open: tipOpen && result.approximate,
    onOpenChange: setTipOpen,
    placement: "top",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { move: false, delay: { open: 80, close: 0 } }),
    useFocus(context),
    useDismiss(context),
  ])
  const above = placement.startsWith("top")
  const slide = reduceMotion ? 0 : 8

  const switchSystem = () => {
    const next = active === "indian" ? "international" : "indian"
    setLocalSystem(next)
    onSystemChange?.(next)
  }

  return (
    <span data-slot="precise-number" className={cn("inline-flex items-center gap-1.5", className)} {...props}>
      <span
        ref={refs.setReference}
        tabIndex={result.approximate ? 0 : undefined}
        aria-describedby={result.approximate ? tipId : undefined}
        {...(result.approximate ? getReferenceProps() : {})}
        className={cn(
          "inline-flex rounded-sm font-medium tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          result.approximate && "cursor-help border-b border-dotted border-muted-foreground/60",
        )}
      >
        <span className="inline-grid overflow-hidden">
          {/* Switching lakh/crore and million/billion rolls the old figure out and the new one in, so the change of units is seen, not missed. */}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={result.text}
              aria-hidden
              initial={{ opacity: 0, y: slide, filter: reduceMotion ? "none" : "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -slide, filter: reduceMotion ? "none" : "blur(2px)" }}
              transition={{ duration: reduceMotion ? 0.1 : 0.26, ease: [0.2, 0, 0, 1] }}
              className="col-start-1 row-start-1 whitespace-nowrap"
            >
              {result.text}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="sr-only">{result.spoken}</span>
        {result.approximate && (
          <span id={tipId} className="sr-only">
            {exactLabel} {result.exact}
          </span>
        )}
      </span>
      {result.approximate && (
        <FloatingPortal>
          <AnimatePresence>
            {tipOpen && (
              <div ref={refs.setFloating} style={floatingStyles} className="pointer-events-none z-50" {...getFloatingProps()}>
                <motion.span
                  aria-hidden
                  initial={{ opacity: 0, y: reduceMotion ? 0 : above ? 4 : -4, scale: reduceMotion ? 1 : 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
                  transition={reduceMotion ? { duration: 0.1 } : { type: "spring", stiffness: 560, damping: 34, mass: 0.6 }}
                  className="block whitespace-nowrap rounded-md border bg-popover px-2 py-1 font-mono text-xs text-popover-foreground shadow-md"
                >
                  {result.exact}
                </motion.span>
              </div>
            )}
          </AnimatePresence>
        </FloatingPortal>
      )}
      {toggleable && format !== "percent" && (
        <button
          type="button"
          onClick={switchSystem}
          aria-label={toggleLabel(active === "indian" ? "international" : "indian")}
          className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-1.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeftRight aria-hidden className="size-3" />
          {active === "indian" ? "L/Cr" : "M/B"}
        </button>
      )}
    </span>
  )
}
