"use client"

import * as React from "react"
import NumberFlow, { NumberFlowGroup } from "@number-flow/react"
import { TZDate } from "@date-fns/tz"
import { addDays as addCalendarDays, format } from "date-fns"
import { CalendarX2, Globe, Timer, Truck } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/** The zone if the runtime knows it, else UTC, so a typo'd zone can't crash the picker. */
const safeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return timeZone
  } catch {
    return "UTC"
  }
}

/** Wall date, weekday and minutes past midnight of an instant in a zone (the device's when omitted). */
export function wallTime(ts: number, timeZone?: string) {
  const at = Number.isFinite(ts) ? ts : 0
  const d = timeZone ? new TZDate(at, safeZone(timeZone)) : new Date(at)
  return { date: format(d, "yyyy-MM-dd"), weekday: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() }
}

/**
 * The instant a store wall time happens. @date-fns/tz resolves the hard cases: a time inside a
 * spring-forward gap moves forward by the gap, and a repeated autumn time picks the first one.
 */
export function zonedInstant(date: string, minutes: number, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number)
  return new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, safeZone(timeZone)).getTime()
}

/** Calendar-day arithmetic on "YYYY-MM-DD" strings, free of the device's zone and DST. */
export const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number)
  return format(addCalendarDays(new TZDate(y, m - 1, d, 12, 0, "UTC"), n), "yyyy-MM-dd")
}

export interface CutoffOptions {
  /** IANA zone of the store or warehouse. Cutoffs and dates are the store's. */
  storeTimeZone: string
  /** Same-day (or lead-day) cutoff in store time, "HH:MM". */
  cutoff?: string
  /** Open days needed after the order day: 0 for same-day, 1 for next-day. */
  leadDays?: number
  /** Weekdays with no delivery (0 = Sunday). */
  closedWeekdays?: number[]
  /** Store-date holidays with a name to show. */
  holidays?: { date: string; name: string }[]
  /** How many days to offer, starting with the store's today. */
  days?: number
}

export type DayStatus = "available" | "too-soon" | "closed" | "holiday"

/**
 * Everything the picker shows, as of `now`: the store's date, whether today's cutoff is still ahead
 * (and when, as an instant), the earliest date an order placed now can get, the closed days it had to
 * skip and why, and each offered day's status.
 */
export function cutoffPlan(now: number, { storeTimeZone, cutoff = "14:00", leadDays = 0, closedWeekdays = [], holidays = [], days = 7 }: CutoffOptions) {
  const store = wallTime(now, storeTimeZone)
  const [h, m] = String(cutoff).split(":").map(Number)
  // A malformed cutoff falls back to 14:00 instead of producing an invalid date.
  const cutoffMinutes = Number.isFinite(h) ? Math.min(1439, Math.max(0, h * 60 + (m || 0))) : 840
  const closure = (date: string) => {
    const holiday = (Array.isArray(holidays) ? holidays : []).find((x) => x?.date === date)
    if (holiday) return { status: "holiday" as const, reason: holiday.name }
    if (Array.isArray(closedWeekdays) && closedWeekdays.includes(new Date(`${date}T00:00Z`).getUTCDay())) return { status: "closed" as const, reason: undefined }
    return null
  }
  const todayOpen = !closure(store.date)
  const beforeCutoff = todayOpen && store.minutes < cutoffMinutes
  let earliest = beforeCutoff ? store.date : addDays(store.date, 1)
  const skipped: { date: string; reason?: string }[] = []
  for (let lead = leadDays, i = 0; i < 60; i++) {
    const closed = closure(earliest)
    if (closed) skipped.push({ date: earliest, reason: closed.reason })
    else if (lead === 0) break
    else lead--
    earliest = addDays(earliest, 1)
  }
  const list = Array.from({ length: Math.min(60, Math.max(1, Math.trunc(days) || 7)) }, (_, i) => {
    const date = addDays(store.date, i)
    const closed = closure(date)
    return { date, status: (closed?.status ?? (date < earliest ? "too-soon" : "available")) as DayStatus, reason: closed?.reason }
  })
  return { storeDate: store.date, beforeCutoff, cutoffAt: zonedInstant(store.date, cutoffMinutes, storeTimeZone), earliest, skipped: skipped.filter((s) => s.date < earliest), days: list }
}

/** Can a date still be chosen for an order placed at `now`? Run it again at checkout, on the server too. */
export const isDateAvailable = (date: string, now: number, options: CutoffOptions) => cutoffPlan(now, { ...options, days: 60 }).days.some((d) => d.date === date && d.status === "available")

const dayName = (date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(Date.parse(`${date}T12:00Z`))
/** "IST", "PDT", "BST" where a real abbreviation exists, otherwise "GMT+4". */
const zoneName = (ts: number, timeZone?: string) => {
  const names = ["en-US", "en-IN", "en-GB"].map((l) => new Intl.DateTimeFormat(l, { timeZone, timeZoneName: "short" }).formatToParts(ts).find((p) => p.type === "timeZoneName")?.value ?? "")
  return names.find((n) => !/^(GMT|UTC)/.test(n)) ?? names[0]
}
const clock = (ts: number, timeZone?: string) => {
  const at = Number.isFinite(ts) ? ts : 0
  const zone = timeZone && safeZone(timeZone)
  return `${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone }).format(at)} ${zoneName(at, zone)}`
}
const within = (ms: number) => {
  const total = Math.max(1, Math.ceil(ms / 60_000))
  return total >= 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total} min`
}
/** The same countdown with each number rolling as it changes. The label carries the plain text. */
function Within({ ms }: { ms: number }) {
  const total = Math.max(1, Math.ceil(ms / 60_000))
  const hours = Math.floor(total / 60)
  return (
    <span role="img" aria-label={within(ms)} className="whitespace-nowrap tabular-nums">
      <NumberFlowGroup>
        {hours > 0 && (
          <>
            <NumberFlow aria-hidden value={hours} trend={-1} /> h{" "}
          </>
        )}
        <NumberFlow aria-hidden value={hours > 0 ? total % 60 : total} trend={-1} /> min
      </NumberFlowGroup>
    </span>
  )
}
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (k, key: string) => v[key] ?? k)
/** `fill`, but placeholders may be React nodes (the rolling countdown). */
const fillNodes = (t: string, v: Record<string, React.ReactNode>) =>
  t.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1]
    return <React.Fragment key={i}>{key && key in v ? v[key] : part}</React.Fragment>
  })

export interface CutoffPickerProps extends CutoffOptions, Omit<React.ComponentProps<"div">, "defaultValue"> {
  /** Selected store date, "YYYY-MM-DD". */
  value?: string
  /** Initial date when uncontrolled. */
  defaultValue?: string
  /** Called with the chosen delivery date. */
  onValueChange?: (date: string) => void
  /** Shopper's zone. Defaults to the browser's. */
  userTimeZone?: string
  /** "Now" for previews and tests. Defaults to a live clock. */
  now?: Date | number
  /** Warn when less than this many minutes are left, since checkout itself takes time. */
  checkoutMinutes?: number
  /** Visible label for the date picker. */
  label?: string
  /** Templates: `{time}`, `{day}`, `{date}`, `{reason}` and `{yours}` are filled in. */
  countdownText?: string
  /** Text describing the cutoff time. */
  cutoffText?: string
  /** Text naming skipped holidays and closed days. */
  closedText?: string
  /** Text shown when the cutoff is close. */
  hurryText?: string
  /** Text shown when the store's date differs from the shopper's. */
  storeDateText?: string
  /** Text shown when the chosen date is no longer available. */
  rolledText?: string
  /** Text for a date that can't be chosen. */
  unavailableText?: string
  /** Text for switching to the new earliest date. */
  switchLabel?: string
  /** Word used for today. */
  todayLabel?: string
}

/**
 * A delivery or pickup date picker that is honest about cutoffs. It counts down to the store's cutoff
 * ("Order within 1 h 12 min for delivery today") in store time with your own time beside it, names the
 * holidays and closed days it skips, says so when the store's date isn't yours, and never moves a chosen
 * date silently: when the cutoff passes while someone is choosing, it says the date is gone and offers
 * the new earliest one in one tap.
 */
export function CutoffPicker({
  storeTimeZone,
  cutoff = "14:00",
  leadDays = 0,
  closedWeekdays,
  holidays,
  days = 7,
  value,
  defaultValue,
  onValueChange,
  userTimeZone,
  now: fixedNow,
  checkoutMinutes = 5,
  label = "Delivery date",
  countdownText = "Order within {time} for delivery {day}",
  cutoffText = "Cutoff {time} at the store · {yours} for you",
  closedText = "Today's cutoff has passed. Earliest is {date}{reason}.",
  hurryText = "Checkout takes a few minutes, so don't wait.",
  storeDateText = "Dates are the store's: it's already {date} there.",
  rolledText = "{date} closed at {time} while you were choosing.",
  unavailableText = "{date} isn't available{reason}.",
  switchLabel = "Switch to {date}",
  todayLabel = "Today",
  className,
  ...props
}: CutoffPickerProps) {
  const [tick, setTick] = React.useState<number>()
  const [zone, setZone] = React.useState(userTimeZone)
  const [inner, setInner] = React.useState(defaultValue)
  const listRef = React.useRef<HTMLDivElement>(null)
  const labelId = React.useId()
  const highlightId = React.useId()
  const reduce = useReducedMotion()
  const selected = value ?? inner

  React.useEffect(() => setZone(userTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone), [userTimeZone])
  React.useEffect(() => {
    if (fixedNow !== undefined && Number.isFinite(new Date(fixedNow).getTime())) return
    setTick(Date.now())
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [fixedNow])

  const fixed = fixedNow !== undefined ? new Date(fixedNow).getTime() : NaN
  const now = Number.isFinite(fixed) ? fixed : tick
  if (now === undefined || !zone) return <div data-slot="cutoff-picker" className={cn("h-40 w-full max-w-md", className)} {...props} />

  const plan = cutoffPlan(now, { storeTimeZone, cutoff, leadDays, closedWeekdays, holidays, days })
  const left = plan.cutoffAt - now
  const relative = (date: string) => (date === plan.storeDate ? "today" : date === addDays(plan.storeDate, 1) ? "tomorrow" : `on ${dayName(date)}`)
  const userDate = wallTime(now, zone).date
  const selectedDay = plan.days.find((d) => d.date === selected)
  const lost = selected !== undefined && selectedDay?.status !== "available"
  const skippedReason = plan.skipped.filter((s) => s.reason).map((s) => `, ${dayName(s.date, { weekday: "short" })} is ${s.reason}`)[0] ?? ""
  const announce = !plan.beforeCutoff
    ? fill(closedText, { date: dayName(plan.earliest), reason: skippedReason })
    : left < checkoutMinutes * 60_000
      ? hurryText
      : ""
  const choose = (date: string) => {
    if (value === undefined) setInner(date)
    onValueChange?.(date)
  }
  const available = plan.days.filter((d) => d.status === "available").map((d) => d.date)
  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const at = available.indexOf(selected ?? "")
    const next = available[Math.min(available.length - 1, Math.max(0, at < 0 ? 0 : at + step))]
    if (!next) return
    choose(next)
    listRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus()
  }

  return (
    <div data-slot="cutoff-picker" data-state={plan.beforeCutoff ? "open" : "closed"} className={cn("grid w-full max-w-md gap-3 text-sm", className)} {...props}>
      {/* Only state changes are announced (cutoff passed, hurry, date lost), never the ticking countdown. */}
      <span role="status" className="sr-only">
        {announce}
      </span>
      <div className="grid gap-1.5 rounded-md border px-3 py-2.5">
        {plan.beforeCutoff ? (
          <>
            <p className="flex items-start gap-2 font-medium">
              <Timer aria-hidden className={cn("mt-0.5 size-4 shrink-0", left < checkoutMinutes * 60_000 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")} />
              <span>{fillNodes(countdownText, { time: <Within ms={left} />, day: relative(plan.earliest) + (userDate !== plan.storeDate && plan.earliest === plan.storeDate ? ` (${dayName(plan.storeDate)})` : "") })}</span>
            </p>
            {left < 3_600_000 && (
              <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={cn("h-full origin-left rounded-full", left < checkoutMinutes * 60_000 ? "bg-amber-500" : "bg-emerald-500")}
                  initial={false}
                  animate={{ scaleX: Math.max(0, left / 3_600_000) }}
                  transition={reduce ? { duration: 0 } : { duration: 1, ease: "linear" }}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground tabular-nums">
              {fill(cutoffText, { time: clock(plan.cutoffAt, storeTimeZone), yours: `${clock(plan.cutoffAt, zone)}${wallTime(plan.cutoffAt, zone).date !== plan.storeDate ? ` ${dayName(wallTime(plan.cutoffAt, zone).date, { weekday: "short" })}` : ""}` })}
            </p>
            <AnimatePresence initial={false}>
              {left < checkoutMinutes * 60_000 && (
                <motion.p
                  initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden text-xs text-amber-700 dark:text-amber-400"
                >
                  {hurryText}
                </motion.p>
              )}
            </AnimatePresence>
          </>
        ) : (
          <p className="flex items-start gap-2">
            <Truck aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>{fill(closedText, { date: dayName(plan.earliest), reason: skippedReason })}</span>
          </p>
        )}
        {userDate !== plan.storeDate && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Globe aria-hidden className="mt-px size-3.5 shrink-0" />
            {fill(storeDateText, { date: dayName(plan.storeDate) })}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <p id={labelId} className="text-sm font-medium">
          {label}
        </p>
        <div ref={listRef} role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown} className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
          {plan.days.map(({ date, status, reason }) => {
            const checked = date === selected
            const disabled = status !== "available"
            return (
              <button
                key={date}
                type="button"
                role="radio"
                data-date={date}
                aria-checked={checked}
                aria-disabled={disabled || undefined}
                aria-label={`${dayName(date, { weekday: "long", day: "numeric", month: "long" })}${reason ? `, closed for ${reason}` : status === "closed" ? ", closed" : status === "too-soon" ? ", no longer available" : ""}`}
                tabIndex={checked || (!available.includes(selected ?? "") && date === plan.earliest) ? 0 : -1}
                onClick={() => !disabled && choose(date)}
                className={cn(
                  "relative grid min-h-16 content-center justify-items-center gap-0.5 rounded-md border px-1 py-1.5 text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  disabled ? "cursor-not-allowed bg-muted/40 text-muted-foreground" : "hover:bg-accent",
                  checked && !disabled && "border-primary text-primary-foreground",
                  checked && disabled && "border-amber-500 text-amber-800 dark:text-amber-300",
                )}
              >
                {checked && !disabled && (
                  // One highlight that slides between days, so a one-tap switch visibly moves the order.
                  <motion.span
                    aria-hidden
                    layoutId={highlightId}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 36 }}
                    className="absolute -inset-px rounded-md bg-primary"
                  />
                )}
                <span className="relative">{date === plan.storeDate ? todayLabel : dayName(date, { weekday: "short" })}</span>
                <span className={cn("relative text-base font-semibold tabular-nums", disabled && "line-through decoration-1")}>{Number(date.slice(8))}</span>
                <span title={reason} className="relative max-w-full truncate text-[10px] leading-tight">{reason ?? (status === "closed" ? "Closed" : dayName(date, { month: "short" }))}</span>
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
      {lost && selected && (
        <motion.p
          key="lost"
          role="alert"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
        >
          <CalendarX2 aria-hidden className="size-4 shrink-0" />
          <span className="flex-1">{fill(selectedDay?.status === "too-soon" ? rolledText : unavailableText, { date: dayName(selected), time: clock(plan.cutoffAt, storeTimeZone), reason: selectedDay?.reason ? `: ${selectedDay.reason}` : "" })}</span>
          <button
            type="button"
            onClick={() => {
              choose(plan.earliest)
              // Focus follows the fix to the new day instead of being lost with this notice.
              requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-date="${plan.earliest}"]`)?.focus())
            }}
            className="inline-flex h-6 items-center rounded-md border border-amber-500/40 px-2 font-medium transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {fill(switchLabel, { date: dayName(plan.earliest) })}
          </button>
        </motion.p>
      )}
      </AnimatePresence>
    </div>
  )
}
