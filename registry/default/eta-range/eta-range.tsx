"use client"

import * as React from "react"
import { CalendarX, Clock, History, Truck } from "lucide-react"

import { cn } from "@/lib/utils"
import { dayFromIso, estimateEta, formatCutoff, type EtaInput } from "./eta"

export { estimateEta, type Eta, type EtaInput } from "./eta"

const DAY = 86_400_000
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, key: string) => v[key] ?? m)

/** "Thu 15 Oct", or "Thu 15" when the month is implied by the other end of a range. */
function formatDay(day: number, locale: string | undefined, withMonth = true) {
  const parts = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).formatToParts(day * DAY)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return [part("weekday"), part("day"), withMonth ? part("month") : ""].filter(Boolean).join(" ")
}

/** "Thu 15 – Sat 17 Oct", "Fri 30 Oct – Mon 2 Nov", or one day when the range has collapsed. */
export function formatRange(from: number, to: number, locale?: string) {
  if (from === to) return formatDay(from, locale)
  const sameMonth = new Date(from * DAY).getUTCMonth() === new Date(to * DAY).getUTCMonth()
  return `${formatDay(from, locale, !sameMonth)} – ${formatDay(to, locale)}`
}

function formatWait(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export interface EtaRangeProps extends Omit<React.ComponentProps<"div">, "children">, Omit<EtaInput, "now"> {
  /** Order time. Leave out to use the live clock (ticks every 30 s after mount). */
  now?: Date | number
  /** The range you quoted before, as "YYYY-MM-DD" days, to explain a change. */
  previous?: { earliest: string; latest: string }
  /** Why the estimate changed, e.g. "Carrier backlog after the long weekend". */
  reason?: string
  /** Show the cutoff countdown when the cutoff is this close, in minutes. */
  countdownWithin?: number
  /** Date and time formatting locale. */
  locale?: string
  /** Templates: `{range}`, `{day}`, `{share}`, `{wait}`, `{cutoff}`, `{ship}`, `{after}`, `{days}`, `{previous}`. */
  titleText?: string
  /** Text naming the most likely day. */
  likelyText?: string
  /** Text used when no day stands out. */
  flatText?: string
  /** Countdown to the cutoff. */
  countdownText?: string
  /** Shown after the cutoff has passed. */
  missedText?: string
  /** Text saying when the order ships. */
  shipsText?: string
  /** Text naming no-delivery days in the range. */
  closedText?: string
  /** Explains why the range widened. */
  widenedText?: string
  /** Word used for today. */
  todayLabel?: string
}

/**
 * A delivery estimate that doesn't fake precision. It quotes the range that covers most deliveries
 * with the most likely day (only when one day really stands out), counts the shipper's business days
 * and holidays, says what missing the cutoff (in the shipper's time zone) would cost, names days in the
 * range with no deliveries, and explains when the estimate widened since it was first quoted.
 */
export function EtaRange({
  now,
  timeZone = "Asia/Kolkata",
  cutoff = "16:00",
  processingDays,
  transit,
  workDays,
  deliveryDays,
  holidays,
  coverage = 0.9,
  previous,
  reason,
  countdownWithin = 360,
  locale = "en-IN",
  titleText = "Arrives {range}",
  likelyText = "most likely {day} ({share} of orders)",
  flatText = "any day in this range is about as likely",
  countdownText = "Order within {wait} to ship {ship} ({cutoff} cutoff). After that: {after}.",
  missedText = "Today's {cutoff} cutoff has passed, so it ships {ship}.",
  shipsText = "Ships {ship}.",
  closedText = "No deliveries on {days}; it isn't counted.",
  widenedText = "Widened from {previous}.",
  todayLabel = "today",
  className,
  ...props
}: EtaRangeProps) {
  const [clock, setClock] = React.useState<number>()
  React.useEffect(() => {
    if (now !== undefined) return
    const tick = () => setClock(Date.now())
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [now])

  const at = now ?? clock
  if (at === undefined) return <div data-slot="eta-range" aria-busy className={cn("h-24 w-full max-w-sm animate-pulse rounded-lg bg-muted", className)} {...props} />

  const rules = { timeZone, cutoff, processingDays, transit, workDays, deliveryDays, holidays, coverage }
  const eta = estimateEta({ now: at, ...rules })
  const late = eta.cutoffAt !== null ? estimateEta({ now: eta.cutoffAt, ...rules }) : null
  const instant = typeof at === "number" ? at : at.getTime()
  const cutoffLabel = formatCutoff(cutoff, timeZone, instant, locale)
  const prev = previous && { from: dayFromIso(previous.earliest), to: dayFromIso(previous.latest) }
  const widened = prev && (eta.earliest < prev.from || eta.latest > prev.to)
  const max = Math.max(...eta.days.map((d) => d.share), 1e-9)
  const strip: number[] = []
  for (let day = Math.min(eta.days[0].day, prev?.from ?? Infinity); day <= Math.max(eta.days[eta.days.length - 1].day, prev?.to ?? -Infinity); day++) strip.push(day)
  const shareOf = (day: number) => eta.days.find((d) => d.day === day)?.share
  const total = eta.days.reduce((a, d) => a + d.share, 0) || 1

  return (
    <div data-slot="eta-range" data-state={widened ? "widened" : eta.missedCutoff ? "missed-cutoff" : "ok"} className={cn("grid w-full max-w-sm gap-3 rounded-lg border bg-card p-3 text-card-foreground", className)} {...props}>
      <style>{"@keyframes cui-eta-range-grow{from{transform:scaleY(0)}}"}</style>
      <div className="flex gap-2">
        <Truck aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium">{fill(titleText, { range: formatRange(eta.earliest, eta.latest, locale) })}</p>
          <p className="text-sm text-muted-foreground">
            {eta.likely !== null ? fill(likelyText, { day: formatDay(eta.likely, locale, false), share: `${Math.round(eta.likelyShare * 100)}%` }) : flatText}
          </p>
        </div>
      </div>

      <div aria-hidden className="flex items-end gap-1">
        {strip.map((day) => {
          const share = shareOf(day)
          const inRange = day >= eta.earliest && day <= eta.latest
          const wasQuoted = prev && day >= prev.from && day <= prev.to
          return (
            <div key={day} className="grid min-w-0 flex-1 justify-items-center gap-1">
              <div className={cn("flex h-9 w-full items-end justify-center rounded-sm border border-transparent", wasQuoted && "border-dashed border-muted-foreground/50")}>
                {share === undefined ? (
                  <span className="h-full w-full rounded-sm bg-[repeating-linear-gradient(135deg,transparent_0_3px,var(--color-border)_3px_5px)]" />
                ) : (
                  <span
                    className={cn(
                      "w-3/5 origin-bottom rounded-t-sm motion-safe:animate-[cui-eta-range-grow_350ms_ease-out]",
                      day === eta.likely ? "bg-primary" : inRange ? "bg-foreground/45" : "bg-muted-foreground/20",
                    )}
                    style={{ height: `${Math.max(8, (share / max) * 100)}%` }}
                  />
                )}
              </div>
              <span className={cn("text-[11px] leading-none tabular-nums", inRange ? "font-medium" : "text-muted-foreground")}>
                {new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "narrow" }).format(day * DAY)}
                <br />
                {new Date(day * DAY).getUTCDate()}
              </span>
            </div>
          )
        })}
      </div>
      <p className="sr-only">{eta.days.map((d) => `${formatDay(d.day, locale)}: ${Math.round((d.share / total) * 100)}%`).join(", ")}</p>

      <div aria-live="polite" className="grid gap-1.5 text-xs">
        {eta.cutoffAt !== null && late && eta.cutoffAt - instant <= countdownWithin * 60_000 ? (
          <p className="flex gap-1.5 text-muted-foreground">
            <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{fill(countdownText, { wait: formatWait(eta.cutoffAt - instant), cutoff: cutoffLabel, ship: eta.shipDay === eta.orderDay ? todayLabel : formatDay(eta.shipDay, locale), after: formatRange(late.earliest, late.latest, locale) })}</span>
          </p>
        ) : eta.shipDay !== eta.orderDay ? (
          <p className="flex gap-1.5 text-muted-foreground">
            <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{fill(eta.missedCutoff ? missedText : shipsText, { cutoff: cutoffLabel, ship: formatDay(eta.shipDay, locale) })}</span>
          </p>
        ) : null}
        {eta.closed.length > 0 && (
          <p className="flex gap-1.5 text-muted-foreground">
            <CalendarX aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>{fill(closedText, { days: eta.closed.map((d) => formatDay(d, locale)).join(", ") })}</span>
          </p>
        )}
        {widened && prev && (
          <p className="flex gap-1.5 text-amber-700 dark:text-amber-400">
            <History aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {fill(widenedText, { previous: formatRange(prev.from, prev.to, locale) })}
              {reason && ` ${reason}.`}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
