"use client"

import * as React from "react"
import { ArrowRight, CalendarClock, Check, LoaderCircle, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface PlanInfo {
  name: string
  /** Price per billing interval, before tax. */
  price: number
  interval: "month" | "year"
}

export interface PlanLimit {
  /** e.g. "Seats", "Storage". */
  label: string
  /** What the account uses today. */
  used: number
  /** The limit on the new plan. */
  limit: number
  /** e.g. "GB". */
  unit?: string
  /** What happens to the excess, e.g. "Uploads pause; nothing is deleted". */
  effect: string
  /** True when the excess is removed or lost, so the change needs an explicit acknowledgement. */
  destructive?: boolean
}

export type PlanChangeTiming = "now" | "period-end"

const DAY = 86_400_000
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Same day next month or year, clamped to the month's end: 31 Jan + 1 month is 28 Feb, not 3 Mar. */
export function addBillingInterval(from: Date, interval: PlanInfo["interval"]) {
  const months = interval === "year" ? 12 : 1
  const target = new Date(from)
  target.setDate(1)
  target.setMonth(target.getMonth() + months)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(from.getDate(), lastDay))
  return target
}

/** Every user-visible string the props don't already cover, so the readback can be translated. */
export const PLAN_CHANGE_MESSAGES = {
  perInterval: (price: string, interval: PlanInfo["interval"]) => `${price}/${interval === "year" ? "yr" : "mo"}`,
  to: "to",
  timingGroup: "When the change happens",
  switchNow: "Switch now",
  onDate: (date: string) => `On ${date}`,
  unused: (plan: string, left: number, total: number) => `Unused ${plan} (${left} of ${total} days)`,
  firstInterval: (plan: string, interval: PlanInfo["interval"]) => `${plan}, first ${interval}`,
  forDays: (plan: string, days: number) => `${plan} for those ${days} days`,
  chargedToday: "Charged today",
  nextBill: (date: string) => `Next bill, ${date}`,
  fromWhen: (when: string | null, plan: string) => `${when ? `From ${when}` : "From today"}, on ${plan}`,
  gain: "Gain: ",
  lose: "Lose: ",
  overLimit: (label: string, used: string, plan: string, limit: string) => `${label}: you use ${used}, ${plan} allows ${limit}.`,
  payNow: (plan: string, amount: string) => `Switch to ${plan}, pay ${amount} today`,
  switchNowLabel: (plan: string) => `Switch to ${plan} now`,
  switchLater: (plan: string, date: string) => `Switch to ${plan} on ${date}`,
}
export type PlanChangeMessages = typeof PLAN_CHANGE_MESSAGES

/**
 * Prorates a plan change by day, the way most billing systems do: credit for the
 * unused part of the current plan, a charge for the new plan over the same days,
 * and anything negative carried to the next bill as credit (not refunded). A change
 * of interval (monthly to yearly) charges the new price today and restarts the cycle.
 */
export function prorate(current: PlanInfo, next: PlanInfo, periodStart: Date, periodEnd: Date, now: Date, timing: PlanChangeTiming) {
  const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY))
  const daysLeft = Math.min(totalDays, Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / DAY)))
  if (timing === "period-end") return { totalDays, daysLeft, credit: 0, charge: 0, today: 0, carry: 0, renewsOn: periodEnd, renewal: next.price, restarts: false }
  const credit = round2((current.price * daysLeft) / totalDays)
  const restarts = current.interval !== next.interval
  const charge = restarts ? next.price : round2((next.price * daysLeft) / totalDays)
  const net = round2(charge - credit)
  const carry = Math.max(0, -net)
  const renewsOn = restarts ? addBillingInterval(now, next.interval) : periodEnd
  return { totalDays, daysLeft, credit, charge, today: Math.max(0, net), carry, renewsOn, renewal: Math.max(0, round2(next.price - carry)), restarts }
}

export interface PlanChangeReadbackProps extends Omit<React.ComponentProps<"section">, "title"> {
  current: PlanInfo
  next: PlanInfo
  /** The current billing period. */
  periodStart: Date | string
  periodEnd: Date | string
  /** The moment of the change. Pass it for deterministic rendering; otherwise the clock is read after mount. */
  now?: Date | string
  /** Controlled timing. */
  timing?: PlanChangeTiming
  /** Initial timing. Defaults to now for upgrades and period end for downgrades, so paid-for features aren't cut short. */
  defaultTiming?: PlanChangeTiming
  onTimingChange?: (timing: PlanChangeTiming) => void
  /** Offer the now / period-end choice. */
  allowTimingChoice?: boolean
  /** Features the new plan doesn't have. */
  lose?: string[]
  /** Features the new plan adds. */
  gain?: string[]
  /** Limits the account already exceeds on the new plan. */
  limits?: PlanLimit[]
  currency?: string
  locale?: string
  timeZone?: string
  /** Makes the change. Return a promise to show a pending state; a rejection keeps the form. */
  onConfirm?: (timing: PlanChangeTiming) => void | Promise<void>
  carryText?: (amount: string, date: string) => string
  acknowledgeText?: (limit: PlanLimit, over: string) => string
  /** Override any other user-visible string (see `PLAN_CHANGE_MESSAGES`). */
  messages?: Partial<PlanChangeMessages>
}

/**
 * A plan-change readback that answers what people actually get wrong: what is
 * charged today, why (credit for unused days against the new plan's days), when
 * the next bill lands and for how much, that a downgrade credit goes to the next
 * bill rather than back to the card, which features and limits go, and what
 * happens to data already over the new limit. Losing data needs a tick first.
 */
export function PlanChangeReadback({
  current,
  next,
  periodStart,
  periodEnd,
  now,
  timing,
  defaultTiming,
  onTimingChange,
  allowTimingChoice = true,
  lose = [],
  gain = [],
  limits = [],
  currency = "INR",
  locale = "en-IN",
  timeZone,
  onConfirm,
  carryText = (amount, date) => `${amount} becomes credit on your bills from ${date}. It isn't refunded to your card.`,
  acknowledgeText = (limit, over) => `I understand what happens to the ${over} over the ${limit.label.toLowerCase()} limit`,
  messages,
  className,
  ...props
}: PlanChangeReadbackProps) {
  const say = { ...PLAN_CHANGE_MESSAGES, ...messages }
  const upgrade = next.price / (next.interval === "year" ? 12 : 1) > current.price / (current.interval === "year" ? 12 : 1)
  const [innerTiming, setInnerTiming] = React.useState<PlanChangeTiming>(defaultTiming ?? (upgrade ? "now" : "period-end"))
  const [clock, setClock] = React.useState<Date>()
  const [acked, setAcked] = React.useState<Record<string, boolean>>({})
  const [pending, setPending] = React.useState(false)
  React.useEffect(() => setClock(new Date()), [])
  const id = React.useId()
  const when = timing ?? innerTiming
  const today = now ? new Date(now) : clock
  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
  const date = (d: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone }).format(d)
  const per = (p: PlanInfo) => say.perInterval(money(p.price), p.interval)
  const amount = (n: number, unit?: string) => `${new Intl.NumberFormat(locale).format(n)}${unit ? ` ${unit}` : ""}`
  const over = limits.filter((l) => l.used > l.limit)
  const mustAck = over.filter((l) => l.destructive && !acked[l.label])

  const choose = (t: PlanChangeTiming) => {
    if (timing === undefined) setInnerTiming(t)
    onTimingChange?.(t)
  }
  const confirm = async () => {
    if (!onConfirm || pending || mustAck.length) return
    setPending(true)
    try {
      await onConfirm(when)
    } catch {
      // The caller reports the error; nothing changed.
    } finally {
      setPending(false)
    }
  }

  const p = today ? prorate(current, next, start, end, today, when) : null
  const row = "flex justify-between gap-3"
  const flash = "rounded-sm px-1 motion-safe:animate-[cui-plan-change-readback-flash_400ms_ease-out]"

  return (
    <section data-slot="plan-change-readback" aria-labelledby={`${id}-title`} className={cn("w-full min-w-0 max-w-sm space-y-4 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-plan-change-readback-flash{from{background-color:color-mix(in oklab,var(--color-amber-400) 45%,transparent)}}"}</style>
      <h3 id={`${id}-title`} className="flex flex-wrap items-center gap-x-2 font-medium">
        {current.name} <span className="font-normal text-muted-foreground">{per(current)}</span>
        <ArrowRight aria-label={say.to} className="size-4 text-muted-foreground" />
        {next.name} <span className="font-normal text-muted-foreground">{per(next)}</span>
      </h3>

      {allowTimingChoice && (
        <div role="radiogroup" aria-label={say.timingGroup} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs">
          {(["now", "period-end"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={when === t} onClick={() => choose(t)} className="rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs">
              {t === "now" ? say.switchNow : say.onDate(date(end))}
            </button>
          ))}
        </div>
      )}

      <dl className="space-y-1">
        {p && when === "now" && (
          <>
            <div className={cn(row, "text-muted-foreground")}>
              <dt>{say.unused(current.name, p.daysLeft, p.totalDays)}</dt>
              <dd className="shrink-0 tabular-nums text-emerald-700 dark:text-emerald-400">−{money(p.credit)}</dd>
            </div>
            <div className={cn(row, "text-muted-foreground")}>
              <dt>{p.restarts ? say.firstInterval(next.name, next.interval) : say.forDays(next.name, p.daysLeft)}</dt>
              <dd className="shrink-0 tabular-nums">+{money(p.charge)}</dd>
            </div>
          </>
        )}
        <div className={cn(row, "text-base font-medium")}>
          <dt>{say.chargedToday}</dt>
          <dd key={`${when}-${p?.today}`} className={cn("tabular-nums", flash)}>{p ? money(p.today) : "…"}</dd>
        </div>
        <div className={cn(row, "text-muted-foreground")}>
          <dt>{p ? say.nextBill(date(p.renewsOn)) : say.nextBill("…")}</dt>
          <dd key={`${when}-${p?.renewal}`} className={cn("tabular-nums", flash)}>{p ? money(p.renewal) : "…"}</dd>
        </div>
      </dl>

      {p && p.carry > 0 && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <CalendarClock aria-hidden className="size-3.5 shrink-0" /> {carryText(money(p.carry), date(p.renewsOn))}
        </p>
      )}

      {(lose.length > 0 || gain.length > 0) && (
        <div className="space-y-1 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{say.fromWhen(when === "now" ? null : date(end), next.name)}</p>
          <ul className="space-y-0.5">
            {gain.map((f) => (
              <li key={f} className="flex gap-1.5"><Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> <span><span className="sr-only">{say.gain}</span>{f}</span></li>
            ))}
            {lose.map((f) => (
              <li key={f} className="flex gap-1.5"><X aria-hidden className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" /> <span><span className="sr-only">{say.lose}</span>{f}</span></li>
            ))}
          </ul>
        </div>
      )}

      {over.map((l) => {
        const excess = amount(round2(l.used - l.limit), l.unit)
        return (
          <div key={l.label} className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50">
            <p className="flex gap-2">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {say.overLimit(l.label, amount(l.used, l.unit), next.name, amount(l.limit, l.unit))} {l.effect}
              </span>
            </p>
            <div aria-hidden className="ml-6 flex h-1.5 overflow-hidden rounded-full bg-amber-200 dark:bg-amber-900">
              <div className="bg-amber-600 dark:bg-amber-400" style={{ width: `${(l.limit / l.used) * 100}%` }} />
              <div className="flex-1 bg-[repeating-linear-gradient(135deg,var(--color-red-500)_0_3px,transparent_3px_6px)]" />
            </div>
            {l.destructive && (
              <label className="ml-6 flex gap-2 text-xs">
                <input type="checkbox" checked={!!acked[l.label]} onChange={(e) => setAcked((a) => ({ ...a, [l.label]: e.target.checked }))} className="mt-0.5 size-3.5 accent-amber-600" />
                {acknowledgeText(l, excess)}
              </label>
            )}
          </div>
        )
      })}

      {onConfirm && (
        <button
          type="button"
          disabled={mustAck.length > 0 || !p}
          aria-busy={pending || undefined}
          onClick={() => void confirm()}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {!p ? "…" : when === "now" ? (p.today > 0 ? say.payNow(next.name, money(p.today)) : say.switchNowLabel(next.name)) : say.switchLater(next.name, date(end))}
        </button>
      )}
    </section>
  )
}
