/**
 * Pure name matching for KYC across ID documents. Sources:
 * - UIDAI FAQ "My name is different in PAN and Aadhaar": name, gender and date of birth should match; a minor name
 *   mismatch falls back to an Aadhaar OTP; a completely different name fails and must be corrected; date of birth
 *   and gender must be exactly the same.
 * - Income Tax Department, "How PAN is formed": the 4th character is the holder type (P individual, C company...)
 *   and the 5th is the first letter of the surname for an individual, or of the name for anyone else.
 */

export type MatchLevel = "exact" | "order" | "initials" | "missing" | "spelling" | "different"

export interface IdRecord {
  /** Stable key, e.g. "pan", "aadhaar", "bank". */
  id: string
  /** Shown to the user: "PAN", "Aadhaar", "Bank account". */
  label: string
  /** The name exactly as printed on the document. */
  name: string
  /** "YYYY-MM-DD". */
  dob?: string
  gender?: "M" | "F" | "T"
  /** A PAN, when this record is the PAN card: its 4th and 5th letters are checked against the name. */
  pan?: string
}

const HONORIFICS = new Set(["MR", "MRS", "MS", "MISS", "SHRI", "SRI", "SMT", "KUM", "KUMARI", "DR", "LATE", "SELVI", "THIRU", "MX"])
/** Spellings ID databases treat as the same word. */
const ALIASES: Record<string, string> = { MOHD: "MOHAMMED", MD: "MOHAMMED", MOHAMMAD: "MOHAMMED", MUHAMMAD: "MOHAMMED", MOHAMED: "MOHAMMED", KR: "KUMAR", KUMAAR: "KUMAR" }

/**
 * Uppercase words with accents, dots and commas removed; "R.K." becomes ["R", "K"]. Leading honorifics ("Mr", "Smt",
 * "Late") are dropped unless `keepHonorifics`, since "MS" can also be someone's initials.
 */
export function nameTokens(name: unknown, keepHonorifics = false): string[] {
  if (typeof name !== "string") return []
  const words = name.replace(/^\uFEFF/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z\s]/g, " ").split(/\s+/).filter(Boolean)
  let start = 0
  while (!keepHonorifics && start < words.length - 1 && HONORIFICS.has(words[start])) start++
  return words.slice(start, start + 12)
}

/** True when the name has letters but none in the Latin script the documents are matched in (e.g. Devanagari). */
export const notLatin = (name: unknown) => typeof name === "string" && /\p{L}/u.test(name) && nameTokens(name).length === 0

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}
/** Common transliteration variants folded together: Lakshmi/Laxmi, Bhaskar/Baskar, Vijay/Vijai, Deepa/Dipa. */
const fold = (w: string) => (ALIASES[w] ?? w).replace(/KSH/g, "X").replace(/([BCDGJKPST])H/g, "$1").replace(/EE/g, "I").replace(/OO/g, "U").replace(/AA/g, "A").replace(/W/g, "V").replace(/Y$/, "I")
/** Different spellings of the same word: a known variant, or a typo (one slip, two in long words). */
// A different first letter is a different name (Mohan/Rohan, Arun/Varun), not a typo.
const close = (a: string, b: string) => fold(a) === fold(b) || (a[0] === b[0] && a.length >= 4 && b.length >= 4 && editDistance(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1))
const initialOf = (a: string, b: string) => (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b))

export interface NameComparison {
  level: MatchLevel
  /** Words in `b` the other name doesn't have, for highlighting. */
  differing: string[]
  /** For "missing": the words only one side has, and which side has them. */
  extra?: { side: "a" | "b"; words: string[] }
}

const RANK: Record<MatchLevel, number> = { exact: 0, order: 1, initials: 2, missing: 3, spelling: 4, different: 5 }

/** How two names differ, in the order an ID database would forgive them. */
export function compareNames(a: unknown, b: unknown): NameComparison {
  const stripped = compareTokens(nameTokens(a), nameTokens(b))
  if (stripped.level !== "different") return stripped
  // "MS Dhoni": what looked like an honorific may be initials, so try again keeping it.
  const kept = compareTokens(nameTokens(a, true), nameTokens(b, true))
  return RANK[kept.level] < RANK[stripped.level] ? kept : stripped
}

function compareTokens(x: string[], y: string[]): NameComparison {
  if (!x.length || !y.length) return { level: "different", differing: y }
  if (x.join(" ") === y.join(" ")) return { level: "exact", differing: [] }
  const sorted = (w: string[]) => [...w].sort().join(" ")
  if (sorted(x) === sorted(y)) return { level: "order", differing: [] }

  if (x.length === y.length) {
    if (x.every((w, i) => w === y[i] || initialOf(w, y[i])) && x.some((w, i) => w !== y[i])) return { level: "initials", differing: y.filter((w, i) => w !== x[i]) }
    if (x.every((w, i) => w === y[i] || close(w, y[i]))) return { level: "spelling", differing: y.filter((w, i) => w !== x[i]) }
  }
  // One name is the other with words left out (a middle name, a father's name): order kept.
  const [short, long] = x.length < y.length ? [x, y] : [y, x]
  let k = 0
  const unmatched: string[] = []
  for (const w of long) {
    if (k < short.length && (w === short[k] || initialOf(w, short[k]))) k++
    else unmatched.push(w)
  }
  if (k === short.length && (short.length > 1 || long.length <= 2))
    return { level: "missing", differing: y.length > x.length ? unmatched : [], extra: { side: y.length > x.length ? "b" : "a", words: unmatched } }
  return { level: "different", differing: y.filter((w) => !x.includes(w)) }
}

/** Holder type from the PAN's 4th letter (Income Tax Department). */
export const PAN_HOLDER_TYPES: Record<string, string> = {
  P: "Individual", C: "Company", H: "Hindu Undivided Family", F: "Firm or LLP", A: "Association of Persons",
  T: "Trust", B: "Body of Individuals", L: "Local Authority", J: "Artificial Juridical Person", G: "Government",
}

export type PanNameFinding =
  | { kind: "format" }
  | { kind: "holder"; letter: string }
  | { kind: "ok"; holder: string; letter: string; word: string }
  /** The letter matches a word that isn't last: the PAN was issued with that word as the surname. */
  | { kind: "surnameElsewhere"; holder: string; letter: string; word: string }
  | { kind: "noWord"; holder: string; letter: string }

/** Checks a PAN's 4th and 5th letters against a name. Null when there's no PAN or no name. */
export function checkPanName(pan: unknown, name: unknown): PanNameFinding | null {
  const p = typeof pan === "string" ? pan.toUpperCase().replace(/[\s-]/g, "") : ""
  const words = nameTokens(name)
  if (!p || !words.length) return null
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(p) || p.slice(5, 9) === "0000") return { kind: "format" }
  const holder = PAN_HOLDER_TYPES[p[3]]
  if (!holder) return { kind: "holder", letter: p[3] }
  const letter = p[4]
  // Individuals: the surname, usually last. Everyone else: the first word of the name.
  const expected = p[3] === "P" ? words[words.length - 1] : words[0]
  if (expected.startsWith(letter)) return { kind: "ok", holder, letter, word: expected }
  const other = words.find((w) => w.startsWith(letter))
  return other ? { kind: "surnameElsewhere", holder, letter, word: other } : { kind: "noWord", holder, letter }
}

export type RecordConflict = { kind: "dob" | "gender"; a: string; b: string }

/** "1994-03-12", "12/03/1994" or "12-03-1994" to "1994-03-12"; gender to its upper-case letter. */
const normal = (field: "dob" | "gender", v: string) => {
  const t = v.trim().toUpperCase()
  if (field === "gender") return t.charAt(0)
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : t
}

/** Date of birth and gender must be exactly the same on every document (formats and case are normalised first). */
export function recordConflicts(records: IdRecord[]): RecordConflict[] {
  const out: RecordConflict[] = []
  const valid = (Array.isArray(records) ? records : []).filter((r) => r && typeof r === "object")
  for (const field of ["dob", "gender"] as const) {
    const withValue = valid.filter((r) => typeof r[field] === "string" && r[field]!.trim())
    for (let i = 1; i < withValue.length; i++)
      if (normal(field, withValue[i][field]!) !== normal(field, withValue[0][field]!)) out.push({ kind: field, a: withValue[0].id, b: withValue[i].id })
  }
  return out
}
