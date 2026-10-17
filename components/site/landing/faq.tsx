import { Plus } from "lucide-react"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

const items: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it free?",
    a: "Yes. Every component is MIT licensed, free for personal and commercial projects. Keep the license notice and do what you like with the code.",
  },
  {
    q: "Does it need shadcn/ui?",
    a: "It needs a shadcn setup, not shadcn's components. The CLI uses your Tailwind v4 theme and copies the code into your app.",
  },
  {
    q: "How do I add a component?",
    a: "Run its shadcn CLI command. The source is copied into your project, and any extra dependencies are listed for you.",
  },
  {
    q: "Does it work with Next.js, Vite and Remix?",
    a: "Yes. It targets React 19 and Tailwind v4, and components are safe to render on the server.",
  },
  {
    q: "Can I customise it?",
    a: "Yes. The copied source belongs to your app: edit its styles, behavior and copy to fit your product.",
  },
]

/** Native <details> (the registry has no disclosure component): keyboard, find-in-page and screen readers work for free. */
export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions, answered." />
        <Reveal className="min-w-0">
          <div className="divide-y border-y">
            {items.map(({ q, a: answer }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 text-[15px] font-medium tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {q}
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
