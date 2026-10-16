/** Pure ordering helpers for <ReorderReadback>. They run anywhere, including on the server before saving. */

/**
 * Keeps an order honest against the current items: unknown and repeated ids are dropped, and items
 * the order doesn't mention yet are appended in their given order. Garbage input gives the item order.
 */
export function normalizeOrder(order: readonly unknown[] | null | undefined, ids: readonly string[]) {
  const known = new Set(ids)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of Array.isArray(order) ? order : []) {
    if (typeof id === "string" && known.has(id) && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  for (const id of ids) if (!seen.has(id)) out.push(id)
  return out
}

/** A copy of `order` with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(order: readonly T[], from: number, to: number) {
  const next = [...order]
  if (from < 0 || from >= next.length) return next
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item)
  return next
}

/** The pinned id a move from `before` to `after` would shift, if any. Pinned items keep their place. */
export function brokenPin(before: readonly string[], after: readonly string[], pinned: ReadonlySet<string>) {
  return before.find((id, index) => pinned.has(id) && after[index] !== id)
}

/** The single item that moved between two orders, with where it went. Undefined when nothing moved. */
export function describeMove(before: readonly string[], after: readonly string[]) {
  if (before.length !== after.length || before.every((id, i) => after[i] === id)) return undefined
  // The moved item is the one whose distance travelled is largest; a one-item move shifts the rest by one.
  let best: { id: string; from: number; to: number } | undefined
  for (const [to, id] of after.entries()) {
    const from = before.indexOf(id)
    if (!best || Math.abs(to - from) > Math.abs(best.to - best.from)) best = { id, from, to }
  }
  return best
}

/**
 * Items that really moved since `baseline`, with how many places (positive = up). Only the fewest
 * items that explain the change count, so one row dragged to the top is "1 moved", not every row it pushed down.
 */
export function shiftsSince(baseline: readonly string[], order: readonly string[]) {
  const was = order.map((id) => baseline.indexOf(id))
  // Longest increasing run of old positions = the rows that stayed put relative to each other.
  const tails: number[] = []
  const prev = new Array<number>(was.length).fill(-1)
  const tailAt: number[] = []
  was.forEach((w, i) => {
    if (w < 0) return
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (was[tailAt[mid]] < w) lo = mid + 1
      else hi = mid
    }
    prev[i] = lo > 0 ? tailAt[lo - 1] : -1
    tails[lo] = w
    tailAt[lo] = i
  })
  const stayed = new Set<number>()
  for (let i = tailAt[tails.length - 1] ?? -1; i >= 0; i = prev[i]) stayed.add(i)
  const shifts = new Map<string, number>()
  order.forEach((id, index) => {
    if (was[index] >= 0 && !stayed.has(index) && was[index] !== index) shifts.set(id, was[index] - index)
  })
  return shifts
}

/** "1st", "2nd", "23rd" in English; pass your own formatter for other languages. */
export function ordinal(index: number) {
  const n = index + 1
  const suffixes: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" }
  const suffix = suffixes[new Intl.PluralRules("en", { type: "ordinal" }).select(n)] ?? "th"
  return `${n}${suffix}`
}
