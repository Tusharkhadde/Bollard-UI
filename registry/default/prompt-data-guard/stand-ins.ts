import { detectPii } from "@/registry/default/pii-post-guard/pii"

/** What a stand-in replaces. */
export type DataKind = "name" | "email" | "phone" | "card" | "aadhaar" | "pan" | "address" | "secret"
export const DATA_KINDS: DataKind[] = ["secret", "card", "aadhaar", "pan", "email", "phone", "address", "name"]

export interface DataMatch {
  kind: DataKind
  value: string
  start: number
  end: number
}

export interface PromptScan {
  matches: DataMatch[]
  /** Data rows in pasted tables that hold personal data (header excluded). */
  rows: number
  /** Confidentiality markings found, as written ("CONFIDENTIAL"). */
  markings: string[]
}

/** Finds secrets in text; pass `detectSecrets` from secret-paste-guard. */
export type SecretDetector = (text: string) => { value: string; start: number; end: number }[]
/** Finds people's names in free text, e.g. an NER model or a list from your CRM. Same shape as SecretDetector. */
export type NameDetector = SecretDetector

export interface ScanOptions {
  detectSecrets?: SecretDetector
  /** Optional: finds names in free text. Without it, names are caught in table name columns only. */
  detectNames?: NameDetector
  /** Names already found elsewhere (another attachment); every other mention in this text is stood in too. */
  knownNames?: string[]
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** A markdown table rule row (|---|:--:|) or an empty cell. */
const RULE_CELL = /^[\s:=-]*$/

const MARKING = /\b(?:STRICTLY CONFIDENTIAL|CONFIDENTIAL|INTERNAL ONLY|INTERNAL USE ONLY|DO NOT (?:DISTRIBUTE|SHARE|FORWARD)|ATTORNEY[- ]CLIENT PRIVILEGED|PRIVILEGED|UNDER NDA|NOT FOR (?:DISTRIBUTION|EXTERNAL USE))\b|^(?:Confidential|Internal only)\b/gm
const NAME_HEADER = /^(?:full[\s_-]?name|name|customer(?:[\s_-]?name)?|client(?:[\s_-]?name)?|first[\s_-]?name|last[\s_-]?name|surname|contact(?:[\s_-]?name)?|patient(?:[\s_-]?name)?|employee(?:[\s_-]?name)?)$/i
const PERSONAL_HEADER = /name|e-?mail|phone|mobile|address|customer|dob|birth|aadhaar|pan\b|ssn/i

/** Splits one delimited line, honouring double quotes. Returns cells with their offsets in the line. */
function cells(line: string, sep: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = []
  let start = 0
  let quoted = false
  for (let i = 0; i <= line.length; i++) {
    const ch = line[i]
    if (ch === '"') quoted = !quoted
    if (i === line.length || (ch === sep && !quoted)) {
      const raw = line.slice(start, i)
      const lead = raw.length - raw.trimStart().length
      const body = raw.trim().replace(/^"|"$/g, "")
      const s = start + lead + (raw.trim().startsWith('"') ? 1 : 0)
      out.push({ text: body, start: s, end: s + body.length })
      start = i + 1
    }
  }
  return out
}

interface Table {
  header: { text: string; start: number; end: number }[]
  rows: { offset: number; cells: { text: string; start: number; end: number }[] }[]
}

/** Runs of 3+ lines that split into the same number (2+) of cells by comma, tab, semicolon or pipe. */
function findTables(text: string): Table[] {
  const lines: { text: string; offset: number }[] = []
  let offset = 0
  for (const l of text.split("\n")) {
    lines.push({ text: l, offset })
    offset += l.length + 1
  }
  const tables: Table[] = []
  let i = 0
  while (i < lines.length) {
    let best: { sep: string; end: number } | null = null
    for (const sep of ["\t", ",", ";", "|"]) {
      const n = cells(lines[i].text, sep).length
      if (n < 2) continue
      let j = i + 1
      while (j < lines.length && lines[j].text.trim() && cells(lines[j].text, sep).length === n) j++
      if (j - i >= 3 && (!best || j > best.end)) best = { sep, end: j }
    }
    if (!best) {
      i++
      continue
    }
    const all = lines.slice(i, best.end).map((l) => ({ offset: l.offset, cells: cells(l.text, best!.sep) }))
    const first = all[0].cells
    const isHeader = first.every((c) => !/\d/.test(c.text)) && first.some((c) => /[a-z]/i.test(c.text))
    tables.push({ header: isHeader ? first.map((c) => ({ ...c, start: c.start + all[0].offset, end: c.end + all[0].offset })) : [], rows: isHeader ? all.slice(1) : all })
    i = best.end
  }
  return tables
}

/**
 * Finds what shouldn't leave for an AI provider: personal details (reusing pii-post-guard's checked
 * detectors), secrets (through `detectSecrets`), every cell in a name column of a pasted table, the
 * number of table rows that hold personal data, and confidentiality markings. Handles CRLF and a BOM;
 * never throws.
 */
export function scanPrompt(input: string, opts: ScanOptions = {}): PromptScan {
  if (typeof input !== "string" || !input) return { matches: [], rows: 0, markings: [] }
  const text = input
  const found: DataMatch[] = []
  const overlaps = (s: number, e: number) => found.some((m) => s < m.end && e > m.start)
  try {
    for (const s of opts.detectSecrets?.(text) ?? []) if (!overlaps(s.start, s.end)) found.push({ kind: "secret", value: s.value, start: s.start, end: s.end })
  } catch {
    // A failing custom detector shouldn't block the rest.
  }
  for (const p of detectPii(text, ["card", "aadhaar", "pan", "email", "address", "phone"])) {
    if (!overlaps(p.start, p.end)) found.push({ kind: p.kind as DataKind, value: p.value, start: p.start, end: p.end })
  }
  let rows = 0
  for (const t of findTables(text)) {
    const nameCols = t.header.map((h, i) => (NAME_HEADER.test(h.text) ? i : -1)).filter((i) => i >= 0)
    const personalHeader = t.header.some((h) => PERSONAL_HEADER.test(h.text))
    for (const r of t.rows) {
      // Skip markdown rule rows (|---|---|): they're layout, not data.
      if (r.cells.every((c) => RULE_CELL.test(c.text))) continue
      for (const c of nameCols) {
        const cell = r.cells[c]
        if (!cell || !cell.text || /^\d+$/.test(cell.text) || RULE_CELL.test(cell.text)) continue
        const s = r.offset + cell.start
        if (!overlaps(s, s + cell.text.length)) found.push({ kind: "name", value: cell.text, start: s, end: s + cell.text.length })
      }
      const lineEnd = r.offset + (r.cells[r.cells.length - 1]?.end ?? 0)
      if (personalHeader || found.some((m) => m.start >= r.offset && m.end <= lineEnd + 1)) rows++
    }
  }
  try {
    for (const n of opts.detectNames?.(text) ?? []) if (n && typeof n.value === "string" && !overlaps(n.start, n.end)) found.push({ kind: "name", value: n.value, start: n.start, end: n.end })
  } catch {
    // A failing custom detector shouldn't block the rest.
  }
  // A name found once (in a table column, by detectNames, or in another attachment) is stood in everywhere it
  // appears, so "call Asha Rao" under the table doesn't leak what the table hid.
  const names = new Set([...found.filter((m) => m.kind === "name").map((m) => m.value.trim()), ...(opts.knownNames ?? []).map((n) => String(n).trim())])
  // Capped so a 10,000-row export stays fast; the table cells themselves are already covered.
  for (const n of [...names].filter((x) => x.length >= 2 && /\p{L}/u.test(x)).sort((a, b) => b.length - a.length).slice(0, 500)) {
    for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(n).replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}_])`, "giu"))) {
      if (!overlaps(m.index, m.index + m[0].length)) found.push({ kind: "name", value: m[0], start: m.index, end: m.index + m[0].length })
    }
  }
  const markings = [...new Set([...text.matchAll(MARKING)].map((m) => m[0]))]
  return { matches: found.sort((a, b) => a.start - b.start), rows, markings }
}

/** Stand-in tokens look like ‹EMAIL_1›: unlikely in real text, and models copy them through intact. */
const token = (kind: DataKind, n: number) => `‹${kind.toUpperCase()}_${n}›`
const normal = (m: DataMatch) => (m.kind === "email" || m.kind === "name" ? m.value.trim().toLowerCase() : /phone|card|aadhaar/.test(m.kind) ? m.value.replace(/\D/g, "").slice(-10) : m.value.trim())

/**
 * Swaps each match for a consistent stand-in (the same email is ‹EMAIL_1› everywhere, across every text
 * you pass) and returns the mapping to keep locally. Pass the same `mapping` again to keep numbering
 * stable across the prompt and its attachments.
 */
export function applyStandIns(text: string, matches: DataMatch[], mapping: Record<string, string> = {}): { text: string; mapping: Record<string, string> } {
  const map = { ...mapping }
  const byValue = new Map<string, string>()
  const counts: Partial<Record<DataKind, number>> = {}
  for (const [tok, original] of Object.entries(map)) {
    const m = tok.match(/^‹([A-Z]+)_(\d+)›$/)
    if (!m) continue
    const kind = m[1].toLowerCase() as DataKind
    counts[kind] = Math.max(counts[kind] ?? 0, Number(m[2]))
    byValue.set(`${kind}:${normal({ kind, value: original, start: 0, end: 0 })}`, tok)
  }
  // Number in reading order, so ‹NAME_1› is the first one a reader meets; then replace from the end.
  const live = [...matches].filter((m) => text.slice(m.start, m.end) === m.value).sort((a, b) => a.start - b.start)
  const tokens = live.map((m) => {
    const key = `${m.kind}:${normal(m)}`
    let tok = byValue.get(key)
    if (!tok) {
      counts[m.kind] = (counts[m.kind] ?? 0) + 1
      tok = token(m.kind, counts[m.kind]!)
      byValue.set(key, tok)
      map[tok] = m.value
    }
    return tok
  })
  let out = text
  for (let i = live.length - 1; i >= 0; i--) out = out.slice(0, live[i].start) + tokens[i] + out.slice(live[i].end)
  return { text: out, mapping: map }
}

/**
 * Puts the real values back into the AI's reply. Accepts the stand-in as the model may echo it:
 * ‹EMAIL_1›, <EMAIL_1>, [EMAIL_1], {EMAIL_1} or «EMAIL_1», any case. Unknown tokens are left alone.
 */
export function restoreStandIns(reply: string, mapping: Record<string, string>): string {
  if (typeof reply !== "string" || !mapping) return typeof reply === "string" ? reply : ""
  const bracketed = reply.replace(/[‹<[{«(]\s*([A-Za-z]+)_(\d+)\s*[›>\]}»)]/g, (whole, k: string, n: string) => mapping[`‹${k.toUpperCase()}_${n}›`] ?? whole)
  // Models also drop the brackets ("Hi NAME_1,"). Only exact upper-case tokens that are in the mapping count.
  return bracketed.replace(/(?<![\p{L}\p{N}_])([A-Z]+)_(\d+)(?![\p{L}\p{N}_])/gu, (whole, k: string, n: string) => mapping[`‹${k}_${n}›`] ?? whole)
}
