// The /components finder state (query + filters), its URL form, and the one
// function that turns it into a result list. The grid, the sidebar and ⌘K all
// go through here so they always agree.
import { filterFinderItems, shouldUseUnfilteredFallback, type FinderFacets } from "./finder-filters"
import { search, type SearchItem } from "./search"

export interface FinderState extends FinderFacets {
  q: string
}

export const emptyFinder: FinderState = { q: "", flow: null, field: null, category: null, integration: null, dependencies: null }

export const isFiltering = (s: FinderState) => !!(s.q.trim() || s.flow || s.field || s.category || s.integration || s.dependencies)

export function finderFromSearch(search: string): FinderState {
  const params = new URLSearchParams(search)
  return {
    q: params.get("q") ?? "",
    flow: params.get("flow") || null,
    field: params.get("field") || null,
    category: params.get("category") || null,
    integration: params.get("integration") || null,
    dependencies: params.get("dependencies") || null,
  }
}

export function finderToSearch(s: FinderState) {
  const params = new URLSearchParams()
  if (s.q.trim()) params.set("q", s.q)
  if (s.flow) params.set("flow", s.flow)
  if (s.field) params.set("field", s.field)
  if (s.category) params.set("category", s.category)
  if (s.integration) params.set("integration", s.integration)
  if (s.dependencies) params.set("dependencies", s.dependencies)
  const text = params.toString().replace(/\+/g, "%20")
  return text ? `?${text}` : ""
}

export interface FinderResult<T> {
  items: T[]
  /** Nothing matched the query; `items` holds the closest few. */
  fallback: boolean
  /** Flows the query points at (for suggesting their kits). */
  flows: string[]
}

/** Filters first (flow, field, category), then ranks by the query. Never empty when there's a query. */
export function runFinder<T extends SearchItem>(items: T[], s: FinderState): FinderResult<T> {
  const filtered = filterFinderItems(items, s)
  if (!s.q.trim()) return { items: filtered, fallback: false, flows: [] }
  const ranked = search(filtered, s.q)
  if (!ranked.fallback || !shouldUseUnfilteredFallback(filtered.length, items.length)) return ranked
  // The filters left nothing for this query: look across everything instead.
  const wide = search(items, s.q)
  return { items: wide.items.slice(0, 6), fallback: true, flows: wide.flows }
}
