"use client"

import * as React from "react"
import { CalendarDays, CircleCheck, Loader2, Scale, TriangleAlert, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkLeave, countLeave, type DayPart, type Holiday, type LeaveIssue, type LeavePolicy, type LeaveRequest, type TeamAbsence } from "./leave"

export { checkLeave, countLeave, dayNumber, type DayPart, type Holiday, type LeaveCount, type LeaveDay, type LeaveIssue, type LeavePolicy, type LeaveRequest, type TeamAbsence } from "./leave"

/** Every visible string. `{…}` placeholders are filled in. */
export const LEAVE_REQUEST_MESSAGES = {
  start: "From",
  end: "To",
  startPart: "First day",
  endPart: "Last day",
  full: "Full day",
  morning: "Morning only",
  afternoon: "Afternoon only",
  fromAfternoon: "From afternoon",
  untilNoon: "Until noon",
  half: "Half day",
  range: "{start} – {end}",
  counts: "{calendar} calendar days · {working} working days",
  cost: "Uses {cost} of your {balance} days",
  costNoBalance: "Uses {cost} days of leave",
  back: "Back at work {date}",
  backAfternoon: "Back at work {date} afternoon",
  invalid: "Pick real dates for both ends.",
  reversed: "The last day is before the first.",
  swap: "Swap dates",
  startsOff: "{date} is already off, so it isn't counted.",
  endsOff: "{date} is already off, so it isn't counted.",
  startOn: "Start {date}",
  endOn: "End {date}",
  allOff: "Every day in this range is a weekend or holiday. No leave needed.",
  whichHalf: "Half day on {date}: morning or afternoon? Your team will plan around it.",
  useMorning: "Morning",
  useAfternoon: "Afternoon",
  gapStart: "Morning only on {date} means working that afternoon, then leave again. Did you mean from the afternoon?",
  gapEnd: "Afternoon only on {date} means working that morning after your leave. Did you mean until noon?",
  sandwich: "Your policy counts {days} between your leave days, so this uses {cost} days, not {without}.",
  sandwichLaw: "If you're a worker covered by the OSH Code 2020, s.32(1)(iv) says holidays between or next to your leave aren't counted as leave. Ask HR which rule applies to you.",
  overBalance: "This uses {cost} days but you have {balance}. {short} would be unpaid.",
  fitBalance: "End {date} instead",
  oneDay: "{n} day",
  manyDays: "{n} days",
  team: "{names} also off. Busiest day {date}: {count} away.",
  teamLimit: "{names} also off. On {date} that's {count} away, more than your team allows.",
  submit: "Request leave",
  submitAnyway: "Request anyway",
  submitted: "Sent for approval.",
  legend: "Day by day",
  kinds: { leave: "leave", half: "half day", weekend: "weekend", holiday: "holiday", sandwich: "charged as leave" },
}
export type LeaveRequestMessages = typeof LEAVE_REQUEST_MESSAGES

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const EMPTY: LeaveRequest = { start: "", end: "", startPart: "full", endPart: "full" }

export interface LeaveRequestCheckProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "onSubmit"> {
  /** Controlled request. */
  value?: LeaveRequest
  /** Initial request when uncontrolled. */
  defaultValue?: Partial<LeaveRequest>
  /** Called with the new request on every edit or fix. */
  onValueChange?: (request: LeaveRequest) => void
  /** Public and company holidays. */
  holidays?: Holiday[]
  /** Who on the team is already away. */
  team?: TeamAbsence[]
  /** Most people the team allows away on one day, including this person. */
  teamLimit?: number
  /** Sandwich rule and weekly offs. */
  policy?: LeavePolicy
  /** Days of leave left. */
  balance?: number
  /** Locale for dates. */
  locale?: string
  /** Sends the request. With warnings open, the first press jumps to them and the second sends. May return a Promise. */
  onSubmit?: (request: LeaveRequest) => void | Promise<void>
  /**
   * Under a sandwich charge, show the note that India's OSH Code 2020 s.32(1)(iv) excludes holidays from leave
   * for covered workers. Defaults to on for Indian locales ("en-IN", "hi-IN"…).
   */
  showLawNote?: boolean
  /** Any visible string. */
  messages?: Partial<Omit<LeaveRequestMessages, "kinds">> & { kinds?: Partial<LeaveRequestMessages["kinds"]> }
}

/**
 * Reads a leave request back as working days, calendar days and what it really costs, and catches what
 * people get wrong: a weekend or holiday at either end, a sandwich rule that charges the weekend in between,
 * a half day with no half chosen (or one that leaves a working gap), a balance going negative and teammates
 * already away. Each catch has a one-tap fix where one exists.
 */
export function LeaveRequestCheck({
  value, defaultValue, onValueChange, holidays = [], team = [], teamLimit, policy = {}, balance, locale = "en-IN",
  onSubmit, showLawNote, messages, className, ...props
}: LeaveRequestCheckProps) {
  const lawNote = showLawNote ?? /-IN$/i.test(locale)
  const t = { ...LEAVE_REQUEST_MESSAGES, ...messages, kinds: { ...LEAVE_REQUEST_MESSAGES.kinds, ...messages?.kinds } }
  const [inner, setInner] = React.useState<LeaveRequest>({ ...EMPTY, ...defaultValue })
  const req: LeaveRequest = { ...EMPTY, ...(value ?? inner) }
  const [asked, setAsked] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [sentFor, setSentFor] = React.useState<string>()
  const [status, setStatus] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const submitRef = React.useRef<HTMLButtonElement>(null)
  const id = React.useId()
  const key = JSON.stringify(req)
  const count = countLeave(req, holidays, team, policy)
  const issues = checkLeave(req, { holidays, team, policy, balance, teamLimit })
  const single = req.start === req.end
  // Teammates being away is worth knowing, not worth a second press, unless it breaks the team's limit.
  const blocking = issues.filter((i) => !(i.kind === "team" && !i.overLimit))
  const nothingToRequest = !count || count.cost <= 0

  const date = (iso: string, weekday = true) => {
    const d = new Date(`${iso}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: weekday ? "short" : undefined, day: "numeric", month: "short" }).format(d)
  }
  const short = (day: number) => {
    const d = new Date(day * 86_400_000)
    return `${new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }).format(d)} ${new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" }).format(d)}`
  }
  const list = (items: string[]) => (typeof Intl.ListFormat === "function" ? new Intl.ListFormat(locale, { type: "conjunction" }).format(items) : items.join(", "))
  const n = (x: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(x)

  const commit = (patch: Partial<LeaveRequest>) => {
    const next = { ...req, ...patch }
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setAsked(false)
  }

  /** After a fix, go to the next fix, else the submit button, else the first date. */
  const refocus = () =>
    requestAnimationFrame(() => {
      const root = rootRef.current
      ;(root?.querySelector<HTMLElement>("[data-fix]") ?? submitRef.current ?? root?.querySelector<HTMLElement>("input"))?.focus()
    })
  const fixButton = (label: string, patch: Partial<LeaveRequest>) => (
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

  const render = (issue: LeaveIssue): [React.ReactNode, React.ReactNode[]] => {
    switch (issue.kind) {
      case "invalid": return [t.invalid, []]
      case "reversed": return [t.reversed, [fixButton(t.swap, { start: req.end, end: req.start })]]
      case "startsOff": return [fill(t.startsOff, { date: date(issue.date) }), [fixButton(fill(t.startOn, { date: date(issue.fix) }), { start: issue.fix, startPart: "full" })]]
      case "endsOff": return [fill(t.endsOff, { date: date(issue.date) }), [fixButton(fill(t.endOn, { date: date(issue.fix) }), { end: issue.fix, endPart: "full" })]]
      case "allOff": return [t.allOff, []]
      case "whichHalf": {
        const part = issue.end === "start" ? "startPart" : "endPart"
        return [fill(t.whichHalf, { date: date(issue.date) }), [fixButton(t.useMorning, { [part]: "morning" }), fixButton(t.useAfternoon, { [part]: "afternoon" })]]
      }
      case "gap":
        return issue.end === "start"
          ? [fill(t.gapStart, { date: date(issue.date) }), [fixButton(t.fromAfternoon, { startPart: "afternoon" })]]
          : [fill(t.gapEnd, { date: date(issue.date) }), [fixButton(t.untilNoon, { endPart: "morning" })]]
      case "sandwich":
        return [fill(t.sandwich, { days: list(issue.days.map((d) => d.holiday || short(d.day))), cost: n(issue.cost), without: n(issue.without) }), []]
      case "overBalance":
        return [
          fill(t.overBalance, { cost: n(issue.cost), balance: n(issue.balance), short: fill(issue.cost - Math.max(0, issue.balance) === 1 ? t.oneDay : t.manyDays, { n: n(issue.cost - Math.max(0, issue.balance)) }) }),
          issue.fitEnd ? [fixButton(fill(t.fitBalance, { date: date(issue.fitEnd) }), { end: issue.fitEnd, endPart: "full" })] : [],
        ]
      case "team":
        return [fill(issue.overLimit ? t.teamLimit : t.team, { names: list(issue.names), date: date(issue.date), count: issue.busiest + 1 }), []]
    }
  }

  const summary = count ? `${fill(t.range, { start: date(req.start), end: date(req.end) })}. ${fill(balance === undefined ? t.costNoBalance : t.cost, { cost: n(count.cost), balance: n(balance ?? 0) })}.` : ""
  // Warnings appear while picking dates, so they're read out too, once the picking settles.
  const spoken = [summary, ...issues.map((i) => render(i)[0]).filter((x): x is string => typeof x === "string")].filter(Boolean).join(" ")
  React.useEffect(() => {
    const timer = setTimeout(() => setStatus(spoken), 700)
    return () => clearTimeout(timer)
  }, [spoken])

  const submit = async () => {
    if (blocking.length && !asked) {
      setAsked(true)
      ;(rootRef.current?.querySelector<HTMLElement>("[data-fix]") ?? rootRef.current?.querySelector<HTMLElement>("[data-issues]"))?.focus()
      return
    }
    if (!onSubmit || pending || nothingToRequest) return
    setPending(true)
    const sent = key
    try {
      await onSubmit(req)
      setSentFor(sent)
    } catch {
      // The caller reports failures; the button becomes usable again.
    } finally {
      setPending(false)
    }
  }

  const partSelect = (which: "startPart" | "endPart") => {
    const options: [DayPart, string][] = single
      ? [["full", t.full], ["morning", t.morning], ["afternoon", t.afternoon]]
      : which === "startPart"
        ? [["full", t.full], ["afternoon", t.fromAfternoon], ["morning", t.morning]]
        : [["full", t.full], ["morning", t.untilNoon], ["afternoon", t.afternoon]]
    if (req[which] === "half") options.push(["half", t.half])
    return (
      <select
        aria-label={which === "startPart" ? t.startPart : t.endPart}
        value={req[which]}
        onChange={(e) => commit({ [which]: e.target.value as DayPart })}
        className="h-8 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    )
  }
  const dateField = (which: "start" | "end") => (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={`${id}-${which}`} className="text-sm font-medium">{which === "start" ? t.start : t.end}</label>
      <input
        id={`${id}-${which}`}
        type="date"
        value={req[which]}
        aria-invalid={issues.some((i) => i.kind === "invalid" || i.kind === "reversed") || undefined}
        onChange={(e) => commit(which === "start" && (!req.end || req.end === req.start) ? { start: e.target.value, end: e.target.value } : { [which]: e.target.value })}
        className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
      />
      {(which === "start" || !single) && partSelect(which === "start" ? "startPart" : "endPart")}
    </div>
  )

  const tone: Record<string, string> = {
    leave: "bg-primary text-primary-foreground",
    half: "bg-primary/30 text-foreground ring-1 ring-inset ring-primary/60",
    weekend: "bg-muted text-muted-foreground",
    holiday: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
    sandwich: "bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/50 dark:text-amber-200",
  }

  return (
    <div ref={rootRef} data-slot="leave-request-check" data-state={issues.length ? "warning" : count ? "ok" : "empty"} className={cn("grid w-full max-w-md gap-3 text-sm", className)} {...props}>
      <div className="grid gap-3 min-[400px]:grid-cols-2">
        {dateField("start")}
        {dateField("end")}
      </div>

      {count && (
        <section aria-label={fill(t.range, { start: date(req.start), end: date(req.end) })} className="grid gap-2 rounded-md border bg-muted/40 p-3">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium">{fill(t.range, { start: date(req.start), end: date(req.end) })}</span>
            <span className="text-xs text-muted-foreground">{fill(t.counts, { calendar: count.calendarDays, working: n(count.workingDays) })}</span>
          </p>
          {count.days.length <= 31 && (
            <ol aria-label={t.legend} className="flex flex-wrap gap-1">
              {count.days.map((d) => (
                <li key={d.date} title={`${date(d.date)}: ${d.holiday ?? t.kinds[d.kind]}${d.team.length ? ` · ${d.team.join(", ")}` : ""}`} className={cn("relative grid h-9 w-8 place-items-center rounded-md text-[11px] leading-tight tabular-nums", tone[d.kind])}>
                  <span aria-hidden>{new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "narrow" }).format(new Date(d.day * 86_400_000))}<br />{new Date(d.day * 86_400_000).getUTCDate()}</span>
                  <span className="sr-only">{date(d.date)}: {d.holiday ?? t.kinds[d.kind]}</span>
                  {d.team.length > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-violet-500 ring-2 ring-card" />}
                </li>
              ))}
            </ol>
          )}
          <p className={cn("text-xs font-medium", balance !== undefined && count.cost > balance ? "text-amber-700 dark:text-amber-400" : "text-foreground")}>
            {fill(balance === undefined ? t.costNoBalance : t.cost, { cost: n(count.cost), balance: n(balance ?? 0) })}
            {count.back && <span className="font-normal text-muted-foreground"> · {fill(count.back.afternoon ? t.backAfternoon : t.back, { date: date(count.back.date) })}</span>}
          </p>
        </section>
      )}

      {issues.length > 0 && (
        <ul data-issues tabIndex={-1} className="grid gap-2 outline-none">
          {issues.map((issue, i) => {
            const [text, fixes] = render(issue)
            const Icon = issue.kind === "team" ? Users : issue.kind === "sandwich" || issue.kind.endsWith("Off") ? CalendarDays : TriangleAlert
            return (
              <li key={`${issue.kind}-${i}`} className={cn("flex gap-1.5 text-xs", issue.kind === "team" && !issue.overLimit ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400")}>
                <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 space-y-1">
                  <span className="block break-words">{text}</span>
                  {fixes.length > 0 && <span className="flex flex-wrap gap-2">{fixes}</span>}
                  {issue.kind === "sandwich" && lawNote && (
                    <span className="flex gap-1.5 text-muted-foreground">
                      <Scale aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      <span className="min-w-0">{t.sandwichLaw}</span>
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {onSubmit && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {sentFor === key && !pending && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CircleCheck aria-hidden className="size-3.5" />{t.submitted}</span>
          )}
          <button
            ref={submitRef}
            type="button"
            onClick={submit}
            disabled={pending || nothingToRequest}
            aria-busy={pending || undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
              asked && blocking.length ? "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {asked && blocking.length ? t.submitAnyway : t.submit}
          </button>
        </div>
      )}
      <span aria-live="polite" className="sr-only">{sentFor === key ? t.submitted : status}</span>
    </div>
  )
}
