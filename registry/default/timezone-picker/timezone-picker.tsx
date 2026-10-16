"use client"

// Bollard UI — timezone-picker · MIT licence · https://bollard-ui.vercel.app/components/timezone-picker

import * as React from "react"
import { tzOffset } from "@date-fns/tz"
import { autoUpdate, flip, offset as gap, shift, size, useFloating } from "@floating-ui/react"
import { CalendarClock, Check, Globe, MonitorSmartphone, Search } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { formatOffsetGap, sameClock, zoneCity } from "@/registry/default/timezone-mismatch/timezone-mismatch"
import { COUNTRY_ALIASES, LEGACY_ZONES, ZONE_ABBREVIATIONS, ZONE_COUNTRY } from "./timezone-data"

/** 330 → "UTC+5:30", -420 → "UTC−7". */
export function formatUtcOffset(minutes: number) {
  const abs = Math.abs(minutes)
  return `UTC${minutes < 0 ? "−" : "+"}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, "0")}` : ""}`
}

const HOUR = 3_600_000

/** UTC offset in minutes via @date-fns/tz; NaN-safe for unknown zones (0). */
const offsetAt = (timeZone: string, at: number) => {
  const minutes = tzOffset(timeZone, new Date(at))
  return Number.isFinite(minutes) ? minutes : 0
}

/** The next time `timeZone` changes its UTC offset within `days`, found to the minute. */
export function nextOffsetChange(timeZone: string, from: number, days = 30) {
  if (!Number.isFinite(from)) return null
  const start = offsetAt(timeZone, from)
  for (let t = from + 6 * HOUR; t <= from + days * 24 * HOUR; t += 6 * HOUR) {
    if (offsetAt(timeZone, t) === start) continue
    let [lo, hi] = [t - 6 * HOUR, t]
    while (hi - lo > 60_000) {
      const mid = Math.floor((lo + hi) / 2)
      if (offsetAt(timeZone, mid) === start) lo = mid
      else hi = mid
    }
    return { at: hi, from: start, to: offsetAt(timeZone, hi) }
  }
  return null
}

export interface ZoneMatch {
  zone: string
  city: string
  country?: string
  /** What an abbreviation means for this zone ("Israel Standard Time"). */
  note?: string
}

/**
 * Finds zones by city, country or abbreviation. `ambiguous` is true when an
 * abbreviation means more than one zone (IST, PST, CST, MST...), so the caller
 * must ask instead of picking the first.
 */
export function searchTimeZones(query: string, zones: string[], countryName: (code: string) => string | undefined) {
  const q = query.trim().toLowerCase()
  const abbr = ZONE_ABBREVIATIONS[q.toUpperCase()]
  const describe = (zone: string, note?: string): ZoneMatch => ({ zone, city: zoneCity(zone), country: ZONE_COUNTRY[zone] && countryName(ZONE_COUNTRY[zone]), note })
  if (abbr) return { ambiguous: abbr.length > 1, results: abbr.map((a) => describe(a.zone, a.name)) }
  if (!q) return { ambiguous: false, results: [] }
  const alias = COUNTRY_ALIASES[q]
  const scored = zones.flatMap((zone) => {
    const m = describe(zone)
    const city = m.city.toLowerCase()
    const score = city.startsWith(q) ? 0 : (alias && ZONE_COUNTRY[zone] === alias) || m.country?.toLowerCase().startsWith(q) ? 1 : city.includes(q) || zone.toLowerCase().includes(q) ? 2 : -1
    return score < 0 ? [] : [{ m, score }]
  })
  return { ambiguous: false, results: scored.sort((a, b) => a.score - b.score).slice(0, 8).map((s) => s.m) }
}

/** Every visible string; `{placeholders}` are filled in. Individual props of the same name still win. */
export const TIMEZONE_PICKER_MESSAGES = {
  placeholder: "City, country or abbreviation",
  /** `{abbr}` and `{count}` are filled in. */
  ambiguousText: "{abbr} can mean {count} different zones. Pick one.",
  noResultsText: "No matching zone.",
  /** `{direction}` (forward/back), `{amount}`, `{date}` and `{offset}` are filled in. */
  dstText: "Clocks go {direction} {amount} on {date}, to {offset}.",
  /** `{city}` and `{gap}` are filled in. */
  mismatchText: "Your device is on {city} time, {gap} of this zone.",
  useDeviceLabel: "Use {city}",
  /** `{zone}` is the picked city. Announced once after a pick. */
  pickedText: "{zone} selected.",
  forward: "forward",
  back: "back",
  now: "now",
}
export type TimezonePickerMessages = typeof TIMEZONE_PICKER_MESSAGES

export interface TimezonePickerProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Visible label. */
  label?: string
  /** Selected IANA zone, e.g. "Asia/Kolkata". */
  value?: string
  /** Starting IANA zone when uncontrolled. */
  defaultValue?: string
  /** Called with the chosen IANA zone. */
  onValueChange?: (timeZone: string) => void
  /** Override the detected device zone (tests, demos). */
  deviceTimeZone?: string
  /** Warn about a clock change this many days ahead. */
  dstWarningDays?: number
  /** Locale for times and names. */
  locale?: string
  /** Placeholder of the search input. */
  placeholder?: string
  /** `{abbr}` and `{count}` are filled in. */
  ambiguousText?: string
  /** Shown when nothing matches. */
  noResultsText?: string
  /** `{direction}` (forward/back), `{amount}`, `{date}` and `{offset}` are filled in. */
  dstText?: string
  /** `{city}` and `{gap}` are filled in. */
  mismatchText?: string
  /** Label of the use-device-zone button. */
  useDeviceLabel?: string
  /** Override any text (see `TIMEZONE_PICKER_MESSAGES`). */
  messages?: Partial<TimezonePickerMessages>
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)
const line = "flex gap-1.5 text-xs text-amber-700 dark:text-amber-400"
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * A time zone picker that won't guess. Search by city, country or abbreviation; an
 * ambiguous one (IST is India, Israel or Ireland) lists every meaning and waits for a
 * choice. Each result shows its local time and UTC offset, and the selection warns
 * about a clock change in the coming weeks and about a zone that differs from the device's.
 * The list is positioned with Floating UI, so it flips above the field near the bottom of
 * the screen instead of being clipped.
 */
export function TimezonePicker({
  label = "Time zone",
  value,
  defaultValue = "UTC",
  onValueChange,
  deviceTimeZone,
  dstWarningDays = 30,
  locale,
  messages,
  placeholder,
  ambiguousText,
  noResultsText,
  dstText,
  mismatchText,
  useDeviceLabel,
  className,
  ...props
}: TimezonePickerProps) {
  const own = Object.fromEntries(Object.entries({ placeholder, ambiguousText, noResultsText, dstText, mismatchText, useDeviceLabel }).filter(([, v]) => v !== undefined))
  const say: TimezonePickerMessages = { ...TIMEZONE_PICKER_MESSAGES, ...messages, ...own }
  const reduce = useReducedMotion()
  const [announce, setAnnounce] = React.useState("")
  const [inner, setInner] = React.useState(defaultValue)
  const [query, setQuery] = React.useState<string | null>(null)
  const [active, setActive] = React.useState(0)
  const [now, setNow] = React.useState<number>()
  const [device, setDevice] = React.useState(deviceTimeZone)
  const zone = value ?? inner
  const id = React.useId()

  React.useEffect(() => {
    const detected = deviceTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    setDevice(LEGACY_ZONES[detected] ?? detected)
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [deviceTimeZone])

  const regions = React.useMemo(() => new Intl.DisplayNames(locale ?? "en", { type: "region" }), [locale])
  const zones = React.useMemo(
    () => [...new Set([...Intl.supportedValuesOf("timeZone").map((z) => LEGACY_ZONES[z] ?? z), ...Object.keys(ZONE_COUNTRY), "UTC"])],
    [],
  )
  const countryName = (code: string) => regions.of(code)
  const search = query === null ? null : searchTimeZones(query, zones, countryName)
  const open = !!search && query !== ""
  const { refs, floatingStyles } = useFloating({
    open,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      gap(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, { width: `${rects.reference.width}px`, maxHeight: `${Math.max(120, Math.min(320, availableHeight))}px` })
        },
      }),
    ],
  })

  const clock = (tz: string, at: number) => new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at)
  const shortName = (tz: string, at: number) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value

  const choose = (next: string) => {
    if (value === undefined) setInner(next)
    onValueChange?.(next)
    setQuery(null)
    setAnnounce(fill(say.pickedText, { zone: zoneCity(next) }))
  }

  const selectedCountry = ZONE_COUNTRY[zone] && countryName(ZONE_COUNTRY[zone])
  const display = [zoneCity(zone), selectedCountry].filter(Boolean).join(", ")
  const offset = now === undefined ? 0 : offsetAt(zone, now)
  const change = now === undefined ? null : nextOffsetChange(zone, now, dstWarningDays)
  const deviceDiffers = now !== undefined && device && !sameClock(zone, device, now)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!search) return
    const count = search.results.length
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % count : (i - 1 + count) % count))
    } else if (e.key === "Enter" && search.results[active]) {
      e.preventDefault()
      choose(search.results[active].zone)
    } else if (e.key === "Escape") setQuery(null)
  }

  return (
    <div data-slot="timezone-picker" className={cn("grid w-full max-w-sm gap-1.5", className)} {...props}>
      <label htmlFor={`${id}-input`} className="w-fit text-sm font-medium">{label}</label>
      <div ref={refs.setReference} className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          value={query ?? display}
          placeholder={say.placeholder}
          autoComplete="off"
          spellCheck={false}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const next = searchTimeZones(e.target.value, zones, countryName)
            setQuery(e.target.value)
            setActive(next.ambiguous ? -1 : 0)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setQuery(null)}
          className="h-9 w-full min-w-0 rounded-md border bg-transparent pr-3 pl-9 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <AnimatePresence>
          {open && (
            <motion.div
              ref={refs.setFloating}
              style={floatingStyles}
              initial={reduce ? false : { opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 520, damping: 36 }}
              className="z-50 flex origin-top flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
            >
              {search.ambiguous && (
                <p className="shrink-0 border-b bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300" role="status">
                  {fill(say.ambiguousText, { abbr: query!.trim().toUpperCase(), count: String(search.results.length) })}
                </p>
              )}
              <ul id={`${id}-list`} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-auto p-1">
                {search.results.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">{say.noResultsText}</li>}
                {search.results.map((m, i) => {
                  const abbr = query!.trim().toUpperCase()
                  const current = now === undefined ? undefined : shortName(m.zone, now)
                  const daylightNow = m.note && current && /^[A-Z]+DT$/.test(current) && abbr.endsWith("ST") && current !== abbr
                  return (
                    <li
                      key={m.zone}
                      id={`${id}-opt-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(m.zone)}
                      onMouseEnter={() => setActive(i)}
                      className="relative flex cursor-default items-center gap-3 rounded-sm px-2 py-1.5 text-sm"
                    >
                      {i === active && (
                        <motion.span
                          layoutId={reduce ? undefined : `${id}-active`}
                          transition={{ type: "spring", stiffness: 600, damping: 40 }}
                          aria-hidden
                          className="absolute inset-0 rounded-sm bg-accent"
                        />
                      )}
                      <span className="relative min-w-0 flex-1">
                        <span className="block">{[m.city, m.country].filter(Boolean).join(", ")}</span>
                        {m.note && <span className="block text-xs text-muted-foreground">{m.note}{daylightNow ? ` · on ${current} ${say.now}` : ""}</span>}
                      </span>
                      {now !== undefined && (
                        <span className="relative shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {clock(m.zone, now)} · {formatUtcOffset(offsetAt(m.zone, now))}
                        </span>
                      )}
                      {m.zone === zone && <Check aria-hidden className="relative size-4 shrink-0" />}
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {now !== undefined && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Globe aria-hidden className="size-3.5" />
          {clock(zone, now)} {say.now} · {formatUtcOffset(offset)}
          {shortName(zone, now)?.match(/^[A-Z]{2,5}$/) ? ` (${shortName(zone, now)})` : ""}
        </p>
      )}
      <span className="sr-only" aria-live="polite">{announce}</span>
      <div className="grid gap-1">
        <AnimatePresence initial={false}>
          {change && (
            <motion.p
              key={`dst-${zone}`}
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(line, "overflow-hidden")}
            >
              <CalendarClock aria-hidden className="mt-px size-3.5 shrink-0" />
              {fill(say.dstText, {
                direction: change.to > change.from ? say.forward : say.back,
                amount: formatOffsetGap(change.to - change.from).replace(/ (ahead|behind)$/, ""),
                date: new Intl.DateTimeFormat(locale, { timeZone: zone, weekday: "short", day: "numeric", month: "short" }).format(change.at),
                offset: formatUtcOffset(change.to),
              })}
            </motion.p>
          )}
          {deviceDiffers && (
            <motion.p
              key={`device-${zone}`}
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(line, "overflow-hidden")}
            >
              <span className="flex h-6 shrink-0 items-center"><MonitorSmartphone aria-hidden className="size-3.5" /></span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="py-1">{fill(say.mismatchText, { city: zoneCity(device), gap: formatOffsetGap(offsetAt(device, now) - offset) })}</span>
                <button
                  type="button"
                  onClick={() => {
                    choose(device)
                    document.getElementById(`${id}-input`)?.focus()
                  }}
                  className={fixClass}
                >
                  {fill(say.useDeviceLabel, { city: zoneCity(device) })}
                </button>
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
