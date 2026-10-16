"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, Search, X } from "lucide-react"

import { runFinder, isFiltering } from "@/lib/finder"
import { FIELDS, FLOWS, KITS, flowLabel, kitFor, type Kit } from "@/lib/kits"
import type { SearchItem } from "@/lib/search"
import { cn } from "@/lib/utils"
import { CopyButton } from "./copy-button"
import { useSite } from "./site-shell"

const EXAMPLES = ["users paste api keys", "checkout", "+91 phone", "sent twice", "delete account"]
const PAGE = 36
const SECTION_PREVIEW = 6

/**
 * The /components finder: one search box, flow chips, two quieter filters, and
 * an incident-first grid. Everything is in the URL (?q=&flow=&field=&category=)
 * via the site shell, which the sidebar reads too.
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

  const result = React.useMemo(() => runFinder(items, finder), [items, finder])
  const filtering = isFiltering(finder)
  const hasQuery = finder.q.trim().length > 0
  const byName = React.useMemo(() => new Map(items.map((item) => [item.name, item])), [items])

  const flowCounts = React.useMemo(() => new Map(FLOWS.map((f) => [f.id, items.filter((i) => i.flows?.includes(f.id)).length])), [items])
  const fieldCounts = React.useMemo(() => new Map(FIELDS.map((f) => [f.id, items.filter((i) => i.fields?.includes(f.id)).length])), [items])

  const activeKit = finder.flow ? kitFor(finder.flow) : undefined
  const suggestedKits = !finder.flow && hasQuery ? result.flows.map(kitFor).filter((k): k is Kit => !!k).slice(0, 2) : []
  const list = result.items
  const shown = list.slice(0, limit)
  // Default view: one section per flow, kit picks first, then essentials, then A–Z.
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

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
      active ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
    )

  return (
    <div className="space-y-8" data-finder>
      {/* Search */}
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
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground sm:left-5" />
          <input
            id="finder-q"
            ref={inputRef}
            type="search"
            name="q"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setDraft("")}
            placeholder="Search components, e.g. phone input or paid twice…"
            autoComplete="off"
            enterKeyHint="search"
            data-finder-input
            className="h-14 w-full min-w-0 rounded-2xl border-2 bg-card pr-12 pl-12 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-amber-500 focus-visible:ring-4 focus-visible:ring-amber-500/20 sm:h-16 sm:pl-14 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
          />
          {draft && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setDraft("")
                setFinder({ q: "" })
                inputRef.current?.focus()
              }}
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </form>
        {!hasQuery && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
            <span>Try</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setFinder({ q: example })}
                className="rounded-md bg-muted/70 px-2 py-0.5 text-foreground/80 outline-none transition-colors hover:bg-amber-400/25 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {example}
              </button>
            ))}
          </p>
        )}
      </div>

      {/* Where it happens */}
      <div className="space-y-3">
        <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase" id="flow-label">
          Browse by flow
        </p>
        <div
          role="toolbar"
          aria-labelledby="flow-label"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
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
              {flow.label}
              <span className="text-xs tabular-nums opacity-60">{flowCounts.get(flow.id)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
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
          <p className="ml-auto text-muted-foreground tabular-nums" aria-live="polite" data-finder-count>
            {filtering ? (
              result.fallback ? (
                "No exact match"
              ) : (
                <>
                  {result.items.length} of {items.length}
                </>
              )
            ) : (
              <>{items.length} components</>
            )}
          </p>
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setDraft("")
                clearFinder()
              }}
              className="rounded-md px-2 py-1 font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {activeKit && <KitCard kit={activeKit} byName={byName} registryBase={registryBase} />}

      {!filtering &&
        flowSections.map(({ flow, members, total }) => (
          <section key={flow.id} aria-labelledby={`flow-${flow.id}`} className="scroll-mt-20 space-y-3" data-flow-section={flow.id}>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b pb-2">
              <div className="min-w-0">
                <h2 id={`flow-${flow.id}`} className="text-xl font-semibold tracking-tight">
                  {flow.label} <span className="text-base font-normal text-muted-foreground tabular-nums">{total}</span>
                </h2>
                {kitFor(flow.id) && <p className="text-sm text-pretty text-muted-foreground">{kitFor(flow.id)!.blurb}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setFinder({ flow: flow.id })
                  window.scrollTo({ top: 0 })
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-1 text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                See all {total} <ArrowRight aria-hidden className="size-3.5" />
              </button>
            </div>
            <CardGrid items={members} registryBase={registryBase} hideFlow={flow.id} />
          </section>
        ))}

      {filtering && result.fallback && (
        <div className="rounded-2xl border border-dashed p-5" data-finder-fallback>
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
        <SectionHeading
          id="all-heading"
          title={
            result.fallback ? "Closest matches" : finder.flow && !hasQuery ? `Everything in ${flowLabel(finder.flow)}` : "Results"
          }
        />
        <CardGrid items={shown} registryBase={registryBase} hideFlow={finder.flow} ranked={hasQuery && !result.fallback} />
        {list.length > shown.length && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setLimit((n) => n + 96)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
          <SectionHeading id="fallback-kits" title="Or start from a flow" />
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

function SectionHeading({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  )
}

function FilterSelect({
  label,
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
        "relative inline-flex h-9 items-center rounded-full border pr-8 pl-3.5 transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 hover:bg-accent",
        value ? "border-foreground/40 bg-accent text-foreground" : "text-muted-foreground",
      )}
    >
      <label htmlFor={id} className="pointer-events-none whitespace-nowrap">
        {label}: <span className="font-medium text-foreground">{selected ? selected.label.replace(/ \(\d+\)$/, "") : "Any"}</span>
      </label>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 size-3.5" />
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="absolute inset-0 cursor-pointer appearance-none rounded-full bg-transparent text-transparent opacity-0 outline-none"
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

export function IncidentCard({
  item,
  registryBase,
  top = false,
}: {
  item: SearchItem
  registryBase: string
  hideFlow?: string | null
  top?: boolean
}) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col rounded-xl border bg-card transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-sm",
        top && "border-amber-500/60 ring-1 ring-amber-500/30",
      )}
      data-card={item.name}
    >
      <Link
        href={`/components/${item.name}`}
        className="flex flex-1 flex-col gap-2 rounded-xl p-4 pr-12 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {(top || item.essential) && (
          <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {top && <span className="rounded-full bg-amber-400 px-2 py-0.5 font-semibold text-amber-950">Best match</span>}
            {item.essential && !top && <span className="rounded-full bg-muted px-2 py-0.5">Essential</span>}
          </span>
        )}
        <span className="text-[15px] leading-snug font-semibold">{item.title}</span>
        <span className="line-clamp-2 text-sm text-pretty text-muted-foreground">
          <span className="sr-only">Stops: </span>
          {item.headline ?? item.description}
        </span>
      </Link>
      <CopyButton
        value={`npx shadcn@latest add ${registryBase}${item.name}.json`}
        label={`Copy install command for ${item.title}`}
        className="absolute top-3 right-3 size-8 opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
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
        "group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card text-left outline-none transition-[border-color,box-shadow] hover:border-foreground/25 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50",
        wide && "sm:flex-row sm:items-center",
      )}
      data-kit={kit.flow}
    >
      <span className="flex flex-1 flex-col gap-2 p-4">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold">
            {kit.title}
            <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">{members.length} components</span>
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
        </span>
        <span className="text-sm text-pretty text-muted-foreground">{kit.blurb}</span>
        <span className="flex flex-wrap gap-1 pt-1">
          {members.slice(0, wide ? 7 : 4).map((name) => (
            <span key={name} className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
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
  const command = `npx shadcn@latest add ${members.map((name) => `${registryBase}${name}.json`).join(" ")}`
  return (
    <section aria-labelledby="kit-heading" className="overflow-hidden rounded-2xl border bg-card shadow-sm" data-kit-card={kit.flow}>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-amber-700 uppercase dark:text-amber-400">
            {flowLabel(kit.flow)} · kit
          </p>
          <h2 id="kit-heading" className="text-2xl font-semibold tracking-tight">
            {kit.title}
          </h2>
          <p className="text-pretty text-muted-foreground">{kit.blurb}</p>
        </div>
        <div className="min-w-0 space-y-3">
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {members.map((name) => {
              const item = byName.get(name)!
              return (
                <li key={name} className="min-w-0">
                  <Link
                    href={`/components/${name}`}
                    className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="truncate font-medium">{item.title}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border bg-muted/40 py-1.5 pr-1.5 pl-3 font-mono text-[12.5px]">
            <span aria-hidden className="select-none text-amber-600 dark:text-amber-400">
              $
            </span>
            <code className="min-w-0 flex-1 truncate text-muted-foreground" title={command}>
              npx shadcn@latest add <span className="text-foreground">{members.length} components</span>
            </code>
            <CopyButton value={command} label={`Copy install command for all ${members.length} components in the ${kit.title}`} className="h-8 shrink-0 px-3 font-sans">
              Copy install-all
            </CopyButton>
          </div>
        </div>
      </div>
    </section>
  )
}

