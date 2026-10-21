"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, Search, X } from "lucide-react"

import { runFinder, isFiltering } from "@/lib/finder"
import { FIELDS, FLOWS, KITS, flowLabel, flowShort, kitFor, type Kit } from "@/lib/kits"
import type { SearchItem } from "@/lib/search"
import { cn } from "@/lib/utils"
import { trackInstallCopy } from "@/lib/analytics"
import { CopyButton } from "./copy-button"
import { useSite, type CategorySummary } from "./site-shell"

const EXAMPLES = ["users paste api keys", "checkout", "+91 phone", "sent twice", "delete account"]
const PAGE = 36
const SECTION_PREVIEW = 6

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
const label = "font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase"

/**
 * The /components finder: one ranked search box, flow chips, two quieter filters
 * (field type, kind of mistake), and below it either the browse view (flow cards,
 * category cards, then a section per flow) or the ranked results. Everything is in
 * the URL (?q=&flow=&field=&category=) via the site shell, which the sidebar reads too.
 */
export function Finder({ registryBase }: { registryBase: string }) {
  const { items, categories, finder, setFinder, clearFinder } = useSite()
  const [limit, setLimit] = React.useState(PAGE)
  const [draft, setDraft] = React.useState(finder.q)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Keep the box in step when the query changes elsewhere (sidebar, back button, example chip).
  React.useEffect(() => setDraft(finder.q), [finder.q])
  // Typing is instant locally; the shared query (and URL) follows a beat later.
  React.useEffect(() => {
    if (draft === finder.q) return
    const t = window.setTimeout(() => setFinder({ q: draft }), 120)
    return () => window.clearTimeout(t)
  }, [draft, finder.q, setFinder])
  React.useEffect(() => setLimit(PAGE), [finder])

  // "/" focuses the search box (unless you're already typing somewhere).
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const result = React.useMemo(() => runFinder(items, finder), [items, finder])
  const filtering = isFiltering(finder)
  const hasQuery = finder.q.trim().length > 0
  const byName = React.useMemo(() => new Map(items.map((item) => [item.name, item])), [items])

  const flowCounts = React.useMemo(() => new Map(FLOWS.map((f) => [f.id, items.filter((i) => i.flows?.includes(f.id)).length])), [items])
  const fieldCounts = React.useMemo(() => new Map(FIELDS.map((f) => [f.id, items.filter((i) => i.fields?.includes(f.id)).length])), [items])
  const integrationCounts = React.useMemo(() => new Map(["styled", "headless"].map((kind) => [kind, items.filter((item) => item.integration === kind).length])), [items])
  const dependencyCounts = React.useMemo(() => new Map(["with", "without"].map((kind) => [kind, items.filter((item) => (kind === "with") === Boolean(item.hasDependencies)).length])), [items])

  const activeKit = finder.flow ? kitFor(finder.flow) : undefined
  const suggestedKits = !finder.flow && hasQuery ? result.flows.map(kitFor).filter((k): k is Kit => !!k).slice(0, 2) : []
  const list = result.items
  const shown = list.slice(0, limit)
  // Browse view: one section per flow, kit picks first, then essentials, then A–Z.
  const flowSections = React.useMemo(
    () =>
      FLOWS.map((flow) => {
        const kit = kitFor(flow.id)?.components ?? []
        const all = items.filter((item) => item.flows?.includes(flow.id))
        const rank = (item: SearchItem) => {
          const k = kit.indexOf(item.name)
          return k !== -1 ? k : item.essential ? 100 : 1000
        }
        const sorted = [...all].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
        return { flow, members: sorted.slice(0, SECTION_PREVIEW), total: all.length }
      }).filter((s) => s.total > 0),
    [items],
  )

  const openFlow = (flow: string) => {
    setFinder({ flow, q: "", field: null, category: null, integration: null, dependencies: null })
    window.scrollTo({ top: 0 })
  }

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[13px] whitespace-nowrap transition-colors",
      focusRing,
      active ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:border-border-strong hover:text-foreground",
    )

  return (
    <div className="space-y-10" data-finder>
      {/* Search + filters */}
      <div className="space-y-4">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            setFinder({ q: draft })
            inputRef.current?.blur()
          }}
          className="relative"
        >
          <label htmlFor="finder-q" className="sr-only">
            Describe the mistake, or what you&apos;re building
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="finder-q"
            ref={inputRef}
            type="search"
            name="q"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setDraft("")}
            placeholder="Search by name or by the mistake, e.g. “paid twice”"
            autoComplete="off"
            enterKeyHint="search"
            data-finder-input
            className="h-11 w-full min-w-0 rounded-lg border bg-surface pr-12 pl-10 text-base outline-none transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 sm:text-[15px] [&::-webkit-search-cancel-button]:hidden"
          />
          {draft ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setDraft("")
                setFinder({ q: "" })
                inputRef.current?.focus()
              }}
              className={cn("absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground", focusRing)}
            >
              <X aria-hidden className="size-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden h-5 -translate-y-1/2 items-center rounded border bg-background px-1.5 font-mono text-[11px] text-muted-foreground pointer-fine:inline-flex">
              /
            </kbd>
          )}
        </form>

        {!hasQuery && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[13px] text-muted-foreground">
            <span className="mr-0.5">Try</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setFinder({ q: example })}
                className={cn("rounded-md border border-dashed px-2 py-0.5 text-foreground/80 transition-colors hover:border-solid hover:border-border-strong hover:text-foreground", focusRing)}
              >
                {example}
              </button>
            ))}
          </p>
        )}

        <div
          role="toolbar"
          aria-label="Flow"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          data-flow-chips
        >
          <button type="button" aria-pressed={!finder.flow} onClick={() => setFinder({ flow: null })} className={chip(!finder.flow)}>
            All
          </button>
          {FLOWS.map((flow) => (
            <button
              key={flow.id}
              type="button"
              aria-pressed={finder.flow === flow.id}
              onClick={() => setFinder({ flow: finder.flow === flow.id ? null : flow.id })}
              className={chip(finder.flow === flow.id)}
            >
              {flow.short}
              <span className="text-[11px] tabular-nums opacity-60">{flowCounts.get(flow.id)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <FilterSelect
            label="Field"
            value={finder.field}
            onChange={(field) => setFinder({ field })}
            options={FIELDS.filter((f) => (fieldCounts.get(f.id) ?? 0) > 0).map((f) => ({ value: f.id, label: `${f.label} (${fieldCounts.get(f.id)})` }))}
          />
          <FilterSelect
            label="Kind of mistake"
            value={finder.category}
            onChange={(category) => setFinder({ category })}
            options={categories.map((c) => ({ value: c.slug, label: `${c.name} (${c.count})` }))}
          />
          <FilterSelect
            label="Integration"
            value={finder.integration}
            onChange={(integration) => setFinder({ integration })}
            options={[
              { value: "styled", label: `Styled component (${integrationCounts.get("styled")})` },
              { value: "headless", label: `Headless · any UI (${integrationCounts.get("headless")})` },
            ]}
          />
          <FilterSelect
            label="Packages"
            value={finder.dependencies}
            onChange={(dependencies) => setFinder({ dependencies })}
            options={[
              { value: "with", label: `Adds packages (${dependencyCounts.get("with")})` },
              { value: "without", label: `No added packages (${dependencyCounts.get("without")})` },
            ]}
          />
          <p className="ml-auto text-muted-foreground tabular-nums" aria-live="polite" data-finder-count>
            {filtering ? (result.fallback ? "No exact match" : `${result.items.length} of ${items.length}`) : `${items.length} components`}
          </p>
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setDraft("")
                clearFinder()
              }}
              className={cn("rounded-md px-2 py-1 font-medium text-foreground underline-offset-4 hover:underline", focusRing)}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Browse view */}
      {!filtering && (
        <>
          <section id="flows" aria-labelledby="flows-heading" className="scroll-mt-20 space-y-4">
            <BrowseHeading id="flows-heading" title="Browse by flow" note="Where the mistake happens." />
            <ul className="grid overflow-hidden rounded-xl border sm:grid-cols-2 xl:grid-cols-3" data-flow-grid>
              {FLOWS.map((flow) => {
                const kit = kitFor(flow.id)
                return (
                  <li key={flow.id} className="-mt-px -ml-px min-w-0 border-t border-l">
                    <button
                      type="button"
                      onClick={() => openFlow(flow.id)}
                      className={cn("group flex h-full w-full flex-col gap-1 p-4 text-left transition-colors hover:bg-surface sm:p-5", focusRing, "focus-visible:ring-inset")}
                      data-flow-card={flow.id}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{flow.label}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                          {flowCounts.get(flow.id)}
                          <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
                        </span>
                      </span>
                      {kit && <span className="line-clamp-2 text-[13px] leading-5 text-pretty text-muted-foreground">{kit.blurb}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-labelledby="kinds-heading" className="space-y-4">
            <BrowseHeading id="kinds-heading" title="Browse by kind of mistake" note="The categories in the sidebar." />
            <CategoryGrid categories={categories} onOpen={(category) => setFinder({ category, q: "", flow: null, field: null })} />
          </section>

          {flowSections.map(({ flow, members, total }) => (
            <section key={flow.id} id={`flow-${flow.id}`} aria-labelledby={`flow-${flow.id}-heading`} className="scroll-mt-20 space-y-4" data-flow-section={flow.id}>
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <h2 id={`flow-${flow.id}-heading`} className="text-lg font-semibold tracking-[-0.02em]">
                    {flow.label} <span className="ml-1 text-sm font-normal text-muted-foreground tabular-nums">{total}</span>
                  </h2>
                  {kitFor(flow.id) && <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{kitFor(flow.id)!.blurb}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => openFlow(flow.id)}
                  className={cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", focusRing)}
                >
                  View all {total} <ArrowRight aria-hidden className="size-3.5" />
                </button>
              </div>
              <CardGrid items={members} registryBase={registryBase} hideFlow={flow.id} />
            </section>
          ))}
        </>
      )}

      {/* Results */}
      {activeKit && <KitCard kit={activeKit} byName={byName} registryBase={registryBase} />}

      {filtering && result.fallback && (
        <div className="rounded-xl border border-dashed p-5" data-finder-fallback>
          <p className="font-medium">
            Nothing matched{hasQuery ? <> &ldquo;{finder.q.trim()}&rdquo;</> : null}
            {finder.flow || finder.field || finder.category ? " with these filters" : ""} exactly.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Here are the closest guardrails. Or describe what goes wrong (&ldquo;paid twice&rdquo;), or the screen you&apos;re building (&ldquo;checkout&rdquo;).
          </p>
        </div>
      )}

      {suggestedKits.map((kit) => (
        <KitTile key={kit.flow} kit={kit} byName={byName} onOpen={() => setFinder({ flow: kit.flow, q: "" })} wide />
      ))}

      {filtering && (
        <section aria-labelledby="all-heading" className="space-y-4">
          <BrowseHeading
            id="all-heading"
            title={result.fallback ? "Closest matches" : finder.flow && !hasQuery ? `Everything in ${flowLabel(finder.flow)}` : hasQuery ? "Best matches first" : "Results"}
          />
          <CardGrid items={shown} registryBase={registryBase} hideFlow={finder.flow} ranked={hasQuery && !result.fallback} />
          {list.length > shown.length && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setLimit((n) => n + 96)}
                className={cn("inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:border-border-strong hover:bg-accent", focusRing)}
              >
                Show more <span className="text-muted-foreground tabular-nums">{list.length - shown.length} left</span>
                <ChevronDown aria-hidden className="size-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {filtering && result.fallback && !suggestedKits.length && (
        <section aria-labelledby="fallback-kits" className="space-y-4">
          <BrowseHeading id="fallback-kits" title="Or start from a flow" />
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {KITS.map((kit) => (
              <li key={kit.flow}>
                <KitTile kit={kit} byName={byName} onOpen={() => setFinder({ flow: kit.flow, q: "", field: null, category: null })} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function BrowseHeading({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3">
      <h2 id={id} className="text-lg font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {note && <p className="text-[13px] text-muted-foreground">{note}</p>}
    </div>
  )
}

function CategoryGrid({ categories, onOpen }: { categories: CategorySummary[]; onOpen: (slug: string) => void }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-category-grid>
      {categories.map((category) => (
        <li key={category.slug} className="min-w-0">
          <button
            type="button"
            onClick={() => {
              onOpen(category.slug)
              window.scrollTo({ top: 0 })
            }}
            className={cn(
              "group flex h-full w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface",
              focusRing,
            )}
            data-category-card={category.slug}
          >
            <span className="min-w-0 truncate text-sm font-medium">{category.name}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              {category.count}
              <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function FilterSelect({
  label: name,
  value,
  onChange,
  options,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  options: { value: string; label: string }[]
}) {
  const id = React.useId()
  const selected = options.find((o) => o.value === value)
  return (
    <span
      className={cn(
        "relative inline-flex h-8 items-center rounded-md border pr-8 pl-3 transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-border-strong",
        value ? "border-border-strong bg-accent text-foreground" : "bg-background text-muted-foreground",
      )}
    >
      <label htmlFor={id} className="pointer-events-none whitespace-nowrap">
        {name}: <span className="font-medium text-foreground">{selected ? selected.label.replace(/ \(\d+\)$/, "") : "Any"}</span>
      </label>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 size-3.5" />
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="absolute inset-0 cursor-pointer appearance-none rounded-md bg-transparent text-transparent opacity-0 outline-none"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  )
}

function CardGrid({
  items,
  registryBase,
  hideFlow,
  ranked = false,
}: {
  items: SearchItem[]
  registryBase: string
  hideFlow?: string | null
  ranked?: boolean
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-component-grid>
      {items.map((item, i) => (
        <li key={item.name} className="min-w-0">
          <IncidentCard item={item} registryBase={registryBase} hideFlow={hideFlow} top={ranked && i === 0} />
        </li>
      ))}
    </ul>
  )
}

/** A component card: name, the mistake it stops, and its flow tags. The install copy button appears on hover/focus (always on touch). */
export function IncidentCard({
  item,
  registryBase,
  hideFlow,
  top = false,
}: {
  item: SearchItem
  registryBase: string
  hideFlow?: string | null
  top?: boolean
}) {
  const tags = (item.flows ?? []).filter((f) => f !== hideFlow).slice(0, 2)
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-background transition-colors hover:border-border-strong hover:bg-surface",
        top && "border-brand/50 hover:border-brand/70",
      )}
      data-card={item.name}
    >
      <Link href={`/components/${item.name}`} className={cn("flex flex-1 flex-col gap-1.5 rounded-xl p-4", focusRing)}>
        <span className="flex min-w-0 items-center gap-2 pr-8">
          <span className="truncate text-sm font-medium">{item.title}</span>
          {top && (
            <span className="shrink-0 rounded border border-brand/40 bg-brand/10 px-1.5 py-px text-[10.5px] font-medium text-amber-800 dark:text-amber-300">Best match</span>
          )}
          {item.essential && !top && <span className="shrink-0 rounded border px-1.5 py-px text-[10.5px] text-muted-foreground">Essential</span>}
        </span>
        <span className="flex flex-wrap gap-1.5 pt-0.5 text-[10.5px]">
          <span className="rounded border px-1.5 py-px text-muted-foreground">{item.integration === "headless" ? "Headless · any UI" : "Styled component"}</span>
          <span className="rounded border px-1.5 py-px text-muted-foreground">{item.hasDependencies ? "Adds npm packages" : "No added packages"}</span>
          {item.hasA11yGuidance && <span className="rounded border border-brand/30 bg-brand/5 px-1.5 py-px text-foreground/80">A11y guidance</span>}
        </span>
        <span className="line-clamp-2 text-[13px] leading-5 text-pretty text-muted-foreground">
          <span className="sr-only">Stops: </span>
          {item.headline ?? item.description}
        </span>
        <span className="mt-auto flex flex-wrap gap-1 pt-2 text-[11px] text-muted-foreground">
          <span className="truncate">{item.category}</span>
          {tags.map((flow) => (
            <span key={flow} className="before:mr-1 before:content-['·']">
              {flowShort(flow)}
            </span>
          ))}
        </span>
      </Link>
      <CopyButton
        value={`npx shadcn@4.21.0 add @bollard/${item.name}`}
        label={`Copy install command for ${item.title}`}
        onCopy={() => trackInstallCopy({ component: item.name, surface: "component-finder" })}
        className="absolute top-3 right-3 size-7 opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
      />
    </div>
  )
}

function KitTile({ kit, byName, onOpen, wide = false }: { kit: Kit; byName: Map<string, SearchItem>; onOpen: () => void; wide?: boolean }) {
  const members = kit.components.filter((name) => byName.has(name))
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-background text-left transition-colors hover:border-border-strong hover:bg-surface",
        focusRing,
        wide && "sm:flex-row sm:items-center",
      )}
      data-kit={kit.flow}
    >
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {kit.title}
            <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">{members.length} components</span>
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
        </span>
        <span className="text-[13px] text-pretty text-muted-foreground">{kit.blurb}</span>
        <span className="flex flex-wrap gap-1 pt-1">
          {members.slice(0, wide ? 7 : 4).map((name) => (
            <span key={name} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {byName.get(name)!.title}
            </span>
          ))}
          {!wide && members.length > 4 && <span className="px-1 text-[11px] text-muted-foreground">+{members.length - 4}</span>}
        </span>
      </span>
    </button>
  )
}

function KitCard({ kit, byName, registryBase }: { kit: Kit; byName: Map<string, SearchItem>; registryBase: string }) {
  const members = kit.components.filter((name) => byName.has(name))
  const command = `npx shadcn@4.21.0 add ${members.map((name) => `@bollard/${name}`).join(" ")}`
  return (
    <section aria-labelledby="kit-heading" className="overflow-hidden rounded-xl border bg-surface" data-kit-card={kit.flow}>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
        <div className="min-w-0 space-y-2">
          <p className={cn(label, "inline-flex items-center gap-2")}>
            <span aria-hidden className="h-px w-4 bg-brand" />
            {flowLabel(kit.flow)} · kit
          </p>
          <h2 id="kit-heading" className="text-xl font-semibold tracking-[-0.02em]">
            {kit.title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{kit.blurb}</p>
        </div>
        <div className="min-w-0 space-y-3">
          <ol className="grid gap-0.5 sm:grid-cols-2">
            {members.map((name) => {
              const item = byName.get(name)!
              return (
                <li key={name} className="min-w-0">
                  <Link href={`/components/${name}`} className={cn("flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-accent", focusRing)}>
                    <span className="truncate font-medium">{item.title}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background py-1.5 pr-1.5 pl-3 font-mono text-[12.5px]">
            <span aria-hidden className="select-none text-muted-foreground">
              $
            </span>
            <code className="min-w-0 flex-1 truncate text-muted-foreground" title={command}>
              npx shadcn@4.21.0 add <span className="text-foreground">{members.length} components</span>
            </code>
            <CopyButton value={command} label={`Copy install command for all ${members.length} components in the ${kit.title}`} onCopy={() => trackInstallCopy({ components: members, surface: "flow-kit" })} className="h-8 shrink-0 px-3 font-sans">
              Copy install-all
            </CopyButton>
          </div>
        </div>
      </div>
    </section>
  )
}
