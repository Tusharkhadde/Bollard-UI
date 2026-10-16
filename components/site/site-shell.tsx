"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { emptyFinder, finderFromSearch, finderToSearch, type FinderState } from "@/lib/finder"
import type { SearchItem } from "@/lib/search"
import { CommandPalette } from "./command-palette"
import { MobileDrawer } from "./mobile-drawer"

export interface CategorySummary {
  name: string
  slug: string
  count: number
  first: string
}

interface SiteContextValue {
  items: SearchItem[]
  categories: CategorySummary[]
  openSearch: (query?: string) => void
  openDrawer: () => void
  /** The one query + filter set shared by the /components grid and the sidebar. */
  finder: FinderState
  setFinder: (next: Partial<FinderState>) => void
  clearFinder: () => void
}

const SiteContext = React.createContext<SiteContextValue | null>(null)

export function useSite() {
  const value = React.useContext(SiteContext)
  if (!value) throw new Error("useSite must be used inside <SiteShell>")
  return value
}

export function SiteShell({
  items,
  categories,
  children,
}: {
  items: SearchItem[]
  categories: CategorySummary[]
  children: React.ReactNode
}) {
  const [search, setSearch] = React.useState<{ open: boolean; query: string }>({ open: false, query: "" })
  const [drawer, setDrawer] = React.useState(false)
  const [finder, setFinderState] = React.useState<FinderState>(emptyFinder)
  const pathname = usePathname()
  const onIndex = pathname === "/components"
  const closeDrawer = React.useCallback(() => setDrawer(false), [])
  const closeSearch = React.useCallback(() => setSearch({ open: false, query: "" }), [])

  // Close the drawer on navigation.
  React.useEffect(() => setDrawer(false), [pathname])

  // On /components the URL is the source of truth: read it on arrival and on back/forward.
  React.useEffect(() => {
    if (!onIndex) return
    const read = () => setFinderState(finderFromSearch(window.location.search))
    read()
    window.addEventListener("popstate", read)
    return () => window.removeEventListener("popstate", read)
  }, [onIndex])

  // …and write it back, so a filtered view can be shared or bookmarked.
  React.useEffect(() => {
    if (!onIndex) return
    const next = `${window.location.pathname}${finderToSearch(finder)}`
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next)
  }, [finder, onIndex])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearch((s) => ({ open: !s.open, query: "" }))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const setFinder = React.useCallback((next: Partial<FinderState>) => setFinderState((s) => ({ ...s, ...next })), [])
  const clearFinder = React.useCallback(() => setFinderState(emptyFinder), [])

  const value = React.useMemo<SiteContextValue>(
    () => ({
      items,
      categories,
      openSearch: (query = "") => setSearch({ open: true, query }),
      openDrawer: () => setDrawer(true),
      finder,
      setFinder,
      clearFinder,
    }),
    [items, categories, finder, setFinder, clearFinder],
  )

  return (
    <SiteContext.Provider value={value}>
      {children}
      {search.open && <CommandPalette initialQuery={search.query} onClose={closeSearch} />}
      <MobileDrawer open={drawer} onClose={closeDrawer} />
    </SiteContext.Provider>
  )
}
