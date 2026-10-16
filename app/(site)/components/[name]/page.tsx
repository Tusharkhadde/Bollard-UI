import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Package, Puzzle } from "lucide-react"

import { CodeBlock } from "@/components/site/code-block"
import { DocsTabs } from "@/components/site/docs-tabs"
import { PackageCommand } from "@/components/site/package-command"
import { PreviewPanel } from "@/components/site/preview-panel"
import { Toc } from "@/components/site/toc"
import { catalog, categories, readDemo, readSource, registryBase, type CatalogEntry } from "@/lib/catalog"
import { highlight } from "@/lib/highlight"
import { KITS, fieldLabel, flowHref, flowShort } from "@/lib/kits"
import { usageFromDemo } from "@/lib/usage"
import { cn } from "@/lib/utils"

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

const inlineCode = "rounded-md border bg-surface px-1.5 py-0.5 font-mono text-[12.5px] text-foreground"
const tag =
  "inline-flex h-7 items-center rounded-md border bg-background px-2.5 text-xs text-muted-foreground outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** h2 with a hover "#" anchor, shadcn-docs style. */
function DocHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={`${id}-heading`} className="group text-xl font-semibold tracking-[-0.02em]">
      <a href={`#${id}`} className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {children}
        <span aria-hidden className="ml-2 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground">
          #
        </span>
      </a>
    </h2>
  )
}

function DocSection({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-20 space-y-4 pt-12", className)}>
      <DocHeading id={id}>{title}</DocHeading>
      {children}
    </section>
  )
}

/** Numbered steps with a hairline rail (the manual-install list). */
function Steps({ steps }: { steps: { title: React.ReactNode; body?: React.ReactNode }[] }) {
  return (
    <ol className="relative ml-3 border-l pl-7">
      {steps.map((step, i) => (
        <li key={i} className="relative pb-8 last:pb-1">
          <span
            aria-hidden
            className="absolute top-0 -left-[calc(1.75rem+0.75rem+0.5px)] grid size-6 place-items-center rounded-full border bg-background font-mono text-[11px] font-medium text-foreground tabular-nums"
          >
            {i + 1}
          </span>
          <p className="text-[15px] leading-6 font-medium">{step.title}</p>
          {step.body && <div className="mt-3 min-w-0 space-y-3">{step.body}</div>}
        </li>
      ))}
    </ol>
  )
}

export default async function ComponentPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const index = catalog.findIndex((entry) => entry.name === name)
  if (index === -1) notFound()
  const item = catalog[index]
  const prev = catalog[index - 1]
  const next = catalog[index + 1]
  const category = categories.find((c) => c.name === item.category)
  const main = `registry/default/${name}/${name}.tsx`
  const files = [...item.files]
    .sort((a, b) => Number(b === main) - Number(a === main))
    .map((path) => {
      const source = readSource(path)
      return { path, source, lines: source.replace(/\n$/, "").split("\n").length, code: highlight(source.replace(/\n$/, "")) }
    })
  const url = `${registryBase}${name}.json`
  const demo = readDemo(name)
  const usage = demo ? usageFromDemo(name, demo) : null
  const pairs = pairsFor(item)
  const mistakes = (item.mistakes ?? []).slice(0, 6)
  const aliases = (item.aliases ?? []).slice(0, 8)
  const hasStops = !!item.stops || mistakes.length > 0
  const deps = item.dependencies
  const regDeps = item.registryDependencies

  const sections = [
    { id: "installation", label: "Installation" },
    usage && { id: "usage", label: "Usage" },
    hasStops && { id: "stops", label: "What it stops" },
    { id: "dependencies", label: "Dependencies" },
    pairs.length > 0 && { id: "pairs", label: "Pairs well with" },
  ].filter((s): s is { id: string; label: string } => !!s)

  const demoCode = demo ? demo.replace(/\n$/, "") : null
  const codeTab = demoCode ? (
    <CodeBlock
      collapsible
      files={[{ path: `${name}-demo.tsx`, source: demoCode, lines: demoCode.split("\n").length, code: highlight(demoCode) }]}
    />
  ) : (
    <CodeBlock collapsible files={files} />
  )

  type Step = { title: React.ReactNode; body?: React.ReactNode }
  const manualSteps = ([
    deps.length > 0 && {
      title: "Install the dependencies",
      body: <PackageCommand kind="install" args={deps.join(" ")} label="Copy install command" />,
    },
    regDeps.length > 0 && {
      title: (
        <>
          Add the Bollard UI {regDeps.length === 1 ? "component" : "components"} it builds on:{" "}
          {regDeps.map((dep, i) => (
            <span key={dep}>
              {i > 0 && ", "}
              <Link href={`/components/${dep}`} className="underline decoration-border underline-offset-4 hover:decoration-foreground">
                {dep}
              </Link>
            </span>
          ))}
        </>
      ),
      body: <PackageCommand kind="add" args={regDeps.map((dep) => `${registryBase}${dep}.json`).join(" ")} label="Copy add command" />,
    },
    {
      title: (
        <>
          Copy and paste the following code into <code className={inlineCode}>components/ui</code>
        </>
      ),
      body: <CodeBlock collapsible files={files} />,
    },
    {
      title: "Update the import paths to match your project setup.",
      body: (
        <p className="text-sm leading-relaxed text-muted-foreground">
          It uses the <code className={inlineCode}>cn()</code> helper from <code className={inlineCode}>@/lib/utils</code>, which every shadcn/ui project
          already has.
        </p>
      ),
    },
  ] as (Step | false)[]).filter((s): s is Step => !!s)

  const pagerButton =
    "grid size-8 place-items-center rounded-md border bg-background text-muted-foreground outline-none transition-colors hover:border-border-strong hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <div className="flex gap-12 px-4 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-10 xl:gap-16">
      <main id="top" className="min-w-0 flex-1 xl:max-w-[46rem] 2xl:max-w-[52rem]">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
            <li>
              <Link href="/components" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Components
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3.5 shrink-0 opacity-60" />
            </li>
            <li className="min-w-0">
              <Link
                href={`/components?category=${category?.slug ?? ""}`}
                className="block truncate rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {item.category}
              </Link>
            </li>
            <li aria-hidden className="hidden sm:block">
              <ChevronRight className="size-3.5 shrink-0 opacity-60" />
            </li>
            <li aria-current="page" className="hidden truncate text-foreground sm:block">
              {item.title}
            </li>
          </ol>
        </nav>

        <header className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[2.25rem]">{item.title}</h1>
            <div className="flex shrink-0 items-center gap-1.5 pt-1.5">
              {prev ? (
                <Link href={`/components/${prev.name}`} aria-label={`Previous: ${prev.title}`} title={prev.title} className={pagerButton}>
                  <ChevronLeft className="size-4" aria-hidden />
                </Link>
              ) : null}
              {next ? (
                <Link href={`/components/${next.name}`} aria-label={`Next: ${next.title}`} title={next.title} className={pagerButton}>
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
          <p className="max-w-[65ch] text-base leading-relaxed text-pretty text-muted-foreground">{item.description}</p>
          {item.stops && (
            <p className="flex items-start gap-2.5 text-[15px] leading-6 text-foreground" data-stops>
              <span className="mt-[3px] inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.12em] text-amber-800 uppercase dark:text-amber-300">
                Stops
              </span>
              <span className="min-w-0">{item.stops}</span>
            </p>
          )}
          {(item.flows?.length ?? 0) > 0 && (
            <ul aria-label="Flows" className="flex flex-wrap gap-1.5 pt-1">
              {(item.flows ?? []).map((flow) => (
                <li key={flow}>
                  <Link href={flowHref(flow)} className={tag}>
                    {flowShort(flow)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        <section aria-label="Example" className="pt-8" id="preview">
          <PreviewPanel name={name} code={codeTab} />
        </section>

        <DocSection id="installation" title="Installation">
          <DocsTabs
            label="Installation method"
            variant="segmented"
            listClassName="mb-4"
            tabs={[
              {
                value: "cli",
                label: "CLI",
                content: (
                  <div className="space-y-3">
                    <PackageCommand kind="add" args={url} label="Copy install command" />
                    <p className="text-sm text-muted-foreground">The files land in your project. They&apos;re yours to edit.</p>
                  </div>
                ),
              },
              { value: "manual", label: "Manual", content: <Steps steps={manualSteps} /> },
            ]}
          />
        </DocSection>

        {usage && (
          <DocSection id="usage" title="Usage">
            <CodeBlock lineNumbers={false} files={[{ path: `${name}-usage.tsx`, source: usage, lines: usage.split("\n").length, code: highlight(usage) }]} />
          </DocSection>
        )}

        {hasStops && (
          <DocSection id="stops" title="What it stops">
            <div className="overflow-hidden rounded-xl border">
              {item.stops && (
                <div className="flex items-start gap-3 border-b bg-surface px-4 py-3.5 last:border-b-0 sm:px-5">
                  <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-brand" />
                  <p className="text-[15px] leading-6 font-medium">{item.stops}</p>
                </div>
              )}
              {mistakes.length > 0 && (
                <div className="space-y-2.5 px-4 py-4 sm:px-5">
                  <p className="text-xs font-medium text-muted-foreground">How people describe it</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {mistakes.map((m) => (
                      <li key={m}>
                        <Link href={`/components?q=${encodeURIComponent(m)}`} className={tag}>
                          &ldquo;{m}&rdquo;
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(aliases.length > 0 || (item.fields?.length ?? 0) > 0) && (
                <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-[1fr_auto] sm:px-5">
                  {aliases.length > 0 && (
                    <div className="min-w-0 space-y-2.5">
                      <p className="text-xs font-medium text-muted-foreground">Also known as</p>
                      <p className="text-sm text-pretty text-foreground/85">{aliases.join(" · ")}</p>
                    </div>
                  )}
                  {(item.fields?.length ?? 0) > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-medium text-muted-foreground">Field type</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {(item.fields ?? []).map((field) => (
                          <li key={field}>
                            <Link href={`/components?field=${field}`} className={tag}>
                              {fieldLabel(field)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DocSection>
        )}

        <DocSection id="dependencies" title="Dependencies">
          {deps.length || regDeps.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {deps.map((dep) => (
                <li key={dep}>
                  <a href={`https://www.npmjs.com/package/${dep}`} className={cn(tag, "gap-1.5 font-mono")}>
                    <Package className="size-3.5" aria-hidden />
                    {dep}
                  </a>
                </li>
              ))}
              {regDeps.map((dep) => (
                <li key={dep}>
                  <Link href={`/components/${dep}`} className={cn(tag, "gap-1.5 font-mono")}>
                    <Puzzle className="size-3.5" aria-hidden />
                    {dep}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None beyond React and Tailwind CSS.</p>
          )}
        </DocSection>

        {pairs.length > 0 && (
          <DocSection id="pairs" title="Pairs well with">
            <ul className="grid gap-3 sm:grid-cols-2">
              {pairs.map((pair) => (
                <li key={pair.name} className="min-w-0">
                  <Link
                    href={`/components/${pair.name}`}
                    className="group flex h-full min-w-0 flex-col gap-1 rounded-xl border p-4 outline-none transition-colors hover:border-border-strong hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      <span className="truncate">{pair.title}</span>
                      <ArrowRight
                        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
                        aria-hidden
                      />
                    </span>
                    <span className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">{pair.headline}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </DocSection>
        )}

        <nav aria-label="Previous and next component" className="mt-14 flex items-stretch justify-between gap-3 border-t pt-6">
          {prev ? (
            <Link
              href={`/components/${prev.name}`}
              rel="prev"
              className="group flex min-w-0 flex-col gap-0.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden /> Previous
              </span>
              <span className="truncate text-sm font-medium group-hover:underline group-hover:underline-offset-4">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/components/${next.name}`}
              rel="next"
              className="group flex min-w-0 flex-col items-end gap-0.5 rounded-lg px-1 py-1 text-right outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Next <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
              </span>
              <span className="truncate text-sm font-medium group-hover:underline group-hover:underline-offset-4">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>
      <aside className="hidden w-52 shrink-0 xl:block">
        <div className="sticky top-24">
          <Toc sections={sections} />
        </div>
      </aside>
    </div>
  )
}
