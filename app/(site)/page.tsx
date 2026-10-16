import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import { GithubIcon } from "@/components/site/github-icon"
import { InstallCommand } from "@/components/site/install-command"
import { CompareInputs } from "@/components/site/landing/compare-inputs"
import { Faq } from "@/components/site/landing/faq"
import { Hero } from "@/components/site/landing/hero"
import { HowItWorks } from "@/components/site/landing/how-it-works"
import { LiveDemo, type ShowcaseName } from "@/components/site/landing/live-demo"
import { Reveal } from "@/components/site/landing/reveal"
import { SectionHeading } from "@/components/site/landing/section-heading"
import { TrustStrip } from "@/components/site/landing/trust-strip"
import { catalog, GITHUB_URL, registryBase } from "@/lib/catalog"
import { FLOWS } from "@/lib/kits"
import { cn } from "@/lib/utils"

/** The live examples grid: a 6-column bento on desktop, pairs on tablet, one column on phones. */
const showcase: { name: ShowcaseName; span: string; note?: string }[] = [
  { name: "sql-guard", span: "md:col-span-2 lg:col-span-4" },
  { name: "card-expiry-input", span: "md:col-span-2 lg:col-span-2" },
  { name: "ifsc-input", span: "lg:col-span-2" },
  { name: "percent-input", span: "lg:col-span-2" },
  { name: "upi-id-input", span: "md:col-span-2 lg:col-span-2" },
  { name: "cooldown-button", span: "lg:col-span-2" },
  { name: "homoglyph-guard", span: "lg:col-span-2" },
  { name: "type-to-confirm", span: "md:col-span-2 lg:col-span-2" },
]

const button =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const primary = cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")
const outline = cn(button, "border bg-background hover:bg-muted")
const eyebrow = "text-sm font-bold text-muted-foreground"

export default function Home() {
  const byName = new Map(catalog.map((item) => [item.name, item]))
  const total = catalog.length
  const cards = showcase.flatMap((card) => {
    const item = byName.get(card.name)
    return item ? [{ ...card, title: item.title, stops: card.note ?? item.headline ?? item.description }] : []
  })
  const flows = FLOWS.map((flow) => ({ ...flow, count: catalog.filter((item) => item.flows?.includes(flow.id)).length })).filter((f) => f.count > 0)

  return (
    <main className="overflow-x-clip">
      <Hero registryBase={registryBase} githubUrl={GITHUB_URL} />
      <TrustStrip total={total} />

      {/* Live examples */}
      <section aria-labelledby="examples-heading" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 id="examples-heading" className="sr-only">
          Live examples
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          {cards.map((card, i) => (
            <Reveal as="li" key={card.name} delay={(i % 4) * 0.06} className={cn("flex min-w-0 flex-col rounded-xl border bg-card shadow-xs", card.span)}>
              <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                  <h3 className="font-bold">{card.title}</h3>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{card.stops}</p>
                </div>
                <Link
                  href={`/components/${card.name}`}
                  aria-label={`${card.title} docs`}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <ArrowUpRight aria-hidden className="size-4" />
                </Link>
              </div>
              <div className="flex flex-1 items-center px-5 pt-4 pb-5">
                <LiveDemo name={card.name} />
              </div>
            </Reveal>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Every card is the real component, the same code the CLI adds.{" "}
          <Link href="/components" className="font-bold text-foreground underline-offset-4 hover:underline">
            See all {total}
          </Link>
        </p>
      </section>

      <HowItWorks registryBase={registryBase} />

      {/* One honest side-by-side */}
      <section aria-labelledby="compare-heading" className="border-t">
        <Reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading id="compare-heading" eyebrow="The difference" title="A normal input vs a Bollard input">
            Rent is usually ₹24,000. Someone types one zero too many. Try editing either field.
          </SectionHeading>
          <div className="mt-10">
            <CompareInputs />
          </div>
        </Reveal>
      </section>

      {/* Browse by flow */}
      <section id="flows" aria-labelledby="flows-heading" className="scroll-mt-20 border-t">
        <Reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="flows-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Browse by flow
            </h2>
            <p className={eyebrow}>Start from the screen you&apos;re building.</p>
          </div>
          <ul className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-9">
            {flows.map((flow) => (
              <li key={flow.id} className="min-w-0 bg-background">
                <Link
                  href={`/components?flow=${flow.id}`}
                  title={flow.label}
                  className="flex h-full flex-col gap-1 px-4 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <span className="truncate text-sm font-bold">{flow.short}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {flow.count} <span className="sr-only">components</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <Faq />

      {/* Closing call to action */}
      <section id="get-started" aria-labelledby="cta-heading" className="scroll-mt-20 border-t">
        <Reveal className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
          <span aria-hidden className="hazard-stripes-sm h-1 w-12 rounded-full" />
          <h2 id="cta-heading" className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            Put a bollard in front of every mistake.
          </h2>
          <p className="mt-4 max-w-lg text-pretty text-muted-foreground">
            Add one with the shadcn CLI. The source lands in your repo, MIT licensed, so every line is yours to change.
          </p>
          <InstallCommand registryBase={registryBase} name="type-to-confirm" className="mt-8 w-full max-w-[46rem] min-w-0" />
          <div className="mt-4 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/components" className={primary}>
              Browse components <ArrowRight aria-hidden className="size-4" />
            </Link>
            <a href={GITHUB_URL} className={outline}>
              <GithubIcon className="size-4" /> GitHub
            </a>
          </div>
        </Reveal>
      </section>
    </main>
  )
}
