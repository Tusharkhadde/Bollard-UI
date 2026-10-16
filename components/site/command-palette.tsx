"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowRight, ArrowUp, CornerDownLeft, Search } from "lucide-react"

import { flowShort } from "@/lib/kits"
import { search } from "@/lib/search"
import { cn } from "@/lib/utils"
import { BollardGlyph } from "./bollard-art"
import { useSite } from "./site-shell"

const LIMIT = 40

export function CommandPalette({ initialQuery, onClose }: { initialQuery: string; onClose: () => void }) {
  const { items } = useSite()
  const router = useRouter()
  const [query, setQuery] = React.useState(initialQuery)
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()
  // Same ranking as /components, flat (best hit first), never empty. With no query: the essentials.
  const result = React.useMemo(() => {
    if (!query.trim()) return { items: items.filter((item) => item.essential), fallback: false, total: items.length }
    const r = search(items, query)
    return { items: r.items.slice(0, LIMIT), fallback: r.fallback, total: r.items.length }
  }, [items, query])
  const flat = result.items

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

  const go = (name: string) => {
    onClose()
    router.push(`/components/${name}`)
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
      go(flat[active].name)
    } else if (event.key === "Tab") {
      event.preventDefault()
      inputRef.current?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[12vh]" onKeyDown={onKeyDown}>
      <div aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search components"
        data-command-palette
        className="relative flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[active] ? `${listId}-${flat[active].name}` : undefined}
            aria-autocomplete="list"
            placeholder="Describe the mistake, or what you’re building…"
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div ref={listRef} id={listId} role="listbox" aria-label="Components" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <div className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
            {!query.trim() ? "Start here" : result.fallback ? `No exact match for “${query.trim()}”. Closest:` : "Best matches"}
          </div>
          {flat.map((item, i) => (
            <div
              key={item.name}
              id={`${listId}-${item.name}`}
              role="option"
              aria-selected={i === active}
              data-index={i}
              data-name={item.name}
              onPointerMove={() => i !== active && setActive(i)}
              onClick={() => go(item.name)}
              className={cn("flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm", i === active && "bg-accent text-accent-foreground")}
            >
              <BollardGlyph className="mt-0.5 h-5 w-auto shrink-0 text-foreground/70" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="ml-auto shrink-0 rounded-full border px-1.5 text-[10px] text-muted-foreground">
                    {item.flows?.[0] ? flowShort(item.flows[0]) : item.category}
                  </span>
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{item.headline ?? item.description}</span>
              </span>
            </div>
          ))}
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                onClose()
                router.push(`/components?q=${encodeURIComponent(query.trim())}`)
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Search aria-hidden className="size-4" />
              {result.fallback ? "Browse kits and filters" : `See all ${result.total} results with filters`}
              <ArrowRight aria-hidden className="ml-auto size-4" />
            </button>
          )}
        </div>
        <div className="hidden items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <ArrowUp className="size-3" aria-hidden />
            <ArrowDown className="size-3" aria-hidden /> to move
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" aria-hidden /> to open
          </span>
          <span className="ml-auto tabular-nums" aria-live="polite">
            {flat.length} {flat.length === 1 ? "result" : "results"}
          </span>
        </div>
      </div>
    </div>
  )
}
