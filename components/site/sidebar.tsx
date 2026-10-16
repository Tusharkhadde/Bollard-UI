"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LayoutGrid, ListFilter, X } from "lucide-react"

import { isFiltering, runFinder } from "@/lib/finder"
import { fieldLabel, flowLabel } from "@/lib/kits"
import { cn } from "@/lib/utils"
import { useSite } from "./site-shell"

const COLLAPSE_KEY = "bollard-ui-sidebar-collapsed"

export function Sidebar({ className, autoFocusFilter = false }: { className?: string; autoFocusFilter?: boolean }) {
  const { items, categories, finder, setFinder, clearFinder } = useSite()
  const pathname = usePathname()
  const current = pathname.startsWith("/components/") ? pathname.slice("/components/".length) : null
  const filter = finder.q
  const setFilter = React.useCallback((q: string) => setFinder({ q }), [setFinder])
  const [collapsed, setCollapsed] = React.useState<string[]>([])
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const filterRef = React.useRef<HTMLInputElement>(null)
  const uid = React.useId()

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "[]")
      if (Array.isArray(saved)) setCollapsed(saved.filter((v) => typeof v === "string"))
    } catch {}
    if (autoFocusFilter) filterRef.current?.focus({ preventScroll: true })
  }, [autoFocusFilter])

  const toggle = (category: string) =>
    setCollapsed((list) => {
      const next = list.includes(category) ? list.filter((c) => c !== category) : [...list, category]
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })

  // Keep the active link in view inside the sidebar's own scroll area.
  React.useEffect(() => {
    const root = scrollRef.current
    const link = root?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!root || !link) return
    const r = root.getBoundingClientRect()
    const l = link.getBoundingClientRect()
    if (l.top < r.top + 8 || l.bottom > r.bottom - 8) root.scrollTop += l.top - r.top - r.height / 3
  }, [current])

  // The same query and filters as the /components grid, so both always show the same set.
  const result = React.useMemo(() => runFinder(items, finder), [items, finder])
  const matches = React.useMemo(() => new Set(result.items.map((item) => item.name)), [result])
  const filtering = isFiltering(finder)
  const facets = [
    finder.flow && { key: "flow", label: flowLabel(finder.flow) },
    finder.field && { key: "field", label: fieldLabel(finder.field) },
    finder.category && { key: "category", label: categories.find((c) => c.slug === finder.category)?.name ?? finder.category },
  ].filter((f): f is { key: "flow" | "field" | "category"; label: string } => !!f)

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0 px-3 pt-4 pb-2">
        <label className="relative block">
          <span className="sr-only">Filter components</span>
          <ListFilter aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={filterRef}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setFilter("")}
            placeholder="Filter: a mistake or a screen"
            data-sidebar-filter
            className="h-8 w-full min-w-0 rounded-md border bg-transparent pr-7 pl-8 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
          {filter && (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => {
                setFilter("")
                filterRef.current?.focus()
              }}
              className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </label>
        {facets.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {facets.map((facet) => (
              <button
                key={facet.key}
                type="button"
                onClick={() => setFinder({ [facet.key]: null })}
                aria-label={`Remove filter ${facet.label}`}
                className="inline-flex items-center gap-1 rounded-full border bg-accent px-2 py-0.5 text-[11px] text-foreground outline-none hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {facet.label}
                <X aria-hidden className="size-3" />
              </button>
            ))}
          </div>
        )}
        {filtering && (
          <p className="mt-1.5 flex items-center gap-2 px-0.5 text-xs text-muted-foreground" aria-live="polite">
            <span>{result.fallback ? `No exact match · ${matches.size} closest` : `${matches.size} of ${items.length} components`}</span>
            <button type="button" onClick={clearFinder} className="ml-auto font-medium text-foreground underline-offset-2 hover:underline">
              Clear
            </button>
          </p>
        )}
      </div>
      <nav ref={scrollRef} aria-label="Components" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
        <Link
          href="/components"
          aria-current={pathname === "/components" ? "page" : undefined}
          className={cn(
            "mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            pathname === "/components" && "bg-accent font-medium text-foreground",
          )}
        >
          <LayoutGrid className="size-3.5" aria-hidden />
          All components
          <span className="ml-auto text-xs tabular-nums">{items.length}</span>
        </Link>
        {categories.map((category) => {
          const list = items.filter((item) => item.category === category.name && matches.has(item.name))
          if (filtering && list.length === 0) return null
          const open = filtering || !collapsed.includes(category.name)
          const id = `${uid}-${category.slug}`
          return (
            <div key={category.name} className="mb-1" data-sidebar-category={category.slug}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => toggle(category.name)}
                disabled={filtering}
                className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:hover:bg-transparent"
              >
                <ChevronRight className={cn("size-3.5 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {filtering ? `${list.length}/${category.count}` : category.count}
                </span>
              </button>
              {open && (
                <ul id={id} className="mt-0.5 mb-2 ml-3.5 border-l pl-2">
                  {list.map((item) => {
                    const active = item.name === current
                    return (
                      <li key={item.name}>
                        <Link
                          href={`/components/${item.name}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "-ml-[9px] block truncate border-l border-transparent py-1 pr-2 pl-[17px] text-sm text-muted-foreground outline-none transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                            active && "border-foreground font-medium text-foreground hover:border-foreground",
                          )}
                        >
                          {item.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
