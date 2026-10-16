"use client"

import * as React from "react"
import { BedDouble, CircleCheck, Moon, Plane, TriangleAlert, Undo2 } from "lucide-react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { applyFix, checkTrip, instantOf, parseDay, parseLocal, shiftDay, type StayFix, type TripLeg, type TripProblem, type TripStay } from "./chain"

export { applyFix, checkTrip, firstNightAfter, instantOf, lastNightBefore, parseLocal } from "./chain"
export type { ParsedTime, StayFix, TripLeg, TripProblem, TripStay } from "./chain"

/** Every visible string. Placeholders in braces are filled in; "one|other" picks by {count}. */
export const TRIP_DATE_CHAIN_MESSAGES = {
  nightsLabel: "Each column is a night",
  stays: "Stays",
  nights: "{count} night|{count} nights",
  arrivalNight: "{leg} lands at {time} on {date}, but {stay} only starts on {checkIn}, with check-in in the afternoon. Book from {night} to have a bed when you land.",
  noBedOnArrival: "Nothing is booked for when {leg} lands at {time} on {date}.",
  paidBeforeArrival: "{stay} starts on {checkIn}, but {leg} only lands on {date} at {time}: {nights} paid while you're travelling.",
  paidAfterDeparture: "{leg} leaves at {time} on {date}, so the night of {night} is paid but you'll leave for the airport that evening. Keep it only if you want the room until then.",
  paidInAir: "{stay} is booked for {nights} while you're in the air.",
  gap: "No bed for the night of {nights}.|No bed for {count} nights: {nights}.",
  double: "{a} and {b} are both booked for the night of {nights}: paid twice.|{a} and {b} are both booked for {count} nights ({nights}): paid twice.",
  legOrder: "{leg} lands before it takes off in real time. Check the times or time zones.",
  connection: "Only {gap} between {leg} landing and {next} taking off. Check you can make it.",
  connectionImpossible: "{next} takes off before {leg} lands. Check the times or time zones.",
  nightDeparture: "{leg} leaves at {time} on {date}. That's {weekday} night: be at the airport on {weekday} evening.",
  checkIn: "Check in {date}",
  checkOut: "Check out {date}",
  extend: "Extend {stay} to {date}",
  allGood: "One bed for every night from landing to take-off.",
  fixed: "{stay} now runs {from} to {to}.",
  undo: "Undo",
  noBed: "No bed",
  twice: "Paid twice",
  unused: "Paid, not used",
}

export type TripDateChainMessages = typeof TRIP_DATE_CHAIN_MESSAGES

const fill = (tpl: string, v: Record<string, string | number>) =>
  (tpl.includes("|") ? tpl.split("|")[Number(v.count) === 1 ? 0 : 1] : tpl).replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))
const fixClass =
  "inline-flex min-h-6 max-w-full items-center py-0.5 text-left rounded-md border border-amber-500/40 px-2 text-xs font-medium text-amber-900 outline-none transition-colors hover:bg-amber-500/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-amber-200"
const COL = 36
const keyOf = (p: TripProblem) => `${p.kind}-${"nights" in p ? p.nights[0] : "legId" in p ? p.legId : ""}`

export interface TripDateChainProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Flights and trains, with local times as printed. */
  legs: TripLeg[]
  /** Controlled stays. */
  value?: TripStay[]
  /** Initial stays when uncontrolled. */
  defaultValue?: TripStay[]
  onValueChange?: (stays: TripStay[]) => void
  /** Times before this hour belong to the previous night (landing 00:50 needs the room from the night before). Default 6. */
  earlyHours?: number
  /** With zones on both ends, a gap shorter than this between landing and the next take-off is flagged. Default 60. */
  minConnectionMinutes?: number
  /** 12- or 24-hour clock follows the locale. */
  locale?: string
  messages?: Partial<TripDateChainMessages>
}

/**
 * Stops the hotel booked for the wrong night. Each stay is a bar on a night-by-night strip under the flights,
 * so landing at 00:50 with the room from that date, nights paid before a +1 arrival, gap nights, double-booked
 * nights and a room kept past a 00:35 departure show up as columns with no bed, two beds or a bed unused.
 * One tap slides the stay's bar to the right dates, with Undo, and a small-hours departure is read back as
 * the evening before ("be at the airport on Saturday evening").
 */
export function TripDateChain({ legs, value: valueProp, defaultValue = [], onValueChange, earlyHours = 6, minConnectionMinutes = 60, locale, messages, className, ...props }: TripDateChainProps) {
  const t = { ...TRIP_DATE_CHAIN_MESSAGES, ...messages }
  const [inner, setInner] = React.useState<TripStay[]>(defaultValue)
  const stays = (valueProp ?? inner).slice(0, 50)
  const [undo, setUndo] = React.useState<TripStay[] | null>(null)
  const [status, setStatus] = React.useState("")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const stripRef = React.useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const problems = checkTrip(legs, stays, earlyHours, minConnectionMinutes)
  const safeLegs = (legs ?? []).filter((l) => parseLocal(l?.depart) && parseLocal(l?.arrive))

  const day = (key: string, o: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => {
    const d = parseDay(key)
    return d ? new Intl.DateTimeFormat(locale, o).format(d) : key
  }
  const time = (raw: string) => {
    const p = parseLocal(raw)
    return p ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, p.hour, p.minute)) : raw
  }
  const legOf = (id: string) => safeLegs.find((l) => l.id === id)
  const stayOf = (id?: string) => stays.find((s) => s.id === id)
  const nightList = (n: string[]) => (n.length > 2 ? `${day(n[0], { day: "numeric", month: "short" })}–${day(n.at(-1)!, { day: "numeric", month: "short" })}` : n.map((x) => day(x)).join(", "))

  const commit = (next: TripStay[]) => {
    if (valueProp === undefined) setInner(next)
    onValueChange?.(next)
  }
  const runFix = (f: StayFix) => {
    const next = applyFix(stays, f)
    setUndo(stays)
    commit(next)
    const s = next.find((x) => x.id === f.stayId)
    if (s) setStatus(fill(t.fixed, { stay: s.name, from: day(s.checkIn), to: day(s.checkOut) }))
    // Focus the next fix from the new result; a line animating out must not take it.
    const left = checkTrip(legs, next, earlyHours, minConnectionMinutes).find((p) => "fix" in p && p.fix)
    requestAnimationFrame(() => ((left && rootRef.current?.querySelector<HTMLElement>(`[data-fix="${keyOf(left)}"]`)) || rootRef.current?.querySelector<HTMLElement>("[data-undo]"))?.focus())
  }
  const fixLabel = (p: TripProblem, f: StayFix) => {
    const s = stayOf(f.stayId)
    if (p.kind === "gap" && f.checkOut) return fill(t.extend, { stay: s?.name ?? "", date: day(f.checkOut, { weekday: "short", day: "numeric" }) })
    return f.checkIn ? fill(t.checkIn, { date: day(f.checkIn, { weekday: "short", day: "numeric" }) }) : fill(t.checkOut, { date: day(f.checkOut!, { weekday: "short", day: "numeric" }) })
  }
  const text = (p: TripProblem) => {
    const leg = "legId" in p ? legOf(p.legId) : undefined
    const L = leg?.label ?? ""
    switch (p.kind) {
      case "arrivalNight": {
        const s = stayOf(p.stayId)
        return s ? fill(t.arrivalNight, { leg: L, time: time(leg!.arrive), date: day(leg!.arrive.slice(0, 10)), stay: s.name, checkIn: day(s.checkIn), night: day(p.nights[0]) }) : fill(t.noBedOnArrival, { leg: L, time: leg ? time(leg.arrive) : "", date: leg ? day(leg.arrive.slice(0, 10)) : "" })
      }
      case "paidBeforeArrival": {
        const s = stayOf(p.stayId)
        return fill(t.paidBeforeArrival, { stay: s?.name ?? "", checkIn: day(s?.checkIn ?? ""), leg: L, date: day(leg!.arrive.slice(0, 10)), time: time(leg!.arrive), nights: fill(t.nights, { count: p.nights.length }) })
      }
      case "paidAfterDeparture":
        return fill(t.paidAfterDeparture, { leg: L, time: time(leg!.depart), date: day(leg!.depart.slice(0, 10)), night: nightList(p.nights) })
      case "paidInAir":
        return fill(t.paidInAir, { stay: stayOf(p.stayId)?.name ?? "", nights: nightList(p.nights) })
      case "gap":
        return fill(t.gap, { count: p.nights.length, nights: nightList(p.nights) })
      case "double":
        return fill(t.double, { count: p.nights.length, a: stayOf(p.stayIds[0])?.name ?? "", b: stayOf(p.stayIds[1])?.name ?? "", nights: nightList(p.nights) })
      case "legOrder":
        return fill(t.legOrder, { leg: L })
      case "connection": {
        const next = legOf(p.nextId)?.label ?? ""
        return p.minutes <= 0 ? fill(t.connectionImpossible, { leg: L, next }) : fill(t.connection, { leg: L, next, gap: `${Math.floor(p.minutes / 60) ? `${Math.floor(p.minutes / 60)}h ` : ""}${p.minutes % 60}m` })
      }
      case "nightDeparture":
        return fill(t.nightDeparture, { leg: L, time: time(leg!.depart), date: day(leg!.depart.slice(0, 10)), weekday: day(p.evening, { weekday: "long" }) })
    }
  }

  // The strip: columns are nights (noon to noon), so a 00:35 take-off sits inside the evening before.
  const keys = [
    ...stays.flatMap((s) => [s.checkIn, shiftDay(s.checkOut, -1)]),
    ...safeLegs.flatMap((l) => [l.depart, l.arrive].map((raw) => shiftDay(raw.slice(0, 10), parseLocal(raw)!.hour < 12 ? -1 : 0))),
  ].filter((k) => parseDay(k)).sort()
  const start = keys[0]
  const count = start ? Math.min(45, Math.max(1, Math.round((parseDay(keys.at(-1)!)!.getTime() - parseDay(start)!.getTime()) / 864e5) + 1)) : 0
  const cols = Array.from({ length: count }, (_, i) => shiftDay(start, i))
  const xOf = (raw: string) => {
    const p = parseLocal(raw)
    if (!p || !start) return 0
    return Math.round((parseDay(p.date)!.getTime() - parseDay(start)!.getTime()) / 864e5) + (p.hour + p.minute / 60 - 12) / 24
  }
  const pct = (x: number) => `${(Math.min(count, Math.max(0, x)) / Math.max(1, count)) * 100}%`
  const state = new Map<string, "gap" | "double" | "unused">()
  problems.forEach((p) => {
    const kind = p.kind === "gap" || p.kind === "arrivalNight" ? "gap" : p.kind === "double" ? "double" : p.kind.startsWith("paid") ? "unused" : null
    if (kind && "nights" in p) p.nights.forEach((n) => state.set(n, kind))
  })
  const warnings = problems.filter((p) => p.kind !== "nightDeparture")
  // On a narrow screen the strip scrolls: keep the first problem night in view, and follow it as fixes land.
  const firstBad = cols.findIndex((c) => state.has(c))
  React.useEffect(() => {
    const el = stripRef.current
    if (!el || firstBad < 0 || el.scrollWidth <= el.clientWidth) return
    el.scrollTo({ left: Math.max(0, firstBad * COL - COL), behavior: reduce ? "auto" : "smooth" })
  }, [firstBad, reduce])
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 320, damping: 32 }

  return (
    <div ref={rootRef} data-slot="trip-date-chain" className={cn("w-full min-w-0 max-w-md space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground", className)} {...props}>
      {count > 0 && (
        <div ref={stripRef} aria-hidden className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="relative space-y-1" style={{ minWidth: count * COL }}>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
              {cols.map((c, i) => (
                <div key={c} className="text-center text-[10px] leading-tight text-muted-foreground">
                  <div>{day(c, { weekday: "short" })}</div>
                  <div className={cn("tabular-nums", (i === 0 || c.endsWith("-01")) && "font-medium text-foreground")}>{i === 0 || c.endsWith("-01") ? day(c, { day: "numeric", month: "short" }) : Number(c.slice(8))}</div>
                </div>
              ))}
            </div>
            <div className="relative h-8">
              {safeLegs.map((l) => {
                const a = xOf(l.depart)
                const b = Math.max(xOf(l.arrive), a + 0.15)
                const mins = legMinutes(l)
                return (
                  <React.Fragment key={l.id}>
                    <div className="absolute top-0 flex items-center gap-1 whitespace-nowrap text-[10px] text-sky-800 tabular-nums dark:text-sky-300" style={a > count - 2.5 ? { right: 0 } : { left: pct(a) }}>
                      <Plane className="size-3 shrink-0" />
                      {time(l.depart)}–{time(l.arrive)}
                      {mins != null && mins > 0 && <span className="text-muted-foreground">{Math.floor(mins / 60)}h{mins % 60 ? ` ${mins % 60}m` : ""}</span>}
                    </div>
                    <div className="absolute bottom-1 h-1.5 rounded-full bg-sky-500" style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }} />
                  </React.Fragment>
                )
              })}
            </div>
            {stays.map((s) => {
              const a = Math.round(((parseDay(s.checkIn)?.getTime() ?? 0) - (parseDay(start)?.getTime() ?? 0)) / 864e5)
              const b = Math.round(((parseDay(s.checkOut)?.getTime() ?? 0) - (parseDay(start)?.getTime() ?? 0)) / 864e5)
              return (
                <div key={s.id} className="relative h-7">
                  {b > a && (
                    <motion.div
                      initial={false}
                      animate={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)} - 2px)` }}
                      transition={spring}
                      className="absolute inset-y-0 flex items-center gap-1 overflow-hidden rounded-md bg-primary px-1.5 text-[11px] font-medium text-primary-foreground"
                    >
                      <BedDouble className="size-3 shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </motion.div>
                  )}
                </div>
              )
            })}
            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
              {cols.map((c) => {
                const st = state.get(c)
                return (
                  <div key={c} className={cn("h-1.5 rounded-full transition-colors", st === "gap" ? "bg-red-500" : st === "double" ? "bg-red-500" : st === "unused" ? "bg-amber-500" : "bg-transparent")} />
                )
              })}
            </div>
          </div>
        </div>
      )}
      <div aria-hidden className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{t.nightsLabel}</span>
        {[...state.values()].some((v) => v !== "unused") && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-red-500" />{t.noBed} / {t.twice.toLowerCase()}</span>}
        {[...state.values()].includes("unused") && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-amber-500" />{t.unused}</span>}
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted-foreground">{t.stays}</h3>
        <ul className="mt-1.5 divide-y rounded-lg border">
          {stays.map((s) => {
            const n = Math.round(((parseDay(s.checkOut)?.getTime() ?? 0) - (parseDay(s.checkIn)?.getTime() ?? 0)) / 864e5)
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 basis-32 font-medium">{s.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {day(s.checkIn)} → {day(s.checkOut)} <span className="whitespace-nowrap">· {fill(t.nights, { count: Math.max(0, n) })}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <AnimatePresence initial={false}>
          {problems.map((p) => {
            const info = p.kind === "nightDeparture"
            const k = keyOf(p)
            return (
              <motion.div key={k} initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={{ duration: reduce ? 0.1 : 0.22, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
                <div className={cn("mt-1.5 flex items-start gap-2 text-xs", info ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300")}>
                  {info ? <Moon aria-hidden className="mt-px size-3.5 shrink-0" /> : <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />}
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 basis-40 break-words">{text(p)}</span>
                  {"fix" in p && p.fix && (
                    <button type="button" data-fix={k} onClick={() => runFix(p.fix!)} className={fixClass}>{fixLabel(p, p.fix)}</button>
                  )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {warnings.length === 0 && stays.length > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            {t.allGood}
          </p>
        )}
        {undo && (
          <button type="button" data-undo onClick={() => { commit(undo); setUndo(null); setStatus("") }} className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Undo2 aria-hidden className="size-3.5" />
            {t.undo}
          </button>
        )}
      </div>
      <span role="status" className="sr-only">{status}</span>
    </div>
  )
}

/** Real duration of a leg in minutes when both zones are known, else null. Handy for "17h 35m" labels. */
export function legMinutes(leg: TripLeg): number | null {
  const d = parseLocal(leg.depart)
  const a = parseLocal(leg.arrive)
  if (!d || !a) return null
  const di = instantOf(d, leg.departTz)
  const ai = instantOf(a, leg.arriveTz)
  return di != null && ai != null ? Math.round((ai - di) / 60000) : null
}
