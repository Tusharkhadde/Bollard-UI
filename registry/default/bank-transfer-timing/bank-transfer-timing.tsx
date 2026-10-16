"use client"

import * as React from "react"
import { CalendarClock, Clock, Info, Loader2, TriangleAlert, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { amountToWords } from "@/registry/default/amount-in-words/words"
import { checkTransfer, istParts, RAIL_RULES, RAILS, UPI_LIMITS, type NewPayeeRule, type Rail, type TransferIssue, type TransferInput, type UpiCategory } from "./transfer"

export { checkTransfer, isBankHoliday, istParts, nextNeftBatch, RAIL_RULES, RAILS, UPI_LIMITS, type Arrival, type NewPayeeRule, type Rail, type TransferInput, type TransferIssue, type UpiCategory } from "./transfer"

/** Every visible string. `{amount}`, `{max}`, `{min}`, `{time}`, `{day}`, `{minutes}`, `{rail}` and `{payee}` are filled in. */
export const BANK_TRANSFER_MESSAGES = {
  sending: "You're sending",
  to: "to {payee}",
  railLabel: "How to send it",
  rails: {
    IMPS: { name: "IMPS", hint: "Instant · up to {max}" },
    NEFT: { name: "NEFT", hint: "Half-hourly batches · no limit" },
    RTGS: { name: "RTGS", hint: "Real time · from {min}" },
    UPI: { name: "UPI", hint: "Instant · up to {max}" },
  } as Record<Rail, { name: string; hint: string }>,
  arrives: "When it arrives",
  instant: "In their account within seconds, any day, any time.",
  realtime: "In their account within 30 minutes, by {time}.",
  batch: "Leaves in the {time} batch{day}. In their account by {by} at the latest.",
  /** RBI's 48th batch settles at 00:00, so "00:00 tomorrow" reads a day late. */
  batchMidnight: "Leaves in the midnight (00:00) batch tonight. In their account by {by} at the latest.",
  branchClosed: "Your branch is closed, so it leaves {day} at {time}.",
  tomorrow: " tomorrow",
  issues: {
    "rtgs-min": "RTGS only takes {min} or more. Your bank will refuse {amount}.",
    "imps-max": "IMPS stops at {max} per transfer.",
    "upi-max": "UPI {category} payments stop at {max}.",
    "bank-limit": "Your bank allows up to {max} a day by {rail}.",
    cooling: "{payee} was added recently. You can send from {time} ({minutes} min).",
    "first-day": "Until {day} {time}, a new payee can get at most {max}.",
    "neft-large": "For this much, RTGS lands within 30 minutes instead of waiting for a batch.",
    holiday: "Today is a bank holiday. IMPS, UPI, NEFT and RTGS still run, but a few banks credit some transfers on the next working day.",
  } as Record<TransferIssue["kind"], string>,
  categories: { p2p: "to a person", merchant: "to a shop", tax: "tax", "capital-markets": "investment", insurance: "insurance", travel: "travel", "credit-card": "credit card", collections: "loan and EMI", jewellery: "jewellery" } as Record<UpiCategory, string>,
  use: "Use {rail}",
  continue: "Send {amount} by {rail}",
  done: "Sent by {rail}",
  payeeFallback: "This payee",
}

export type BankTransferMessages = typeof BANK_TRANSFER_MESSAGES

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m))
const fixClass = "inline-flex h-6 shrink-0 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface BankTransferTimingProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  /** Amount in rupees. */
  amount: number
  /** Controlled rail. */
  rail?: Rail
  /** Initial rail when uncontrolled. Defaults to IMPS. */
  defaultRail?: Rail
  onRailChange?: (rail: Rail) => void
  /** Rails your app offers, in display order. */
  rails?: Rail[]
  /** Payee's name, shown in the readback. */
  payee?: string
  /** "Now", for tests and server-rendered previews. Otherwise the clock is read after mount and every 30 s. */
  now?: Date
  upiCategory?: UpiCategory
  upiLimits?: TransferInput["upiLimits"]
  /** Your bank's per-day limit for each rail, if lower than the network's. */
  bankLimits?: TransferInput["bankLimits"]
  /** Your bank's cooling period and first-day cap for a newly added payee. */
  newPayee?: NewPayeeRule
  /** Bank holidays (YYYY-MM-DD, India time). Sundays and 2nd/4th Saturdays are built in. */
  holidays?: string[]
  /** `branch` NEFT and RTGS only leave in branch hours on working days. */
  channel?: "online" | "branch"
  branchHours?: TransferInput["branchHours"]
  /** Continue to authorisation. Not reachable while a limit would make the bank refuse. May return a Promise. */
  onContinue?: (transfer: { amount: number; rail: Rail }) => void | Promise<void>
  locale?: string
  /** Any visible string. */
  messages?: Partial<Omit<BankTransferMessages, "rails" | "issues" | "categories">> & {
    rails?: Partial<BankTransferMessages["rails"]>
    issues?: Partial<BankTransferMessages["issues"]>
    categories?: Partial<BankTransferMessages["categories"]>
  }
}

/**
 * Before an Indian bank transfer, says when the money will actually land (seconds, the next NEFT batch
 * and its 2-hour credit window, RTGS within 30 minutes) and catches the rail that will be refused: RTGS
 * under ₹2 lakh, IMPS over ₹5 lakh, UPI over its category cap, a bank's own daily limit, a new payee's
 * cooling period and first-day cap. Each catch offers the rail that works, and the amount is spelled out.
 */
export function BankTransferTiming({
  amount, rail, defaultRail = "IMPS", onRailChange, rails = RAILS, payee, now, upiCategory = "p2p", upiLimits, bankLimits,
  newPayee, holidays, channel = "online", branchHours, onContinue, locale = "en-IN", messages, className, ...props
}: BankTransferTimingProps) {
  const t: BankTransferMessages = {
    ...BANK_TRANSFER_MESSAGES, ...messages,
    rails: { ...BANK_TRANSFER_MESSAGES.rails, ...messages?.rails },
    issues: { ...BANK_TRANSFER_MESSAGES.issues, ...messages?.issues },
    categories: { ...BANK_TRANSFER_MESSAGES.categories, ...messages?.categories },
  }
  const offered = (Array.isArray(rails) && rails.length ? rails : RAILS).filter((r) => RAILS.includes(r))
  const [inner, setInner] = React.useState<Rail>(defaultRail)
  const current = rail ?? inner
  const fixedNow = now instanceof Date && Number.isFinite(now.getTime()) ? now : undefined
  const [clock, setClock] = React.useState<Date | undefined>(fixedNow)
  const [pending, setPending] = React.useState(false)
  const [done, setDone] = React.useState<string>()
  const [status, setStatus] = React.useState("")
  const [spoken, setSpoken] = React.useState("")
  const groupRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const value = Number.isFinite(Number(amount)) ? Math.max(0, Math.min(Number(amount), 1e12)) : 0
  const key = `${value}|${current}`
  const latest = React.useRef(key)
  latest.current = key

  // An invalid `now` falls back to the live clock instead of throwing in Intl.DateTimeFormat.
  const fixedTime = fixedNow?.getTime()
  React.useEffect(() => {
    if (fixedTime !== undefined) return setClock(new Date(fixedTime))
    setClock(new Date())
    const timer = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(timer)
  }, [fixedTime])

  React.useEffect(() => {
    const timer = setTimeout(() => setSpoken(status), 500)
    return () => clearTimeout(timer)
  }, [status])

  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
  const time = (d: Date) => new Intl.DateTimeFormat(locale, { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d)
  const day = (d: Date) => new Intl.DateTimeFormat(locale, { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(d)
  const result = clock ? checkTransfer({ amount: value, rail: current, now: clock, upiCategory, upiLimits, bankLimits, newPayee, holidays, channel, branchHours }) : undefined
  const issues = result?.issues ?? []
  const blocked = issues.some((i) => i.level === "block")
  const upiMax = ({ ...UPI_LIMITS, ...upiLimits }[upiCategory] ?? UPI_LIMITS.p2p).perTxn
  const payeeName = payee?.trim() || t.payeeFallback

  // Say the first blocking problem once it settles, not on every change.
  const firstBlock = issues.find((i) => i.level === "block")
  const blockText = firstBlock ? describe(firstBlock) : ""
  React.useEffect(() => {
    if (blockText) setStatus(blockText)
  }, [blockText])

  const choose = (next: Rail, focus = false) => {
    if (rail === undefined) setInner(next)
    onRailChange?.(next)
    setDone(undefined)
    if (focus) {
      setStatus(fill(t.use, { rail: t.rails[next].name }))
      requestAnimationFrame(() => groupRef.current?.querySelector<HTMLElement>(`[data-rail="${next}"]`)?.focus())
    }
  }

  const onKey = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = offered[(offered.indexOf(current) + step + offered.length) % offered.length]
    choose(next)
    groupRef.current?.querySelector<HTMLElement>(`[data-rail="${next}"]`)?.focus()
  }

  const send = async () => {
    if (!onContinue || pending || blocked || value <= 0) return
    const at = key
    setPending(true)
    try {
      await onContinue({ amount: value, rail: current })
      if (latest.current === at) { setDone(at); setStatus(fill(t.done, { rail: t.rails[current].name })) }
    } catch {
      // The caller reports failures; the button works again.
    } finally {
      setPending(false)
    }
  }

  function describe(issue: TransferIssue) {
    const values: Record<string, string | number> = { amount: money(value), rail: t.rails[current].name, payee: payeeName }
    if ("max" in issue) values.max = money(issue.max)
    if ("min" in issue) values.min = money(issue.min)
    if ("category" in issue) values.category = t.categories[issue.category]
    if ("until" in issue) { values.time = time(issue.until); values.day = day(issue.until) }
    if ("minutes" in issue) values.minutes = issue.minutes
    return fill(t.issues[issue.kind], values)
  }

  const arrivalText = () => {
    const a = result?.arrival
    if (!a || !clock) return ""
    if (a.kind === "instant") return t.instant
    const at = (d: Date) => (day(d) !== day(clock) ? `${day(d)} ${time(d)}` : time(d))
    if (a.kind === "realtime") return fill(t.realtime, { time: at(a.by) })
    if (a.kind === "branch-closed") return fill(t.branchClosed, { day: day(a.leaves), time: time(a.leaves) })
    if (istParts(a.batch).minutes === 0) return fill(t.batchMidnight, { by: at(a.by) })
    const nextDay = day(a.batch) !== day(clock)
    return fill(t.batch, { time: time(a.batch), day: nextDay ? t.tomorrow : "", by: at(a.by) })
  }

  return (
    <div data-slot="bank-transfer-timing" data-state={blocked ? "blocked" : issues.length ? "info" : "ok"} className={cn("w-full max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      <div>
        <p className="text-xs text-muted-foreground">{t.sending}</p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-semibold tabular-nums">{money(value)}</span>
          {payee && <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">{fill(t.to, { payee: payeeName })}</span>}
        </p>
        {value > 0 && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{amountToWords(Math.round(value * 100), "INR", "indian")}</p>}
      </div>

      <div>
        <p id={`${id}-rail`} className="mb-1.5 text-sm font-medium">{t.railLabel}</p>
        <div ref={groupRef} role="radiogroup" aria-labelledby={`${id}-rail`} onKeyDown={onKey} className="grid grid-cols-2 gap-2">
          {offered.map((r) => {
            const hint = fill(t.rails[r].hint, { max: money(r === "UPI" ? upiMax : RAIL_RULES.impsMax), min: money(RAIL_RULES.rtgsMin) })
            return (
              <button
                key={r} type="button" role="radio" data-rail={r} aria-checked={current === r} tabIndex={current === r ? 0 : -1} onClick={() => choose(r)}
                className="min-w-0 rounded-md border px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-foreground aria-checked:bg-accent"
              >
                <span className="block font-medium">{t.rails[r].name}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className={cn("flex gap-2 rounded-md border p-3", blocked ? "border-dashed text-muted-foreground" : "bg-muted/40")}>
        {current === "NEFT" || result?.arrival.kind === "branch-closed" ? <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" /> : current === "RTGS" ? <Clock aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Zap aria-hidden className="mt-0.5 size-4 shrink-0" />}
        <div className="min-w-0">
          <p className="text-xs font-medium">{t.arrives}</p>
          <p className={cn("min-h-5", blocked && "line-through decoration-1")}>{arrivalText()}</p>
        </div>
      </div>

      {issues.length > 0 && (
        <ul id={`${id}-issues`} className="space-y-1.5 text-xs">
          {issues.map((issue) => (
            <li key={issue.kind} className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", issue.level === "block" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
              <span className="flex min-w-48 flex-1 gap-1.5">
                {issue.level === "block" ? <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" /> : <Info aria-hidden className="mt-px size-3.5 shrink-0" />}
                <span className="min-w-0">{describe(issue)}</span>
              </span>
              {"suggest" in issue && issue.suggest.filter((r) => offered.includes(r)).slice(0, 2).map((r) => (
                <button key={r} type="button" className={fixClass} onClick={() => choose(r, true)}>{fill(t.use, { rail: t.rails[r].name })}</button>
              ))}
            </li>
          ))}
        </ul>
      )}

      {onContinue && (
        <button
          type="button" onClick={send} aria-disabled={blocked || pending || value <= 0 || undefined} aria-describedby={issues.length ? `${id}-issues` : undefined}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {done === key ? fill(t.done, { rail: t.rails[current].name }) : fill(t.continue, { amount: money(value), rail: t.rails[current].name })}
        </button>
      )}
      <span role="status" className="sr-only">{spoken}</span>
    </div>
  )
}
