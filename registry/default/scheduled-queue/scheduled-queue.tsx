"use client"

import * as React from "react"
import { CalendarClock, Clock, Lock, MoonStar, TriangleAlert, X } from "lucide-react"

import { cn } from "@/lib/utils"

export interface ScheduledItem {
  id: string
  /** e.g. "Diwali offer · all customers". */
  title: string
  /** Secondary line, e.g. "84 recipients". */
  detail?: string
  /** When it goes out. */
  at: Date | number | string
  /** Where it lands (IANA zone, e.g. "Asia/Dubai"). Quiet hours are judged here. Defaults to the viewer's zone. */
  timeZone?: string
}

/** Wall-clock hour (0–23) of `at` in `timeZone`. */
export function hourIn(at: number, timeZone?: string) {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(at)) % 24
}

/** True when `hour` is inside quiet hours that may wrap midnight (22 → 7). */
export const isQuiet = (hour: number, start: number, end: number) => (start > end ? hour >= start || hour < end : hour >= start && hour < end)

/** The first `hour`:00 in `timeZone` after `at`: where a 2 AM send should move to. */
export function nextHourIn(at: number, hour: number, timeZone?: string) {
  let t = Math.floor(at / 3_600_000) * 3_600_000 + 3_600_000
  // Step hour by hour (DST-safe) until the wall clock there reads `hour`.
  for (let i = 0; i < 49 && hourIn(t, timeZone) !== hour; i++) t += 3_600_000
  const minutes = Number(new Intl.DateTimeFormat("en-US", { minute: "numeric", timeZone }).format(t))
  return t - minutes * 60_000
}

/** "2 days", "3 hr 20 min", "14 min", "3:07", with units localized for `locale`. */
export function formatDuration(ms: number, locale?: string) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const unit = (n: number, u: "day" | "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: u === "day" ? "long" : "short" }).format(n)
  if (s >= 2 * 86_400) return unit(Math.round(s / 86_400), "day")
  if (s >= 3600) return unit(Math.floor(s / 3600), "hour") + (s % 3600 >= 60 ? ` ${unit(Math.floor((s % 3600) / 60), "minute")}` : "")
  if (s >= 600) return unit(Math.round(s / 60), "minute")
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** "in 2 days", "in 3 hr 20 min", "in 14 min", "in 3:07". */
export const formatCountdown = (ms: number, locale?: string) => `in ${formatDuration(ms, locale)}`

const toLocalInput = (t: number) => {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
const small =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors outline-none hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"

export interface ScheduledQueueProps extends Omit<React.ComponentProps<"ul">, "children"> {
  items: ScheduledItem[]
  onCancel: (id: string) => void | Promise<void>
  onReschedule: (id: string, at: Date) => void | Promise<void>
  /** Offered on items whose time has passed without sending. */
  onSendNow?: (id: string) => void
  /** How long before the cancel cutoff a row turns into a last-chance warning, in ms. */
  lastChance?: number
  /** Items lock this many ms before sending (the provider is preparing them) and can no longer be cancelled. */
  cutoff?: number
  /** Quiet hours in the item's time zone, e.g. 22 → 7. */
  quietHours?: { start: number; end: number }
  /** The hour the one-tap quiet-hours fix moves an item to. */
  fixHour?: number
  locale?: string
  /** Templates: `{left}`, `{time}`, `{zone}`, `{ago}` are filled in. */
  lastChanceText?: string
  lockedText?: string
  sendingText?: string
  overdueText?: string
  quietText?: string
  fixLabel?: string
  sendNowLabel?: string
  rescheduleLabel?: string
  cancelLabel?: string
  saveLabel?: string
  pastWarning?: string
  emptyText?: string
  /** Countdown chip; `{time}` is filled in ("in {time}"). */
  countdownText?: string
  /** Chip on an item whose time passed without sending. */
  missedLabel?: string
  /** Zone name when an item has no `timeZone`. */
  localZoneText?: string
  /** Accessible name of the reschedule field; `{title}` is filled in. */
  newTimeLabel?: string
  /** Announced once when a row enters its last-chance window or locks; `{title}` is filled in. */
  lastChanceAnnouncement?: string
  lockedAnnouncement?: string
}

/**
 * A queue of scheduled sends that makes the deadline you actually have
 * visible. Each row counts down live; inside the last-chance window it
 * highlights and counts down to the cancel cutoff (when the provider locks it
 * in), not to the send time. It flags sends landing in quiet hours where the
 * audience lives, with a one-tap move to a sane hour, and items whose time
 * passed without sending. Reschedule refuses a time in the past.
 */
export function ScheduledQueue({
  items,
  onCancel,
  onReschedule,
  onSendNow,
  lastChance = 5 * 60_000,
  cutoff = 60_000,
  quietHours = { start: 22, end: 7 },
  fixHour = 9,
  locale,
  lastChanceText = "Last chance · {left} left to cancel",
  lockedText = "Locked in · sending {left}",
  sendingText = "Going out now",
  overdueText = "Was due {ago} and hasn't gone out",
  quietText = "Lands at {time} in {zone}",
  fixLabel = "Move to {time}",
  sendNowLabel = "Send now",
  rescheduleLabel = "Reschedule",
  cancelLabel = "Cancel",
  saveLabel = "Save",
  pastWarning = "That time has already passed.",
  emptyText = "Nothing scheduled.",
  countdownText = "in {time}",
  missedLabel = "Missed",
  localZoneText = "your time zone",
  newTimeLabel = "New time for {title}",
  lastChanceAnnouncement = "Last chance to cancel {title}.",
  lockedAnnouncement = "{title} is locked in and can no longer be cancelled.",
  className,
  ...props
}: ScheduledQueueProps) {
  const [now, setNow] = React.useState<number>()
  const [editing, setEditing] = React.useState<{ id: string; value: string }>()
  const rows = React.useRef(new Map<string, HTMLLIElement>())

  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const clock = (t: number, timeZone?: string, withZone = true) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: withZone ? "short" : undefined }).format(t)
  const relativeAgo = (ms: number) => {
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    const minutes = Math.max(1, Math.round(ms / 60_000))
    return minutes < 90 ? relative.format(-minutes, "minute") : minutes < 2880 ? relative.format(-Math.round(minutes / 60), "hour") : relative.format(-Math.round(minutes / 1440), "day")
  }
  const hourLabel = (t: number, timeZone?: string) => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(t)

  const reschedule = async (id: string, at: number) => {
    setEditing(undefined)
    try {
      await onReschedule(id, new Date(at))
    } catch {
      return // The caller reports the error; the row keeps its old time.
    }
    const el = rows.current.get(id)
    if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      el.animate([{ backgroundColor: "rgb(16 185 129 / 0.18)" }, { backgroundColor: "transparent" }], { duration: 400, easing: "ease-out" })
  }

  const sorted = [...items].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  if (!sorted.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>

  return (
    <ul data-slot="scheduled-queue" className={cn("w-full divide-y overflow-hidden rounded-xl border bg-background text-sm", className)} {...props}>
      {sorted.map((item) => {
        const at = new Date(item.at).getTime()
        const left = now === undefined ? Infinity : at - now
        const state = left <= -120_000 ? "overdue" : left <= 0 ? "sending" : left <= cutoff ? "locked" : left <= cutoff + lastChance ? "last" : "queued"
        const hour = hourIn(at, item.timeZone)
        const quiet = state === "queued" || state === "last" ? isQuiet(hour, quietHours.start, quietHours.end) : false
        const fixAt = nextHourIn(at, fixHour, item.timeZone)
        const zone = item.timeZone?.split("/").pop()?.replace(/_/g, " ") ?? localZoneText
        const countdown = fill(countdownText, { time: formatDuration(left, locale) })
        const values = {
          left: state === "last" ? formatDuration(left - cutoff, locale) : countdown,
          time: hourLabel(at, item.timeZone),
          zone,
          ago: now === undefined ? "" : relativeAgo(now - at),
        }
        const edit = editing?.id === item.id ? editing : undefined
        const editPast = edit ? new Date(edit.value).getTime() <= (now ?? 0) : false
        const urgent = state === "last" || state === "locked"
        return (
          <li
            key={item.id}
            ref={(el) => void (el ? rows.current.set(item.id, el) : rows.current.delete(item.id))}
            data-state={state}
            className={cn("space-y-1.5 px-4 py-3 transition-colors duration-300", urgent && "bg-amber-500/10", state === "overdue" && "bg-red-500/5")}
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  urgent ? "bg-amber-500" : state === "overdue" ? "bg-red-500" : "bg-muted-foreground/40",
                  state === "last" && "motion-safe:animate-pulse",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {clock(at, item.timeZone)}
                  {item.detail && ` · ${item.detail}`}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                  urgent ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : state === "overdue" ? "text-red-700 dark:text-red-400" : "bg-muted text-muted-foreground",
                )}
              >
                {state === "overdue" ? missedLabel : state === "sending" ? sendingText : countdown}
              </span>
            </div>

            {/* Announce state changes once; the per-second countdown below stays silent. */}
            <p className="sr-only" aria-live="polite">
              {state === "last" ? fill(lastChanceAnnouncement, { title: item.title }) : state === "locked" ? fill(lockedAnnouncement, { title: item.title }) : ""}
            </p>
            <div className="space-y-1.5 pl-5">
              {(state === "last" || state === "locked") && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {state === "locked" ? <Lock aria-hidden className="size-3.5" /> : <Clock aria-hidden className="size-3.5" />}
                  {fill(state === "locked" ? lockedText : lastChanceText, values)}
                </p>
              )}
              {quiet && (
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <span className="flex gap-1.5">
                    <MoonStar aria-hidden className="mt-px size-3.5 shrink-0" />
                    {fill(quietText, values)}
                  </span>
                  <button type="button" onClick={() => void reschedule(item.id, fixAt)} className={fixClass}>
                    {fill(fixLabel, { time: hourLabel(fixAt, item.timeZone) })}
                  </button>
                </p>
              )}
              {state === "overdue" && (
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
                  <span className="flex gap-1.5">
                    <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                    {fill(overdueText, values)}
                  </span>
                  {onSendNow && (
                    <button type="button" onClick={() => onSendNow(item.id)} className={cn(fixClass, "border-red-500/40 text-red-800 hover:bg-red-500/10 dark:text-red-200")}>
                      {sendNowLabel}
                    </button>
                  )}
                </p>
              )}
              {edit ? (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="datetime-local"
                      aria-label={fill(newTimeLabel, { title: item.title })}
                      value={edit.value}
                      autoFocus
                      aria-invalid={editPast || undefined}
                      onChange={(event) => setEditing({ id: item.id, value: event.target.value })}
                      onKeyDown={(event) => event.key === "Escape" && setEditing(undefined)}
                      className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
                    />
                    <button type="button" disabled={editPast || !edit.value} onClick={() => void reschedule(item.id, new Date(edit.value).getTime())} className={cn(small, "bg-primary text-primary-foreground hover:bg-primary/90")}>
                      {saveLabel}
                    </button>
                  </div>
                  {editPast && (
                    <p role="alert" className="text-xs text-destructive">
                      {pastWarning}
                    </p>
                  )}
                </div>
              ) : (
                state !== "sending" && (
                  <div className="flex gap-2">
                    <button type="button" disabled={state === "locked"} onClick={() => setEditing({ id: item.id, value: toLocalInput(Math.max(at, (now ?? at) + 600_000)) })} className={cn(small, "h-7 px-2 text-xs hover:bg-accent")}>
                      <CalendarClock aria-hidden className="size-3.5" />
                      {rescheduleLabel}
                    </button>
                    <button type="button" disabled={state === "locked"} onClick={() => void Promise.resolve().then(() => onCancel(item.id)).catch(() => {})} className={cn(small, "h-7 px-2 text-xs hover:bg-accent", urgent && "border border-amber-700/25 dark:border-amber-300/25")}>
                      <X aria-hidden className="size-3.5" />
                      {cancelLabel}
                    </button>
                  </div>
                )
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
