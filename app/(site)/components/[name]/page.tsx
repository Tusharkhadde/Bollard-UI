import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Package, Puzzle, ServerCog } from "lucide-react"

import { CodeBlock } from "@/components/site/code-block"
import { ComponentFaqSection } from "@/components/site/component-faq"
import { ComponentFeedback } from "@/components/site/component-feedback"
import { FactsTable } from "@/components/site/facts-table"
import { JsonLd } from "@/components/site/json-ld"
import { DocsTabs } from "@/components/site/docs-tabs"
import { PackageCommand } from "@/components/site/package-command"
import { PreviewPanel } from "@/components/site/preview-panel"
import { Toc } from "@/components/site/toc"
import { catalog, categories, readDemo, readProps, readSource, registryBase, type CatalogEntry, type PropsDoc, type RulesInfo } from "@/lib/catalog"
import { getComponentFaqs } from "@/lib/component-faq"
import { getComponentFacts } from "@/lib/facts"
import { highlight } from "@/lib/highlight"
import { KITS, fieldLabel, flowHref, flowShort } from "@/lib/kits"
import { usageFromDemo } from "@/lib/usage"
import { buildImplementationContext } from "@/lib/implementation-context"
import { toInstalledImport } from "@/lib/registry-imports"
import { cn } from "@/lib/utils"

import componentDates from "@/lib/component-dates.json"
import { absoluteUrl, GITHUB_URL, SAME_AS_PROFILES, SITE_NAME, SITE_URL } from "@/lib/site"

const DATES = componentDates as Record<string, string>

// Keep the most-used pages pre-rendered; the rest of the catalog is rendered
// and cached on first request so adding components does not scale build time linearly.
export const dynamicParams = true

export function generateStaticParams() {
  return catalog.filter((item) => item.essential).map((item) => ({ name: item.name }))
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const item = catalog.find((entry) => entry.name === name)
  if (!item) return {}
  const rawMistake = (item.stops ?? item.headline ?? item.summary ?? item.description).replace(/[.!?]+$/, "").trim()
  
  // Format description: mistake + shadcn + MIT licensed, strictly <= 155 chars
  let description = `Stops ${rawMistake.toLowerCase()}. Copy-paste shadcn React component, MIT licensed.`
  if (description.length > 155) {
    const maxMistake = 155 - "Stops … Copy-paste shadcn React component, MIT licensed.".length
    description = `Stops ${rawMistake.slice(0, maxMistake).trim()}… Copy-paste shadcn React component, MIT licensed.`
  }

  // Format title: primary query first, under 48 chars so suffixed "%s | Bollard UI" is strictly <= 65 chars
  let title = `${item.title} Component`
  if (title.length > 46) {
    title = item.title
  }

  const path = `/components/${name}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(path),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [absoluteUrl(`/components/${name}/opengraph-image`)],
    },
  }
}

/** Imports as the shadcn CLI writes them: @/registry/default/<dir>/<file> → @/components/ui/<file>. */
function asInstalled(source: string) {
  return toInstalledImport(source)
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

/** A plain bullet list in a hairline card, used by "What it catches", "Accessibility" and "Limitations". */
function BulletCard({ items, tone = "default" }: { items: string[]; tone?: "default" | "muted" }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border">
      {items.map((text) => (
        <li key={text} className={cn("flex items-start gap-3 px-4 py-3 text-[14.5px] leading-6 sm:px-5", tone === "muted" && "text-foreground/85")}>
          <span aria-hidden className={cn("mt-[11px] h-px w-3 shrink-0", tone === "default" ? "bg-brand" : "bg-muted-foreground/50")} />
          <span className="min-w-0 text-pretty">{text}</span>
        </li>
      ))}
    </ul>
  )
}

/** "This is a UX guard rail. Enforce on the server: …" */
function ServerCallout({ text }: { text: string }) {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-brand/40 bg-brand/[0.06] px-4 py-3.5 sm:px-5" data-server-note>
      <ServerCog aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
      <p className="text-[14.5px] leading-6 text-pretty">
        <span className="font-medium">This is a UX guard rail. Enforce on the server: </span>
        <span className="text-foreground/85">{text}</span>
      </p>
    </div>
  )
}

function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}

/** Rule-bearing components: when the rules were last checked, against what, and a reminder to check the source. */
function RulesBox({ rules }: { rules: RulesInfo }) {
  return (
    <div className="space-y-3 rounded-xl border bg-surface px-4 py-4 sm:px-5" data-rules>
      <p className="text-[14.5px] leading-6">
        {rules.verified ? (
          <>
            <span className="font-medium">Rules last verified:</span> <time dateTime={rules.verified}>{formatDate(rules.verified)}</time>
          </>
        ) : (
          <span className="font-medium">Rules not yet verified against an official source.</span>
        )}
      </p>
      {rules.sources && rules.sources.length > 0 && (
        <ul className="space-y-1.5">
          {rules.sources.map((source) => (
            <li key={source.url} className="text-sm">
              <a
                href={source.url}
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 rounded-sm text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ExternalLink aria-hidden className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {rules.note ?? "Informational only; check the official source or a professional before relying on it."} Copied components don&apos;t update
        themselves, so re-check after rule changes (see{" "}
        <Link href="/docs#updating" className="underline underline-offset-4 hover:text-foreground">
          updating a component
        </Link>
        ).
      </p>
    </div>
  )
}

/** Name, type, default and description per prop, from scripts/props.mjs. */
function PropsTable({ doc }: { doc: PropsDoc }) {
  const nativeOf = (doc.extends ?? []).map((e) => e.match(/ComponentProps<\s*"(\w+)"\s*>/)?.[1] ?? e.match(/HTMLAttributes<\s*HTML(\w+?)Element/)?.[1]?.toLowerCase()).filter(Boolean)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <caption className="sr-only">{doc.component} props</caption>
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="px-4 py-2.5 font-medium">Prop</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Default</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {doc.props.map((prop) => (
              <tr key={prop.name} className="align-top">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <code className="font-mono text-[12.5px] font-medium text-foreground">
                    {prop.name}
                    {prop.required && (
                      <span className="text-amber-700 dark:text-amber-400" title="Required">
                        *<span className="sr-only"> (required)</span>
                      </span>
                    )}
                  </code>
                  {prop.description && <p className="mt-1 max-w-[34ch] text-[13px] leading-5 text-pretty text-muted-foreground">{prop.description}</p>}
                </th>
                <td className="px-4 py-3">
                  <code className="font-mono text-[12px] break-words text-foreground/85">{prop.type}</code>
                </td>
                <td className="px-4 py-3">
                  {prop.default ? <code className="font-mono text-[12px] text-foreground/85">{prop.default}</code> : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-muted-foreground">
        <span className="text-amber-700 dark:text-amber-400">*</span> required.{" "}
        {nativeOf.length > 0
          ? `Also accepts the native props of <${nativeOf.join(">, <")}> (className, aria-*, data-*…), passed through to it.`
          : doc.extends?.length
            ? `Also accepts ${doc.extends.join(", ")}.`
            : null}
      </p>
    </div>
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
      const source = asInstalled(readSource(path))
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
  const propsDoc = readProps(name)
  const hasProps = !!propsDoc && propsDoc.props.length > 0
  const implementationContext = buildImplementationContext({
    name,
    title: item.title,
    targets: item.targets,
    dependencies: deps,
    registryDependencies: regDeps.map((dependency) => `@bollard/${dependency}`),
    usage: usage ?? `import { ${name.replace(/(^|-)([a-z])/g, (_, _dash, letter) => letter.toUpperCase())} } from "@/components/ui/${name}"`,
    propNames: propsDoc?.props.map((prop) => prop.name) ?? [],
    limitations: item.limits,
    serverGuidance: item.server,
  })
  const catches = item.catches ?? []
  const a11y = item.a11y ?? []
  const limits = item.limits ?? []
  const hasLimits = limits.length > 0 || !!item.server

  const sections = [
    { id: "installation", label: "Installation" },
    usage && { id: "usage", label: "Usage" },
    catches.length > 0 && { id: "catches", label: "What it catches" },
    hasProps && { id: "props", label: "Props" },
    a11y.length > 0 && { id: "accessibility", label: "Accessibility" },
    hasLimits && { id: "limitations", label: "Limitations" },
    item.rules && { id: "rules", label: "Rules" },
    hasStops && { id: "stops", label: "What it stops" },
    { id: "dependencies", label: "Dependencies" },
    { id: "facts", label: "Facts & specs" },
    { id: "faq", label: "FAQ" },
    pairs.length > 0 && { id: "pairs", label: "Pairs well with" },
  ].filter((s): s is { id: string; label: string } => !!s)

  const demoCode = demo ? asInstalled(demo.replace(/\n$/, "")) : null
  const codeTab = demoCode ? (
    <CodeBlock
      collapsible
      component={name}
      files={[{ path: `${name}-demo.tsx`, source: demoCode, lines: demoCode.split("\n").length, code: highlight(demoCode) }]}
    />
  ) : (
    <CodeBlock collapsible component={name} files={files} />
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
      body: <CodeBlock collapsible component={name} files={files} />,
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

  const lastUpdated = DATES[name] || "2026-10-16"
  const componentFacts = getComponentFacts(item, lastUpdated)
  const componentFaqs = getComponentFaqs(item)

  return (
    <div className="flex gap-12 px-4 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-10 xl:gap-16">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${SITE_URL}/#publisher`,
            name: "Bollard UI",
            url: SITE_URL,
            logo: `${SITE_URL}/icon.svg`,
            sameAs: SAME_AS_PROFILES,
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${SITE_URL}/components/${name}#breadcrumbs`,
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Components", item: `${SITE_URL}/components` },
              { "@type": "ListItem", position: 3, name: item.title, item: `${SITE_URL}/components/${name}` },
            ],
          },
          {
            "@type": "SoftwareSourceCode",
            "@id": `${SITE_URL}/components/${name}#code`,
            name: item.title,
            description: item.summary ?? item.description,
            url: `${SITE_URL}/components/${name}`,
            license: "https://opensource.org/licenses/MIT",
            isAccessibleForFree: true,
            programmingLanguage: ["TypeScript", "React"],
            runtimePlatform: "React",
            codeRepository: GITHUB_URL,
            isPartOf: { "@id": `${SITE_URL}/#library` },
            author: { "@id": `${SITE_URL}/#publisher` },
            publisher: { "@id": `${SITE_URL}/#publisher` },
            dateModified: `${lastUpdated}T00:00:00Z`,
          },
          {
            "@type": "FAQPage",
            "@id": `${SITE_URL}/components/${name}#faq`,
            mainEntity: componentFaqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          },
        ],
      }} />
      <main id="top" className="min-w-0 flex-1 xl:max-w-[46rem] 2xl:max-w-[52rem]">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
            <li><Link href="/" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">Home</Link></li>
            <li aria-hidden><ChevronRight className="size-3.5 shrink-0 opacity-60" /></li>
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

          {/* Self-contained Answer Block for AEO / GEO */}
          <div className="rounded-xl border border-brand/40 bg-brand/[0.04] p-4.5 sm:p-5" data-answer-block>
            <p className="text-[15px] sm:text-[15.5px] leading-relaxed text-foreground/95 font-medium">
              {item.title} is a copy-paste React component that {item.stops ? `stops ${item.stops.toLowerCase()}` : `prevents costly form mistakes`} before the user submits. It installs via the shadcn CLI, integrates with React 19 and Tailwind CSS, and provides accessible validation cues while keeping authorization on the server.
            </p>
            <div className="mt-3.5">
              <PackageCommand kind="add" args={url} label={`Copy ${item.title} install command`} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground pt-1">
            <span>Version <span className="font-mono text-foreground font-medium">0.1.0</span></span>
            <span aria-hidden>·</span>
            <span>Last updated <time dateTime={lastUpdated} className="font-medium text-foreground">{formatDate(lastUpdated)}</time></span>
            <span aria-hidden>·</span>
            <span>Free &amp; MIT licensed</span>
          </div>

          <ul aria-label="Compatibility and setup" className="flex flex-wrap gap-1.5 text-[11px]">
            <li className="rounded-md border bg-surface px-2 py-1 text-muted-foreground">
              {item.integration === "headless" ? "Headless · any React UI" : "Styled · shadcn theme"}
            </li>
            <li className="rounded-md border bg-surface px-2 py-1 text-muted-foreground">React 19+</li>
            <li className="rounded-md border bg-surface px-2 py-1 text-muted-foreground">MIT licensed</li>
            {item.integration === "styled" && <li className="rounded-md border bg-surface px-2 py-1 text-muted-foreground">Tailwind v4</li>}
            <li className="rounded-md border bg-surface px-2 py-1 text-muted-foreground">
              {deps.length ? `${deps.length} extra npm ${deps.length === 1 ? "package" : "packages"}` : "No extra npm packages"}
            </li>
            {a11y.length > 0 && <li className="rounded-md border border-brand/30 bg-brand/5 px-2 py-1 text-foreground/80">A11y guidance in docs</li>}
          </ul>
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
          <PreviewPanel name={name} code={codeTab} implementationContext={implementationContext} />
        </section>

        <ComponentFeedback component={name} />

        <DocSection id="installation" title={`How do I install ${item.title}?`}>
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
          <DocSection id="usage" title={`How do I use ${item.title} in React?`}>
            <CodeBlock lineNumbers={false} component={name} files={[{ path: `${name}-usage.tsx`, source: usage, lines: usage.split("\n").length, code: highlight(usage) }]} />
          </DocSection>
        )}

        {catches.length > 0 && (
          <DocSection id="catches" title={`What input mistakes does ${item.title} catch?`}>
            <BulletCard items={catches} />
          </DocSection>
        )}

        {hasProps && propsDoc && (
          <DocSection id="props" title={`What props does ${item.title} accept?`}>
            <PropsTable doc={propsDoc} />
          </DocSection>
        )}

        {a11y.length > 0 && (
          <DocSection id="accessibility" title={`How is ${item.title} accessible?`}>
            <BulletCard items={a11y} tone="muted" />
            <p className="text-[13px] text-muted-foreground">Only what the source does. Test with your own screen reader and content before shipping.</p>
          </DocSection>
        )}

        {hasLimits && (
          <DocSection id="limitations" title={`What are the limitations and server boundaries?`}>
            {item.server && <ServerCallout text={item.server} />}
            {limits.length > 0 && <BulletCard items={limits} tone="muted" />}
          </DocSection>
        )}

        {item.rules && (
          <DocSection id="rules" title={`What validation rules apply to ${item.title}?`}>
            <RulesBox rules={item.rules} />
          </DocSection>
        )}

        {hasStops && (
          <DocSection id="stops" title={`What expensive mistakes does ${item.title} stop?`}>
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

        <DocSection id="dependencies" title={`What dependencies does ${item.title} require?`}>
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

        <DocSection id="facts" title={`${item.title} facts & technical specifications`}>
          <FactsTable facts={componentFacts} title="" />
        </DocSection>

        <DocSection id="faq" title={`Frequently asked questions about ${item.title}`}>
          <ComponentFaqSection faqs={componentFaqs} componentTitle={item.title} />
        </DocSection>

        {pairs.length > 0 && (
        <DocSection id="pairs" title={`Which components pair with ${item.title}?`}>
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
