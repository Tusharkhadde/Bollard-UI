import { Plus } from "lucide-react"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"
import { HOME_FAQS } from "@/lib/home-faq"

/** Native <details> (the registry has no disclosure component): keyboard, find-in-page and screen readers work for free. */
export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered." />
        <Reveal className="min-w-0">
          <div className="divide-y border-y">
            {HOME_FAQS.map(({ question, answer }) => (
              <details key={question} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 text-[15px] font-medium tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {question}
                  <Plus aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" />
                </summary>
                <div className="pr-8 pb-5 text-[15px] leading-relaxed text-pretty text-muted-foreground">{answer}</div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
