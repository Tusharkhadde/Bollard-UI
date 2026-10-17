// Bollard UI — seat-gap-check · MIT licence · https://bollard-ui.vercel.app/components/seat-gap-check

export type SeatStatus = "free" | "taken" | "blocked"

export interface Seat {
  id: string
  status: SeatStatus
}

/** One row, left to right. `null` is an aisle or gap. */
export interface SeatRow {
  label: string
  cells: (Seat | null)[]
}

export interface Traveller {
  name: string
  /** Needs to sit next to an adult. */
  child?: boolean
}

export type SeatIssue =
  | { kind: "split"; groups: string[][] }
  | { kind: "orphan"; seats: string[] }
  | { kind: "child"; traveller: number; seat: string; rearrange?: string[] }

export interface SeatSuggestion {
  /** Seat per traveller, same order as `travellers`. */
  seats: string[]
  /** "G4–G7". */
  label: string
}

/**
 * Reads a seat map from text, one row per line: a row label, then `o` free, `x` taken, `-` blocked
 * and `_` an aisle. Seats are numbered left to right, skipping aisles: "F oo_xoo" is F1 F2 | F3 F4 F5.
 * Tolerates a BOM, CRLF, blank lines and stray spaces.
 */
export function parseSeatMap(text: unknown): SeatRow[] {
  if (typeof text !== "string") return []
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map((line) => {
      const [label, ...rest] = line.split(/\s+/)
      let n = 0
      const cells = [...rest.join("")].slice(0, 200).flatMap((ch): (Seat | null)[] => {
        if (ch === "_") return [null]
        const status: SeatStatus | undefined = ch === "o" ? "free" : ch === "x" ? "taken" : ch === "-" ? "blocked" : undefined
        return status ? [{ id: `${label}${++n}`, status }] : []
      })
      return { label, cells }
    })
}

type Pos = { row: number; col: number }

/** Where every seat is, and its neighbours in the same block (aisles and row ends break blocks). */
const safe = (rows: unknown): SeatRow[] => (Array.isArray(rows) ? rows.filter((r) => r && Array.isArray(r.cells)) : [])
const people = (t: unknown): Traveller[] => (Array.isArray(t) ? t.map((x) => (x && typeof x === "object" ? x : { name: "" })) : [])

function index(rows: SeatRow[]) {
  const pos = new Map<string, Pos>()
  rows.forEach((r, row) => r.cells.forEach((c, col) => c && pos.set(c.id, { row, col })))
  const at = (row: number, col: number) => rows[row]?.cells[col] ?? null
  const neighbours = (id: string) => {
    const p = pos.get(id)
    return p ? [at(p.row, p.col - 1), at(p.row, p.col + 1)].filter((c): c is Seat => !!c).map((c) => c.id) : []
  }
  return { pos, at, neighbours }
}

/** Free seats this selection leaves alone between occupied seats, an aisle or a row end. */
function orphansOf(rows: SeatRow[], picked: Set<string>) {
  const out: string[] = []
  rows.forEach((r) =>
    r.cells.forEach((c, col) => {
      if (!c || c.status !== "free" || picked.has(c.id)) return
      const open = (x: Seat | null | undefined) => !!x && x.status === "free" && !picked.has(x.id)
      if (!open(r.cells[col - 1]) && !open(r.cells[col + 1])) out.push(c.id)
    }),
  )
  return out
}

/** Order travellers so every child sits beside an adult: child, adult, child, adult… */
function arrange(travellers: Traveller[]): number[] {
  const adults = travellers.map((t, i) => (t.child ? -1 : i)).filter((i) => i >= 0)
  const kids = travellers.map((t, i) => (t.child ? i : -1)).filter((i) => i >= 0)
  if (!adults.length) return travellers.map((_, i) => i)
  const order: number[] = []
  adults.forEach((a, k) => {
    if (k === 0 && kids.length) order.push(kids.shift() as number)
    order.push(a)
    if (kids.length) order.push(kids.shift() as number)
  })
  return [...order, ...kids]
}

const assign = (travellers: Traveller[], block: string[]) => {
  const seats: string[] = Array(travellers.length).fill("")
  arrange(travellers).forEach((t, k) => (seats[t] = block[k]))
  return seats
}

/** Splits, single empty seats and children away from adults, for one selection. */
export function checkSeats(rowsIn: SeatRow[], travellersIn: Traveller[], selected: string[], { orphans = true }: { orphans?: boolean } = {}): SeatIssue[] {
  const rows = safe(rowsIn)
  const travellers = people(travellersIn)
  const { pos, neighbours } = index(rows)
  const chosen = (Array.isArray(selected) ? selected : []).filter((id) => typeof id === "string" && pos.has(id))
  if (chosen.length < 2 && !orphans) return []
  const picked = new Set(chosen)
  const issues: SeatIssue[] = []

  const seen = new Set<string>()
  const groups: string[][] = []
  for (const id of chosen) {
    if (seen.has(id)) continue
    const group: string[] = []
    const stack = [id]
    while (stack.length) {
      const s = stack.pop() as string
      if (seen.has(s)) continue
      seen.add(s)
      group.push(s)
      stack.push(...neighbours(s).filter((n) => picked.has(n)))
    }
    groups.push(group.sort((a, b) => (pos.get(a)?.col ?? 0) - (pos.get(b)?.col ?? 0)))
  }
  if (groups.length > 1) issues.push({ kind: "split", groups })

  if (orphans && chosen.length) {
    const before = new Set(orphansOf(rows, new Set()))
    const created = orphansOf(rows, picked).filter((id) => !before.has(id) && neighbours(id).some((n) => picked.has(n)))
    if (created.length) issues.push({ kind: "orphan", seats: created })
  }

  const seatOf = (i: number) => (Array.isArray(selected) && typeof selected[i] === "string" && pos.has(selected[i]) ? selected[i] : "")
  travellers.forEach((t, i) => {
    const seat = seatOf(i)
    if (!t?.child || !seat) return
    const adultNext = neighbours(seat).some((n) => travellers.some((u, j) => !u?.child && seatOf(j) === n))
    const anyAdultSeated = travellers.some((u, j) => !u?.child && seatOf(j))
    if (adultNext || !anyAdultSeated) return
    const group = groups.find((g) => g.includes(seat))
    const together = groups.length === 1 && group && group.length === travellers.length
    issues.push({ kind: "child", traveller: i, seat, rearrange: together ? assign(travellers, group) : undefined })
  })
  return issues
}

const span = (block: string[]) => (block.length > 1 ? `${block[0]}–${block[block.length - 1]}` : block[0])

/** The nearest run of free seats that fits the whole group without leaving a single seat, children beside adults. */
export function suggestBlock(rowsIn: SeatRow[], travellersIn: Traveller[], selected: string[], { orphans = true }: { orphans?: boolean } = {}): SeatSuggestion | null {
  const rows = safe(rowsIn)
  const travellers = people(travellersIn)
  const n = travellers.length
  if (!n || n > 60) return null
  const { pos } = index(rows)
  const mine = new Set((Array.isArray(selected) ? selected : []).filter((id) => pos.has(id)))
  const anchor = [...mine].map((id) => pos.get(id) as Pos)
  const centre = anchor.length
    ? { row: anchor.reduce((s, p) => s + p.row, 0) / anchor.length, col: anchor.reduce((s, p) => s + p.col, 0) / anchor.length }
    : { row: rows.length / 2, col: (rows[0]?.cells.length ?? 0) / 2 }
  let best: { score: number; block: string[] } | null = null
  rows.forEach((r, row) => {
    for (let start = 0; start + n <= r.cells.length; start++) {
      const cells = r.cells.slice(start, start + n)
      if (!cells.every((c) => c && typeof c.id === "string" && (c.status === "free" || mine.has(c.id)))) continue
      const block = cells.map((c) => (c as Seat).id)
      const left = orphans ? orphansOf(rows, new Set(block)).filter((id) => !orphansOf(rows, new Set()).includes(id)).length : 0
      const score = Math.abs(row - centre.row) * 2 + Math.abs(start + (n - 1) / 2 - centre.col) + left * 100
      if (!best || score < best.score) best = { score, block }
    }
  })
  const found = best as { score: number; block: string[] } | null
  return found ? { seats: assign(travellers, found.block), label: span(found.block) } : null
}
