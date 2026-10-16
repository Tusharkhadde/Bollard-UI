"use client"

import * as React from "react"
import NumberFlow from "@number-flow/react"
import { ArrowDownRight, ArrowUpRight, Check, LoaderCircle, Lock, RefreshCw } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { compareQuotes, formatHold, quoteDeadline, type Quote, type QuoteChange, type QuoteDirection } from "./quote"

export { compareQuotes, formatHold, quoteDeadline } from "./quote"
export type { Quote, QuoteChange, QuoteDirection } from "./quote"

/** Every visible string. Placeholders: {time} {amount} {old} {delta} {percent}. */
export const QUOTE_LOCK_MESSAGES = {
  heldFor: "Price held for {time}",
  refreshing: "Getting a new price…",
  up: "Up {delta} ({percent})",
  down: "Down {delta} ({percent})",
  worseNote: "Higher than the {old} you saw. Accept the new price to continue.",
  worseNoteReceive: "Lower than the {old} you saw. Accept the new price to continue.",
  betterNote: "Price changed from {old}.",
  endingSoon: "The hold was about to end, so here's a fresh price first.",
  accept: "Accept {amount}",
  pay: "Pay {amount}",
  paying: "Paying…",
  paid: "Paid {amount}",
  refresh: "Get a new price",
  requoteFailed: "Couldn't get a new price. Nothing was charged.",
  payFailed: "Payment didn't go through.",
  retry: "Try again",
  announceNew: "New price {amount}. {change}",
}

export type QuoteLockMessages = typeof QUOTE_LOCK_MESSAGES

export interface QuoteLockProps extends Omit<React.ComponentProps<"div">, "children" | "onChange"> {
  /** The quote to show. A quote with a new `id` from the parent replaces the current one. */
  quote: Quote
  /** Fetch a fresh quote. Called when the hold ends (with `autoRequote`) or the user asks. */
  onRequote: () => Quote | Promise<Quote>
  /** Pay with this exact quote. Reject to keep the user on the page with an error. */
  onConfirm: (quote: Quote) => void | Promise<void>
  /** Called with every quote the component adopts. */
  onQuoteChange?: (quote: Quote) => void
  /** Worse-by-more-than-this percent needs an explicit accept. 0 means any increase does. */
  tolerance?: number
  /** "pay": higher is worse. "receive": lower is worse (what the recipient gets). */
  direction?: QuoteDirection
  /** Fetch a new quote by itself when the hold runs out. */
  autoRequote?: boolean
  /** A Pay press with less hold than this (ms) gets a fresh quote first, since the payment may land after expiry. */
  minTimeToPay?: number
  /** Label above the amount, e.g. "You send". */
  label?: React.ReactNode
  /** BCP 47 locale for amounts and times. */
  locale?: string
  /** Override any visible string. */
  messages?: Partial<QuoteLockMessages>
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m)

/**
 * Stops paying a price you never saw. FX transfers, crypto swaps and fares hold a quote for a
 * short time; when it lapses the price is re-quoted, often while the user is still reading.
 * This shows the hold draining, fetches a fresh quote when it ends, rolls the amount from old to
 * new with the difference called out, and makes a worse-than-tolerance price an explicit
 * "Accept" step: the Pay button morphs into Accept in place, so focus stays put. The Pay label
 * always carries the amount, a press in the last seconds of a hold re-quotes first, stale
 * responses and double presses are ignored, and the countdown is never read aloud.
 */
export function QuoteLock({
  quote,
  onRequote,
  onConfirm,
  onQuoteChange,
  tolerance = 0,
  direction = "pay",
  autoRequote = true,
  minTimeToPay = 3000,
  label,
  locale,
  messages,
  className,
  ...props
}: QuoteLockProps) {
  const m = { ...QUOTE_LOCK_MESSAGES, ...messages }
  const [current, setCurrent] = React.useState(quote)
  const [deadline, setDeadline] = React.useState<number>()
  const [total, setTotal] = React.useState(1)
  const [now, setNow] = React.useState<number>()
  const [accepted, setAccepted] = React.useState(quote.amount)
  const [change, setChange] = React.useState<(QuoteChange & { from: number }) | null>(null)
  const [phase, setPhase] = React.useState<"held" | "requoting" | "confirming" | "paid">("held")
  const [error, setError] = React.useState<string | null>(null)
  const [note, setNote] = React.useState<string | null>(null)
  const [announcement, setAnnouncement] = React.useState("")
  const seq = React.useRef(0)
  const busy = React.useRef(false)
  const reduceMotion = useReducedMotion()

  const money = React.useCallback(
    (n: number, signed = false) =>
      new Intl.NumberFormat(locale, { style: "currency", currency: current.currency, signDisplay: signed ? "always" : "auto" }).format(n),
    [locale, current.currency],
  )

  // Adopt a quote: start its hold from now, on this device's clock.
  const adopt = React.useCallback((next: Quote) => {
    const at = Date.now()
    const end = quoteDeadline(next, at)
    setCurrent(next)
    setDeadline(Number.isFinite(end) ? end : undefined)
    setTotal(Number.isFinite(end) ? Math.max(1, end - at) : 1)
    setNow(at)
  }, [])

  React.useEffect(() => {
    seq.current++ // any requote still in flight belongs to the old quote
    adopt(quote)
    setAccepted(quote.amount)
    setChange(null)
    setPhase((p) => (p === "paid" ? p : "held"))
    // A new quote id from the parent replaces ours; the same id re-rendering does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id])

  React.useEffect(() => {
    if (deadline === undefined || phase === "paid") return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline, phase])

  const requote = React.useCallback(
    async (reason?: string) => {
      const ticket = ++seq.current
      setPhase("requoting")
      setError(null)
      setNote(reason ?? null)
      try {
        const next = await onRequote()
        if (ticket !== seq.current) return // a newer request (or a new parent quote) won
        const diff = compareQuotes(accepted, next.amount, tolerance, direction)
        adopt(next)
        onQuoteChange?.(next)
        setChange(diff.delta ? { ...diff, from: accepted } : null)
        if (!diff.needsAccept) setAccepted(next.amount)
        const changeText = diff.delta
          ? fill(diff.delta > 0 ? m.up : m.down, { delta: money(Math.abs(diff.delta)), percent: `${Math.abs(diff.percent).toFixed(1)}%` })
          : ""
        setAnnouncement(fill(m.announceNew, { amount: money(next.amount), change: changeText }))
      } catch {
        if (ticket === seq.current) setError(m.requoteFailed)
      } finally {
        if (ticket === seq.current) setPhase("held")
      }
    },
    [accepted, adopt, direction, m.announceNew, m.down, m.requoteFailed, m.up, money, onQuoteChange, onRequote, tolerance],
  )

  const left = deadline !== undefined && now !== undefined ? deadline - now : Infinity
  const expired = left <= 0

  React.useEffect(() => {
    if (expired && autoRequote && phase === "held" && !error) void requote()
  }, [expired, autoRequote, phase, error, requote])

  const mustAccept = change?.needsAccept === true && accepted !== current.amount
  const primary = async () => {
    if (busy.current || phase !== "held") return
    if (mustAccept) {
      setAccepted(current.amount)
      return
    }
    if (left < minTimeToPay) return void requote(m.endingSoon)
    busy.current = true
    setPhase("confirming")
    setError(null)
    try {
      await onConfirm(current)
      setPhase("paid")
    } catch {
      setError(m.payFailed)
      setPhase("held")
    } finally {
      busy.current = false
    }
  }

  const fraction = Number.isFinite(left) ? Math.max(0, Math.min(1, left / total)) : 1
  const urgent = Number.isFinite(left) && left < 10_000
  const spring = reduceMotion ? { duration: 0.1 } : { type: "spring" as const, stiffness: 420, damping: 32 }
  const amountText = money(current.amount)
  const buttonText =
    phase === "paid"
      ? fill(m.paid, { amount: amountText })
      : phase === "confirming"
        ? m.paying
        : fill(mustAccept ? m.accept : m.pay, { amount: amountText })
  const worseNote = direction === "pay" ? m.worseNote : m.worseNoteReceive

  return (
    <div
      data-slot="quote-lock"
      data-state={phase}
      data-needs-accept={mustAccept || undefined}
      className={cn("grid w-full min-w-0 max-w-sm gap-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)}
      {...props}
    >
      <div className="min-w-0">
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            <span className="sr-only">{amountText}</span>
            <NumberFlow
              aria-hidden
              value={current.amount}
              locales={locale}
              format={{ style: "currency", currency: current.currency }}
              animated={!reduceMotion}
            />
          </span>
          <AnimatePresence initial={false}>
            {change && (
              <motion.span
                key={`${current.id}-chip`}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                  change.worse
                    ? "bg-red-500/10 text-red-700 dark:text-red-400"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                )}
              >
                {change.delta > 0 ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
                {fill(change.delta > 0 ? m.up : m.down, {
                  delta: money(Math.abs(change.delta)),
                  percent: `${Math.abs(change.percent).toFixed(1)}%`,
                })}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {current.detail && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{current.detail}</p>}
      </div>

      {phase !== "paid" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
          <svg viewBox="0 0 20 20" className="size-4 -rotate-90">
            <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" className="stroke-muted" />
            <motion.circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={urgent ? "stroke-amber-500" : "stroke-emerald-500"}
              initial={false}
              animate={{ pathLength: phase === "requoting" ? 0 : fraction }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: "linear" }}
            />
          </svg>
          {phase === "requoting" ? (
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle className="size-3 animate-spin" />
              {m.refreshing}
            </span>
          ) : Number.isFinite(left) ? (
            <span className={cn("tabular-nums", urgent && "text-amber-700 dark:text-amber-400")}>
              {fill(m.heldFor, { time: formatHold(left) })}
            </span>
          ) : (
            <Lock className="size-3" />
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {(mustAccept || (change && !change.worse) || note || error) && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "grid gap-1 rounded-md px-3 py-2 text-xs",
                error || mustAccept ? "bg-amber-500/10 text-amber-900 dark:text-amber-200" : "bg-muted text-muted-foreground",
              )}
            >
              {error && <p role="alert">{error}</p>}
              {note && !error && <p>{note}</p>}
              {mustAccept && <p>{fill(worseNote, { old: money(change!.from) })}</p>}
              {change && !change.worse && !mustAccept && <p>{fill(m.betterNote, { old: money(change.from) })}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {phase !== "paid" && (error || !autoRequote) && (
          <button
            type="button"
            onClick={() => void requote()}
            disabled={phase !== "held"}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 dark:bg-input/30"
          >
            <RefreshCw aria-hidden className="size-4" />
            {error ? m.retry : m.refresh}
          </button>
        )}
        <motion.button
          type="button"
          layout={!reduceMotion}
          transition={spring}
          onClick={() => void primary()}
          aria-disabled={phase !== "held" || undefined}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-md px-4 text-sm font-medium whitespace-nowrap shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:opacity-70",
            phase === "paid"
              ? "bg-emerald-600 text-white"
              : mustAccept
                ? "bg-amber-500 text-amber-950 hover:bg-amber-400"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {phase === "confirming" && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {phase === "paid" && <Check aria-hidden className="size-4" />}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={buttonText}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
              transition={spring}
            >
              {buttonText}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
