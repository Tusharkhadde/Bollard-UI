export type RefKind = "doi" | "case" | "url" | "cite" | "quote" | "marker"
export type IssueCode = "doi-dash" | "doi-publisher" | "reporter-year" | "future-year" | "marker" | "unsourced-quote"

export interface Issue {
  code: IssueCode
  /** Plain-words reason, in English; the component can swap it via messages keyed by code. */
  message: string
  /** Values the message mentions, for translated messages. */
  vars?: Record<string, string | number>
}

export interface Reference {
  /** Stable for the same text at the same place. */
  id: string
  kind: RefKind
  /** The reference as written. */
  text: string
  start: number
  end: number
  issues: Issue[]
  /** What a lookup should search for: the DOI, the case citation or the URL. Null when nothing can be looked up. */
  key: string | null
  /** A one-tap repair: replace `text` with this. Empty string removes it. */
  fix?: string
}

/**
 * DOI registrant prefixes of the big publishers, and the journals that use them. "Nature", "Science" and "Cell"
 * only count as the journal when no capitalised word sits right before them, so "Computer Science",
 * "Environmental Science & Technology" (ACS) and "Human Nature" (Springer) aren't read as Science or Nature.
 */
const SOLO = String.raw`(?<![A-Z][\p{L}'’-]*[ \u00A0])`
const PUBLISHERS: { prefix: string; name: string; journals: RegExp }[] = [
  { prefix: "10.1038", name: "Springer Nature", journals: new RegExp(String.raw`${SOLO}\bNature(?! Communications? Reviews)\b|\bScientific Reports\b|\bNature Communications\b`, "u") },
  { prefix: "10.1126", name: "AAAS", journals: new RegExp(String.raw`${SOLO}\bScience(?: Advances| Translational Medicine)?\b(?!\s*(?:of|and|&|Direct)\b)`, "u") },
  { prefix: "10.1056", name: "NEJM Group", journals: /\b(?:N(?:ew)? ?Engl(?:and)? ?J(?:ournal)? ?(?:of )?Med(?:icine)?|NEJM)\b/i },
  { prefix: "10.1001", name: "the American Medical Association", journals: /\bJAMA\b/ },
  { prefix: "10.1136", name: "BMJ", journals: /\bBMJ\b|\bBritish Medical Journal\b/ },
  { prefix: "10.1371", name: "PLOS", journals: /\bPLo[Ss] (?:ONE|One|Biology|Medicine|Genetics)\b/ },
  { prefix: "10.1016", name: "Elsevier", journals: new RegExp(String.raw`\bThe Lancet\b|\bLancet\b|${SOLO}\bCell\b(?! Reports? Physical)`, "u") },
  { prefix: "10.1145", name: "ACM", journals: /\bCommunications of the ACM\b|\bACM Computing Surveys\b/ },
  { prefix: "10.1109", name: "IEEE", journals: /\bIEEE Transactions\b/ },
  { prefix: "10.1073", name: "PNAS", journals: /\bPNAS\b|\bProceedings of the National Academy of Sciences\b/ },
]

/** Federal reporters and the years they printed: a citation outside its reporter's years is a tell. */
// Years from Justia's reporter index (https://law.justia.com/cases/) and Wikipedia's Federal Reporter / Federal Supplement pages.
const REPORTERS: { re: RegExp; name: string; from?: number; to?: number; next?: string }[] = [
  { re: /^F\.\s?2d$/, name: "F.2d", from: 1924, to: 1993, next: "F.3d" },
  { re: /^F\.\s?3d$/, name: "F.3d", from: 1993, to: 2021, next: "F.4th" },
  { re: /^F\.\s?Supp\.$/, name: "F. Supp.", from: 1932, to: 1998, next: "F. Supp. 2d" },
  { re: /^F\.\s?4th$/, name: "F.4th", from: 2021 },
  { re: /^F\.\s?Supp\.\s?2d$/, name: "F. Supp. 2d", from: 1998, to: 2014, next: "F. Supp. 3d" },
  { re: /^F\.\s?Supp\.\s?3d$/, name: "F. Supp. 3d", from: 2014 },
  { re: /^F\.\s?App(?:'|’)x$/, name: "F. App'x", from: 2001, to: 2021 },
]

const DASHES = /[\u2010-\u2015\u2212]/
const DOI = /\b10\.\d{4,9}\/(?:[^\s"<>()[\]{}]|\(\w{1,6}\))*[^\s"<>()[\]{}.,;:]/g
const CASE = /\b(\d{1,4})\s+(U\.\s?S\.|S\.\s?Ct\.|F\.\s?(?:2d|3d|4th)|F\.\s?Supp\.(?:\s?[23]d)?|F\.\s?App(?:'|’)x)\s+(\d{1,5})(?:,\s*\d{1,5}(?:[–-]\d+)?)?\s*\(([^()]{0,40}?)(\d{4})\)/g
const URL = /\bhttps?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/g
const AUTHOR_YEAR = /\(([A-Z][\p{L}'’-]+(?:\s(?:et al\.|and|&)\s?[A-Z]?[\p{L}'’-]*)?),?\s(\d{4})[a-z]?\)/gu
const MARKERS = /:?contentReference\[oaicite:\d+\]\{index=\d+\}|【\d+(?::\d+)?†[^】]{0,40}】|\uE200cite(?:\uE202[\w-]+)+\uE201|oai_citation:\d+‡[^\s)\]]*|\[cite(?:_start|_end|:\s*[\d, ]+)\]|\bturn\d+(?:search|news|view|file)\d+\b/g
const QUOTE = /[“"]([^“”"\n]{40,})[”"]/g
const SOURCE_NEAR = /\([^()]*\d{4}[a-z]?\)|\[\d+(?:[,–-]\s?\d+)*\]|https?:\/\/|\b10\.\d{4,9}\/|\d+\s+(?:U\.\s?S\.|F\.)|\b(?:said|wrote|according to|told)\s+[A-Z]/

/**
 * Finds the references in AI-written text and flags the ones that look made up: a DOI whose prefix
 * doesn't belong to the journal it names, a dash inside a DOI, a case cited to a reporter that wasn't
 * printing that year (F.3d for 2022), a year in the future, leftover chatbot citation markers
 * (oaicite, 【4†source】), and long quotes with no source nearby. Everything with a `key` can be
 * looked up; nothing here claims a reference is real. Never throws.
 */
export function findReferences(input: string, opts: { year?: number } = {}): Reference[] {
  if (typeof input !== "string" || !input) return []
  const text = input
  const year = opts.year && Number.isFinite(opts.year) ? opts.year : new Date().getFullYear()
  const refs: Reference[] = []
  const taken = (s: number, e: number) => refs.some((r) => s < r.end && e > r.start)
  const push = (r: Omit<Reference, "id">) => {
    if (!taken(r.start, r.end)) refs.push({ ...r, id: `${r.kind}-${r.start}-${r.text.length}` })
  }
  const future = (y: number): Issue[] => (y > year ? [{ code: "future-year", message: `${y} hasn't happened yet.`, vars: { year: y } }] : [])

  for (const m of text.matchAll(MARKERS)) push({ kind: "marker", text: m[0], start: m.index, end: m.index + m[0].length, key: null, fix: "", issues: [{ code: "marker", message: "A chatbot's citation marker. It points to nothing outside that chat." }] })

  // DOIs, including ones where a dash replaced the hyphen ("10.1038/s41586–021").
  const doiText = text.replace(/\b10\.\d{4,9}\/\S+/g, (s) => s.replace(new RegExp(DASHES.source, "g"), "-"))
  const dois = [...doiText.matchAll(DOI)]
  for (const [i, m] of dois.entries()) {
    const raw = text.slice(m.index, m.index + m[0].length)
    const issues: Issue[] = []
    let fix: string | undefined
    if (DASHES.test(raw)) {
      issues.push({ code: "doi-dash", message: "DOIs use plain hyphens. A long dash here usually means the DOI was retyped, not copied.", vars: {} })
      fix = raw.replace(new RegExp(DASHES.source, "g"), "-")
    }
    const prefix = m[0].split("/")[0]
    // A reference names its journal before the DOI, or in a parenthesis right after it. Look no further
    // back than the line start or the previous DOI, so a neighbour's journal never counts.
    const lineStart = text.lastIndexOf("\n", m.index) + 1
    const prev = dois[i - 1]
    const before = text.slice(Math.max(lineStart, m.index - 120, prev ? prev.index + prev[0].length : 0), m.index)
    const paren = text.slice(m.index + raw.length).match(/^\s*\(([^()\n]{0,40})\)/)?.[1] ?? ""
    const near = `${before} ${paren}`
    const named = PUBLISHERS.find((p) => p.journals.test(near))
    if (named && named.prefix !== prefix) {
      const owner = PUBLISHERS.find((p) => p.prefix === prefix)
      const journal = near.match(named.journals)?.[0] ?? named.name
      issues.push({ code: "doi-publisher", message: `It names ${journal}, but ${prefix} belongs to ${owner ? owner.name : "a different publisher"}. ${journal} DOIs start ${named.prefix}.`, vars: { journal, prefix, expected: named.prefix } })
    }
    const y = paren.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? before.slice(-40).match(/\b(?:19|20)\d{2}\b(?!.*\b(?:19|20)\d{2}\b)/)?.[0]
    if (y) issues.push(...future(Number(y)))
    push({ kind: "doi", text: raw, start: m.index, end: m.index + raw.length, key: m[0].toLowerCase(), issues, fix })
  }

  for (const m of text.matchAll(CASE)) {
    const y = Number(m[5])
    const reporter = REPORTERS.find((r) => r.re.test(m[2].trim()))
    const issues: Issue[] = [...future(y)]
    if (reporter && y <= year && ((reporter.to && y > reporter.to) || (reporter.from && y < reporter.from)))
      issues.push({ code: "reporter-year", message: `${reporter.name} ${reporter.to && y > reporter.to ? `stopped in ${reporter.to}${reporter.next ? `; a ${y} case would be in ${reporter.next}` : ""}` : `started in ${reporter.from}`}.`, vars: { reporter: reporter.name, year: y } })
    // Take the case name back to the start of the sentence or line ("Varghese v. China Southern Airlines Co., ").
    const before = text.slice(Math.max(0, m.index - 120), m.index)
    const clause = before.split(/[;:]\s|\.\s+(?=[A-Z])(?<!\bv\.\s+)|\n/).pop() ?? ""
    const name = clause.replace(/^\s*(?:(?:See|see|Cf\.|cf\.|But|but|E\.g\.|e\.g\.|also|Accord|accord),?\s+)+/, "").match(/([A-Z][\w.'’&-]*(?:\s+[\w.'’&-]+){0,8}\s+v\.\s+[\w.'’&,-]+(?:\s+[\w.'’&,-]+){0,8}?,?\s*)$/)
    const start = name ? m.index - name[1].length : m.index
    push({ kind: "case", text: text.slice(start, m.index + m[0].length), start, end: m.index + m[0].length, key: `${m[1]} ${m[2].replace(/\s+/g, " ")} ${m[3]}`, issues })
  }

  for (const m of text.matchAll(URL)) {
    if (/doi\.org\//i.test(m[0]) && refs.some((r) => r.kind === "doi" && r.start >= m.index && r.end <= m.index + m[0].length)) continue
    push({ kind: "url", text: m[0], start: m.index, end: m.index + m[0].length, key: m[0], issues: [] })
  }

  for (const m of text.matchAll(AUTHOR_YEAR)) {
    const y = Number(m[2])
    if (y > year) push({ kind: "cite", text: m[0], start: m.index, end: m.index + m[0].length, key: null, issues: future(y) })
  }

  for (const m of text.matchAll(QUOTE)) {
    const words = m[1].trim().split(/\s+/).length
    if (words < 25) continue
    const paraStart = Math.max(text.lastIndexOf("\n\n", m.index), 0)
    const nextBreak = text.indexOf("\n\n", m.index + m[0].length)
    const para = text.slice(paraStart, nextBreak < 0 ? text.length : nextBreak)
    if (SOURCE_NEAR.test(para.replace(m[0], ""))) continue
    push({ kind: "quote", text: m[0], start: m.index, end: m.index + m[0].length, key: null, issues: [{ code: "unsourced-quote", message: `A ${words}-word quote with nothing saying who said it or where.`, vars: { words } }] })
  }

  return refs.sort((a, b) => a.start - b.start)
}

/** Applies a reference's fix to the text, only if the reference is still where it was found. */
export function applyFix(text: string, ref: Pick<Reference, "start" | "end" | "text" | "fix">): string {
  if (ref.fix === undefined || text.slice(ref.start, ref.end) !== ref.text) return text
  let before = text.slice(0, ref.start)
  let after = text.slice(ref.end)
  // Removing a marker shouldn't leave a double space or a space before punctuation.
  if (ref.fix === "") {
    if (/\s$/.test(before) && /^[\s.,;:!?)]/.test(after)) before = before.replace(/[ \t]+$/, "")
    if (/^[ \t]/.test(after) && /^\s*$/.test(before.slice(-1))) after = after.replace(/^[ \t]+/, "")
  }
  return before + ref.fix + after
}
