/** Pure helpers for <NamesakeSelect>: who shares a name, and which details tell them apart. */

export interface NamesakeOption {
  id: string
  /** The name people search and see: "Ravi Kumar". */
  label: string
  /** Identifying details, in the order they should be offered: { Born: "12 Mar 1988", City: "Pune", Phone: "•• 4410" }. */
  details?: Record<string, string>
}

/**
 * The comparison key for a name: case, accents, punctuation, spacing and word order are ignored,
 * so "Ravi  Kumar", "KUMAR, Ravi" and "Ravi Kumár" are namesakes. Garbage gives "".
 */
export function nameKey(name: unknown) {
  if (typeof name !== "string") return ""
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ")
}

/** Every option's namesakes (other options with the same name key), by id. Options without any are left out. */
export function findNamesakes(options: readonly NamesakeOption[]) {
  const groups = new Map<string, NamesakeOption[]>()
  for (const option of options) {
    const key = nameKey(option.label)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), option])
  }
  const twins = new Map<string, NamesakeOption[]>()
  for (const group of groups.values()) if (group.length > 1) for (const option of group) twins.set(option.id, group.filter((o) => o !== option))
  return twins
}

/**
 * Detail keys that differ within a group, best first: keys whose values are all distinct (they alone
 * identify each person) before keys that only partly differ, then in the caller's order.
 */
export function distinguishingKeys(group: readonly NamesakeOption[]) {
  const keys = [...new Set(group.flatMap((o) => Object.keys(o.details ?? {})))]
  const distinct = (key: string) => new Set(group.map((o) => (o.details?.[key] ?? "").trim().toLowerCase())).size
  return keys
    .map((key, order) => ({ key, order, count: distinct(key) }))
    .filter((k) => k.count > 1)
    .sort((a, b) => Number(b.count === group.length) - Number(a.count === group.length) || a.order - b.order)
    .map((k) => k.key)
}

/** True when every word of the query starts a word in the name or appears in a detail. */
export function matches(option: NamesakeOption, query: string) {
  const words = nameKey(query).split(" ").filter(Boolean)
  if (words.length === 0) return true
  const name = nameKey(option.label).split(" ")
  const details = Object.values(option.details ?? {}).map(nameKey).join(" ")
  return words.every((w) => name.some((n) => n.startsWith(w)) || details.includes(w))
}
