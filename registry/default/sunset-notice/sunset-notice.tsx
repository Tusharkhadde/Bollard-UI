"use client"

import * as React from "react"
import { ArrowUpRight, BellOff, Sunset } from "lucide-react"

import { cn } from "@/lib/utils"
import { dayIn, formatTimeLeft, readSunsetHeaders, sunsetPhase, type HeaderSource, type SunsetPhase } from "./sunset-headers"

export * from "./sunset-headers"

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
    fill: "bg-sky-500",
  },
  warning: {
    surface: "border-amber-500/30 bg-background bg-linear-to-r from-amber-500/10 to-amber-500/10 text-amber-950 dark:text-amber-50",
    icon: "text-amber-600 dark:text-amber-400",
    muted: "text-amber-900/75 dark:text-amber-100/75",
    solid: "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
    outline: "border border-amber-700/25 hover:bg-amber-500/15 dark:border-amber-300/25",
    fill: "bg-amber-500",
  },
  danger: {
    surface: "border-red-500/30 bg-background bg-linear-to-r from-red-500/10 to-red-500/10 text-red-950 dark:text-red-50",
    icon: "text-red-600 dark:text-red-400",
    muted: "text-red-900/75 dark:text-red-100/75",
    solid: "bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300",
    outline: "border border-red-700/25 hover:bg-red-500/15 dark:border-red-300/25",
    fill: "bg-red-500",
  },
} as const

const DAY = 86_400_000
/** Days-left marks a snooze lasts until. */
const remindAt = [30, 7, 1]

/** localStorage can throw (blocked site data, private mode); a snooze then lasts this visit only. */
const storage = {
  get: (key: string) => {
    try {
      return Number(localStorage.getItem(key)) || undefined
    } catch {}
  },
  set: (key: string, value: number) => {
    try {
      localStorage.setItem(key, String(value))
    } catch {}
  },
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

type When = Date | string | number

export interface SunsetNoticeProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** What is going away, e.g. "Orders API v1". */
  subject: string
  /** The API response (or its Headers, or a plain header map). Cross-origin APIs must list Sunset, Deprecation and Link in Access-Control-Expose-Headers. */
  headers?: HeaderSource
  /** Overrides the Sunset header. */
  sunset?: When
  /** Overrides the Deprecation header. */
  deprecation?: When
  /** Exactly what stops working at sunset. */
  stops?: string[]
  /** Migration guide. Defaults to the Link rel="deprecation", then rel="sunset". */
  migrateHref?: string
  /** Time zone for dates; defaults to the reader's own. */
  timeZone?: string
  /** Locale for dates. */
  locale?: string
  /** Remembers "Remind me later" per subject and sunset date. A changed date shows the notice again. */
  storageKey?: string
  /** Called when the user snoozes, with the days-left mark the notice returns at. */
  onSnooze?: (days: number) => void
  /** Turns amber this many days before sunset, red at `finalDays`. */
  soonDays?: number
  /** Days before sunset when the notice turns red. */
  finalDays?: number
  /** Templates: `{subject}`, `{left}`, `{date}`, `{utc}`, `{days}` are filled in. */
  announcedText?: string
  /** Text once deprecated. */
  deprecatedText?: string
  /** Text with the sunset date. */
  sunsetText?: string
  /** Text once the sunset has passed. */
  pastText?: string
  /** Text when deprecated with no date. */
  noDateText?: string
  /** Note when the local day differs from the UTC date. */
  shiftedText?: string
  /** Detail after the sunset passed. */
  pastDetailText?: string
  /** Heading of what stops working. */
  stopsLabel?: string
  /** Label of the migration link. */
  migrateLabel?: string
  /** Label of the remind-me-later button. */
  remindLabel?: string
  /** Label of the deprecation date. */
  deprecatedLabel?: string
  /** Label of the sunset date. */
  sunsetLabel?: string
}

/**
 * Stops an API shutdown arriving as a surprise outage. It reads the Sunset
 * (RFC 8594) and Deprecation (RFC 9745) headers off a response, says exactly
 * what stops working and when in the reader's own zone (flagging when that's a
 * different calendar day than the header's UTC date), counts the days down,
 * links the migration guide from the Link header, and lets "Remind me later"
 * snooze only until the next mark (30, 7, 1 days left).
 */
export function SunsetNotice({
  subject,
  headers,
  sunset: sunsetProp,
  deprecation: deprecationProp,
  stops = [],
  migrateHref,
  timeZone,
  locale,
  storageKey = "cui-sunset",
  onSnooze,
  soonDays = 30,
  finalDays = 7,
  announcedText = "{subject} will be deprecated on {date}",
  deprecatedText = "{subject} is deprecated",
  sunsetText = "{subject} stops working in {left}",
  pastText = "{subject} was due to stop on {date}",
  noDateText = "No shutdown date has been announced yet.",
  shiftedText = "{date} your time ({utc} in UTC)",
  pastDetailText = "Requests may start failing at any moment.",
  stopsLabel = "Stops working",
  migrateLabel = "Migration guide",
  remindLabel = "Remind me {days} before",
  deprecatedLabel = "Deprecated {date}",
  sunsetLabel = "Sunset {date}",
  className,
  ...props
}: SunsetNoticeProps) {
  const [now, setNow] = React.useState<number>()
  const [snoozedTo, setSnoozedTo] = React.useState<number>()
  const [drawn, setDrawn] = React.useState(false)
  const parsed = React.useMemo(() => (headers ? readSunsetHeaders(headers) : undefined), [headers])
  const sunset = sunsetProp !== undefined ? new Date(sunsetProp) : parsed?.sunset
  const deprecation = deprecationProp !== undefined ? new Date(deprecationProp) : parsed?.deprecation
  const key = `${storageKey}:${subject}:${sunset?.toISOString() ?? "none"}`

  React.useEffect(() => {
    setNow(Date.now())
    setSnoozedTo(storage.get(key))
    const id = setInterval(() => setNow(Date.now()), 60_000)
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => {
      clearInterval(id)
      cancelAnimationFrame(frame)
    }
  }, [key])

  React.useEffect(() => {
    if (parsed?.inconsistent) console.warn(`[SunsetNotice] ${subject}: Sunset is earlier than Deprecation (RFC 9745 §4). Check with the API owner.`)
  }, [parsed?.inconsistent, subject])

  if (now === undefined) return null
  const phase: SunsetPhase | undefined = sunsetPhase({ sunset, deprecation }, now, soonDays, finalDays)
  const left = sunset ? sunset.getTime() - now : undefined
  const nextMark = left === undefined ? undefined : remindAt.find((days) => days * DAY < left)
  if (!phase || (snoozedTo !== undefined && left !== undefined && left > snoozedTo * DAY)) return null

  const format = (date: Date, zone = timeZone, withTime = true) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", ...(withTime && { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }), timeZone: zone }).format(date)
  const shifted = sunset !== undefined && dayIn(sunset, timeZone) !== dayIn(sunset, "UTC")
  const values = {
    subject,
    left: left === undefined ? "" : formatTimeLeft(left),
    date: phase === "announced" && deprecation instanceof Date ? format(deprecation) : sunset ? format(sunset) : "",
    utc: sunset ? format(sunset, "UTC", false) : "",
    days: nextMark === undefined ? "" : `${nextMark} ${nextMark === 1 ? "day" : "days"}`,
  }
  const title = phase === "past" ? pastText : phase === "announced" ? announcedText : sunset ? sunsetText : deprecatedText
  const detail = phase === "past" ? pastDetailText : !sunset ? noDateText : phase === "announced" ? "" : fill(shifted ? shiftedText : "{date}", values)
  const tone = tones[phase === "past" || phase === "final" ? "danger" : phase === "soon" ? "warning" : "info"]
  const href = migrateHref ?? parsed?.deprecationLink ?? parsed?.sunsetLink
  const span = sunset && deprecation instanceof Date ? sunset.getTime() - deprecation.getTime() : 0
  const elapsed = span > 0 && deprecation instanceof Date ? Math.min(1, Math.max(0, (now - deprecation.getTime()) / span)) : undefined

  const snooze = () => {
    if (nextMark === undefined) return
    storage.set(key, nextMark)
    setSnoozedTo(nextMark)
    onSnooze?.(nextMark)
  }

  return (
    <div data-slot="sunset-notice" data-state={phase} role="region" aria-label={fill(title, values)} className={cn("overflow-hidden rounded-lg border", tone.surface, className)} {...props}>
      <div className={bar}>
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <Sunset aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
          <div className="min-w-0 flex-1" role={phase === "past" ? "alert" : "status"}>
            <p className="font-medium tabular-nums">{fill(title, values)}</p>
            {detail && <p className={cn("text-xs", tone.muted)}>{detail}</p>}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {nextMark !== undefined && phase !== "past" && (
            <button type="button" onClick={snooze} className={cn(action, tone.outline)}>
              <BellOff aria-hidden className="size-4" />
              {fill(remindLabel, values)}
            </button>
          )}
          {href && (
            <a href={href} target="_blank" rel="noreferrer" className={cn(action, tone.solid)}>
              {migrateLabel}
              <ArrowUpRight aria-hidden className="size-4" />
            </a>
          )}
        </div>
      </div>
      {stops.length > 0 && (
        <div className="px-3 pb-2 text-xs">
          <p className={cn("font-medium", tone.muted)}>{stopsLabel}</p>
          <ul className="mt-1 grid gap-1">
            {stops.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className={cn("mt-1.5 size-1 shrink-0 rounded-full", tone.fill)} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {elapsed !== undefined && sunset && deprecation instanceof Date && (
        <div className="px-3 pb-2.5" aria-hidden>
          <div className="h-1 overflow-hidden rounded-full bg-current/10">
            <div
              className={cn("h-full rounded-full transition-[width] duration-400 ease-out motion-reduce:transition-none", tone.fill)}
              style={{ width: `${drawn ? elapsed * 100 : 0}%` }}
            />
          </div>
          <div className={cn("mt-1 flex justify-between gap-3 text-xs", tone.muted)}>
            <span>{fill(deprecatedLabel, { date: format(deprecation, timeZone, false) })}</span>
            <span>{fill(sunsetLabel, { date: format(sunset, timeZone, false) })}</span>
          </div>
        </div>
      )}
    </div>
  )
}
