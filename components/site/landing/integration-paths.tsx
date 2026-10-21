import Link from "next/link"
import { ArrowRight, Braces, PanelsTopLeft } from "lucide-react"

import { InstallCommand } from "@/components/site/install-command"

import { Section, SectionHeading } from "./section-heading"

const paths = [
  {
    name: "amount-input",
    title: "Use a ready-made component",
    label: "SHADCN + TAILWIND",
    description: "Add a Bollard component with its shadcn styling, then edit the copied source to fit your product.",
    icon: PanelsTopLeft,
    href: "/docs#cli",
    action: "See component setup",
  },
  {
    name: "use-bollard-field",
    title: "Keep your existing controls",
    label: "HEADLESS · ANY REACT UI",
    description: "Connect field validation to shadcn, HeroUI, or custom controls. Your markup and styling stay yours.",
    icon: Braces,
    href: "/components/use-bollard-field",
    action: "See the headless hook",
  },
] as const

export function IntegrationPaths() {
  return (
    <Section id="start-with-your-stack" labelledBy="integration-paths-heading" padding="pt-10 pb-14 sm:pt-12 sm:pb-16" bordered={false}>
      <div className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-7">
        <SectionHeading id="integration-paths-heading" eyebrow="Start with your stack" title="Pick the way you build.">
          Install a styled guardrail or add validation to the controls you already use.
        </SectionHeading>
        <Link href="/docs" className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Read setup docs <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
      <ul className="mt-5 grid gap-3 lg:grid-cols-2">
        {paths.map(({ name, title, label, description, icon: Icon, href, action }) => (
          <li key={name} className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground">
                  <Icon className="size-4" />
                </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">{label}</p>
                <h3 className="mt-1 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-1 text-[13px] leading-5 text-pretty text-muted-foreground">{description}</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] font-medium text-muted-foreground">Install from the registry</p>
            <InstallCommand name={name} className="mt-2 rounded-lg" />
            <Link href={href} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {action} <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
