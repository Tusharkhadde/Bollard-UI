// Bollard UI — csv-export-guard · MIT licence · https://bollard-ui.vercel.app/components/csv-export-guard

/** Pure checks behind CsvExportGuard: what a spreadsheet does to each cell when it opens a CSV. */

export type CsvIssueKind = "formula" | "leading-zero" | "long-number" | "plus-number" | "date-like"

export interface CsvCellIssue {
  kind: CsvIssueKind
  /** What the cell turns into when the CSV is opened, e.g. "4110" or "1.23457E+15". */
  becomes: string
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec"
const monthName = (n: number) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][n - 1]

/** Excel's General format: 12+ digits show as 1.23457E+15, and only 15 digits survive. */
function scientific(digits: string) {
  const [mantissa, exp] = Number(digits).toExponential(5).split("e")
  return `${mantissa.replace(/\.?0+$/, "")}E+${exp.replace("+", "").padStart(2, "0")}`
}

/** How a spreadsheet will mangle this value on open, or null when it survives as typed. */
export function spreadsheetIssue(value: string): CsvCellIssue | null {
  if (!value) return null
  const digits = value.replace(/[\s+-]/g, "")
  // A leading + on a phone number is read as a sign: it vanishes and the rest becomes a number.
  if (/^\+\d[\d\s-]{6,}$/.test(value))
    return { kind: "plus-number", becomes: digits.length >= 12 ? scientific(digits) : digits }
  // OWASP list: = + - @, tab, CR, LF, and full-width variants start a formula. Plain numbers like -5 are fine.
  if (/^[=@＝＋－＠\t\r\n]/.test(value) || (/^[+-]/.test(value) && !/^[+-]?\d+(\.\d+)?$/.test(value)))
    return { kind: "formula", becomes: "runs as a formula" }
  if (/^0\d+$/.test(value)) return { kind: "leading-zero", becomes: String(Number(value)) }
  if (/^\d{12,}$/.test(value)) {
    const lost = value.length > 15 ? ` (digits after the 15th become 0)` : ""
    return { kind: "long-number", becomes: scientific(value) + lost }
  }
  const dm = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(value)
  if (dm) {
    const [a, b] = [Number(dm[1]), Number(dm[2])]
    if (a >= 1 && b >= 1 && a <= 31 && b <= 31 && (a <= 12 || b <= 12)) {
      const readings = [b <= 12 && `${a} ${monthName(b)}`, a <= 12 && `${b} ${monthName(a)}`].filter(Boolean) as string[]
      return { kind: "date-like", becomes: [...new Set(readings)].join(" or ") }
    }
  }
  const named = new RegExp(`^(?:(\\d{1,2})[ -]?(${MONTHS})[a-z]*|(${MONTHS})[a-z]*[ -]?(\\d{1,2}))$`, "i").exec(value)
  if (named && !/^\d+$/.test(value)) {
    const day = named[1] ?? named[4]
    const month = (named[2] ?? named[3]).slice(0, 3)
    return { kind: "date-like", becomes: `${Number(day)} ${month[0].toUpperCase()}${month.slice(1).toLowerCase()}` }
  }
  return null
}

/** The fix a flagged cell gets: formulas are neutralised with a prefix, everything else is forced to text. */
export function fixCell(value: string, issue: CsvCellIssue, prefix = "'") {
  return issue.kind === "formula" ? prefix + value : `="${value.replace(/"/g, '""')}"`
}

export interface CsvColumnReport {
  key: string
  label: string
  /** First few values, as text. */
  samples: string[]
  /** Flagged cells by kind, with one example each. */
  issues: { kind: CsvIssueKind; count: number; example: string; becomes: string }[]
  flagged: number
}

export const cellText = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v))

/** One report per column: which cells a spreadsheet would change and how. */
export function analyzeCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): CsvColumnReport[] {
  return columns.map(({ key, label }) => {
    const byKind = new Map<CsvIssueKind, { kind: CsvIssueKind; count: number; example: string; becomes: string }>()
    let flagged = 0
    for (const row of rows) {
      const text = cellText(row[key])
      const issue = spreadsheetIssue(text)
      if (!issue) continue
      flagged++
      const entry = byKind.get(issue.kind)
      if (entry) entry.count++
      else byKind.set(issue.kind, { kind: issue.kind, count: 1, example: text, becomes: issue.becomes })
    }
    return { key, label, samples: rows.slice(0, 3).map((r) => cellText(r[key])), issues: [...byKind.values()], flagged }
  })
}

/** RFC 4180 field: quoted when it holds a comma, quote, line break or edge spaces. */
const field = (s: string) => (/[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** Builds the CSV, applying the fix to flagged cells in the columns listed in `fixed`. CRLF line ends. */
export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  fixed: Iterable<string> = [],
  { prefix = "'", bom = true }: { prefix?: string; bom?: boolean } = {},
) {
  const fix = new Set(fixed)
  const lines = [columns.map((c) => field(c.label)).join(",")]
  for (const row of rows) {
    lines.push(
      columns
        .map(({ key }) => {
          const text = cellText(row[key])
          const issue = fix.has(key) ? spreadsheetIssue(text) : null
          return field(issue ? fixCell(text, issue, prefix) : text)
        })
        .join(","),
    )
  }
  // The BOM makes Excel read UTF-8, so names like "Zoë" or "₹" don't turn into mojibake.
  return (bom ? "\uFEFF" : "") + lines.join("\r\n") + "\r\n"
}
