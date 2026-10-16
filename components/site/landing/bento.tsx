import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { LiveDemo, type ShowcaseName } from "./live-demo"
import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

/** Bento layout: a tall SQL card on the left of a 6-col grid, two stacked on the right, three below. */
const cards: { name: ShowcaseName; span: string; stage?: string }[] = [
  { name: "sql-guard", span: "md:col-span-2 lg:col-span-4 lg:row-span-2", stage: "max-w-xl" },
  { name: "type-to-confirm", span: "lg:col-span-2" },
  { name: "cooldown-button", span: "lg:col-span-2" },
  { name: "upi-id-input", span: "lg:col-span-2" },
  { name: "homoglyph-guard", span: "lg:col-span-2" },
  { name: "card-expiry-input", span: "md:col-span-2 lg:col-span-2" },
]

export type BentoItem = { name: string; title: string; headline: string }

/** Six live components, each with a mistake already in it, captioned with the mistake it stops. */
export function Bento({ items, total }: { items: BentoItem[]; total: number }) {
  const byName = new Map(items.map((item) => [item.name, item]))
  const list = cards.flatMap((card) => {
    const item = byName.get(card.name)
    return item ? [{ ...item, ...card }] : []
  })
  return (
    <Section id="components" labelledBy="bento-heading">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading id="bento-heading" eyebrow="Live components" title="Every card is the real thing.">
          Each one already has a mistake in it. Try to get it past.
        </SectionHeading>
        <Link
          href="/components"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm font-medium outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:mb-1"
        >
          All {total} components
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
      <ul className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
        {list.map((card, i) => (
          <Reveal
            as="li"
            key={card.name}
            delay={(i % 3) * 0.05}
            className={cn(
              "group/card flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow,translate] duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.18)] motion-reduce:hover:translate-y-0 dark:hover:shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]",
              card.span,
            )}
          >
            <div className="bg-dots flex flex-1 items-center justify-center border-b bg-surface px-5 py-8 sm:px-8 sm:py-10">
              <div className={cn("w-full", card.stage ?? "max-w-md")}>
                <LiveDemo name={card.name} />
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-medium tracking-tight">{card.title}</h3>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">Stops: {card.headline}</p>
              </div>
              <Link
                href={`/components/${card.name}`}
                aria-label={`${card.title} docs`}
                className="grid size-7 shrink-0 place-items-center rounded-md border text-muted-foreground outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
