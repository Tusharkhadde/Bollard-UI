"use client"

// Bollard UI — timezone-mismatch · MIT licence · https://bollard-ui.vercel.app/components/timezone-mismatch

import * as React from "react"
import { tzOffset, tzScan } from "@date-fns/tz"
import NumberFlow from "@number-flow/react"
import { Check, Plane } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

/** Banner layout shared by every Bollard UI banner: one height, padding, icon size and action style. */
const bar = "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 text-sm"
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
/** Banner tones, identical across Bollard UI banners. */
const tones = {
  info: {
    surface: "border-sky-500/30 bg-background bg-linear-to-r from-sky-500/10 to-sky-500/10 text-sky-950 dark:text-sky-50",
    icon: "text-sky-600 dark:text-sky-400",
    muted: "text-sky-900/75 dark:text-sky-100/75",
    solid: "bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-400 dark:text-sky-950 dark:hover:bg-sky-300",
    outline: "border border-sky-700/25 hover:bg-sky-500/15 dark:border-sky-300/25",
  },
} as const

const DAY = 86_400_000

/** Offset from UTC in minutes for `timeZone` at `at` (Asia/Kolkata → 330). 0 for a zone the runtime doesn't know. */
export function zoneOffset(timeZone: string, at: number) {
  const offset = tzOffset(timeZone, new Date(at))
  return Number.isFinite(offset) ? offset : 0
}

/** Whether the runtime's tz database knows `timeZone`. */
export const isKnownZone = (timeZone: string) => Number.isFinite(tzOffset(timeZone, new Date(0)))

/**
 * Whether two zones show the same wall clock now and through the coming
 * year. Every real clock change is compared (from the tz database via
 * `tzScan`), not a monthly sample, so Jerusalem and Athens, which only part
 * ways for a couple of days each spring, count as different. Changes on the
 * same day to the same offset (Havana and New York) count as the same, so
 * nobody gets asked to "switch" over a few hours in the middle of the night.
 */
export function sameClock(a: string, b: string, at: number) {
  if (a === b) return true
  if (!isKnownZone(a) || !isKnownZone(b)) return false
  if (zoneOffset(a, at) !== zoneOffset(b, at)) return false
  const range = { start: new Date(at), end: new Date(at + 400 * DAY) }
  const changesA = tzScan(a, range)
  const changesB = tzScan(b, range)
  return (
    changesA.length === changesB.length &&
    changesA.every(
      (change, i) => change.offset === changesB[i].offset && Math.abs(change.date.getTime() - changesB[i].date.getTime()) < DAY,
    )
  )
}

/** "5 h 30 min ahead", "3 h behind". */
export function formatOffsetGap(minutes: number) {
  const abs = Math.abs(minutes)
  const parts = [Math.floor(abs / 60) && `${Math.floor(abs / 60)} h`, abs % 60 && `${abs % 60} min`].filter(Boolean)
  return `${parts.join(" ")} ${minutes > 0 ? "ahead" : "behind"}`
}

/** "Europe/London" → "London", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export const zoneCity = (timeZone: string) => timeZone.split("/").pop()!.replace(/_/g, " ")

export interface TimezoneMismatchProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** The time zone saved on the account; times are shown in it today. */
  accountTimeZone: string
  /** Override the detected device zone (tests, demos, or a zone from your own location service). */
  deviceTimeZone?: string
  /** Switch the account (or this session) to the device zone. */
  onUseDeviceZone: (timeZone: string) => void
  /** Called when the user keeps the account zone. */
  onKeepAccountZone?: () => void
  /** localStorage key that remembers the answer per account → device zone pair. `null` disables it. */
  storageKey?: string | null
  /** Templates: `{device}`, `{account}` (city names) and `{gap}` ("5 h 30 min ahead") are filled in. */
  message?: string
  /** Label of the device clock. */
  deviceLabel?: string
  /** Label of the account clock. */
  accountLabel?: string
  /** Label of the use-device-zone button. */
  useDeviceLabel?: string
  /** Label of the keep-account-zone button. */
  keepAccountLabel?: string
  /** Shown for a moment after the answer. `{zone}` is the city now used. */
  doneText?: string
  /** Accessible name of the banner. */
  regionLabel?: string
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

function readChoices(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}")
  } catch {
    return {}
  }
}

/** Hour, minute and day period of `now` in `timeZone`, in the reader's own 12/24-hour habit. */
function clockParts(now: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return { hour: Number(get("hour")), minute: Number(get("minute")), period: get("dayPeriod") }
}

/**
 * Stops travellers misreading every time in the app by hours. When the device
 * is in a different zone from the account, it shows both clocks side by side
 * (ticking digits, so they read as live clocks rather than labels) and asks
 * once which to use. The answer morphs the banner into a one-line confirmation
 * that keeps focus, then gets out of the way and is remembered for this pair of
 * zones, so it stays quiet for the rest of the trip and asks again on the next
 * one. Zones that tell the same time all year never trigger it.
 */
export function TimezoneMismatch({
  accountTimeZone,
  deviceTimeZone,
  onUseDeviceZone,
  onKeepAccountZone,
  storageKey = "bollard-ui:timezone-choice",
  message = "You're in {device} time, {gap} of your account's {account} time.",
  deviceLabel = "Device",
  accountLabel = "Account",
  useDeviceLabel = "Use device zone",
  keepAccountLabel = "Keep account zone",
  doneText = "Times now show in {zone} time.",
  regionLabel = "Time zone mismatch",
  className,
  ...props
}: TimezoneMismatchProps) {
  const [device, setDevice] = React.useState(deviceTimeZone)
  const [now, setNow] = React.useState<number>()
  const [answered, setAnswered] = React.useState(true)
  const [done, setDone] = React.useState<string | null>(null)
  const doneRef = React.useRef<HTMLParagraphElement>(null)
  const reduceMotion = useReducedMotion()
  const pair = `${accountTimeZone}→${device}`

  React.useEffect(() => {
    setDevice(deviceTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [deviceTimeZone])

  React.useEffect(() => {
    setAnswered(device === undefined || (storageKey !== null && pair in readChoices(storageKey)))
  }, [device, pair, storageKey])

  // The confirmation takes focus (the buttons that had it are gone) and steps aside once focus moves on.
  const focusOnMount = React.useCallback((node: HTMLParagraphElement | null) => {
    doneRef.current = node
    node?.focus()
  }, [])
  React.useEffect(() => {
    if (!done) return
    const id = setTimeout(() => document.activeElement !== doneRef.current && setDone(null), 4000)
    return () => clearTimeout(id)
  }, [done])

  const choose = (choice: "device" | "account") => {
    if (storageKey !== null) localStorage.setItem(storageKey, JSON.stringify({ ...readChoices(storageKey), [pair]: choice }))
    setAnswered(true)
    setDone(zoneCity(choice === "device" ? device! : accountTimeZone))
    if (choice === "device") onUseDeviceZone(device!)
    else onKeepAccountZone?.()
  }

  const mismatch =
    !answered &&
    device !== undefined &&
    now !== undefined &&
    isKnownZone(device) &&
    isKnownZone(accountTimeZone) &&
    !sameClock(device, accountTimeZone, now)
  const tone = tones.info
  const spring = reduceMotion ? { duration: 0.12 } : { type: "spring" as const, stiffness: 380, damping: 36 }

  const clock = (label: string, timeZone: string) => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(now)
    const deviceDay = new Intl.DateTimeFormat("en-CA", { timeZone: device, dateStyle: "short" }).format(now)
    const { hour, minute, period } = clockParts(now!, timeZone)
    return (
      <div className="min-w-0 flex-1 rounded-md border border-sky-700/15 bg-background/70 px-3 py-2 dark:border-sky-300/15">
        <p className={cn("text-xs break-words", tone.muted)}>
          {label} · {zoneCity(timeZone)}
        </p>
        <p
          className="text-lg font-semibold tabular-nums"
        >
          <span className="sr-only">{new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" }).format(now)}</span>
          <span aria-hidden className="inline-flex items-baseline">
            <NumberFlow value={hour} animated={!reduceMotion} trend={0} />
            <span>:</span>
            <NumberFlow value={minute} format={{ minimumIntegerDigits: 2 }} animated={!reduceMotion} trend={0} digits={{ 1: { max: 5 } }} />
            {period && <span className="ml-1 text-sm font-medium">{period}</span>}
          </span>
          {day !== deviceDay && (
            <span className={cn("ml-1.5 text-xs font-normal", tone.muted)}>
              {new Intl.DateTimeFormat(undefined, { timeZone, weekday: "short" }).format(now)}
            </span>
          )}
        </p>
      </div>
    )
  }

  return (
    <AnimatePresence initial={false}>
      {(mismatch || done) && (
        <motion.div
          key="timezone-mismatch"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={spring}
          className="overflow-hidden"
        >
          <div
            data-slot="timezone-mismatch"
            data-state={done ? "done" : "asking"}
            role="region"
            aria-label={regionLabel}
            className={cn("overflow-hidden rounded-lg border", tone.surface, className)}
            {...props}
          >
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.p
                  key="done"
                  ref={focusOnMount}
                  tabIndex={-1}
                  role="status"
                  onBlur={() => setDone(null)}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                  className={cn(bar, "font-medium outline-none")}
                >
                  <Check aria-hidden className={cn("size-4 shrink-0", tone.icon)} />
                  {fill(doneText, { zone: done })}
                </motion.p>
              ) : (
                mismatch && (
                  <motion.div key="asking" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                    <div className={cn(bar, "items-start py-2")}>
                      <Plane aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
                      <p className="min-w-0 flex-1 font-medium" aria-live="polite">
                        {fill(message, {
                          device: zoneCity(device!),
                          account: zoneCity(accountTimeZone),
                          gap: formatOffsetGap(zoneOffset(device!, now!) - zoneOffset(accountTimeZone, now!)),
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2 px-3">
                      {clock(deviceLabel, device!)}
                      {clock(accountLabel, accountTimeZone)}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 px-3 py-2">
                      <button type="button" onClick={() => choose("account")} className={cn(action, tone.outline)}>
                        {keepAccountLabel}
                      </button>
                      <button type="button" onClick={() => choose("device")} className={cn(action, tone.solid)}>
                        {useDeviceLabel}
                      </button>
                    </div>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
