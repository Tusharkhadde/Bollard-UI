import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"

import { CopyButton } from "@/components/site/copy-button"
import { cn } from "@/lib/utils"

import { LiveDemo, type ShowcaseName } from "./live-demo"
import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

/**
 * Component lab: a balanced grid of everyday fields, each backed by the real
 * registry component and its live warning or correction.
 */
const cards: { name: ShowcaseName; stage?: string }[] = [
  { name: "amount-input" },
  { name: "email-input" },
  { name: "phone-input" },
  { name: "password-input" },
  { name: "upi-id-input" },
  { name: "card-expiry-input" },
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
    <Section id="components" labelledBy="bento-heading" bordered={false} padding="pt-14 pb-20 sm:pt-20 sm:pb-28">
      <div className="flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading id="bento-heading" eyebrow="Component lab" title="Try the guard rails.">
          Each preview is a real component, loaded with a mistake it is built to catch.
        </SectionHeading>
        <div className="flex shrink-0 items-center gap-4 sm:mb-1">
          <span className="text-xs text-muted-foreground">{total} source components</span>
          <Link href="/components" className="group inline-flex items-center gap-1.5 rounded-md text-sm font-medium outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Browse catalog <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>
      </div>
      <ul className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-2 lg:grid-cols-3">
        {list.map((card, i) => (
          <Reveal
            as="li"
            key={card.name}
            delay={(i % 3) * 0.05}
            className={cn(
              "group/card flex min-w-0 flex-col overflow-hidden bg-card transition-colors duration-200 hover:bg-surface",
            )}
          >
            <div className="ink-amber bg-dots flex h-[22rem] items-center justify-center overflow-hidden border-b bg-surface px-5 py-8 sm:px-8 sm:py-10">
              <div className={cn("w-full", card.stage ?? "max-w-md")}>
                <LiveDemo name={card.name} />
              </div>
            </div>
            <div className="flex min-h-24 items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-medium tracking-tight">{card.title}</h3>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">Stops: {card.headline}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <CopyButton
                  value={`npx shadcn@4.21.0 add @bollard/${card.name}`}
                  label={`Copy ${card.title} install command`}
                  className="h-7 px-2 text-[11px]"
                >
                  Install
                </CopyButton>
                <Link
                  href={`/components/${card.name}`}
                  aria-label={`${card.title} docs`}
                  className="grid size-7 shrink-0 place-items-center rounded-md border text-muted-foreground outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
