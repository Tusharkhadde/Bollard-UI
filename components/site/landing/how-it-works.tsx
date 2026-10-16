import { ShieldCheck, SquarePen, Terminal } from "lucide-react"

import { CodeBlock } from "@/components/site/code-block"
import { InstallCommand } from "@/components/site/install-command"
import { highlight } from "@/lib/highlight"

import { Reveal } from "./reveal"
import { SectionHeading } from "./section-heading"

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
    icon: Terminal,
    title: "Add it with the shadcn CLI",
    body: "One command copies the source into your components folder. There is no Bollard UI package to install or update.",
  },
  {
    icon: SquarePen,
    title: "Drop it in. It's your code",
    body: "Plain React and Tailwind on your shadcn theme. Restyle it, rename it, reword every message.",
  },
  {
    icon: ShieldCheck,
    title: "Catch one real mistake",
    body: "Each component targets a specific, costly slip, like an extra zero or a pasted key, and offers a fix where it can.",
  },
]

/** Three steps on the left, the exact command and usage on the right. */
export function HowItWorks({ registryBase }: { registryBase: string }) {
  return (
    <section aria-labelledby="how-heading" className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <Reveal>
          <SectionHeading id="how-heading" eyebrow="How it works" title="Install it, drop it in, stop the mistake.">
            Bollard UI works the way shadcn/ui does: you add a component, and it becomes part of your app.
          </SectionHeading>
          <ol className="mt-10 grid gap-7">
            {steps.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-card shadow-xs">
                  <Icon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold">
                    <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                    {title}
                  </h3>
                  <p className="mt-1 text-sm text-pretty text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={0.08} className="flex min-w-0 flex-col justify-center gap-3">
          <InstallCommand registryBase={registryBase} name="amount-input" className="h-11 w-full min-w-0 rounded-lg bg-card" />
          <CodeBlock files={[{ path: "rent-field.tsx", source: usage, lines: usage.split("\n").length, code: highlight(usage) }]} />
        </Reveal>
      </div>
    </section>
  )
}
