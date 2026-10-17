import { CodeBlock } from "@/components/site/code-block"
import { InstallCommand } from "@/components/site/install-command"
import Link from "next/link"

import { highlight } from "@/lib/highlight"
import { COMPAT } from "@/lib/site"

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

/** A short path from finding a guard to owning the copied source. */
export function HowItWorks({ registryBase }: { registryBase: string }) {
  return (
    <Section id="how-it-works" labelledBy="how-heading">
      <SectionHeading id="how-heading" eyebrow="How it works" title="Find it, add it, own it.">
        Bollard UI works the way shadcn/ui does: you add a component, and it becomes part of your app.
      </SectionHeading>
      <div className="mt-10 grid min-w-0 gap-10 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)] lg:gap-14">
        <Reveal>
          <ol className="divide-y border-y">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 py-5 first:pt-5 last:pb-5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border font-mono text-xs tabular-nums text-brand">
                  0{i + 1}
                </span>
                <span>
                  <h3 className="text-[15px] font-medium tracking-tight">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">{step.body}</p>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={0.06} className="grid min-w-0 gap-3">
          <p className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">Install a component</p>
          <InstallCommand registryBase={registryBase} name="amount-input" className="w-full min-w-0" />
          <p className="px-1 text-[13px] leading-relaxed text-pretty text-muted-foreground">
            Needs {COMPAT} (<code className="font-mono text-[12px] text-foreground">npx shadcn@latest init</code> once). The CLI writes{" "}
            <code className="font-mono text-[12px] text-foreground">components/ui/amount-input.tsx</code> and installs the packages it lists. Later
            changes don&apos;t reach your copy automatically:{" "}
            <Link href="/docs#updating" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
              how to update
            </Link>
            .
          </p>
          <CodeBlock files={[{ path: "rent-field.tsx", source: usage, lines: usage.split("\n").length, code: highlight(usage) }]} />
        </Reveal>
      </div>
    </Section>
  )
}
