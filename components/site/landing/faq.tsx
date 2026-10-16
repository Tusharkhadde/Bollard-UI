import { Plus } from "lucide-react"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

const code = "rounded border bg-surface px-1 py-0.5 font-mono text-[0.85em] text-foreground"

const items: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it free?",
    a: "Yes. Every component is MIT licensed, free for personal and commercial projects. Keep the license notice and do what you like with the code.",
  },
  {
    q: "Does it need shadcn/ui?",
    a: (
      <>
        It needs a shadcn/ui setup, not shadcn&apos;s components. Run <code className={code}>npx shadcn@latest init</code> once for Tailwind v4, the
        theme variables and the <code className={code}>cn()</code> helper. That is all Bollard UI uses from it.
      </>
    ),
  },
  {
    q: "Do I need to install a package?",
    a: "No. The CLI copies the component's source into your project. Most components need only React and lucide-react. When one needs more, such as motion or date-fns, its registry entry lists it, the CLI installs it, and the component's page shows exactly what it needs.",
  },
  {
    q: "Does it work with Next.js, Vite and Remix?",
    a: (
      <>
        Yes, anywhere the shadcn CLI works with React 19 and Tailwind v4. Components carry <code className={code}>&quot;use client&quot;</code> where they
        use hooks and never touch <code className={code}>window</code> or <code className={code}>document</code> during render, so server rendering is safe.
      </>
    ),
  },
  {
    q: "Is it accessible?",
    a: "That is part of every component's brief: real labels, full keyboard support, warnings announced politely while you type, alerts only for real errors, and motion that respects reduced-motion settings. If you find a gap, please report it.",
  },
  {
    q: "Can I customise it?",
    a: "Completely. It is your file. Components use the standard shadcn theme tokens, so they follow your theme, accept className and native props, and every message a user sees is a prop with an English default you can reword or translate.",
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
            {items.map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 text-[15px] font-medium tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" />
                </summary>
                <div className="pr-8 pb-5 text-[15px] leading-relaxed text-pretty text-muted-foreground">{a}</div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
