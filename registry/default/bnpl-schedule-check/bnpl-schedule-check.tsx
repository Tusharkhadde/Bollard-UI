"use client"

import * as React from "react"
import { addDays, differenceInCalendarDays, startOfWeek } from "date-fns"
import { CalendarClock, CircleCheck, CreditCard, Info, Landmark, LoaderCircle, TriangleAlert } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { cardLastDay, checkSchedule, dayKey, lateFeeCap, parseDay, type BnplCard, type BnplInstalment, type BnplLateFee, type BnplPlan, type BnplProblem, type BnplSource, type BnplValue } from "./bnpl"

export { cardLastDay, checkSchedule, lateFeeCap, parseDay, payInN, paydaysEvery } from "./bnpl"
export type { BnplCard, BnplCheckOptions, BnplClash, BnplInstalment, BnplLateFee, BnplPlan, BnplProblem, BnplSource, BnplValue } from "./bnpl"

/** Every visible string. Placeholders in braces are filled in; "one|other" picks by {count}. */
export const BNPL_SCHEDULE_CHECK_MESSAGES = {
  heading: "{count} payment|{count} payments",
  payments: "Payments",
  payment: "Payment {n}",
  today: "today",
  thisPlan: "This plan",
  otherPlans: "Other plans",
  payday: "Payday",
  cardDead: "Card expired",
  cardExpires: "{card} expires at the end of {month}. Payment {list} comes after that, so it would fail and could cost up to {fees} in late fees.|{card} expires at the end of {month}. Payments {list} come after that, so they would fail and could cost up to {fees} in late fees.",
  cardExpiresNoFee: "{card} expires at the end of {month}. Payment {list} comes after that, so it would fail.|{card} expires at the end of {month}. Payments {list} come after that, so they would fail.",
  payFromBank: "Pay from {bank}",
  updateCard: "Update card",
  beforePayday: "{count} day before payday|{count} days before payday",
  moveTo: "Move to {date}",
  moveAll: "Move {count} payment to payday|Move {count} payments to payday",
  stacked: "{plans} plans would run at once. Around {date}: {total} due ({names}).",
  lateFee: "Late fee {per} per missed payment, at most {max} on this order.",
  lateFeeNoCap: "Late fee {per} per missed payment.",
  source: "Pay with",
  allClear: "No payment falls just before payday or after the card expires.",
  confirm: "Confirm {count} × {amount}",
  confirmMixed: "Confirm plan · {amount}",
  confirmAnyway: "Card expires first. Confirm anyway",
  confirming: "Confirming…",
  moved: "Payment {n} moved to {date}.",
  movedAll: "Payments moved to payday.",
  switched: "Paying from {bank} now.",
  failed: "That didn't go through. Nothing was confirmed.",
}

export type BnplScheduleCheckMessages = typeof BNPL_SCHEDULE_CHECK_MESSAGES

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
  "inline-flex min-h-6 max-w-full items-center py-0.5 text-left gap-1 rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface BnplScheduleCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** The plan being offered, payment by payment. `payInN()` builds a pay-in-4. */
  instalments: BnplInstalment[]
  /** ISO currency code for every amount. */
  currency: string
  /** Plans already running, drawn on the same calendar. */
  others?: BnplPlan[]
  /** Paydays, "YYYY-MM-DD". `paydaysEvery()` builds a fortnightly list. */
  paydays?: string[]
  /** The card on file. Leave out to pay from the bank only. */
  card?: BnplCard | null
  /** Name of the bank-account option. */
  bankLabel?: string
  /** The provider's late-fee rule, shown in money with its cap. */
  lateFee?: BnplLateFee
  /** Controlled source and dates. */
  value?: BnplValue
  /** Initial source and dates when uncontrolled. Defaults to the card (if any) and the plan's dates. */
  defaultValue?: BnplValue
  onValueChange?: (value: BnplValue) => void
  /** Offer "Update card" next to the expiry warning. */
  onUpdateCard?: () => void
  /** Called with the final schedule. May return a Promise; the button shows a pending state. */
  onConfirm?: (value: BnplValue) => void | Promise<unknown>
  /** Flag payments this many days or fewer before payday. Default 3. */
  payGapDays?: number
  /** Furthest a payment may be moved later. Default 7. */
  maxShiftDays?: number
  /** The first payment is taken at checkout: it is labelled "today" and never offered a move. Default true. */
  firstPaidNow?: boolean
  /** First weekday of the calendar: 0 Sunday, 1 Monday. Default 1. */
  weekStartsOn?: 0 | 1
  locale?: string
  messages?: Partial<BnplScheduleCheckMessages>
}

/**
 * Stops a pay-later plan that quietly fails. Each payment is drawn on a calendar beside other running plans
 * and paydays, so a card that expires before payment 4, a payment due the day before payday and three plans
 * landing in the same week are visible before the user agrees. One tap pays from the bank or moves payments
 * to payday (the dots slide across), the late fee is shown in money with its cap, and confirming while the
 * card problem stands takes a second press.
 */
export function BnplScheduleCheck({
  instalments,
  currency,
  others = [],
  paydays = [],
  card,
  bankLabel = "bank account",
  lateFee,
  value: valueProp,
  defaultValue,
  onValueChange,
  onUpdateCard,
  onConfirm,
  payGapDays,
  maxShiftDays,
  firstPaidNow = true,
  weekStartsOn = 1,
  locale,
  messages,
  className,
  ...props
}: BnplScheduleCheckProps) {
  const t = { ...BNPL_SCHEDULE_CHECK_MESSAGES, ...messages }
  const plan = Array.isArray(instalments) ? instalments.slice(0, 60) : []
  const [inner, setInner] = React.useState<BnplValue>(() => defaultValue ?? { source: card ? "card" : "bank", dates: plan.map((p) => p.date) })
  const value = valueProp ?? inner
  const dates = plan.map((p, i) => value.dates?.[i] ?? p.date)
  const [armed, setArmed] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const reduce = useReducedMotion()
  const shake = useAnimationControls()

  const problems = checkSchedule(plan, value, { others, paydays, card, payGapDays, maxShiftDays, firstPaidNow })
  const cardIssue = problems.find((p): p is Extract<BnplProblem, { kind: "cardExpires" }> => p.kind === "cardExpires")
  const payday = problems.filter((p): p is Extract<BnplProblem, { kind: "beforePayday" }> => p.kind === "beforePayday")
  const stacked = problems.find((p): p is Extract<BnplProblem, { kind: "stacked" }> => p.kind === "stacked")
  const total = plan.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const fee = lateFeeCap(total, lateFee)

  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
    } catch {
      return `${n} ${currency}`
    }
  }
  const dayText = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => {
    const d = parseDay(key)
    return d ? new Intl.DateTimeFormat(locale, opts).format(d) : key
  }

  const vkey = `${value.source}|${dates.join(",")}`
  React.useEffect(() => setArmed(false), [vkey])

  /** Apply a change, announce it and put focus on the next fix (or the confirm button). */
  const change = (next: BnplValue, say: string) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
    setStatus(say)
    // Work out the next fix from the new value: a banner that is animating out must not take focus.
    const left = checkSchedule(plan, next, { others, paydays, card, payGapDays, maxShiftDays, firstPaidNow })
    const target = left.some((p) => p.kind === "cardExpires") ? "card" : left.some((p) => p.kind === "beforePayday" && p.canMove) ? "move" : null
    requestAnimationFrame(() => {
      const root = rootRef.current
      ;((target && root?.querySelector<HTMLElement>(`[data-fix="${target}"]`)) || root?.querySelector<HTMLElement>("[data-confirm]") || root?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]'))?.focus()
    })
  }
  const move = (moves: { index: number; payday: string }[]) => {
    const next = [...dates]
    moves.forEach((m) => (next[m.index] = m.payday))
    change({ ...value, dates: next }, moves.length === 1 ? fill(t.moved, { n: moves[0].index + 1, date: dayText(moves[0].payday) }) : t.movedAll)
  }
  const setSource = (source: BnplSource) => change({ ...value, source }, source === "bank" ? fill(t.switched, { bank: bankLabel }) : "")

  const confirm = async () => {
    if (pending) return
    if (cardIssue && !armed) {
      setArmed(true)
      if (!reduce) shake.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.35 } })
      return
    }
    setPending(true)
    try {
      await onConfirm?.(value)
    } catch {
      setStatus(t.failed)
    } finally {
      setPending(false)
      setArmed(false)
    }
  }

  // Calendar: only weeks that hold something, with the empty stretches between them folded away.
  const planDays = dates.map(parseDay).filter((d): d is Date => !!d)
  const first = planDays.length ? new Date(Math.min(...planDays.map(Number))) : null
  const last = planDays.length ? new Date(Math.max(...planDays.map(Number))) : null
  const inSpan = (d: Date | null) => !!d && !!first && !!last && d >= addDays(first, -3) && d <= addDays(last, 7)
  const lastCardDay = card && value.source === "card" ? cardLastDay(card.expires) : null
  const otherByDay = new Map<string, number>()
  others.forEach((o) => o?.instalments?.forEach((p) => { const d = parseDay(p.date); if (inSpan(d)) otherByDay.set(p.date, (otherByDay.get(p.date) ?? 0) + 1) }))
  const paySet = new Set(paydays.filter((p) => inSpan(parseDay(p))))
  const eventDays = [...planDays, ...[...otherByDay.keys(), ...paySet].map(parseDay).filter((d): d is Date => !!d)]
  const busy = [...new Set(eventDays.map((d) => dayKey(startOfWeek(d, { weekStartsOn }))))].sort().map((k) => parseDay(k)!)
  // Fill short gaps so it reads as a calendar; fold only stretches of 3+ empty weeks.
  const weeks = busy.flatMap((w, i) => {
    const gap = i > 0 ? differenceInCalendarDays(w, busy[i - 1]) / 7 - 1 : 0
    return [...(gap > 0 && gap < 3 ? Array.from({ length: gap }, (_, g) => addDays(busy[i - 1], 7 * (g + 1))) : []), w]
  })
  const mine = new Map<string, number[]>()
  dates.forEach((d, i) => mine.set(d, [...(mine.get(d) ?? []), i]))
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" })

  const lineFor = (i: number) => payday.find((p) => p.index === i)
  const movable = payday.filter((p) => p.canMove)
  const issue = (i: number) => !!cardIssue?.indexes.includes(i)
  const amounts = new Set(plan.map((p) => p.amount))
  const ok = !cardIssue && payday.length === 0 && plan.length > 0

  return (
    <div ref={rootRef} data-slot="bnpl-schedule-check" className={cn("w-full min-w-0 max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">{fill(t.heading, { count: plan.length })}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{money(total)}</span>
      </div>

      {weeks.length > 0 && (
        <div aria-hidden className="space-y-1">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {Array.from({ length: 7 }, (_, i) => <span key={i}>{weekdayFmt.format(addDays(weeks[0], i))}</span>)}
          </div>
          {weeks.map((w, wi) => (
            <React.Fragment key={dayKey(w)}>
              {wi > 0 && differenceInCalendarDays(w, weeks[wi - 1]) > 7 && <div className="h-px border-t border-dashed" />}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }, (_, di) => {
                  const d = addDays(w, di)
                  const k = dayKey(d)
                  const dead = !!lastCardDay && d > lastCardDay
                  const showMonth = d.getDate() === 1 || (di === 0 && (wi === 0 || addDays(w, -1).getMonth() !== d.getMonth() || differenceInCalendarDays(w, weeks[wi - 1]) > 7))
                  return (
                    <div key={k} className={cn("relative flex h-11 flex-col items-center rounded-md border border-transparent pt-0.5 text-[10px] text-muted-foreground", dead && "bg-[repeating-linear-gradient(135deg,theme(colors.red.500/.12)_0_4px,transparent_4px_8px)]", inSpan(d) && "bg-muted/50")}>
                      <span className={cn("tabular-nums leading-none", showMonth && "font-medium text-foreground")}>{showMonth ? dayText(k, { day: "numeric", month: "short" }) : d.getDate()}</span>
                      <div className="mt-0.5 flex h-5 items-center gap-0.5">
                        {(mine.get(k) ?? []).map((i) => (
                          <motion.span
                            key={i}
                            layoutId={`${id}-p${i}`}
                            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
                            className={cn("grid size-5 place-items-center rounded-full text-[10px] font-semibold", issue(i) ? "bg-red-600 text-white" : lineFor(i) ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground")}
                          >
                            {i + 1}
                          </motion.span>
                        ))}
                        {Array.from({ length: Math.min(3, otherByDay.get(k) ?? 0) }, (_, j) => <span key={j} className="size-1.5 rounded-full bg-muted-foreground/60" />)}
                      </div>
                      {paySet.has(k) && <span className="absolute inset-x-1 bottom-0.5 h-1 rounded-full bg-emerald-500" />}
                    </div>
                  )
                })}
              </div>
            </React.Fragment>
          ))}
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary" />{t.thisPlan}</span>
            {otherByDay.size > 0 && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-muted-foreground/60" />{t.otherPlans}</span>}
            {paySet.size > 0 && <span className="inline-flex items-center gap-1"><span className="h-1 w-3 rounded-full bg-emerald-500" />{t.payday}</span>}
            {lastCardDay && <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-red-500/30" />{t.cardDead}</span>}
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {cardIssue && card && (
          <motion.div key="card" role="alert" initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-800 dark:text-red-300">
              <CreditCard aria-hidden className="size-4 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 flex-1 basis-40">
                {fill(fee.per > 0 ? t.cardExpires : t.cardExpiresNoFee, { count: cardIssue.indexes.length, card: card.label, month: dayText(cardIssue.expiresOn, { month: "long", year: "numeric" }), list: cardIssue.indexes.map((i) => i + 1).join(", "), fees: money(Math.min(fee.max, fee.per * cardIssue.indexes.length)) })}
              </span>
              <button type="button" data-fix="card" onClick={() => setSource("bank")} className={fixClass}>
                <Landmark aria-hidden className="size-3" />
                {fill(t.payFromBank, { bank: bankLabel })}
              </button>
              {onUpdateCard && <button type="button" onClick={onUpdateCard} className={fixClass}>{t.updateCard}</button>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">{t.payments}</h4>
          {movable.length > 1 && (
            <button type="button" data-fix="move" onClick={() => move(movable)} className={fixClass}>
              <CalendarClock aria-hidden className="size-3" />
              {fill(t.moveAll, { count: movable.length })}
            </button>
          )}
        </div>
        <ol className="mt-1.5 divide-y rounded-lg border">
          {plan.map((p, i) => {
            const pd = lineFor(i)
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
                <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold", issue(i) ? "bg-red-600 text-white" : pd ? "bg-amber-500 text-white" : "bg-muted text-foreground")}>{i + 1}</span>
                <span className="sr-only">{fill(t.payment, { n: i + 1 })}</span>
                <span className="min-w-0 flex-1">
                  {dayText(dates[i])}
                  {i === 0 && firstPaidNow && <span className="text-muted-foreground"> · {t.today}</span>}
                  {issue(i) && <span className="text-red-700 dark:text-red-400"> · {t.cardDead.toLowerCase()}</span>}
                  {pd && <span className="text-amber-800 dark:text-amber-300"> · {fill(t.beforePayday, { count: pd.days })}</span>}
                </span>
                {pd?.canMove && movable.length === 1 && (
                  <button type="button" data-fix="move" onClick={() => move([pd])} className={fixClass}>{fill(t.moveTo, { date: dayText(pd.payday, { weekday: "short", day: "numeric" }) })}</button>
                )}
                <span className="font-medium tabular-nums">{money(Number(p.amount) || 0)}</span>
              </li>
            )
          })}
        </ol>
      </div>

      {stacked && (
        <p className="flex gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{fill(t.stacked, { plans: stacked.plans, date: dayText(dates[stacked.worst.index], { day: "numeric", month: "short" }), total: money(stacked.worst.total), names: [...new Set(stacked.worst.others.map((o) => o.name))].join(", ") })}</span>
        </p>
      )}
      {lateFee && fee.per > 0 && (
        <p className="text-xs text-muted-foreground">{Number.isFinite(fee.max) ? fill(t.lateFee, { per: money(fee.per), max: money(fee.max) }) : fill(t.lateFeeNoCap, { per: money(fee.per) })}</p>
      )}

      {card && (
        <div role="radiogroup" aria-label={t.source} onKeyDown={(e) => radioKeys(e, ["card", "bank"] as const, value.source, (s) => value.source !== s && setSource(s))} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs">
          {(["card", "bank"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={value.source === s} tabIndex={value.source === s ? 0 : -1} onClick={() => value.source !== s && setSource(s)} className="relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:text-foreground">
              {value.source === s && <motion.span layoutId={`${id}-src`} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-md bg-background shadow-xs" />}
              {s === "card" ? <CreditCard aria-hidden className="relative size-3.5 shrink-0" /> : <Landmark aria-hidden className="relative size-3.5 shrink-0" />}
              <span className={cn("relative min-w-0 text-left leading-tight", s === "card" ? "whitespace-nowrap" : "break-words")}>{s === "card" ? card.label : bankLabel.charAt(0).toUpperCase() + bankLabel.slice(1)}</span>
            </button>
          ))}
        </div>
      )}

      {ok && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CircleCheck aria-hidden className="size-3.5 shrink-0" />
          {t.allClear}
        </p>
      )}

      {onConfirm && (
        <motion.button
          type="button"
          data-confirm
          animate={shake}
          onClick={confirm}
          disabled={pending || plan.length === 0}
          aria-busy={pending || undefined}
          className={cn("inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60", armed ? "bg-destructive text-white" : "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : armed ? <TriangleAlert aria-hidden className="size-4" /> : null}
          {pending ? t.confirming : armed ? t.confirmAnyway : amounts.size === 1 ? fill(t.confirm, { count: plan.length, amount: money(plan[0]?.amount ?? 0) }) : fill(t.confirmMixed, { amount: money(total) })}
        </motion.button>
      )}
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}
