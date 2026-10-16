"use client"

import * as React from "react"
import { Minus, Plus, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Decides what a typed quantity should do: commit it (clamped, with a reason) or hold it for
 * confirmation because it is a suspicious jump, like 100 when people order 2. `suggestion` is
 * the likely intended number (the typed one minus its stray last digit).
 */
export function reviewQuantity(
  typed: number,
  current: number,
  { min, max, typical, step = 1 }: { min: number; max: number; typical?: number; step?: number }
) {
  if (typed > max) return { value: max, clamped: "max" as const }
  if (typed < min) return { value: min, clamped: "min" as const }
  // Sold in packs: 7 with a step of 6 from 6 becomes 6, never a quantity that can't be shipped.
  const snapped = snapToStep(typed, min, max, step)
  if (snapped !== typed) return { value: snapped, clamped: "step" as const }
  const baseline = Math.max(current, typical ?? 1, 1)
  if (typed !== current && typed >= 10 && typed >= baseline * 5)
    return { value: typed, confirm: true, suggestion: Math.max(min, Math.floor(typed / 10)) }
  return { value: typed }
}

/** Rounds to the nearest whole step counted from `min`, staying within `max`. */
export function snapToStep(value: number, min: number, max: number, step: number) {
  if (step <= 1) return value
  const snapped = min + Math.round((value - min) / step) * step
  return snapped > max ? snapped - step : snapped
}

/** Every user-visible string, so the stepper can be translated. */
export const QUANTITY_MESSAGES = {
  soldOut: "Out of stock.",
  decrease: "Decrease",
  increase: "Increase",
  typical: (n: number) => `Most people order ${n}`,
  left: (n: number) => `${n} left`,
  allInStock: (n: number) => `That's all ${n} in stock.`,
  onlyInStock: (stock: number, set: number) => `Only ${stock} in stock, so it's set to ${set}.`,
  maxOrder: (n: number) => `The most you can order is ${n}.`,
  minOrder: (n: number) => `The minimum is ${n}.`,
  packs: (step: number, set: number) => `Sold in packs of ${step}, so it's set to ${set}.`,
  confirm: (typed: number, typical: number | undefined, suggestion: number) =>
    `You typed ${typed}${typical !== undefined ? `; most people order ${typical}` : ""}. Did you mean ${suggestion}?`,
  useSuggestion: (n: number) => `Use ${n}`,
  keepTyped: (n: number) => `Yes, ${n}`,
}
export type QuantityMessages = typeof QUANTITY_MESSAGES

export interface QuantityStepperProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step"> {
  /** Visible label. */
  label?: string
  /** Controlled quantity. */
  value?: number
  /** Initial quantity when uncontrolled. */
  defaultValue?: number
  /** Called with every committed quantity. Suspicious typed jumps wait for confirmation first. */
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  /** Units available; the effective maximum is the lower of `max` and `stock`. */
  stock?: number
  /** What a typical order looks like. Typed values far above it ask for confirmation. */
  typical?: number
  /** Units per step (a pack size). Typed values snap to whole steps counted from `min`. */
  step?: number
  /** Text shown when stock is below the minimum. */
  soldOutMessage?: string
  /** Accessible labels of the − and + buttons. */
  decreaseLabel?: string
  increaseLabel?: string
  /** Override any other user-visible string (see `QUANTITY_MESSAGES`). */
  messages?: Partial<QuantityMessages>
}

const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A quantity stepper that won't let a stray keystroke order 100 instead of 10. It clamps to min,
 * max and stock with an explanation, holds big typed jumps until confirmed ("Did you mean 10?"),
 * ignores the scroll wheel, and accelerates when a button is held.
 */
export function QuantityStepper({
  label = "Quantity",
  value,
  defaultValue,
  onValueChange,
  min = 1,
  max = 99,
  stock,
  typical,
  step = 1,
  soldOutMessage,
  decreaseLabel,
  increaseLabel,
  messages,
  id,
  className,
  onBlur,
  onKeyDown,
  ...props
}: QuantityStepperProps) {
  const say = { ...QUANTITY_MESSAGES, ...messages }
  const limit = Math.max(min, Math.min(max, stock ?? Infinity))
  // The highest quantity that is a whole number of steps.
  const ceiling = step > 1 && Number.isFinite(limit) ? min + Math.floor((limit - min) / step) * step : limit
  const clamp = (n: number) => Math.min(ceiling, Math.max(min, n))
  const [inner, setInner] = React.useState(() => clamp(defaultValue ?? min))
  const current = clamp(value ?? inner)
  const [draft, setDraft] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState<{ typed: number; suggestion: number } | null>(null)
  const [note, setNote] = React.useState("")
  const valueRef = React.useRef(current)
  const stopHold = React.useRef<() => void>(() => {})
  const autoId = React.useId()
  const inputId = id ?? autoId
  const soldOut = stock !== undefined && stock < min
  valueRef.current = current

  const set = (next: number, message = "") => {
    const clamped = clamp(next)
    valueRef.current = clamped
    if (value === undefined) setInner(clamped)
    setDraft(null)
    setPending(null)
    setNote(message || (stock !== undefined && clamped === stock && next >= stock ? say.allInStock(stock) : ""))
    if (clamped !== current) onValueChange?.(clamped)
  }

  const commitDraft = () => {
    if (draft === null) return
    if (!draft.trim()) return set(current)
    const review = reviewQuantity(Number(draft), current, { min, max: ceiling, typical, step })
    if (review.confirm) return setPending({ typed: review.value, suggestion: snapToStep(review.suggestion, min, ceiling, step) })
    if (review.clamped === "max")
      return set(review.value, stock !== undefined && Number(draft) > stock ? say.onlyInStock(stock, ceiling) : say.maxOrder(ceiling))
    set(review.value, review.clamped === "min" ? say.minOrder(min) : review.clamped === "step" ? say.packs(step, review.value) : "")
  }

  React.useEffect(() => () => stopHold.current(), [])

  const startHold = (direction: 1 | -1) => {
    stopHold.current()
    let delay = 400
    let timer = 0
    const stop = () => {
      window.clearTimeout(timer)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
    const tick = () => {
      const next = clamp(valueRef.current + direction * step)
      if (next === valueRef.current) return stop()
      set(next)
      delay = Math.max(40, delay * 0.8)
      timer = window.setTimeout(tick, delay)
    }
    set(valueRef.current + direction * step)
    timer = window.setTimeout(tick, delay)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
    stopHold.current = stop
  }

  const stepButton = (direction: 1 | -1) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={direction > 0 ? (increaseLabel ?? say.increase) : (decreaseLabel ?? say.decrease)}
      aria-controls={inputId}
      disabled={soldOut || (direction > 0 ? current >= ceiling : current <= min)}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        startHold(direction)
      }}
      onClick={(event) => event.detail === 0 && set(current + direction * step)}
      className="grid h-full w-9 shrink-0 touch-none place-items-center text-muted-foreground transition-colors first:rounded-l-md last:rounded-r-md hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 outline-none"
    >
      {direction > 0 ? <Plus aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4" />}
    </button>
  )

  const hint = soldOut
    ? (soldOutMessage ?? say.soldOut)
    : [typical !== undefined && say.typical(typical), stock !== undefined && stock <= 10 && say.left(stock)].filter(Boolean).join(" · ")
  const warning = pending ? say.confirm(pending.typed, typical, pending.suggestion) : note

  return (
    <div data-slot="quantity-stepper" className={cn("grid w-full max-w-sm gap-1.5", className)}>
      <label htmlFor={inputId} className="w-fit text-sm font-medium">{label}</label>
      <div
        data-warning={pending ? "" : undefined}
        className="flex h-9 w-fit items-stretch rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 data-warning:border-amber-500 dark:data-warning:border-amber-400"
      >
        {stepButton(-1)}
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          role="spinbutton"
          autoComplete="off"
          aria-valuenow={soldOut ? 0 : current}
          aria-valuemin={min}
          aria-valuemax={ceiling}
          aria-describedby={`${inputId}-hint`}
          disabled={soldOut}
          value={soldOut ? "0" : draft ?? String(current)}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onFocus={(event) => event.target.select()}
          onBlur={(event) => {
            commitDraft()
            onBlur?.(event)
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            const moves: Record<string, number> = { ArrowUp: step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 }
            if (event.key === "Enter") commitDraft()
            else if (event.key === "Escape" && (draft !== null || pending)) set(current)
            else if (event.key === "Home") set(min)
            else if (event.key === "End") set(ceiling)
            else if (moves[event.key]) set(current + moves[event.key])
            else return
            event.preventDefault()
          }}
          className="w-12 min-w-0 border-x bg-transparent text-center text-base font-medium tabular-nums outline-none disabled:opacity-50 md:text-sm"
          {...props}
        />
        {stepButton(1)}
      </div>
      <div id={`${inputId}-hint`} aria-live="polite" className="min-h-6 text-xs">
        {warning ? (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="flex h-6 shrink-0 items-center"><TriangleAlert aria-hidden className="size-3.5" /></span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="py-1">{warning}</span>
              {pending && (
                <>
                  <button type="button" onClick={() => set(pending.suggestion)} className={fixClass}>{say.useSuggestion(pending.suggestion)}</button>
                  <button type="button" onClick={() => set(pending.typed)} className={cn(fixClass, "font-normal")}>{say.keepTyped(pending.typed)}</button>
                </>
              )}
            </span>
          </p>
        ) : hint ? (
          <p className="py-1 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}
