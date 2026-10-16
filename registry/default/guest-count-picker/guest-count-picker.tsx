"use client"

import * as React from "react"
import { CircleAlert, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { checkGuests, limitsWithDefaults, normalizeGuests, splitGuests, type GuestIssue, type GuestLimits, type GuestRoom, type GuestValue } from "./guest-rules"

export { checkGuests, normalizeGuests, roomsNeeded, splitGuests, type GuestIssue, type GuestLimits, type GuestRoom, type GuestValue } from "./guest-rules"

const DEFAULT_MESSAGES = {
  adults: "Adults", children: "Children", infants: "Infants", rooms: "Rooms", room: "Room {n}",
  adultsHint: "Age {min}+", childrenHint: "Ages {min}–{max}", infantsHint: "Under {max}", roomsHint: "Sleeps {max} each",
  fewer: "Fewer {what}", more: "More {what}",
  childAge: "Child {n} age", agePlaceholder: "Age?", ageUnderOne: "Under 1", ageNeeded: "Hotels price children by age.",
  summary: (v: GuestValue) => {
    const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
    return [n(v.adults, "adult", "adults"), v.childAges.length && n(v.childAges.length, "child", "children"), v.infants && n(v.infants, "infant", "infants"), n(v.rooms.length, "room", "rooms")].filter(Boolean).join(" · ")
  },
  tooOld: "Child {n} is {age}. Here that counts as an adult.", tooOldFix: "Count as adult",
  isInfant: "Child {n} is {age}. Here that's an infant, usually free with no bed.", isInfantFix: "Count as infant",
  noAdult: "Children and infants need at least one adult on the booking.", noAdultFix: "Add an adult",
  roomNoAdult: "Room {n} has children but no adult.", roomNoAdultFix: "Move an adult from room {from}",
  overCapacity: "Room {n} has {count} guests but sleeps {max}.", addRoom: "Use {need} rooms", rebalance: "Rebalance rooms",
  cots: "Room {n} has {count} infants and one cot.",
  split: "Rooms hold {inRooms} {kind} but the party has {total}.", splitFix: "Split evenly",
  ok: "Everyone fits.", toFix: "{count} to fix before booking.",
}
export type GuestCountMessages = typeof DEFAULT_MESSAGES
const fill = (t: string, v: Record<string, string | number | undefined>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""))

const stepBtn = "grid size-7 shrink-0 place-items-center rounded-md border bg-background shadow-xs transition-colors outline-none hover:bg-accent disabled:pointer-events-none disabled:opacity-40 dark:bg-input/30"
const fixClass = "inline-flex h-6 items-center gap-1 rounded-md border border-amber-500/40 px-2 font-medium text-amber-900 transition-colors hover:bg-amber-500/10 dark:text-amber-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

interface CountProps {
  label: string
  hint?: string
  value: number
  min?: number
  max: number
  onChange: (n: number) => void
  focusKey: string
  compact?: boolean
  fewer: string
  more: string
}

/** A spinbutton (arrow keys, Home/End) with − and + for touch; the buttons stay out of the tab order. */
function Count({ label, hint, value, min = 0, max, onChange, focusKey, compact, fewer, more }: CountProps) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  const id = React.useId()
  const btn = cn(stepBtn, compact && "size-6")
  return (
    <div className={cn("flex min-w-0 items-center gap-x-3", !compact && "w-full")}>
      <div id={id} className={cn("min-w-0", compact ? "sr-only" : "flex-1")}>
        <span className="block truncate font-medium">{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className={cn("flex items-center", !compact && "gap-1")}>
        <button type="button" tabIndex={-1} aria-label={fewer} disabled={value <= min} onClick={() => set(value - 1)} className={btn}>
          <Minus aria-hidden className="size-3.5" />
        </button>
        <div
          role="spinbutton"
          tabIndex={0}
          data-focus={focusKey}
          aria-labelledby={id}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          onKeyDown={(e) => {
            const next = { ArrowUp: value + 1, ArrowRight: value + 1, ArrowDown: value - 1, ArrowLeft: value - 1, Home: min, End: max }[e.key]
            if (next === undefined) return
            e.preventDefault()
            set(next)
          }}
          className={cn("rounded-md text-center font-medium tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", compact ? "w-4" : "w-7")}
        >
          {value}
        </div>
        <button type="button" tabIndex={-1} aria-label={more} disabled={value >= max} onClick={() => set(value + 1)} className={btn}>
          <Plus aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export interface GuestCountPickerProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Controlled value. */
  value?: GuestValue
  /** Initial value when uncontrolled. Defaults to 2 adults in 1 room. */
  defaultValue?: Partial<GuestValue>
  /** Called with a clean value on every change. */
  onValueChange?: (value: GuestValue) => void
  /** Called whenever the list of problems changes, so you can hold the Book button. */
  onIssuesChange?: (issues: GuestIssue[]) => void
  /** The property's age and room rules. */
  limits?: GuestLimits
  /** Most guests of each kind in the party. Default 16. */
  maxGuests?: number
  /** Every visible string. */
  messages?: Partial<GuestCountMessages>
}

/**
 * A guest picker that catches bookings a hotel will bounce: a "child" older than
 * the child limit (or young enough to be a free infant), infants with no adult,
 * a room over capacity or out of cots, and a room split that doesn't add up to
 * the party, each with a one-tap fix that moves focus to what it changed.
 */
export function GuestCountPicker({
  value, defaultValue, onValueChange, onIssuesChange, limits, maxGuests = 16, messages, className, ...props
}: GuestCountPickerProps) {
  const t = { ...DEFAULT_MESSAGES, ...messages }
  const l = limitsWithDefaults(limits)
  const [inner, setInner] = React.useState(() => normalizeGuests(defaultValue))
  const v = normalizeGuests(value ?? inner)
  const issues = checkGuests(v, limits)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()

  const emit = (next: GuestValue, focus?: string) => {
    const clean = normalizeGuests(next)
    if (value === undefined) setInner(clean)
    onValueChange?.(clean)
    if (focus) requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus())
  }
  // With one room the room simply follows the party; with more, a change shows as a split to fix.
  const party = (patch: Partial<GuestValue>, focus?: string, room?: (rooms: GuestRoom[]) => GuestRoom[]) => {
    const next = { ...v, ...patch }
    next.rooms = v.rooms.length === 1 ? [{ adults: next.adults, children: next.childAges.length, infants: next.infants }] : room ? room(v.rooms.map((r) => ({ ...r }))) : v.rooms
    emit(next, focus)
  }
  const moveChild = (child: number, to: "adults" | "infants") =>
    party({ childAges: v.childAges.filter((_, i) => i !== child), [to]: v[to] + 1 }, to, (rooms) => {
      const r = rooms.find((x) => x.children > 0)
      if (r) [r.children, r[to]] = [r.children - 1, r[to] + 1]
      return rooms
    })
  const setRooms = (n: number, focus = "rooms") => emit({ ...v, rooms: splitGuests(v, n, limits) }, focus)
  const setRoom = (i: number, kind: keyof GuestRoom, n: number) => emit({ ...v, rooms: v.rooms.map((r, j) => (j === i ? { ...r, [kind]: n } : r)) })

  const issueKey = JSON.stringify(issues)
  React.useEffect(() => onIssuesChange?.(issues), [issueKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const status = issues.length ? fill(t.toFix, { count: issues.length }) : t.ok
  const [announced, setAnnounced] = React.useState(status)
  React.useEffect(() => {
    const timer = setTimeout(() => setAnnounced(status), 700)
    return () => clearTimeout(timer)
  }, [status])

  const words = { adults: t.adults.toLowerCase(), children: t.children.toLowerCase(), infants: t.infants.toLowerCase() }
  const message = (i: GuestIssue): [string, string?, (() => void)?] => {
    switch (i.type) {
      case "too-old": return [fill(t.tooOld, { n: i.child + 1, age: i.age }), t.tooOldFix, () => moveChild(i.child, "adults")]
      case "is-infant": return [fill(t.isInfant, { n: i.child + 1, age: i.age === 0 ? t.ageUnderOne.toLowerCase() : i.age }), t.isInfantFix, () => moveChild(i.child, "infants")]
      case "no-adult": return [t.noAdult, t.noAdultFix, () => party({ adults: 1 }, "adults")]
      case "room-no-adult": return [fill(t.roomNoAdult, { n: i.room + 1 }), i.from === undefined ? undefined : fill(t.roomNoAdultFix, { from: i.from + 1 }), () => {
        const rooms = v.rooms.map((r) => ({ ...r }))
        rooms[i.from as number].adults--
        rooms[i.room].adults++
        emit({ ...v, rooms }, `room-${i.room}-adults`)
      }]
      case "over-capacity": case "cots": {
        const need = Math.max(v.rooms.length, i.type === "cots" ? Math.min(v.adults, Math.ceil(v.infants / Math.max(1, l.maxInfantsPerRoom))) : i.need)
        const text = i.type === "cots" ? fill(t.cots, { n: i.room + 1, count: i.count }) : fill(t.overCapacity, { n: i.room + 1, count: i.count, max: l.maxPerRoom })
        return [text, need > v.rooms.length ? fill(t.addRoom, { need }) : t.rebalance, () => setRooms(need)]
      }
      case "split": return [fill(t.split, { inRooms: i.inRooms, total: i.total, kind: words[i.kind] }), t.splitFix, () => setRooms(v.rooms.length, "room-0-adults")]
      default: return [""]
    }
  }
  const shown = issues.filter((i) => i.type !== "age-missing" && !(i.type === "split" && issues.findIndex((x) => x.type === "split") !== issues.indexOf(i)))
  const summary = t.summary(v)
  const kinds = (["adults", "children", "infants"] as const).filter((k) => k !== "infants" || v.infants > 0 || v.rooms.some((r) => r.infants > 0))
  const cols = { "--cols": kinds.length } as React.CSSProperties
  const step = (what: string) => ({ fewer: fill(t.fewer, { what: what.toLowerCase() }), more: fill(t.more, { what: what.toLowerCase() }) })

  return (
    <div
      ref={rootRef}
      data-slot="guest-count-picker"
      role="group"
      className={cn("grid w-full max-w-sm gap-3 text-sm", className)}
      {...props}
      aria-describedby={cn(props["aria-describedby"], `${id}-status`) || undefined}
    >
      <p className="text-xs text-muted-foreground">{summary}</p>
      <div className="grid gap-3 rounded-lg border p-3">
        <Count label={t.adults} hint={fill(t.adultsHint, { min: l.maxChildAge + 1 })} value={v.adults} max={maxGuests} focusKey="adults" onChange={(n) => party({ adults: n })} {...step(t.adults)} />
        <Count
          label={t.children} hint={fill(t.childrenHint, { min: l.maxInfantAge + 1, max: l.maxChildAge })} value={v.childAges.length} max={maxGuests} focusKey="children" {...step(t.children)}
          onChange={(n) => party({ childAges: Array.from({ length: n }, (_, i) => v.childAges[i] ?? null) })}
        />
        {v.childAges.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
            {v.childAges.map((age, i) => (
              <label key={i} className="grid gap-1 text-xs text-muted-foreground">
                {fill(t.childAge, { n: i + 1 })}
                <select
                  value={age ?? ""}
                  aria-invalid={age === null || undefined}
                  aria-describedby={age === null ? `${id}-age-hint` : undefined}
                  onChange={(e) => party({ childAges: v.childAges.map((a, j) => (j === i ? (e.target.value === "" ? null : Number(e.target.value)) : a)) })}
                  className="h-8 w-full min-w-0 rounded-md border bg-background px-1.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-amber-500 dark:bg-input/30"
                >
                  <option value="">{t.agePlaceholder}</option>
                  {Array.from({ length: 18 }, (_, a) => <option key={a} value={a}>{a === 0 ? t.ageUnderOne : a}</option>)}
                </select>
              </label>
            ))}
            {v.childAges.includes(null) && <p id={`${id}-age-hint`} className="col-span-full text-xs text-muted-foreground">{t.ageNeeded}</p>}
          </div>
        )}
        <Count label={t.infants} hint={fill(t.infantsHint, { max: l.maxInfantAge + 1 })} value={v.infants} max={maxGuests} focusKey="infants" onChange={(n) => party({ infants: n })} {...step(t.infants)} />
      </div>

      <div className="grid gap-3 rounded-lg border p-3">
        <Count label={t.rooms} hint={fill(t.roomsHint, { max: l.maxPerRoom })} value={v.rooms.length} min={1} max={l.maxRooms} focusKey="rooms" onChange={(n) => setRooms(n)} {...step(t.rooms)} />
        {v.rooms.length > 1 && (
          // One compact row per room under a single header, so 3+ rooms stay short.
          <div role="table" aria-label={t.rooms} className="@container grid gap-1.5 border-t pt-2.5">
            <div role="row" className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-x-2 text-xs text-muted-foreground @[18rem]:grid-cols-[3.5rem_repeat(var(--cols),minmax(0,1fr))]" style={cols}>
              <span role="columnheader" className="sr-only @[18rem]:not-sr-only">{t.rooms}</span>
              {kinds.map((k) => <span key={k} role="columnheader" className="truncate text-center">{t[k]}</span>)}
            </div>
            {v.rooms.map((r, i) => (
              <div key={i} role="row" className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] items-center gap-x-2 gap-y-1 @[18rem]:grid-cols-[3.5rem_repeat(var(--cols),minmax(0,1fr))]" style={cols}>
                <span role="rowheader" className="col-span-full truncate text-xs font-medium @[18rem]:col-span-1">{fill(t.room, { n: i + 1 })}</span>
                {kinds.map((k) => (
                  <span key={k} role="cell" className="flex justify-center">
                    <Count compact label={`${fill(t.room, { n: i + 1 })}: ${t[k]}`} value={r[k]} max={maxGuests} focusKey={`room-${i}-${k}`} onChange={(n) => setRoom(i, k, n)}
                      fewer={`${fill(t.room, { n: i + 1 })}: ${step(t[k]).fewer}`} more={`${fill(t.room, { n: i + 1 })}: ${step(t[k]).more}`} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <ul className="grid gap-1.5">
          {shown.map((i) => {
            const [text, fixLabel, onFix] = message(i)
            return (
              <li key={JSON.stringify(i)} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <span className="flex h-6 shrink-0 items-center"><CircleAlert aria-hidden className="size-3.5" /></span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <span className="py-1">{text}</span>
                  {fixLabel && onFix && <button type="button" onClick={onFix} className={fixClass}>{fixLabel}</button>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <p id={`${id}-status`} className="sr-only">{status}</p>
      <span className="sr-only" aria-live="polite">{announced}</span>
    </div>
  )
}
