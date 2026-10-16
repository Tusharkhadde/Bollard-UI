import { CodeBlock } from "@/components/site/code-block"
import { InstallCommand } from "@/components/site/install-command"
import { highlight } from "@/lib/highlight"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

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
    title: "Find the mistake",
    body: (
      <>
        Search by what goes wrong, like &ldquo;extra zero&rdquo; or &ldquo;pasted key&rdquo;, with{" "}
        <kbd className="rounded border bg-surface px-1 font-mono text-[11px] text-foreground">⌘K</kbd>, or browse by flow.
      </>
    ),
  },
  {
    title: "Add it with the CLI",
    body: "One shadcn command copies the source into your components folder. There is no Bollard UI package to install or update.",
  },
  {
    title: "It's your code",
    body: "Plain React and Tailwind on your shadcn theme. Restyle it, rename it, reword every message.",
  },
]

/** Three numbered steps in hairline cells, then the exact command and the code it gives you. */
export function HowItWorks({ registryBase }: { registryBase: string }) {
  return (
    <Section id="how-it-works" labelledBy="how-heading">
      <SectionHeading id="how-heading" eyebrow="How it works" title="Find it, add it, own it.">
        Bollard UI works the way shadcn/ui does: you add a component, and it becomes part of your app.
      </SectionHeading>
      <Reveal className="mt-12">
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2 bg-background p-6">
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                <span className="text-brand">0{i + 1}</span> / 03
              </span>
              <h3 className="mt-2 text-[15px] font-medium tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>
      <Reveal delay={0.06} className="mt-3 grid min-w-0 gap-3">
        <InstallCommand registryBase={registryBase} name="amount-input" className="w-full min-w-0" />
        <CodeBlock files={[{ path: "rent-field.tsx", source: usage, lines: usage.split("\n").length, code: highlight(usage) }]} />
      </Reveal>
    </Section>
  )
}
