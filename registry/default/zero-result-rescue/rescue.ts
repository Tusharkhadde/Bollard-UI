// Bollard UI — zero-result-rescue · MIT licence · https://bollard-ui.vercel.app/components/zero-result-rescue

/** Pure logic for zero-result recovery: query repairs, and the smallest change that brings results back. */

export interface SearchAttempt {
  query: string
  /** Ids of the filters still applied. */
  filters: string[]
  /** Search every category instead of the current one. */
  allCategories: boolean
}

export interface ActiveSearchFilter {
  id: string
  /** What the user sees, e.g. "Under ₹500". */
  label: string
}

/** Two keyboard layouts on the same physical keys, as same-length strings in key order. */
export interface KeyboardLayout {
  name: string
  latin: string
  local: string
}

export const RUSSIAN_LAYOUT: KeyboardLayout = {
  name: "Russian",
  latin: "qwertyuiop[]asdfghjkl;'zxcvbnm,.`",
  local: "йцукенгшщзхъфывапролджэячсмитьбюё",
}

export type RescueChange =
  | { kind: "spelling"; words: [from: string, to: string][] }
  | { kind: "layout"; layout: string }
  | { kind: "caps" }
  | { kind: "filter"; id: string; label: string }
  | { kind: "scope" }

export interface Rescue {
  attempt: SearchAttempt
  /** Results this attempt returns. Always above zero. */
  count: number
  changes: RescueChange[]
}

/** Damerau-Levenshtein (optimal string alignment): a swapped pair costs 1. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Replaces each unknown word with the closest vocabulary word (1 edit for short words, 2 for longer). */
export function correctSpelling(query: string, vocabulary: string[]) {
  const known = new Set(vocabulary.map((word) => word.toLowerCase()))
  const words: [string, string][] = []
  const text = query.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const lower = word.toLowerCase()
    if (lower.length < 4 || known.has(lower)) return word
    let best = ""
    let bestScore = lower.length >= 7 ? 3 : 2
    for (const candidate of known) {
      const score = distance(lower, candidate)
      if (score < bestScore) [best, bestScore] = [candidate, score]
    }
    if (!best) return word
    // Keep a leading capital: "Wireles" → "Wireless".
    const fixed = word[0] !== word[0].toLowerCase() ? best[0].toUpperCase() + best.slice(1) : best
    words.push([word, fixed])
    return fixed
  })
  return words.length ? { text, words } : null
}

/** Retypes the query as if the other layout had been on ("цшкудуыы" → "wireless"), or null. */
export function switchLayout(query: string, layout: KeyboardLayout) {
  const letters = [...query.toLowerCase()].filter((char) => /\p{L}|[[\];',.`]/u.test(char))
  const local = letters.filter((char) => layout.local.includes(char)).length
  const toLatin = local > letters.length / 2
  const [from, to] = toLatin ? [layout.local, layout.latin] : [layout.latin, layout.local]
  const out = [...query]
    .map((char) => {
      const index = from.indexOf(char.toLowerCase())
      if (index < 0) return char
      return char === char.toLowerCase() ? to[index] : to[index].toUpperCase()
    })
    .join("")
  return out === query ? null : out
}

/** "wIRELESS hEADPHONES" (Caps Lock on, Shift for the first letter) → "Wireless Headphones", or null. */
export function fixCapsLock(query: string) {
  if (!/(^|\s)\p{Ll}\p{Lu}{2,}/u.test(query)) return null
  return [...query].map((char) => (char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase())).join("")
}

interface RescueOptions {
  query: string
  filters: ActiveSearchFilter[]
  /** The category being searched, if the search is scoped to one. */
  scope?: string
  vocabulary: string[]
  layouts: KeyboardLayout[]
  /** Result count for an attempt. Fixes that return nothing are never offered. */
  count: (attempt: SearchAttempt) => number
  limit?: number
}

/** A fix worth counting: the attempt it would run and what it changes. */
export interface RescueCandidate {
  attempt: SearchAttempt
  changes: RescueChange[]
}

/** Every combination of query repair, dropping one filter (or all), and widening to all categories. */
export function rescueCandidates({ query, filters, scope, vocabulary, layouts }: Omit<RescueOptions, "count" | "limit">): RescueCandidate[] {
  const queries: { text: string; changes: RescueChange[] }[] = [{ text: query, changes: [] }]
  const bases: { text: string; changes: RescueChange[] }[] = [{ text: query, changes: [] }]
  const caps = fixCapsLock(query)
  if (caps) bases.push({ text: caps, changes: [{ kind: "caps" }] })
  for (const layout of layouts) {
    const switched = switchLayout(query, layout)
    if (switched)
      bases.push({
        text: switched,
        changes: [{ kind: "layout", layout: layout.name }],
      })
  }
  for (const base of bases) {
    if (base.changes.length) queries.push(base)
    const spelled = correctSpelling(base.text, vocabulary)
    if (spelled)
      queries.push({
        text: spelled.text,
        changes: [...base.changes, { kind: "spelling", words: spelled.words }],
      })
  }
  const ids = filters.map((filter) => filter.id)
  const filterOptions: { keep: string[]; changes: RescueChange[] }[] = [{ keep: ids, changes: [] }]
  for (const filter of filters) {
    filterOptions.push({
      keep: ids.filter((id) => id !== filter.id),
      changes: [{ kind: "filter", ...filter }],
    })
  }
  if (filters.length > 1)
    filterOptions.push({
      keep: [],
      changes: filters.map((filter) => ({
        kind: "filter" as const,
        ...filter,
      })),
    })
  const scopes = scope ? [false, true] : [false]

  const candidates: RescueCandidate[] = []
  for (const q of queries) {
    for (const f of filterOptions) {
      for (const allCategories of scopes) {
        const changes = [...q.changes, ...f.changes, ...(allCategories ? [{ kind: "scope" as const }] : [])]
        if (changes.length) candidates.push({ attempt: { query: q.text, filters: f.keep, allCategories }, changes })
      }
    }
  }
  return candidates
}

/**
 * Keeps the counted candidates that return results and the smallest sets of changes
 * among them: a fix is dropped if a subset of its changes already works.
 */
export function pickRescues(candidates: RescueCandidate[], counts: number[], limit = 3): Rescue[] {
  const found: Rescue[] = candidates.flatMap((candidate, i) => (counts[i] > 0 ? [{ ...candidate, count: counts[i] }] : []))
  const key = (change: RescueChange) => (change.kind === "filter" ? `filter:${change.id}` : change.kind)
  found.sort((a, b) => a.changes.length - b.changes.length || b.count - a.count)
  const kept: Rescue[] = []
  for (const rescue of found) {
    const keys = new Set(rescue.changes.map(key))
    if (kept.some((other) => other.changes.every((change) => keys.has(key(change))))) continue
    kept.push(rescue)
  }
  return kept.slice(0, limit)
}

/** Synchronous version for in-memory catalogs: candidates, counted with `count`, then picked. */
export function findRescues({ count, limit = 3, ...options }: RescueOptions): Rescue[] {
  const candidates = rescueCandidates(options)
  return pickRescues(candidates, candidates.map((candidate) => count(candidate.attempt)), limit)
}
