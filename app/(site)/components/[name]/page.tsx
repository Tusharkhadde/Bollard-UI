import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Package, Puzzle } from "lucide-react"

import { CodeBlock, CommandLine } from "@/components/site/code-block"
import { PreviewPanel } from "@/components/site/preview-panel"
import { Toc } from "@/components/site/toc"
import { catalog, categories, installCommand, readDemo, readSource, type CatalogEntry } from "@/lib/catalog"
import { highlight } from "@/lib/highlight"
import { KITS, flowShort } from "@/lib/kits"
import { usageFromDemo } from "@/lib/usage"

export const dynamicParams = false

export function generateStaticParams() {
  return catalog.map((item) => ({ name: item.name }))
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const item = catalog.find((entry) => entry.name === name)
  if (!item) return {}
  const description = pageDescription(item)
  return {
    title: item.title,
    description,
    openGraph: { title: `${item.title} · Bollard UI`, description },
    twitter: { card: "summary_large_image", title: `${item.title} · Bollard UI`, description },
  }
}

/** "Stops: extra zero on a transfer. Amount input for React…" kept under ~160 characters. */
function pageDescription(item: CatalogEntry) {
  const lead = item.stops ? `Stops ${item.stops.charAt(0).toLowerCase()}${item.stops.slice(1)}.` : `${item.headline}.`
  const tail = `${item.title}, a copy-paste React component for shadcn/ui.`
  const full = `${lead} ${tail} ${item.description}`
  return full.length > 160 ? full.slice(0, 157).replace(/\s+\S*$/, "") + "…" : full
}

/** Four components to show next: same kit first, then shared flows, then same category. */
function pairsFor(item: CatalogEntry) {
  const picked: CatalogEntry[] = []
  const add = (name: string) => {
    if (picked.length >= 4 || name === item.name || picked.some((p) => p.name === name)) return
    const entry = catalog.find((e) => e.name === name)
    if (entry) picked.push(entry)
  }
  for (const kit of KITS) if (kit.components.includes(item.name)) kit.components.forEach(add)
  const scored = catalog
    .filter((e) => e.name !== item.name)
    .map((e) => ({ e, shared: (e.flows ?? []).filter((f) => (item.flows ?? []).includes(f)).length, essential: e.essential ? 1 : 0 }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.essential - a.essential || a.e.title.localeCompare(b.e.title))
  scored.forEach((x) => add(x.e.name))
  catalog.filter((e) => e.category === item.category).forEach((e) => add(e.name))
  return picked
}

const baseSections = [
  { id: "preview", label: "Preview" },
  { id: "installation", label: "Installation" },
  { id: "usage", label: "Usage" },
  { id: "source", label: "Source" },
  { id: "dependencies", label: "Dependencies" },
  { id: "pairs", label: "Pairs well with" },
]

export default async function ComponentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const index = catalog.findIndex((entry) => entry.name === name)
  if (index === -1) notFound()
  const item = catalog[index]
  const prev = catalog[index - 1]
  const next = catalog[index + 1]
  const category = categories.find((c) => c.name === item.category)
  const main = `registry/default/${name}/${name}.tsx`
  const files = [...item.files].sort((a, b) => Number(b === main) - Number(a === main)).map((path) => {
    const source = readSource(path)
    return { path, source, lines: source.replace(/\n$/, "").split("\n").length, code: highlight(source.replace(/\n$/, "")) }
  })
  const command = installCommand(name)
  const demo = readDemo(name)
  const usage = demo ? usageFromDemo(name, demo) : null
  const pairs = pairsFor(item)
  const sections = baseSections.filter((s) => (s.id === "usage" ? !!usage : s.id === "pairs" ? pairs.length > 0 : true))

  return (
    <div className="flex gap-10 px-4 py-8 sm:px-8 lg:py-10">
      <main className="min-w-0 flex-1 xl:max-w-3xl 2xl:max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/components" className="hover:text-foreground">
            Components
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/components?category=${category?.slug ?? ""}`} className="hover:text-foreground">
            {item.category}
          </Link>
        </nav>
        <header className="mb-8 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{item.title}</h1>
          {item.stops && (
            <p className="text-[15px] font-medium text-foreground" data-stops>
              <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Stops:</span>{" "}
              {item.stops}
            </p>
          )}
          <p className="max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground">{item.description}</p>
          {(item.flows?.length ?? 0) > 0 && (
            <ul aria-label="Flows" className="flex flex-wrap gap-2 pt-1">
              {(item.flows ?? []).map((flow) => (
                <li key={flow}>
                  <Link
                    href={`/components?flow=${flow}`}
                    className="inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {flowShort(flow)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        <section id="preview" aria-labelledby="preview-heading" className="mb-10 scroll-mt-20">
          <h2 id="preview-heading" className="sr-only">
            Preview
          </h2>
          <PreviewPanel name={name} />
        </section>

        <section id="installation" aria-labelledby="installation-heading" className="mb-10 scroll-mt-20 space-y-3">
          <h2 id="installation-heading" className="text-xl font-semibold tracking-tight">
            Installation
          </h2>
          <p className="text-sm text-muted-foreground">Add it with the shadcn CLI. The files land in your project and are yours to edit.</p>
          <CommandLine command={command} label="Copy install command" />
        </section>

        {usage && (
          <section id="usage" aria-labelledby="usage-heading" className="mb-10 scroll-mt-20 space-y-3">
            <h2 id="usage-heading" className="text-xl font-semibold tracking-tight">
              Usage
            </h2>
            <p className="text-sm text-muted-foreground">Taken from the demo above.</p>
            <CodeBlock
              files={[{ path: `${name}-usage.tsx`, source: usage, lines: usage.split("\n").length, code: highlight(usage) }]}
            />
          </section>
        )}

        <section id="source" aria-labelledby="source-heading" className="mb-10 scroll-mt-20 space-y-3">
          <h2 id="source-heading" className="text-xl font-semibold tracking-tight">
            Source
          </h2>
          <p className="text-sm text-muted-foreground">
            Or copy the source into <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">components/ui</code>.
          </p>
          <CodeBlock files={files} />
        </section>

        <section id="dependencies" aria-labelledby="dependencies-heading" className="mb-12 scroll-mt-20 space-y-3">
          <h2 id="dependencies-heading" className="text-xl font-semibold tracking-tight">
            Dependencies
          </h2>
          {item.dependencies.length || item.registryDependencies.length ? (
            <ul className="flex flex-wrap gap-2">
              {item.dependencies.map((dep) => (
                <li key={dep} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs">
                  <Package className="size-3.5 text-muted-foreground" aria-hidden />
                  {dep}
                </li>
              ))}
              {item.registryDependencies.map((dep) => (
                <li key={dep} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs">
                  <Puzzle className="size-3.5 text-muted-foreground" aria-hidden />
                  {dep}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None beyond React and Tailwind CSS.</p>
          )}
          <p className="text-sm text-muted-foreground">
            Every component also uses the <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">cn()</code> helper (clsx + tailwind-merge) from{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">lib/utils</code>.
          </p>
        </section>

        {pairs.length > 0 && (
          <section id="pairs" aria-labelledby="pairs-heading" className="mb-12 scroll-mt-20 space-y-3">
            <h2 id="pairs-heading" className="text-xl font-semibold tracking-tight">
              Pairs well with
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {pairs.map((pair) => (
                <li key={pair.name} className="min-w-0">
                  <Link
                    href={`/components/${pair.name}`}
                    className="group flex h-full min-w-0 flex-col gap-1 rounded-xl border p-4 transition-colors hover:bg-accent/50"
                  >
                    <span className="flex items-center justify-between gap-2 font-medium">
                      <span className="truncate">{pair.title}</span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">{pair.headline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Previous and next component" className="grid gap-3 border-t pt-6 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/components/${prev.name}`}
              rel="prev"
              className="group flex flex-col gap-1 rounded-xl border p-4 transition-colors hover:bg-accent/50"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden /> Previous
              </span>
              <span className="font-medium">{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link
              href={`/components/${next.name}`}
              rel="next"
              className="group flex flex-col items-end gap-1 rounded-xl border p-4 text-right transition-colors hover:bg-accent/50"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Next <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="font-medium">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>
      <aside className="hidden w-48 shrink-0 xl:block">
        <div className="sticky top-24">
          <Toc sections={sections} />
        </div>
      </aside>
    </div>
  )
}
