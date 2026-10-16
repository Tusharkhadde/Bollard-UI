/**
 * Pure, server-safe matching for CommitCombobox: how typed text relates to a fixed list of options.
 */

export interface ComboOption {
  /** What gets stored, e.g. a city id. */
  value: string
  /** What the user sees and types, e.g. "Bengaluru, Karnataka". */
  label: string
  /** Extra names that should find this option (old names, codes): "Bangalore", "BLR". */
  keywords?: string[]
}

/** Lowercases, strips accents and collapses punctuation, so "São Paulo" and "sao-paulo" compare equal. */
export function foldText(text: string): string {
  return String(text ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** Damerau-Levenshtein (optimal string alignment) distance; a swapped pair costs 1. */
export function editDistance(a: string, b: string): number {
  if (a.length > 64 || b.length > 64) return Math.abs(a.length - b.length) + 64
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

/** The names an option answers to: its full label, the part before the first comma, and its keywords. */
const namesOf = (option: ComboOption) => [option.label, option.label.split(",")[0], ...(option.keywords ?? [])].map(foldText).filter(Boolean)

/** Options for a query while typing: word-prefix matches first, then substring matches. */
export function rankOptions(query: string, options: readonly ComboOption[], limit = 8): ComboOption[] {
  const q = foldText(query)
  if (!q) return options.slice(0, limit)
  const scored: { option: ComboOption; score: number }[] = []
  for (const option of options) {
    const names = namesOf(option)
    const score = names.some((n) => n.startsWith(q)) ? 0 : names.some((n) => n.split(" ").some((w) => w.startsWith(q))) ? 1 : names.some((n) => n.includes(q)) ? 2 : -1
    if (score >= 0) scored.push({ option, score })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.option)
}

export interface TypedMatch {
  /** Options whose name equals the text once case, accents and punctuation are ignored. */
  exact: ComboOption[]
  /** Close misspellings (up to 3), nearest first. */
  near: ComboOption[]
}

/** What free text left in the field most likely meant. */
export function matchTyped(text: string, options: readonly ComboOption[]): TypedMatch {
  const q = foldText(text)
  if (!q) return { exact: [], near: [] }
  const exact = options.filter((option) => namesOf(option).includes(q))
  if (exact.length) return { exact, near: [] }
  const allowed = Math.max(1, Math.floor(q.length / 4))
  const near = options
    .map((option) => ({ option, cost: Math.min(...namesOf(option).map((n) => editDistance(q, n))) }))
    .filter((m) => m.cost <= allowed)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 3)
    .map((m) => m.option)
  return { exact, near }
}
