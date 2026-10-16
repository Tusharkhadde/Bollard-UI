"use client"

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { Ban, Check, LoaderCircle, Repeat } from "lucide-react"
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

export interface SpendPurchase {
  /** The item bought; matched against `itemId`. */
  itemId: string
  at: Date | number | string
  amount?: number
  orderId?: string
}

export interface SpendCap {
  /** e.g. "Daily cap", "Monthly cap". */
  label: string
  limit: number
  /** Already spent in this period, not counting this purchase. The parent updates it after each purchase. */
  spent: number
  /** When the period resets, used in the blocked reason. */
  resetsAt?: Date | number | string
}

/** The most recent purchase of `itemId` within `window` ms of `now`, if any. */
export function findDuplicate(purchases: SpendPurchase[], itemId: string, now: number, window: number) {
  return purchases
    .filter((p) => p.itemId === itemId && now - new Date(p.at).getTime() <= window)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
}

/** The first cap this amount would break, with how far over it goes. */
export function findBreach(caps: SpendCap[], amount: number) {
  const cap = caps.find((c) => c.spent + amount > c.limit)
  return cap && { cap, over: cap.spent + amount - cap.limit }
}

const ago = (ms: number) => (ms < 45_000 ? "just now" : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min ago` : `${Math.round(ms / 3_600_000)} h ago`)
const until = (ms: number) => (ms < 3_600_000 ? `${Math.max(1, Math.round(ms / 60_000))} min` : ms < 172_800_000 ? `${Math.round(ms / 3_600_000)} h` : `${Math.round(ms / 86_400_000)} days`)
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
/** `fill`, but placeholders may be React nodes (rolling amounts). */
const fillNodes = (template: string, values: Record<string, React.ReactNode>) =>
  template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1]
    return <React.Fragment key={i}>{key && key in values ? values[key] : part}</React.Fragment>
  })

export interface SpendCapButtonProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Price of this purchase. */
  amount: number
  /** ISO currency code. */
  currency?: string
  /** Locale for money and times. */
  locale?: string
  /** Identifies what is being bought, for duplicate detection. */
  itemId: string
  /** Earlier purchases, in any order. Purchases made through this button are remembered too, so a double-buy is caught before the parent refreshes. */
  purchases?: SpendPurchase[]
  /** A purchase of the same item within this many ms counts as a likely duplicate. */
  duplicateWindow?: number
  /** Spending caps; a purchase that breaks any of them is blocked. */
  caps?: SpendCap[]
  /** Charges. Return a promise to show a pending state; a rejection re-enables the button. */
  onPurchase: () => void | Promise<void>
  /** Shown as "View order" on the duplicate warning. */
  onViewOrder?: (orderId: string) => void
  /** Templates: `{amount}`, `{when}`, `{cap}`, `{over}`, `{reset}`, `{left}` and `{after}` are filled in. */
  label?: string
  /** Shown when the item was bought recently. `{ago}` is filled in. */
  duplicateText?: string
  /** Button label asking for the second click. */
  againLabel?: string
  /** Shown when a cap would be broken. */
  blockedText?: string
  /** Accessible label of a cap meter. */
  capText?: string
  /** Cap line when this purchase doesn't fit. */
  capOverText?: string
  /** Label of the view-order link. */
  viewOrderLabel?: string
  /** Button label while onPurchase runs. */
  pendingLabel?: string
  /** Button label after a purchase. */
  doneLabel?: string
}

/**
 * A pay button that won't double-charge or overspend. It remembers what was
 * just bought ("You bought this 3 min ago") and needs a deliberate second
 * click to buy again, including when the earlier purchase was this same
 * button a second ago. Each cap shows what's left and, as a hatched slice,
 * what this purchase takes; one that would break a cap is blocked with the
 * cap, the overage and when it resets. When a charge lands, the hatched slice
 * visibly turns into spent money and the amounts roll to their new values,
 * so the user sees exactly what the purchase cost each cap. A blocked press
 * shakes instead of doing nothing. Reduced motion keeps the numbers, drops
 * the rolling, springs and shake.
 */
export function SpendCapButton({
  amount,
  currency = "INR",
  locale = "en-IN",
  itemId,
  purchases = [],
  duplicateWindow = 3_600_000,
  caps = [],
  onPurchase,
  onViewOrder,
  label = "Pay {amount}",
  duplicateText = "You bought this {when}.",
  againLabel = "Buy again · {amount}",
  blockedText = "Blocked: {over} over your {cap}. Resets in {reset}.",
  capText = "{left} left → {after} after",
  capOverText = "{left} left · {over} short",
  viewOrderLabel = "View order",
  pendingLabel = "Paying…",
  doneLabel = "Paid",
  className,
  ...props
}: SpendCapButtonProps) {
  const [mine, setMine] = React.useState<SpendPurchase[]>([])
  const [phase, setPhase] = React.useState<"idle" | "armed" | "pending" | "done">("idle")
  const [now, setNow] = React.useState<number>()
  const armedAt = React.useRef(0)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const hintId = React.useId()
  const reduce = useReducedMotion()
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  React.useEffect(() => {
    if (phase !== "done") return
    const id = setTimeout(() => setPhase("idle"), 1600)
    return () => clearTimeout(id)
  }, [phase])

  const flow = (n: number) => (
    <NumberFlow
      aria-hidden
      value={n}
      locales={locale}
      format={{ style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }}
    />
  )
  const bar = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 260, damping: 30 } as const)

  const duplicate = now === undefined ? undefined : findDuplicate([...purchases, ...mine], itemId, now, duplicateWindow)
  const breach = findBreach(caps, amount)
  const values = {
    amount: money(amount),
    when: duplicate && now !== undefined ? ago(now - new Date(duplicate.at).getTime()) : "",
    cap: breach?.cap.label.toLowerCase() ?? "",
    over: breach ? money(breach.over) : "",
    reset: breach?.cap.resetsAt && now !== undefined ? until(new Date(breach.cap.resetsAt).getTime() - now) : "—",
  }

  const click = async () => {
    if (phase === "pending" || phase === "done") return
    if (breach) {
      if (!reduce && buttonRef.current) animate(buttonRef.current, { x: [0, -5, 5, -3, 0] }, { duration: 0.3 })
      return
    }
    if (duplicate && phase === "idle") {
      armedAt.current = performance.now()
      setPhase("armed")
      return
    }
    // A double-click lands its second click here; only a deliberate one counts.
    if (phase === "armed" && performance.now() - armedAt.current < 400) return
    setPhase("pending")
    try {
      await onPurchase()
      setMine((list) => [...list, { itemId, at: Date.now(), amount }])
      setPhase("done")
    } catch {
      setPhase("idle")
    }
  }

  return (
    <div data-slot="spend-cap-button" data-state={breach ? "blocked" : phase} className={cn("w-full space-y-2.5", className)} {...props}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => void click()}
        onBlur={() => setPhase((p) => (p === "armed" ? "idle" : p))}
        onKeyDown={(event) => {
          if (event.key === "Escape") setPhase((p) => (p === "armed" ? "idle" : p))
          if (event.key === "Enter" && event.repeat) event.preventDefault()
        }}
        aria-disabled={breach ? true : undefined}
        aria-busy={phase === "pending" || undefined}
        aria-describedby={hintId}
        className={cn(
          "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          breach
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : phase === "armed"
              ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {breach ? <Ban aria-hidden className="size-4" /> : phase === "pending" ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : phase === "done" ? <Check aria-hidden className="size-4" /> : phase === "armed" ? <Repeat aria-hidden className="size-4" /> : null}
        {fill(phase === "armed" ? againLabel : phase === "pending" ? pendingLabel : phase === "done" ? doneLabel : label, values)}
      </button>

      <div id={hintId} aria-live="polite" className="space-y-1 empty:hidden">
        <AnimatePresence initial={false} mode="popLayout">
        {breach ? (
          <motion.p
            key="breach"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="flex gap-1.5 text-xs font-medium text-red-700 dark:text-red-400"
          >
            <Ban aria-hidden className="mt-px size-3.5 shrink-0" />
            {fill(blockedText, values)}
          </motion.p>
        ) : duplicate && phase !== "done" && phase !== "pending" ? (
          <motion.p
            key="duplicate"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"
          >
            <Repeat aria-hidden className="size-3.5 shrink-0" />
            {fill(duplicateText, values)}
            {duplicate.orderId && onViewOrder && (
              <button
                type="button"
                onClick={() => onViewOrder(duplicate.orderId!)}
                className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
              >
                {viewOrderLabel}
              </button>
            )}
          </motion.p>
        ) : null}
        </AnimatePresence>
      </div>

      {caps.map((cap) => {
        const pct = (n: number) => `${Math.min(100, Math.max(0, (n / cap.limit) * 100))}%`
        const over = cap.spent + amount > cap.limit
        const left = Math.max(0, cap.limit - cap.spent)
        return (
          <div key={cap.label} className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{cap.label}</span>
              <span
                aria-label={fill(over ? capOverText : capText, { left: money(left), after: money(left - amount), over: money(amount - left) })}
                role="img"
                className={cn("tabular-nums", over && "font-medium text-red-700 dark:text-red-400")}
              >
                {fillNodes(over ? capOverText : capText, { left: flow(left), after: flow(left - amount), over: flow(amount - left) })}
              </span>
            </div>
            <div
              role="meter"
              aria-label={cap.label}
              aria-valuemin={0}
              aria-valuemax={cap.limit}
              aria-valuenow={cap.spent}
              aria-valuetext={`${money(cap.spent)} of ${money(cap.limit)} spent`}
              className="flex h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <motion.span className="h-full bg-foreground/50" initial={false} animate={{ width: pct(cap.spent) }} transition={bar} />
              <motion.span
                className={cn(
                  "h-full bg-[repeating-linear-gradient(135deg,currentColor_0_2px,transparent_2px_4px)]",
                  over ? "text-red-500" : "text-amber-500",
                )}
                initial={false}
                animate={{ width: pct(Math.min(amount, left)) }}
                transition={bar}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
