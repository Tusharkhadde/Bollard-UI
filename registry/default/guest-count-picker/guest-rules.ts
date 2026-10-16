// Bollard UI — guest-count-picker · MIT licence · https://bollard-ui.vercel.app/components/guest-count-picker

export interface GuestRoom {
  adults: number
  children: number
  infants: number
}

/** The party (with each child's age) and how it's split across rooms. */
export interface GuestValue {
  adults: number
  /** One entry per child; null until the age is picked. */
  childAges: (number | null)[]
  infants: number
  rooms: GuestRoom[]
}

export interface GuestLimits {
  /** Oldest age that still counts as a child. Older children are priced as adults. Default 17. */
  maxChildAge?: number
  /** Oldest age that counts as an infant (no bed, usually free). Default 1, i.e. under 2. */
  maxInfantAge?: number
  /** Guests a room sleeps. Default 4. */
  maxPerRoom?: number
  /** Cots per room. Default 1. */
  maxInfantsPerRoom?: number
  /** Whether infants count toward `maxPerRoom`. Default false, as most hotels put them on top. */
  infantsCount?: boolean
  /** Most rooms in one booking. Default 8. */
  maxRooms?: number
}

export type GuestIssue =
  | { type: "age-missing"; child: number }
  | { type: "too-old"; child: number; age: number }
  | { type: "is-infant"; child: number; age: number }
  | { type: "no-adult" }
  | { type: "room-no-adult"; room: number; from?: number }
  | { type: "over-capacity"; room: number; count: number; need: number }
  | { type: "cots"; room: number; count: number }
  | { type: "split"; kind: "adults" | "children" | "infants"; inRooms: number; total: number }

const int = (n: unknown, min = 0) => (Number.isFinite(Number(n)) ? Math.max(min, Math.floor(Number(n))) : min)
export const limitsWithDefaults = (l: GuestLimits = {}) => ({
  maxChildAge: int(l.maxChildAge ?? 17), maxInfantAge: int(l.maxInfantAge ?? 1), maxPerRoom: int(l.maxPerRoom ?? 4, 1),
  maxInfantsPerRoom: int(l.maxInfantsPerRoom ?? 1), infantsCount: !!l.infantsCount, maxRooms: int(l.maxRooms ?? 8, 1),
})

/** Coerces anything (NaN, negatives, missing rooms) into a valid value, so bad input never crashes. */
export function normalizeGuests(v?: Partial<GuestValue> | null): GuestValue {
  const ages = Array.isArray(v?.childAges) ? v.childAges.map((a) => (a === null || a === undefined || !Number.isFinite(Number(a)) ? null : int(a))) : []
  const rooms = Array.isArray(v?.rooms) && v.rooms.length ? v.rooms.map((r) => ({ adults: int(r?.adults), children: int(r?.children), infants: int(r?.infants) })) : null
  const value = { adults: int(v?.adults ?? 2), childAges: ages, infants: int(v?.infants), rooms: [] as GuestRoom[] }
  value.rooms = rooms ?? [{ adults: value.adults, children: ages.length, infants: value.infants }]
  return value
}

const guests = (r: GuestRoom, infantsCount: boolean) => r.adults + r.children + (infantsCount ? r.infants : 0)

/** Spreads the party over `count` rooms: an adult in every room first, then children and infants where there's space. */
export function splitGuests(v: GuestValue, count: number, limits?: GuestLimits): GuestRoom[] {
  const l = limitsWithDefaults(limits)
  const n = Math.max(1, Math.min(int(count, 1), l.maxRooms))
  const rooms = Array.from({ length: n }, (_, i) => ({ adults: Math.floor(v.adults / n) + (i < v.adults % n ? 1 : 0), children: 0, infants: 0 }))
  const roomy = (kind: "children" | "infants") => {
    const withAdult = rooms.filter((r) => r.adults > 0)
    const pool = withAdult.length ? withAdult : rooms
    return pool.reduce((best, r) => {
      const full = (x: GuestRoom) => (kind === "infants" ? x.infants >= l.maxInfantsPerRoom : guests(x, l.infantsCount) >= l.maxPerRoom)
      if (full(best) !== full(r)) return full(best) ? r : best
      return guests(r, true) < guests(best, true) ? r : best
    })
  }
  for (let i = 0; i < v.childAges.length; i++) roomy("children").children++
  for (let i = 0; i < v.infants; i++) roomy("infants").infants++
  return rooms
}

/** Rooms the party needs so nobody is over capacity (never more rooms than adults). */
export function roomsNeeded(v: GuestValue, limits?: GuestLimits) {
  const l = limitsWithDefaults(limits)
  const total = v.adults + v.childAges.length + (l.infantsCount ? v.infants : 0)
  const byCots = l.maxInfantsPerRoom ? Math.ceil(v.infants / l.maxInfantsPerRoom) : 1
  return Math.min(l.maxRooms, Math.max(1, Math.min(v.adults || 1, Math.max(Math.ceil(total / l.maxPerRoom), byCots))))
}

/** Every mistake in the party and its room split. */
export function checkGuests(input: Partial<GuestValue> | null | undefined, limits?: GuestLimits): GuestIssue[] {
  const v = normalizeGuests(input)
  const l = limitsWithDefaults(limits)
  const issues: GuestIssue[] = []
  v.childAges.forEach((age, child) => {
    if (age === null) issues.push({ type: "age-missing", child })
    else if (age > l.maxChildAge) issues.push({ type: "too-old", child, age })
    else if (age <= l.maxInfantAge) issues.push({ type: "is-infant", child, age })
  })
  if (!v.adults && (v.childAges.length || v.infants)) issues.push({ type: "no-adult" })
  const sums = { adults: 0, children: 0, infants: 0 }
  v.rooms.forEach((r, room) => {
    sums.adults += r.adults
    sums.children += r.children
    sums.infants += r.infants
    if (v.adults && !r.adults && (r.children || r.infants)) {
      const from = v.rooms.findIndex((x) => x.adults > 1)
      issues.push({ type: "room-no-adult", room, from: from < 0 ? undefined : from })
    }
    const count = guests(r, l.infantsCount)
    if (count > l.maxPerRoom) issues.push({ type: "over-capacity", room, count, need: roomsNeeded(v, l) })
    if (r.infants > l.maxInfantsPerRoom) issues.push({ type: "cots", room, count: r.infants })
  })
  const totals = { adults: v.adults, children: v.childAges.length, infants: v.infants }
  for (const kind of ["adults", "children", "infants"] as const) {
    if (sums[kind] !== totals[kind]) issues.push({ type: "split", kind, inRooms: sums[kind], total: totals[kind] })
  }
  return issues
}
