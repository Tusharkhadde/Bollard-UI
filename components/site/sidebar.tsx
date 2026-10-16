"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, ListFilter, X } from "lucide-react"

import { isFiltering, runFinder } from "@/lib/finder"
import { FLOWS, fieldLabel, flowHref, flowLabel } from "@/lib/kits"
import { cn } from "@/lib/utils"
import { useSite } from "./site-shell"

const COLLAPSE_KEY = "bollard-ui-sidebar-collapsed"

/** The on-site doc pages: the first two lead "Get started", the rest sit in "Project" at the end. */
const DOC_PAGES = [
  { href: "/docs", label: "Getting started" },
  { href: "/start-here", label: "Start here" },
  { href: "/changelog", label: "Changelog" },
  { href: "/quality", label: "Quality" },
  { href: "/security", label: "Security" },
  { href: "/license", label: "License" },
]

const groupLabel = "flex w-full items-center gap-1.5 px-2 pb-1.5 text-xs font-medium text-muted-foreground"
const itemBase =
  "flex min-w-0 items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
const itemActive = "bg-accent font-medium text-foreground"

/**
 * Docs sidebar, shadcn-style: a filter box (shares the /components query), a
 * "Get started" group (Getting started, Start here, All components), the flows, then one group per category with counts.
 * Categories collapse (remembered); the active page is highlighted and kept in view.
 */
export function Sidebar({ className, autoFocusFilter = false }: { className?: string; autoFocusFilter?: boolean }) {
  const { items, categories, finder, setFinder, clearFinder } = useSite()
  const pathname = usePathname()
  const onIndex = pathname === "/components"
  const current = pathname.startsWith("/components/") ? pathname.slice("/components/".length) : null
  const filter = finder.q
  const setFilter = React.useCallback((q: string) => setFinder({ q }), [setFinder])
  const [collapsed, setCollapsed] = React.useState<string[]>([])
  const scrollRef = React.useRef<HTMLElement>(null)
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
    const frame = requestAnimationFrame(() => {
      const root = scrollRef.current
      const link = root?.querySelector<HTMLElement>('[aria-current="page"]')
      if (!root || !link) return
      const r = root.getBoundingClientRect()
      const l = link.getBoundingClientRect()
      // Centre the current page in the rail, like the best docs sites do.
      if (l.top < r.top + 8 || l.bottom > r.bottom - 8) root.scrollTop += l.top - r.top - r.height / 2 + l.height / 2
    })
    return () => cancelAnimationFrame(frame)
  }, [current])

  // The same query and filters as the /components grid, so both always show the same set.
  const result = React.useMemo(() => runFinder(items, finder), [items, finder])
  const matches = React.useMemo(() => new Set(result.items.map((item) => item.name)), [result])
  const filtering = isFiltering(finder)
  const flowCounts = React.useMemo(() => new Map(FLOWS.map((f) => [f.id, items.filter((i) => i.flows?.includes(f.id)).length])), [items])
  const facets = [
    finder.flow && { key: "flow", label: flowLabel(finder.flow) },
    finder.field && { key: "field", label: fieldLabel(finder.field) },
    finder.category && { key: "category", label: categories.find((c) => c.slug === finder.category)?.name ?? finder.category },
  ].filter((f): f is { key: "flow" | "field" | "category"; label: string } => !!f)

  return (
    <div className={cn("flex min-h-0 flex-col", className)} data-sidebar>
      <div className="shrink-0 px-3 pt-5 pb-3">
        <label className="relative block">
          <span className="sr-only">Filter components</span>
          <ListFilter aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={filterRef}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setFilter("")}
            placeholder="Filter components…"
            data-sidebar-filter
            className="h-8 w-full min-w-0 rounded-md border bg-surface pr-7 pl-8 text-base outline-none transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 md:text-[13px]"
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
                className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-2 text-[11px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {facet.label}
                <X aria-hidden className="size-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        {filtering && (
          <p className="mt-2 flex items-center gap-2 px-0.5 text-xs text-muted-foreground" aria-live="polite">
            <span className="tabular-nums">{result.fallback ? `No exact match · ${matches.size} closest` : `${matches.size} of ${items.length}`}</span>
            <button type="button" onClick={clearFinder} className="ml-auto rounded-sm font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              Clear
            </button>
          </p>
        )}
      </div>

      <nav
        ref={scrollRef}
        aria-label="Components"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-10 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
      >
        {!filtering && (
          <div className="mb-6">
            <p className={groupLabel}>Get started</p>
            <ul className="space-y-px">
              {DOC_PAGES.slice(0, 2).map((page) => (
                <li key={page.href}>
                  <Link href={page.href} aria-current={pathname === page.href ? "page" : undefined} className={cn(itemBase, pathname === page.href && itemActive)}>
                    <span className="min-w-0 flex-1 truncate">{page.label}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/components"
                  onClick={() => onIndex && clearFinder()}
                  aria-current={onIndex && !finder.flow ? "page" : undefined} className={cn(itemBase, onIndex && !finder.flow && itemActive)}>
                  <span className="min-w-0 flex-1 truncate">All components</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
                </Link>
              </li>
            </ul>
          </div>
        )}

        {!filtering && (
          <div className="mb-6" data-sidebar-flows>
            <p className={groupLabel}>Browse by flow</p>
            <ul className="space-y-px">
              {FLOWS.map((flow) => {
                const active = onIndex && finder.flow === flow.id
                const inner = (
                  <>
                    <span className="min-w-0 flex-1 truncate">{flow.label}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{flowCounts.get(flow.id)}</span>
                  </>
                )
                return (
                  <li key={flow.id}>
                    {onIndex ? (
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setFinder({ flow: active ? null : flow.id, q: "", field: null, category: null })
                          window.scrollTo({ top: 0 })
                        }}
                        className={cn(itemBase, "w-full text-left", active && itemActive)}
                      >
                        {inner}
                      </button>
                    ) : (
                      <Link href={flowHref(flow.id)} className={itemBase}>
                        {inner}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {categories.map((category) => {
          const list = items.filter((item) => item.category === category.name && matches.has(item.name))
          if (filtering && list.length === 0) return null
          const open = filtering || !collapsed.includes(category.name)
          const id = `${uid}-${category.slug}`
          return (
            <div key={category.name} className="mb-5" data-sidebar-category={category.slug}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => toggle(category.name)}
                disabled={filtering}
                className={cn(groupLabel, "group rounded-md py-1 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:hover:text-muted-foreground")}
              >
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                <span className="text-[11px] font-normal tabular-nums">{filtering ? `${list.length}/${category.count}` : category.count}</span>
                <ChevronRight
                  className={cn("size-3.5 shrink-0 opacity-60 transition-transform motion-reduce:transition-none", open && "rotate-90", filtering && "hidden")}
                  aria-hidden
                />
              </button>
              {open && (
                <ul id={id} className="space-y-px">
                  {list.map((item) => {
                    const active = item.name === current
                    return (
                      <li key={item.name}>
                        <Link
                          href={`/components/${item.name}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(itemBase, active && itemActive)}
                        >
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}

        {!filtering && (
          <div className="mt-2 mb-5 border-t pt-5">
            <p className={groupLabel}>Project</p>
            <ul className="space-y-px">
              {DOC_PAGES.slice(2).map((page) => (
                <li key={page.href}>
                  <Link href={page.href} aria-current={pathname === page.href ? "page" : undefined} className={cn(itemBase, pathname === page.href && itemActive)}>
                    <span className="min-w-0 flex-1 truncate">{page.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
    </div>
  )
}
