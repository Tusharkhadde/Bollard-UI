// Bollard UI — import-preview · MIT licence · https://bollard-ui.vercel.app/components/import-preview

/** A field in your data that file columns can be mapped onto. */
export interface ImportField {
  key: string
  label: string
  /** Import is held until some column maps here. */
  required?: boolean
  /** Other headings that mean this field ("E-mail", "Email address"). */
  aliases?: string[]
  /** What values look like. Used to match columns by content and to check cells. */
  type?: "text" | "email" | "phone" | "date" | "number"
  /** Extra check for one cell. Return the reason it's bad, or null. */
  validate?: (value: string) => string | null
}

export interface ColumnMatch {
  /** Field key, or null for "don't import". */
  field: string | null
  /** 0–1. */
  confidence: number
  /** True when the match came from the values, not the heading. */
  byContent: boolean
}

export interface RowIssue {
  /** Line in the file, 1-based, as the spreadsheet shows it. */
  line: number
  reason: "duplicate" | "existing" | "header" | "invalid" | "missing"
  detail: string
}

const SNIFF: Record<NonNullable<ImportField["type"]>, RegExp> = {
  text: /./,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  phone: /^\+?[\d\s().-]{7,}$/,
  date: /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})$/,
  number: /^-?[\d,]*\.?\d+$/,
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
const looksLike = (field: ImportField, value: string) => SNIFF[field.type ?? "text"].test(value.trim())

/** How well a heading names a field: 1 for an exact name or alias, less for partial overlap. */
function nameScore(heading: string, field: ImportField) {
  const h = norm(heading)
  if (!h) return 0
  const names = [field.key, field.label, ...(field.aliases ?? [])].map(norm)
  if (names.includes(h)) return 1
  if (names.some((n) => n.length > 2 && (h.includes(n) || n.includes(h)))) return 0.8
  return 0
}

/** Share of a column's sample values that look like the field's type, or null when the field has no type. */
function contentScore(values: string[], field: ImportField) {
  if (!field.type || field.type === "text") return null
  const filled = values.filter((v) => v.trim())
  return filled.length ? filled.filter((v) => looksLike(field, v)).length / filled.length : 0
}

/**
 * Finds the row holding the headings: skips title rows above it (a single
 * filled cell, "Contacts export, Oct 2026") and returns -1 when no row in the
 * first five names any field, i.e. the file starts straight with data.
 */
export function detectHeaderRow(rows: string[][], fields: ImportField[]) {
  let best = -1
  let bestHits = 0
  rows.slice(0, 5).forEach((row, i) => {
    const hits = row.filter((cell) => fields.some((f) => nameScore(cell, f) === 1)).length
    if (hits > bestHits) [best, bestHits] = [i, hits]
  })
  return best
}

/**
 * Maps each column to its likeliest field from the heading and a sample of the
 * values. A heading match is boosted or doubted by the values; a column whose
 * heading says nothing ("Contact") can still match by content, capped at 70%.
 * Each field is used once, best match first.
 */
export function matchColumns(headings: string[], columns: string[][], fields: ImportField[]): ColumnMatch[] {
  const candidates: { col: number; field: string; confidence: number; byContent: boolean }[] = []
  headings.forEach((heading, col) => {
    const sample = columns[col].slice(0, 50)
    for (const field of fields) {
      const name = nameScore(heading, field)
      const content = contentScore(sample, field)
      const confidence = content === null ? name * 0.9 : name ? 0.6 * name + 0.4 * content : 0.7 * content
      if (confidence >= 0.5) candidates.push({ col, field: field.key, confidence, byContent: !name })
    }
  })
  candidates.sort((a, b) => b.confidence - a.confidence)
  const result: ColumnMatch[] = headings.map(() => ({ field: null, confidence: 0, byContent: false }))
  const used = new Set<string>()
  for (const c of candidates) {
    if (result[c.col].field || used.has(c.field)) continue
    result[c.col] = { field: c.field, confidence: c.confidence, byContent: c.byContent }
    used.add(c.field)
  }
  return result
}

export interface CheckOptions {
  /** Field whose value identifies a record (usually email). Compared trimmed and case-insensitively. */
  uniqueKey?: string
  /** Whether a record with this key already exists in your data. */
  isExisting?: (key: string) => boolean
}

/**
 * Turns data rows into records and the reason each skipped row is skipped:
 * a repeated heading row, a missing required value, a bad cell, a duplicate
 * of an earlier line, or a record you already have. The first copy of a
 * duplicate is kept.
 */
export function checkRows(rows: string[][], firstLine: number, headings: string[], mapping: ColumnMatch[], fields: ImportField[], { uniqueKey, isExisting }: CheckOptions = {}) {
  const records: Record<string, string>[] = []
  const issues: RowIssue[] = []
  const seen = new Map<string, number>()
  const headingKey = headings.map(norm).join("|")
  rows.forEach((row, i) => {
    const line = firstLine + i
    if (row.every((cell) => !cell.trim())) return
    if (row.map(norm).join("|") === headingKey) return issues.push({ line, reason: "header", detail: "Headings repeated (two exports pasted together?)" })
    const record: Record<string, string> = {}
    mapping.forEach((m, col) => m.field && (record[m.field] = (row[col] ?? "").trim()))
    for (const field of fields) {
      const value = record[field.key] ?? ""
      if (!value) {
        if (field.required && mapping.some((m) => m.field === field.key)) return issues.push({ line, reason: "missing", detail: `${field.label} is empty` })
        continue
      }
      const bad = !looksLike(field, value) ? `${field.label} “${value}” doesn't look like ${field.type === "email" ? "an email" : `a ${field.type}`}` : field.validate?.(value)
      if (bad) return issues.push({ line, reason: "invalid", detail: bad })
    }
    if (uniqueKey && record[uniqueKey]) {
      const key = record[uniqueKey].toLowerCase()
      if (seen.has(key)) return issues.push({ line, reason: "duplicate", detail: `Same as line ${seen.get(key)}` })
      seen.set(key, line)
      if (isExisting?.(key)) return issues.push({ line, reason: "existing", detail: `${record[uniqueKey]} is already in your list` })
    }
    records.push(record)
  })
  return { records, issues }
}
