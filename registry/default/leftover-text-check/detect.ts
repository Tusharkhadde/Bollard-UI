/**
 * Pure detectors for leftover-text-check: what a person forgot to take out of text before publishing it.
 * Chatbot chatter and refusals, unfilled placeholders, TK/TODO markers and a paragraph pasted twice.
 * Offsets index into the text exactly as given (CRLF and a BOM included). Safe on the server.
 */

export type LeftoverKind = "refusal" | "chatter" | "placeholder" | "marker" | "duplicate"

export interface Leftover {
  /** Stable id: kind plus the token or the start offset. */
  id: string
  kind: LeftoverKind
  /** Every range this finding covers; a placeholder lists each copy. */
  ranges: { start: number; end: number }[]
  /** The leftover text itself (the placeholder token, the sentence, the repeated paragraph). */
  text: string
}

const MAX = 200_000

// Apostrophes are matched straight or curly: chatbots and word processors usually emit ’.
const CANT = String.raw`(?: cannot| can['’]?t| can not| am unable to|['’]m unable to| am not able to|['’]m not able to| won['’]t be able to| will not be able to)`
const REFUSAL = [
  // "I'm sorry, but I can't…", "Apologies, but I am unable to provide…", "Unfortunately, I cannot generate…"
  new RegExp(String.raw`\b(?:sorry|apologi[sz]e|apologies|unfortunately|afraid)\b[^.!?\n]{0,24}?\bI${CANT} (?:fulfil+|comply|assist|help(?! but\b)|provide|generate|create|complete|write|use|include|produce|do that)\b`, "i"),
  // A bare refusal that opens the sentence: "I can't assist with that.", "I cannot comply."
  new RegExp(String.raw`^I${CANT} (?:fulfil+|comply|assist|(?:help|do) (?:with )?(?:that|this))\b`, "i"),
  /\b(?:I )?(?:cannot|can['’]t|unable to) (?:fulfil+|comply with) (?:this|that|your) request\b/i,
  /\b(?:goes against|violates?|against) (?:the )?OpenAI(?:['’]s)? (?:use |usage |content )?polic(?:y|ies)\b/i,
  /\bas an AI(?: language model| assistant| model)?\b/i,
]
const CHATTER = [
  // Only the interjection itself ("Certainly!", "Sure, here's…"), so "Of course, the market fell." stays prose.
  /^(?:certainly|sure(?: thing)?|absolutely|of course|great question|happy to help)(?:\s*[!.]|,\s*(?:here|I|below|let)\b)/i,
  /^here(?:['’]s| is| are)\b[^.!?\n]*:\s*$/i,
  /^here(?:['’]s| is| are) (?:a |an |the |your )?(?:revised|rewritten|updated|improved|polished|refined|shorter|longer|new) /i,
  /\bI hope this helps\b/i,
  /\blet me know if you(?:['’]d| would)? (?:like|want|need)\b/i,
  /\bfeel free to (?:ask|let me know|reach out|adjust|modify|tweak|customi[sz]e)\b/i,
  /\bwould you like me to\b/i,
  /\bas of my (?:last )?(?:knowledge )?(?:update|cutoff|training)\b/i,
  /^I(?:['’]ve| have) (?:rewritten|revised|updated|kept|made|adjusted|tailored)\b/i,
]

/** Words that make bracketed text a slot to fill rather than prose ("[product]", "[Your Name]", "[task 1]"). */
const SLOT =
  /\b(?:name|first name|company|product|brand|date|time|city|location|address|email|phone|number|amount|price|title|role|position|topic|link|url|insert|add|your|recipient|client|customer|industry|feature|benefit|keyword|task|step|item|details?|description|reason|team|event|month|year|percentage|placeholder|here|x|n)\b/i

const sentenceRanges = (text: string) => {
  const out: { start: number; end: number }[] = []
  const re = /[^.!?\r\n]+(?:[.!?]+["”’)]*|:(?=\s*$)|(?=\r?\n|$))/gm
  for (const m of text.matchAll(re)) {
    const lead = m[0].length - m[0].trimStart().length
    const start = (m.index ?? 0) + lead
    const end = (m.index ?? 0) + m[0].trimEnd().length
    if (end > start) out.push({ start, end })
  }
  return out
}

/** Merges ranges that touch or are separated only by whitespace. */
const merge = (text: string, ranges: { start: number; end: number }[]) => {
  const out: { start: number; end: number }[] = []
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = out.at(-1)
    if (last && !text.slice(last.end, r.start).trim()) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}

function isSlot(inner: string) {
  const s = inner.trim()
  if (!s || s.length > 40) return false
  if (/^\d+(?:\s*[,–-]\s*\d+)*$/.test(s)) return false // [1], [2, 3], [4–6]: citations
  if (/^(?:sic|sic!|\.\.\.|…|\^.*|[ xX✓]|citation needed|emphasis (?:added|mine))$/i.test(s)) return false
  if (s.split(/\s+/).length > 6 || /[.!?;]\s/.test(s)) return false
  return SLOT.test(s) || /^[A-Z][A-Z _-]{2,}$/.test(s) // [PRODUCT_NAME]
}

/** Lists what's been left in the text. Never throws; huge input is checked up to the first 200,000 characters. */
export function findLeftovers(input: string | null | undefined, opts: { phrases?: RegExp[]; duplicates?: boolean } = {}): Leftover[] {
  const text = typeof input === "string" ? input.slice(0, MAX) : ""
  if (!text.trim()) return []
  const out: Leftover[] = []

  // Chatter and refusals, sentence by sentence. Neighbours merge into one finding, so "I can't do that.
  // Here's a version without it:" goes in one tap; it counts as a refusal if any part is one.
  const flagged: { start: number; end: number; refusal: boolean }[] = []
  for (const r of sentenceRanges(text)) {
    const s = text.slice(r.start, r.end)
    if (REFUSAL.some((re) => re.test(s))) flagged.push({ ...r, refusal: true })
    else if ([...CHATTER, ...(opts.phrases ?? [])].some((re) => re.test(s))) flagged.push({ ...r, refusal: false })
  }
  for (const r of merge(text, flagged)) {
    const kind = flagged.some((f) => f.refusal && f.start >= r.start && f.end <= r.end) ? "refusal" : "chatter"
    out.push({ id: `${kind}:${r.start}`, kind, ranges: [r], text: text.slice(r.start, r.end) })
  }

  // Placeholders, grouped by token so one fill replaces every copy.
  const slots = new Map<string, { start: number; end: number }[]>()
  const add = (token: string, start: number) => slots.set(token, [...(slots.get(token) ?? []), { start, end: start + token.length }])
  for (const m of text.matchAll(/(?<![\]\\!])\[([^[\]\r\n]{1,40})\](?![([])/g)) {
    const at = m.index ?? 0
    // "[label]: https://…" at the start of a line is a Markdown link definition, not a slot.
    if (/^:\s*\S+$/.test(text.slice(at + m[0].length).split(/\r?\n/)[0]) && (at === 0 || text[at - 1] === "\n")) continue
    if (isSlot(m[1])) add(m[0], at)
  }
  for (const m of text.matchAll(/(?<![{$\\])\{([^{}\r\n]{1,40})\}(?!\})/g)) if (isSlot(m[1])) add(m[0], m.index ?? 0)
  for (const m of text.matchAll(/<(?:insert|add|your)\b[^<>\r\n]{0,40}>/gi)) add(m[0], m.index ?? 0)
  for (const m of text.matchAll(/(?<![\w$£€₹])(?:[$£€₹][Xx]{1,}(?:[.,][Xx]+)*|[Xx]{2,}%|[Xx]{2,}(?:,[Xx]{3})+|XX\/XX(?:\/XX(?:XX)?)?)(?![\w%])/g)) add(m[0], m.index ?? 0)
  for (const [token, ranges] of slots) out.push({ id: `placeholder:${token}`, kind: "placeholder", ranges, text: token })

  // Editorial markers: TK (journalism's "to come"), TODO, FIXME, lorem ipsum.
  for (const m of text.matchAll(/\b(?:TKTK|TK(?! ?Maxx\b)|TODO|FIXME)\b|lorem ipsum/gi)) {
    if (/^tk/i.test(m[0]) && m[0] !== m[0].toUpperCase()) continue // "tk" in lower case is too often a word part or name
    if (/^(?:todo|fixme)$/i.test(m[0]) && m[0] !== m[0].toUpperCase()) continue
    const start = m.index ?? 0
    out.push({ id: `marker:${start}`, kind: "marker", ranges: [{ start, end: start + m[0].length }], text: m[0] })
  }

  // A paragraph pasted twice: the later copy is the leftover.
  if (opts.duplicates !== false) {
    const seen = new Set<string>()
    for (const m of text.matchAll(/[^\r\n]+(?:\r?\n[^\r\n]+)*/g)) {
      const key = m[0].replace(/\s+/g, " ").trim().toLowerCase()
      if (key.length < 40) continue
      const start = (m.index ?? 0) + m[0].length - m[0].trimStart().length
      if (seen.has(key)) out.push({ id: `duplicate:${start}`, kind: "duplicate", ranges: [{ start, end: (m.index ?? 0) + m[0].trimEnd().length }], text: m[0].trim() })
      seen.add(key)
    }
  }

  const rank: Record<LeftoverKind, number> = { refusal: 0, chatter: 1, placeholder: 2, marker: 3, duplicate: 4 }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.ranges[0].start - b.ranges[0].start)
}

/** Removes ranges from text along with the whitespace they leave behind. */
export function removeRanges(text: string, ranges: { start: number; end: number }[]) {
  let result = text
  for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
    let start = Math.max(0, r.start)
    let end = Math.min(result.length, r.end)
    while (end < result.length && /[ \t]/.test(result[end])) end++
    const lineStart = start === 0 || /\n[ \t]*$/.test(result.slice(0, start))
    const lineEnd = end === result.length || /^\r?\n/.test(result.slice(end))
    if (lineStart && lineEnd) {
      // The whole line goes with its line break; after a blank line, the blank line it would leave doubled goes too.
      const br = result.slice(end).match(/^(?:\r?\n){1,2}/)?.[0] ?? ""
      const afterBlank = start === 0 || /\n[ \t]*\r?\n[ \t]*$/.test(result.slice(0, start))
      const drop = afterBlank ? br.length : (br.match(/^\r?\n/)?.[0].length ?? 0)
      if (end + drop >= result.length) start = result.slice(0, start).replace(/\s+$/, "").length // last line: no trailing blank lines
      result = result.slice(0, start) + result.slice(end + drop)
      continue
    }
    while (start > 0 && /[ \t]/.test(result[start - 1])) start--
    const gap = start > 0 && end < result.length && !/\s/.test(result[start - 1]) && !/^[\s.,;:!?)]/.test(result[end]) ? " " : ""
    result = result.slice(0, start) + gap + result.slice(end)
  }
  return result.replace(/^\s+/, (m) => (text.startsWith(m) ? m : ""))
}

/** Replaces every copy of a placeholder token with the given text. */
export function fillPlaceholder(text: string, token: string, value: string) {
  return text.split(token).join(value)
}
