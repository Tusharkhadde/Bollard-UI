import type { SearchItem } from "./search"

export interface FinderFacets {
  flow: string | null
  field: string | null
  category: string | null
  integration: string | null
  dependencies: string | null
}

/** Apply the catalog facets before ranked text search. */
export function filterFinderItems<T extends SearchItem>(items: T[], state: FinderFacets) {
  return items.filter((item) => {
    const category = item.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return (
      (!state.flow || item.flows?.includes(state.flow)) &&
      (!state.field || item.fields?.includes(state.field)) &&
      (!state.category || category === state.category) &&
      (!state.integration || item.integration === state.integration) &&
      (!state.dependencies || (state.dependencies === "with" ? item.hasDependencies : !item.hasDependencies))
    )
  })
}

/** Broaden to catalog-wide typo suggestions only when facets excluded every item. */
export function shouldUseUnfilteredFallback(filteredCount: number, catalogCount: number) {
  return catalogCount > 0 && filteredCount === 0
}
