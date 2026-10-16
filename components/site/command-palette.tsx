"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Box, CornerDownLeft, FileText, Layers, Search } from "lucide-react"

import { finderFromSearch } from "@/lib/finder"
import { FLOWS, flowHref, flowShort } from "@/lib/kits"
import { search } from "@/lib/search"
import { cn } from "@/lib/utils"
import { useSite } from "./site-shell"

const LIMIT = 40

type Entry =
  | { kind: "component"; id: string; title: string; hint: string; meta: string; href: string }
  | { kind: "flow"; id: string; title: string; hint: string; meta: string; href: string }
  | { kind: "page"; id: string; title: string; hint: string; meta?: string; href: string }
  | { kind: "action"; id: string; title: string; hint?: string; meta?: string; href: string }

interface Group {
  heading: string
  entries: Entry[]
}

const ICONS = { component: Box, flow: Layers, page: FileText, action: Search }

/** ⌘K: the same ranking as /components, flat and never empty, plus flows and pages. Combobox + listbox, arrow keys, Enter opens. */
export function CommandPalette({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const { items, setFinder } = useSite()
  const router = useRouter()
  const [query, setQuery] = React.useState(initialQuery)
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  const { groups, total, fallback } = React.useMemo(() => {
    const q = query.trim()
    const component = (item: (typeof items)[number]): Entry => ({
      kind: "component",
      id: item.name,
      title: item.title,
      hint: item.headline ?? item.description,
      meta: item.flows?.[0] ? flowShort(item.flows[0]) : item.category,
      href: `/components/${item.name}`,
    })
    const flowEntry = (flow: (typeof FLOWS)[number]): Entry => ({
      kind: "flow",
      id: flow.id,
      title: flow.label,
      hint: `${items.filter((i) => i.flows?.includes(flow.id)).length} components`,
      meta: "Flow",
      href: flowHref(flow.id),
    })
    if (!q) {
      return {
        groups: [
          { heading: "Start here", entries: items.filter((item) => item.essential).map(component) },
          { heading: "Flows", entries: FLOWS.map(flowEntry) },
          {
            heading: "Pages",
            entries: [
              { kind: "page", id: "components", title: "All components", hint: `${items.length} components, search and filters`, href: "/components" },
              { kind: "page", id: "home", title: "Home", hint: "Bollard UI overview", href: "/" },
            ],
          },
        ] as Group[],
        total: items.length,
        fallback: false,
      }
    }
    const r = search(items, q)
    const lower = q.toLowerCase()
    const flows = FLOWS.filter((f) => f.label.toLowerCase().includes(lower) || f.short.toLowerCase().includes(lower) || f.id.includes(lower))
    const groups: Group[] = [
      { heading: r.fallback ? `No exact match for “${q}”. Closest` : "Components", entries: r.items.slice(0, LIMIT).map(component) },
      ...(flows.length ? [{ heading: "Flows", entries: flows.map(flowEntry) }] : []),
      {
        heading: "More",
        entries: [
          {
            kind: "action",
            id: "all-results",
            title: r.fallback ? "Browse kits and filters" : `See all ${r.items.length} results with filters`,
            href: `/components?q=${encodeURIComponent(q)}`,
          },
        ],
      },
    ]
    return { groups, total: r.items.length, fallback: r.fallback }
  }, [items, query])

  const flat = React.useMemo(() => groups.flatMap((g) => g.entries), [groups])

  React.useEffect(() => setActive(0), [query])

  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const go = (entry: Entry) => {
    onClose()
    // Already on /components: a client push to the same path doesn't re-read the URL, so apply the filters directly.
    if (window.location.pathname === "/components" && /^\/components(\?|$)/.test(entry.href)) {
      setFinder(finderFromSearch(entry.href.slice("/components".length)))
      window.scrollTo({ top: 0 })
      return
    }
    router.push(entry.href)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0))
    } else if (event.key === "Home" && event.ctrlKey) {
      setActive(0)
    } else if (event.key === "End" && event.ctrlKey) {
      setActive(Math.max(0, flat.length - 1))
    } else if (event.key === "Enter" && flat[active]) {
      event.preventDefault()
      go(flat[active])
    } else if (event.key === "Tab") {
      event.preventDefault()
      inputRef.current?.focus()
    }
  }

  let index = -1
  const optionId = (entry: Entry) => `${listId}-${entry.kind}-${entry.id}`
  const componentCount = groups[0]?.entries.filter((e) => e.kind === "component").length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[14vh]" onKeyDown={onKeyDown}>
      <div aria-hidden className="absolute inset-0 bg-black/50 backdrop-blur-[2px] motion-safe:animate-[site-fade_120ms_ease-out]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search components"
        data-command-palette
        className="relative flex max-h-[min(34rem,78vh)] w-full max-w-[36rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)] ring-1 ring-black/[0.03] motion-safe:animate-[site-fade_120ms_ease-out] dark:ring-white/[0.04]"
      >
        <div className="flex items-center gap-2.5 border-b px-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[active] ? optionId(flat[active]) : undefined}
            aria-autocomplete="list"
            placeholder="Search components, or describe the mistake…"
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          <kbd className="hidden h-5 items-center rounded border bg-surface px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">Esc</kbd>
        </div>
        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
          {groups.map((group) => (
            <div key={group.heading} role="group" aria-label={group.heading} className="pb-1.5">
              <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-medium text-muted-foreground">{group.heading}</div>
              {group.entries.map((entry) => {
                index += 1
                const i = index
                const Icon = ICONS[entry.kind]
                const selected = i === active
                return (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    id={optionId(entry)}
                    role="option"
                    aria-selected={selected}
                    data-index={i}
                    data-name={entry.kind === "component" ? entry.id : undefined}
                    onPointerMove={() => i !== active && setActive(i)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                      selected ? "bg-accent text-accent-foreground" : "text-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground",
                        selected && "border-border-strong text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{entry.title}</span>
                      {entry.hint && <span className="truncate text-xs text-muted-foreground">{entry.hint}</span>}
                    </span>
                    {entry.meta && <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{entry.meta}</span>}
                    {entry.kind === "action" && <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                    {selected && entry.kind !== "action" && <CornerDownLeft aria-hidden className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-4 border-t bg-surface px-3.5 py-2 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border bg-background px-1 font-mono">↑</kbd>
            <kbd className="rounded border bg-background px-1 font-mono">↓</kbd>
            to move
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border bg-background px-1 font-mono">↵</kbd>
            to open
          </span>
          <span className="ml-auto tabular-nums" aria-live="polite">
            {query.trim() ? (fallback ? `${componentCount} closest` : `${total} ${total === 1 ? "result" : "results"}`) : `${total} components`}
          </span>
        </div>
      </div>
    </div>
  )
}
