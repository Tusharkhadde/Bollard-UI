"use client"

import * as React from "react"
import { CalendarClock, Check, Copy, Globe, LogOut, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkNotice, dayOf, type Holiday, type NoticeInput, type NoticeIssue, type NoticePolicy, type NoticeResult } from "./notice"

export { addMonths, checkNotice, dayOf, zonedToUtc, type Holiday, type NoticeInput, type NoticeIssue, type NoticePolicy, type NoticeResult } from "./notice"

/** Every visible string. `{…}` placeholders are filled in. */
export const NOTICE_PERIOD_MESSAGES = {
  heading: "Notice period · {length}",
  days: "{n} days",
  workingDays: "{n} working days",
  weeks: "{n} weeks",
  months: "{n} months",
  oneMonth: "1 month",
  sentAt: "Resignation sent",
  sentHint: "Your time ({zone})",
  requested: "Last day you'd like",
  optional: "optional",
  leave: "Leave to set off",
  leaveHint: "{n} days left",
  unpaid: "Unpaid days during notice",
  lastDay: "Last working day",
  runs: "Notice runs {start} – {end}",
  employed: "On the payroll until {date}",
  invalid: "Add the date and time you sent your resignation.",
  timezone: "You sent it on {local} your time, but it was already {hr} for HR ({zone}), so they count from {hr}.",
  timezoneEarlier: "You sent it on {local} your time, but it was still {hr} for HR ({zone}), so they count from {hr}.",
  cutoff: "It arrived after {hour}:00, which your policy treats as received on {date}.",
  monthEnd: "{months} from {resigned} lands on a date that month doesn't have. Your policy gives {used}; counting it the other way gives {other}. Get the date confirmed in writing.",
  offDay: "Your notice ends on {date}, a {reason}, so your last working day is {moved}.",
  offDayKeep: "Your notice ends on {date}, a {reason}. Check whether you're expected in.",
  weekend: "weekend",
  unpaidNote: "{days} unpaid days push your last day from {from} to {to}.",
  leaveNotAllowed: "Your policy doesn't let leave shorten notice. Unused leave is usually paid out instead.",
  leaveTooMuch: "You only have {max} days of leave to set off.",
  useMax: "Use {max} days",
  requestBeforeStart: "{date} is before your notice starts.",
  clear: "Clear date",
  requestOff: "{date} is a {reason}. Most HR systems need a working day.",
  askFor: "Ask for {date}",
  short: "Leaving {date} is {days} days short.",
  buyout: "Buyout ≈ {amount} ({rule}).",
  rule30: "monthly pay ÷ 30 per day",
  rule26: "monthly pay ÷ 26 per working day",
  ruleMonth: "monthly pay ÷ days in that month",
  noBuyout: "Your employer can refuse or recover pay for the days you don't serve.",
  useLeave: "Cover it with {n} leave days",
  copy: "Copy line for HR",
  copied: "Copied",
  copyFailed: "Couldn't copy. Select the date above and copy it yourself.",
  confirmLine: "As per my notice period, my last working day will be {date}. Please confirm.",
}
export type NoticePeriodMessages = typeof NOTICE_PERIOD_MESSAGES

const fill = (s: string, v: Record<string, string | number | undefined>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"

export interface NoticePeriodCheckProps extends Omit<React.ComponentProps<"section">, "defaultValue" | "onChange"> {
  /** Notice length and the rules that move it. */
  policy: NoticePolicy
  /** Controlled input. */
  value?: NoticeInput
  /** Initial input when uncontrolled. */
  defaultValue?: Partial<NoticeInput>
  /** Called on every edit or fix. */
  onValueChange?: (value: NoticeInput) => void
  /** Called whenever the result changes, for saving or showing elsewhere. */
  onResultChange?: (result: NoticeResult | null) => void
  /** The employee's IANA time zone, where "Resignation sent" is read. */
  timeZone?: string
  /** Public and company holidays. */
  holidays?: Holiday[]
  /** Leave days available to set off against notice. */
  leaveBalance?: number
  /** Locale for dates and money. */
  locale?: string
  /** ISO 4217 currency for the buyout. */
  currency?: string
  /** Any visible string. */
  messages?: Partial<NoticePeriodMessages>
}

/**
 * Works out the real last working day from the resignation and the notice policy, so nobody books a start
 * date or a flight on the wrong day. It catches month-end arithmetic (31 Jan + 1 month), a last day on a
 * weekend or holiday, an email that HR dates differently in its own time zone, unpaid leave pushing the
 * date out, leave set-off and the buyout cost of leaving early, with one-tap fixes.
 */
export function NoticePeriodCheck({
  policy, value, defaultValue, onValueChange, onResultChange, timeZone = "Asia/Kolkata", holidays = [], leaveBalance,
  locale = "en-IN", currency = "INR", messages, className, ...props
}: NoticePeriodCheckProps) {
  const t = { ...NOTICE_PERIOD_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<NoticeInput>({ sentAt: "", ...defaultValue })
  const input: NoticeInput = { ...(value ?? inner), sentAt: (value ?? inner)?.sentAt ?? "" }
  const raw = checkNotice(input, policy, { timeZone, holidays, leaveBalance })
  const result = "lastDay" in raw ? (raw as NoticeResult) : null
  const issues: NoticeIssue[] = raw.issues.filter((i) => i.kind !== "invalid" || !result)
  const rootRef = React.useRef<HTMLElement>(null)
  const [copied, setCopied] = React.useState<boolean | "failed">(false)
  const [status, setStatus] = React.useState("")
  const id = React.useId()

  const date = (iso?: string, year = false) => {
    const d = dayOf(iso)
    return d === null ? String(iso ?? "") : new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: year ? "numeric" : undefined }).format(d * 86_400_000)
  }
  const money = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
  const n = Math.floor(Number(policy?.length)) || 0
  const length = policy?.unit === "months" ? (n === 1 ? t.oneMonth : fill(t.months, { n })) : policy?.unit === "weeks" ? fill(t.weeks, { n }) : fill(policy?.counting === "working" ? t.workingDays : t.days, { n })

  const commit = (patch: Partial<NoticeInput>) => {
    const next = { ...input, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setCopied(false)
  }
  /** After a fix, go to the next fix, else back to the first field. */
  const refocus = () =>
    requestAnimationFrame(() => (rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? rootRef.current?.querySelector<HTMLElement>("input"))?.focus())
  const fix = (label: string, patch: Partial<NoticeInput>) => (
    <button
      key={label}
      type="button"
      data-fix
      onClick={() => { commit(patch); refocus() }}
      className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
    >
      {label}
    </button>
  )

  const render = (issue: NoticeIssue): [string, React.ReactNode[]] => {
    const reason = (r: string) => (r === "weekend" ? t.weekend : r)
    switch (issue.kind) {
      case "invalid": return [t.invalid, []]
      case "timezone": return [fill(issue.hr > issue.local ? t.timezone : t.timezoneEarlier, { local: date(issue.local), hr: date(issue.hr), zone: issue.zone }), []]
      case "cutoff": return [fill(t.cutoff, { hour: issue.hour, date: date(issue.date) }), []]
      case "monthEnd": return [fill(t.monthEnd, { months: length, resigned: date(result?.resigned), used: date(issue.used), other: date(issue.other) }), []]
      case "offDay": return [fill(issue.moved ? t.offDay : t.offDayKeep, { date: date(issue.date), reason: reason(issue.reason), moved: date(issue.moved) }), []]
      case "unpaid": return [fill(t.unpaidNote, { days: issue.days, from: date(issue.from), to: date(issue.to) }), []]
      case "leaveNotAllowed": return [t.leaveNotAllowed, [fix(t.clear, { leaveToUse: 0 })]]
      case "leaveTooMuch": return [fill(t.leaveTooMuch, { max: issue.max }), [fix(fill(t.useMax, { max: issue.max }), { leaveToUse: issue.max })]]
      case "requestBeforeStart": return [fill(t.requestBeforeStart, { date: date(issue.date) }), [fix(t.clear, { requestedLastDay: "" })]]
      case "requestOff": return [fill(t.requestOff, { date: date(issue.date), reason: reason(issue.reason) }), [fix(fill(t.askFor, { date: date(issue.fix) }), { requestedLastDay: issue.fix })]]
      case "short": {
        const rule = policy.buyout?.divisor === 26 ? t.rule26 : policy.buyout?.divisor === "month" ? t.ruleMonth : t.rule30
        const text = `${fill(t.short, { date: date(input.requestedLastDay), days: issue.days })} ${issue.amount !== undefined ? fill(t.buyout, { amount: money(issue.amount), rule }) : t.noBuyout}`
        return [text, issue.leaveCover ? [fix(fill(t.useLeave, { n: issue.leaveCover }), { leaveToUse: issue.leaveCover })] : []]
      }
    }
  }

  const resultKey = result ? JSON.stringify(result) : ""
  const onResult = React.useRef(onResultChange)
  onResult.current = onResultChange
  React.useEffect(() => {
    onResult.current?.(resultKey ? (JSON.parse(resultKey) as NoticeResult) : null)
  }, [resultKey])

  // Read the outcome once typing settles, never per keystroke.
  const spoken = [result && `${t.lastDay}: ${date(result.lastDay, true)}.`, ...issues.map((i) => render(i)[0])].filter(Boolean).join(" ")
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(spoken), 700)
    return () => clearTimeout(timer)
  }, [spoken])

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(fill(t.confirmLine, { date: date(result.lastDay, true) }))
      setCopied(true)
    } catch {
      setCopied("failed")
    }
  }

  const number = (key: "leaveToUse" | "unpaidDays", label: string, hint?: string) => (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={`${id}-${key}`} className="text-xs font-medium">{label}{hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}</label>
      <input id={`${id}-${key}`} type="number" inputMode="numeric" min={0} max={366} value={input[key] || ""} placeholder="0"
        onChange={(e) => commit({ [key]: Math.max(0, Math.min(366, Math.floor(Number(e.target.value)) || 0)) })} className={field} />
    </div>
  )

  return (
    <section ref={rootRef} aria-labelledby={`${id}-h`} data-slot="notice-period-check" data-state={!result ? "empty" : issues.length ? "warning" : "ok"}
      className={cn("@container grid w-full max-w-md min-w-0 gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-xs", className)} {...props}>
      <h3 id={`${id}-h`} className="flex items-center gap-2 font-medium">
        <LogOut aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">{fill(t.heading, { length })}</span>
      </h3>

      <div className="grid min-w-0 gap-3 @sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-sent`} className="text-xs font-medium">{t.sentAt}<span className="font-normal text-muted-foreground"> · {fill(t.sentHint, { zone: timeZone })}</span></label>
          <input id={`${id}-sent`} type="datetime-local" value={input.sentAt.slice(0, 16)} aria-invalid={!result || undefined} aria-describedby={`${id}-res`}
            onChange={(e) => commit({ sentAt: e.target.value })} className={field} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-req`} className="text-xs font-medium">{t.requested}<span className="font-normal text-muted-foreground"> · {t.optional}</span></label>
          <input id={`${id}-req`} type="date" value={input.requestedLastDay ?? ""} aria-describedby={`${id}-res`} onChange={(e) => commit({ requestedLastDay: e.target.value })} className={field} />
        </div>
        {policy?.leaveSetOff && number("leaveToUse", t.leave, leaveBalance !== undefined ? fill(t.leaveHint, { n: leaveBalance }) : undefined)}
        {number("unpaidDays", t.unpaid)}
      </div>

      <div id={`${id}-res`} className="grid gap-3">
        {result && (
          <div className="grid gap-0.5 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">{t.lastDay}</span>
            <span className="text-base font-semibold">{date(result.lastDay, true)}</span>
            <span className="text-xs text-muted-foreground">
              {fill(t.runs, { start: date(result.start), end: date(result.contractEnd) })}
              {result.employedUntil !== result.lastDay && <> · {fill(t.employed, { date: date(result.employedUntil) })}</>}
            </span>
          </div>
        )}
        {issues.length > 0 && (
          <ul className="grid gap-2">
            {issues.map((issue, i) => {
              const [text, fixes] = render(issue)
              const Icon = issue.kind === "timezone" || issue.kind === "cutoff" ? Globe : issue.kind === "monthEnd" || issue.kind === "offDay" ? CalendarClock : TriangleAlert
              return (
                <li key={`${issue.kind}-${i}`} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 space-y-1">
                    <span className="block break-words">{text}</span>
                    {fixes.length > 0 && <span className="flex flex-wrap gap-2">{fixes}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {result && (
        <button type="button" onClick={copy}
          className="inline-flex h-8 items-center justify-center gap-1.5 justify-self-start rounded-md border px-3 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {copied === true ? <Check aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" /> : <Copy aria-hidden className="size-4" />}
          {copied === true ? t.copied : t.copy}
        </button>
      )}
      {copied === "failed" && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{t.copyFailed}</p>}
      <span aria-live="polite" className="sr-only">{copied === true ? t.copied : status}</span>
    </section>
  )
}
