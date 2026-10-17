import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

/**
 * Keep hyphenated words ("lakh-aware", "sign-up") on one line. A nowrap span rather
 * than U+2011, so the hyphen stays Geist's own glyph and copy-paste stays a plain "-".
 */
function keepHyphenated(text: string) {
  return text.split(/(\S+-\S+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

export type FlowCard = { id: string; label: string; count: number; blurb?: string; href: string }

/** The nine flows from lib/kits as a hairline 3×3 grid, each with its component count and kit blurb. */
export function Flows({ flows }: { flows: FlowCard[] }) {
  return (
    <Section id="flows" labelledBy="flows-heading">
      <SectionHeading id="flows-heading" eyebrow="Browse by flow" title="Start from the screen you're building.">
        Checkout, sign-up, settings, the danger zone. Every component is filed under the places its mistake happens, so one component can appear in several flows.
      </SectionHeading>
      <Reveal className="mt-12">
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <li key={flow.id} className="min-w-0 bg-background">
              <Link
                href={flow.href}
                className="group flex h-full flex-col gap-2 p-5 outline-none transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:p-6"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15px] font-medium tracking-tight">{flow.label}</span>
                  <span className="inline-flex h-5 min-w-[2.75rem] shrink-0 items-center justify-center rounded-full border px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {flow.count}
                    <span className="sr-only"> components</span>
                  </span>
                </span>
                {flow.blurb && <span className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{keepHyphenated(flow.blurb)}</span>}
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
                  Browse
                  <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  )
}
