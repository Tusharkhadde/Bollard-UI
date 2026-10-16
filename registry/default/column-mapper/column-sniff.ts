/** What a column's values look like, or what a field expects. */
export type ValueKind = "email" | "phone" | "date" | "number" | "first-name" | "last-name" | "text"
export type DateOrder = "dmy" | "mdy"

/** A field the spreadsheet is imported into. */
export interface MapperField {
  key: string
  label: string
  /** What the values should look like. Drives the swap and date checks. Defaults to "text". */
  kind?: ValueKind
  required?: boolean
}

/** One spreadsheet column: its heading and a sample of its values (20–50 is plenty). */
export interface MapperColumn {
  heading: string
  values: string[]
}

/** Where one column goes. `dateOrder` only matters for date fields. */
export interface ColumnTarget {
  field: string | null
  dateOrder?: DateOrder
}

export type MappingIssue =
  | { type: "swap"; columns: [number, number]; fields: [string, string]; looksLike: [ValueKind, ValueKind] }
  | { type: "kind"; column: number; field: string; looksLike: ValueKind; suggest?: string }
  | { type: "duplicate"; field: string; columns: number[]; keep: number }
  | { type: "missing"; field: string; suggest?: number }
  | { type: "date-ambiguous"; column: number; example: string }
  | { type: "date-mixed"; column: number; dmyExample: string; mdyExample: string }
  | { type: "date-wrong"; column: number; detected: DateOrder; example: string }

/** A short list of common first names (Indian and international). Pass your own via `firstNames`. */
export const COMMON_FIRST_NAMES = (
  "aarav aditi aditya akash amit ananya anjali arjun aryan ayesha deepak divya diya farhan gaurav ishaan isha kabir kavya " +
  "manish meera neha nikhil pooja priya rahul raj riya rohan sahil sanjay sara shreya sneha tanvi tushar varun vikram " +
  "james john robert michael william david mary patricia jennifer linda elizabeth sarah emma olivia noah liam sophia " +
  "mia lucas ethan anna maria mohammed ahmed fatima ali omar wei li yuki hiro chen"
).split(" ")

const DATE = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME = /^[\p{L}][\p{L}'’.-]*$/u

/** Guesses what a single cell holds. Names are reported as "first-name" (a name-like word). */
export function sniffValue(raw: unknown): ValueKind | null {
  const v = String(raw ?? "").trim()
  if (!v) return null
  if (EMAIL.test(v)) return "email"
  if (DATE.test(v)) return "date"
  const digits = v.replace(/\D/g, "")
  if (/^\+?[\d\s().-]+$/.test(v) && digits.length >= 7 && digits.length <= 15 && !/^-?\d+\.\d+$/.test(v)) return "phone"
  if (/^-?[\d,]*\.?\d+$/.test(v)) return "number"
  if (NAME.test(v)) return "first-name"
  return "text"
}

/** The kind most of a column's values share (60% or more), or null when it's mixed or empty. */
export function sniffColumn(values: unknown[]): ValueKind | null {
  const votes = new Map<ValueKind, number>()
  let total = 0
  for (const value of Array.isArray(values) ? values : []) {
    const kind = sniffValue(value)
    if (!kind) continue
    total++
    votes.set(kind, (votes.get(kind) ?? 0) + 1)
  }
  let best: ValueKind | null = null
  for (const [kind, count] of votes) if (!best || count > (votes.get(best) ?? 0)) best = kind
  return best && (votes.get(best) ?? 0) / total >= 0.6 ? best : null
}

/**
 * Reads the day/month order off the values: 23/04 can only be DD/MM, 04/23 only MM/DD.
 * "ambiguous" when every date fits both, "mixed" when the column proves both.
 */
export function detectDateOrder(values: unknown[]) {
  let dmy = "", mdy = "", sample = ""
  for (const value of Array.isArray(values) ? values : []) {
    const m = String(value ?? "").trim().match(DATE)
    if (!m || m[1].length === 4) continue
    const [a, b] = [Number(m[1]), Number(m[2])]
    sample ||= m[0]
    if (a > 12 && b <= 12) dmy ||= m[0]
    if (b > 12 && a <= 12) mdy ||= m[0]
  }
  if (dmy && mdy) return { order: "mixed" as const, dmy, mdy }
  if (dmy) return { order: "dmy" as const, example: dmy }
  if (mdy) return { order: "mdy" as const, example: mdy }
  return sample ? { order: "ambiguous" as const, example: sample } : null
}

/** Spreadsheet column letter for a 0-based index: 0 → A, 26 → AA. */
export const columnLetter = (i: number): string => (i >= 26 ? columnLetter(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + (i % 26))

/** Reads "03/04/24" in the given order. Two-digit years pivot at 50 (24 → 2024, 87 → 1987). Null when it isn't a date. */
export function readDate(raw: string, order: DateOrder) {
  const m = String(raw ?? "").trim().match(DATE)
  if (!m || m[1].length === 4) return null
  const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const [day, month] = order === "dmy" ? [a, b] : [b, a]
  return { day, month, year: y < 100 ? (y < 50 ? 2000 : 1900) + y : y }
}

const nameShare = (values: unknown[], names: Set<string>) => {
  const words = (Array.isArray(values) ? values : []).map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean)
  return words.length ? words.filter((w) => names.has(w)).length / words.length : 0
}

const STRONG: ValueKind[] = ["email", "phone", "date"]
const fits = (expected: ValueKind, seen: ValueKind | null) => {
  if (!seen || expected === "text" || expected === seen) return true
  if (expected === "first-name" || expected === "last-name") return !STRONG.includes(seen)
  if (expected === "number") return seen === "phone"
  return !STRONG.includes(seen) && !STRONG.includes(expected) ? true : false
}

/** Finds swapped, mistyped, doubled and missing mappings. Never throws on ragged or empty input. */
export function checkMapping(
  columns: MapperColumn[],
  fields: MapperField[],
  mapping: ColumnTarget[],
  firstNames: string[] = COMMON_FIRST_NAMES,
): MappingIssue[] {
  const cols = Array.isArray(columns) ? columns : []
  fields = (Array.isArray(fields) ? fields : []).filter((f) => f && typeof f.key === "string")
  mapping = Array.isArray(mapping) ? mapping : []
  const issues: MappingIssue[] = []
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const target = (c: number) => (mapping?.[c]?.field && byKey.has(mapping[c].field as string) ? (mapping[c].field as string) : null)
  const seen = cols.map((c) => sniffColumn(c?.values ?? []))
  const names = new Set(firstNames.map((n) => n.toLowerCase()))
  const used = new Set<number>()

  // Two columns that each hold what the other one is mapped to.
  cols.forEach((_, a) => {
    cols.forEach((__, b) => {
      const [fa, fb] = [target(a), target(b)]
      if (b <= a || !fa || !fb || used.has(a) || used.has(b)) return
      const [ka, kb] = [byKey.get(fa)?.kind ?? "text", byKey.get(fb)?.kind ?? "text"]
      const nameSwap = ka === "first-name" && kb === "last-name" || ka === "last-name" && kb === "first-name"
      const crossed = !fits(ka, seen[a]) && !fits(kb, seen[b]) && fits(ka, seen[b]) && fits(kb, seen[a])
      const [firstCol, lastCol] = ka === "first-name" ? [a, b] : [b, a]
      const namesFlipped = nameSwap && nameShare(cols[lastCol]?.values ?? [], names) > nameShare(cols[firstCol]?.values ?? [], names) + 0.2
      if (crossed || namesFlipped) {
        issues.push({ type: "swap", columns: [a, b], fields: [fa, fb], looksLike: [kb, ka] })
        used.add(a).add(b)
      }
    })
  })

  // A column whose values don't fit its field (and no partner to swap with).
  cols.forEach((_, c) => {
    const f = target(c)
    const kind = byKey.get(f ?? "")?.kind ?? "text"
    if (!f || used.has(c) || fits(kind, seen[c]) || !seen[c]) return
    const suggest = fields.find((x) => x.kind === seen[c] && !mapping.some((m) => m?.field === x.key))?.key
    issues.push({ type: "kind", column: c, field: f, looksLike: seen[c] as ValueKind, suggest })
  })

  // The same field picked twice: keep the column whose values fit best, then the first.
  for (const f of fields) {
    const dupes = cols.map((_, c) => c).filter((c) => target(c) === f.key)
    if (dupes.length > 1) issues.push({ type: "duplicate", field: f.key, columns: dupes, keep: dupes.find((c) => fits(f.kind ?? "text", seen[c])) ?? dupes[0] })
    if (f.required && !dupes.length) {
      const suggest = cols.findIndex((_, c) => !target(c) && f.kind && f.kind !== "text" && seen[c] === (f.kind === "last-name" ? "first-name" : f.kind))
      issues.push({ type: "missing", field: f.key, suggest: suggest < 0 ? undefined : suggest })
    }
  }

  // Day/month order for date columns.
  cols.forEach((col, c) => {
    const f = target(c)
    if (!f || byKey.get(f)?.kind !== "date") return
    const found = detectDateOrder(col?.values ?? [])
    const chosen = mapping[c]?.dateOrder
    if (!found) return
    if (found.order === "mixed") issues.push({ type: "date-mixed", column: c, dmyExample: found.dmy, mdyExample: found.mdy })
    else if (found.order === "ambiguous") !chosen && issues.push({ type: "date-ambiguous", column: c, example: found.example })
    else if (chosen && chosen !== found.order) issues.push({ type: "date-wrong", column: c, detected: found.order, example: found.example })
  })
  return issues
}

/** The mapping with each date column's order filled in from its values when nobody picked one. */
export function resolveMapping(columns: MapperColumn[], mapping: ColumnTarget[]): ColumnTarget[] {
  return (Array.isArray(columns) ? columns : []).map((col, c) => {
    const m = mapping?.[c] ?? { field: null }
    if (m.dateOrder) return m
    const found = detectDateOrder(col?.values ?? [])
    return found && (found.order === "dmy" || found.order === "mdy") ? { ...m, dateOrder: found.order } : m
  })
}
