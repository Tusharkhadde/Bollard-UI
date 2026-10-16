"use client"

// Bollard UI — event-overlap · MIT licence · https://bollard-ui.vercel.app/components/event-overlap

import * as React from "react"
import { CalendarCheck2, CalendarClock, CalendarOff, Car, Coffee, Globe, Undo2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { findConflicts, MIN, ms, nearestFreeSlot, wallTime, type ConflictKind, type DraftEvent, type CalendarEvent, type OverlapOptions } from "./overlap"

export { findConflicts, nearestFreeSlot, wallTime, type CalendarEvent, type Conflict, type ConflictKind, type DraftEvent, type OverlapOptions } from "./overlap"

const clock = (ts: number, timeZone: string | undefined, locale: string, hour12: boolean) =>
  new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", hour12, timeZone }).format(ts).toUpperCase()
/** "IST", "PDT", "BST" where a real abbreviation exists, otherwise "GMT+4". */
const zoneName = (ts: number, timeZone: string) => {
  const names = ["en-US", "en-IN", "en-GB"].map((l) => new Intl.DateTimeFormat(l, { timeZone, timeZoneName: "short" }).formatToParts(ts).find((p) => p.type === "timeZoneName")?.value ?? "")
  return names.find((n) => !/^(GMT|UTC)/.test(n)) ?? names[0]
}
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => String(v[k] ?? m))

const REASONS: Record<ConflictKind, string> = {
  overlap: "Overlaps by {minutes} min",
  travel: "{needed} min to travel {route}; you'd have {minutes}",
  "no-buffer": "{gap}; your buffer is {needed} min",
  "all-day": "You're marked busy all day",
  free: "Shown as free, so it isn't a clash",
}
const ICONS: Record<ConflictKind, React.ComponentType<{ className?: string }>> = {
  overlap: CalendarClock, travel: Car, "no-buffer": Coffee, "all-day": CalendarOff, free: CalendarCheck2,
}
const fixClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export interface EventOverlapProps extends OverlapOptions, Omit<React.ComponentProps<"div">, "children"> {
  /** The event being created or moved. */
  draft: DraftEvent
  /** Events already on the calendar. */
  events: CalendarEvent[]
  /** Working hours [start, end) in your zone, for the suggested slot. */
  workHours?: [number, number]
  /** Granularity of suggested starts, in minutes. */
  step?: number
  /** "Now", so no slot in the past is offered. Pass it for deterministic previews. */
  now?: Date | number
  /** Move the draft. Called with the suggested slot, and with the old times on Undo. */
  onMove?: (start: Date, end: Date) => void
  /** Reason templates per kind: `{minutes}`, `{needed}`, `{gap}` and `{route}` are filled in. */
  reasons?: Partial<Record<ConflictKind, string>>
  /** Templates: `{count}` and `{time}` are filled in. */
  conflictText?: string
  /** Shown when there are no clashes. */
  clearText?: string
  /** Text for the move-to-free-slot button. */
  moveLabel?: string
  /** Text for the Undo button. */
  undoLabel?: string
  /** Shown when no free slot is found. */
  noSlotText?: string
  /** Text giving another zone's local time. */
  localTimeText?: string
  /** Locale for times and dates. */
  locale?: string
  /** 12-hour clock (2:30 PM). Set false for 14:30. */
  hour12?: boolean
  /** Override any other string. */
  labels?: Partial<typeof EVENT_OVERLAP_LABELS>
}

/** Every other user-visible string. */
export const EVENT_OVERLAP_LABELS = {
  events: (count: number) => (count === 1 ? "1 event" : `${count} events`),
  allDay: "All day",
  nearest: "Nearest free slot",
  /** Fills `{gap}` in the no-buffer reason. */
  gap: (minutes: number) => (minutes ? `Only ${minutes} min break` : "Back-to-back, no break"),
}

/**
 * Stops a calendar event being dropped onto a clash. As you create or move it, it lists what it runs
 * into: overlaps, a back-to-back with no break, too little time to travel from the last place, a
 * busy all-day event like leave, and other-zone events read in their own time too. A strip draws the
 * clash, and the nearest slot that keeps your buffer and travel time is one tap away, with Undo.
 */
export function EventOverlap({
  draft,
  events,
  buffer = 10,
  travelMinutes,
  timeZone,
  workHours = [9, 18],
  step = 15,
  now,
  onMove,
  reasons,
  conflictText = "Clashes with {count}",
  clearText = "No clashes. Your buffer and travel time are kept.",
  moveLabel = "Move to {time}",
  undoLabel = "Undo",
  noSlotText = "No free slot of this length in the next week.",
  localTimeText = "{time} {zone} where it happens",
  locale = "en-GB",
  hour12 = true,
  labels,
  className,
  ...props
}: EventOverlapProps) {
  const [previous, setPrevious] = React.useState<{ start: Date; end: Date }>()
  const [viewerZone, setViewerZone] = React.useState(timeZone)
  const t = { ...EVENT_OVERLAP_LABELS, ...labels }
  React.useEffect(() => setViewerZone(timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone), [timeZone])
  const options = { buffer, travelMinutes, timeZone }
  const conflicts = findConflicts(draft, events, options)
  const clashes = conflicts.filter((c) => c.kind !== "free")
  const s = ms(draft.start)
  const e = ms(draft.end)
  const slot = clashes.length ? nearestFreeSlot(draft, events, { ...options, workHours, step, now: now === undefined ? undefined : ms(now) }) : null
  // The strip shows clashes plus nearby events for context, so a move can be followed.
  const near = events.filter((ev) => !ev.allDay && ms(ev.end) > s - 90 * MIN && ms(ev.start) < e + 90 * MIN)
  const timed = near.map((event) => conflicts.find((c) => c.event.id === event.id) ?? { event, kind: undefined, needed: undefined })
  const from = Math.min(s, ...near.map((ev) => ms(ev.start))) - 30 * MIN
  const to = Math.max(e, ...near.map((ev) => ms(ev.end))) + 30 * MIN
  const pos = (a: number, b: number) => ({ left: `${((Math.max(a, from) - from) / (to - from)) * 100}%`, width: `${((Math.min(b, to) - Math.max(a, from)) / (to - from)) * 100}%` })
  // Events that overlap each other get their own lane, so bars never sit on top of one another.
  const lanes: number[] = []
  const laneOf = new Map<string, number>()
  for (const { event } of [...timed].sort((x, y) => ms(x.event.start) - ms(y.event.start))) {
    let lane = lanes.findIndex((busyUntil) => busyUntil <= ms(event.start))
    if (lane === -1) lane = lanes.length
    lanes[lane] = ms(event.end)
    laneOf.set(event.id, lane)
  }
  const hours: number[] = []
  for (let h = Math.ceil(from / 3_600_000) * 3_600_000; h < to; h += 3_600_000) if (h - from > (to - from) * 0.05 && to - h > (to - from) * 0.05) hours.push(h)
  const range = (a: number, b: number, tz?: string) => `${clock(a, tz, locale, hour12)}–${clock(b, tz, locale, hour12)}`

  const move = () => {
    if (!slot) return
    setPrevious({ start: new Date(s), end: new Date(e) })
    onMove?.(slot.start, slot.end)
  }

  return (
    <div data-slot="event-overlap" data-state={clashes.length ? "conflict" : "clear"} className={cn("grid w-full max-w-md gap-2 text-sm", className)} {...props}>
      <div aria-hidden>
        <div className="relative overflow-hidden rounded-md border bg-muted/40" style={{ height: Math.max(1, lanes.length) * 20 + 10 }}>
          {hours.map((h) => (
            <div key={h} className="absolute inset-y-0 border-l border-dashed border-foreground/10" style={{ left: pos(h, h).left }} />
          ))}
          {timed.map(({ event, kind, needed }) => (
            <React.Fragment key={event.id}>
              {needed && kind !== "overlap" && kind !== "free" && (
                <div
                  className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(245_158_11/0.35)_4px_6px)]"
                  style={ms(event.end) <= s ? pos(ms(event.end), ms(event.end) + needed * MIN) : pos(ms(event.start) - needed * MIN, ms(event.start))}
                />
              )}
              <div
                className={cn("absolute flex items-center truncate rounded-sm px-1 text-[10px]", event.busy === false ? "border border-dashed bg-background text-muted-foreground" : "bg-foreground/15 text-foreground/80")}
                style={{ ...pos(ms(event.start), ms(event.end)), top: (laneOf.get(event.id) ?? 0) * 20 + 4, height: 18 }}
              >
                {event.title}
              </div>
            </React.Fragment>
          ))}
          <div
            className={cn(
              "absolute inset-y-0.5 rounded-sm border-2 transition-[left,width,background-color,border-color] duration-300 ease-out motion-reduce:transition-none",
              clashes.length ? "border-red-500 bg-red-500/15" : "border-emerald-500 bg-emerald-500/15",
            )}
            style={pos(s, e)}
          />
        </div>
        <div className="relative h-4 text-[10px] text-muted-foreground tabular-nums">
          {hours.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 pt-0.5" style={{ left: pos(h, h).left }}>
              {new Intl.DateTimeFormat(locale, { hour: "numeric", hour12, timeZone }).format(h).replace(/\s/g, "").toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="grid gap-1.5">
        {clashes.length ? (
          <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
            <CalendarClock aria-hidden className="size-4 shrink-0" />
            {fill(conflictText, { count: t.events(clashes.length) })}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <CalendarCheck2 aria-hidden className="size-4 shrink-0" />
            <span className="flex-1">{clearText}</span>
            {previous && (
              <button type="button" onClick={() => (onMove?.(previous.start, previous.end), setPrevious(undefined))} className={cn(fixClass, "border-border text-foreground dark:text-foreground")}>
                <Undo2 aria-hidden className="size-3.5" />
                {undoLabel}
              </button>
            )}
          </p>
        )}

        {draft.timeZone && viewerZone && draft.timeZone !== viewerZone && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe aria-hidden className="size-3.5 shrink-0" />
            {fill(localTimeText, { time: range(s, e, draft.timeZone), zone: zoneName(s, draft.timeZone) })}
          </p>
        )}

        {conflicts.length > 0 && (
          <ul className="grid divide-y rounded-md border">
            {conflicts.map(({ event, kind, minutes, needed, route }) => {
              const Icon = ICONS[kind]
              const other = event.timeZone && viewerZone && event.timeZone !== viewerZone ? event.timeZone : undefined
              return (
                <li key={event.id} className={cn("flex gap-2 px-3 py-2", kind === "free" && "text-muted-foreground")}>
                  <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", kind === "overlap" || kind === "all-day" ? "text-red-600 dark:text-red-400" : kind === "free" ? "" : "text-amber-600 dark:text-amber-400")} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap justify-between gap-x-2">
                      <span className="truncate font-medium">{event.title}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{event.allDay ? t.allDay : range(ms(event.start), ms(event.end), timeZone)}</span>
                    </p>
                    <p className="text-xs">{fill(reasons?.[kind] ?? REASONS[kind], { minutes, needed: needed ?? 0, route: route?.join(" → ") ?? "", gap: t.gap(minutes) })}</p>
                    {other && !event.allDay && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Globe aria-hidden className="size-3 shrink-0" />
                        {range(ms(event.start), ms(event.end), other)} {zoneName(ms(event.start), other)}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {clashes.length > 0 &&
          (slot ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-700 dark:text-amber-400">
              <span>{t.nearest}</span>
              <button type="button" onClick={move} className={fixClass}>
                {fill(moveLabel, { time: range(slot.start.getTime(), slot.end.getTime(), timeZone) })}
              </button>
              {wallTime(slot.start.getTime(), timeZone).date !== wallTime(s, timeZone).date && (
                <span>{new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone }).format(slot.start)}</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{noSlotText}</p>
          ))}
      </div>
    </div>
  )
}
