export type PayeeVerdict = "match" | "close" | "no-match"

/** Titles that never decide who an account belongs to. */
const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "prof", "shri", "sri", "smt", "kumari", "km", "messrs"])
/** Legal-form words: "Priya Sharma Traders Pvt Ltd" and "Priya Sharma Traders" are the same payee. */
const LEGAL = new Set(["ltd", "limited", "pvt", "private", "llp", "llc", "inc", "plc", "co", "corp", "company", "gmbh", "pte", "the"])

/** Lowercase words with accents, punctuation, titles and legal suffixes removed. */
export function nameTokens(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bm\/s\b/g, " ")
    .replace(/&/g, " and ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && !HONORIFICS.has(t) && !LEGAL.has(t))
}

/** Edit distance where a swapped neighbour pair (Pirya → Priya) is one edit. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** "P" stands for "Priya"; "Priya" is a typo of "Pirya"; otherwise the words must be equal. */
const near = (typed: string, actual: string) =>
  typed === actual ||
  (typed.length === 1 && actual.startsWith(typed)) ||
  (Math.min(typed.length, actual.length) >= 4 && distance(typed, actual) <= (actual.length >= 8 ? 2 : 1))

/**
 * Compares the name the payer typed with the name the bank holds, the way
 * Confirmation of Payee does: word order, case, accents, titles and legal
 * suffixes don't matter (match); initials, small typos, a missing or extra
 * word, or run-together words are a close match; anything else is no match.
 */
export function comparePayeeNames(typed: string, actual: string): PayeeVerdict {
  const a = nameTokens(typed)
  const b = nameTokens(actual)
  if (!a.length || !b.length) return "no-match"
  const sorted = (t: string[]) => [...t].sort().join(" ")
  if (sorted(a) === sorted(b)) return "match"
  if (a.join("") === b.join("")) return "close"
  // Every word of the shorter name has its own counterpart in the longer one.
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  const pool = [...long]
  const paired = short.every((word) => {
    const i = pool.findIndex((other) => (short === a ? near(word, other) : near(other, word)))
    return i >= 0 && pool.splice(i, 1).length > 0
  })
  // A lone initial or surname shouldn't vouch for a whole name.
  return paired && short.some((w) => w.length > 1) && (short.length >= 2 || long.length <= 2) ? "close" : "no-match"
}
