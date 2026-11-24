import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { CodeBlock } from "@/components/site/code-block"
import { highlight } from "@/lib/highlight"

import { InstallPill } from "./install-pill"
import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

const config = `{
  "registries": {
    "@bollard": "https://bollard-ui.vercel.app/r/{name}.json"
  }
}`

const usage = `import { AmountInput } from "@/components/ui/amount-input"

export function RentField() {
  return (
    <AmountInput
      label="Monthly rent"
      locale="en-IN"
      currency="INR"
      typical={24000} // 2,40,000 asks "Extra zero?"
    />
  )
}`

const steps = [
  {
    title: "Add the registry once",
    body: (
      <>
        Merge the <code className="font-mono text-[12.5px] text-foreground">@bollard</code> namespace into your{" "}
        <code className="font-mono text-[12.5px] text-foreground">components.json</code>.
      </>
    ),
  },
  {
    title: "Install the guard you need",
    body: "The shadcn CLI copies the source into your project and installs what it lists. No runtime package to keep in sync.",
    pill: true,
  },
  {
    title: "Drop it in",
    body: "Use it like any input. Your theme, your copy, your server rules; edit the source whenever you like.",
  },
]

/** Section 7: three steps beside the code that does them. */
export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-heading">
      <Reveal>
        <SectionHeading id="how-heading" eyebrow="How it works" title="Three steps. Then it's your code.">
          Bollard works like shadcn/ui: source you own, styled by your Tailwind theme. Keeping your own inputs? Attach the{" "}
          <Link href="/components/use-bollard-field" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
            headless field hook
          </Link>{" "}
          instead.
        </SectionHeading>
      </Reveal>
      <div className="mt-12 grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <ol className="relative grid gap-8">
          <span aria-hidden className="absolute top-4 bottom-4 left-[0.9375rem] w-px bg-gradient-to-b from-brand/60 via-border to-transparent" />
          {steps.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 0.06} className="relative flex gap-4">
              <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border bg-background font-mono text-xs font-medium text-brand tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 pt-1">
                <h3 className="text-[15px] font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">{step.body}</p>
                {step.pill && <InstallPill name="amount-input" surface="how-it-works" size="sm" className="mt-3" />}
              </div>
            </Reveal>
          ))}
          <Reveal as="li" delay={0.2} className="pl-12">
            <Link href="/docs" className="group inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              Full setup guide <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </Reveal>
        </ol>
        <Reveal delay={0.06} className="min-w-0">
          <CodeBlock
            className="shadow-[0_30px_70px_-45px_rgb(0_0_0/0.5)]"
            files={[
              { path: "rent-field.tsx", source: usage, lines: usage.split("\n").length, code: highlight(usage) },
              { path: "components.json", source: config, lines: config.split("\n").length, code: highlight(config) },
            ]}
          />
        </Reveal>
      </div>
    </Section>
  )
}
