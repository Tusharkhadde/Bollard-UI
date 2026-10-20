"use client"

import Link from "next/link"
import { ArrowRight, Bot, CreditCard, OctagonAlert } from "lucide-react"

import { trackUseCaseSelected } from "@/lib/analytics"
import { USE_CASES } from "@/lib/use-cases"
import { Section, SectionHeading } from "./section-heading"

const icons = { "safe-payments": CreditCard, "danger-zone": OctagonAlert, "agent-approvals": Bot } as const

/** Directs high-intent visitors to a page written for the risky flow they are building. */
export function UseCasePaths() {
  return (
    <Section id="use-cases" labelledBy="use-cases-heading" padding="pt-6 pb-14 sm:pt-8 sm:pb-16" bordered={false}>
      <SectionHeading id="use-cases-heading" eyebrow="Build for the risky moment" title="Start with the action that needs a guard rail.">
        Focused recipes for the three flows where a generic input or confirmation dialog often falls short.
      </SectionHeading>
      <ul className="mt-7 grid overflow-hidden rounded-xl border bg-border md:grid-cols-3">
        {USE_CASES.map((useCase) => {
          const Icon = icons[useCase.slug]
          return (
            <li key={useCase.slug} className="min-w-0 border-b bg-background last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0">
              <Link
                href={`/use-cases/${useCase.slug}`}
                onClick={() => trackUseCaseSelected({ useCase: useCase.slug, surface: "homepage" })}
                className="group flex h-full flex-col p-5 outline-none transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:p-6"
              >
                <span aria-hidden className="grid size-9 place-items-center rounded-lg border bg-card text-brand"><Icon className="size-4" /></span>
                <p className="mt-5 font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground uppercase">{useCase.eyebrow}</p>
                <h3 className="mt-2 text-base font-semibold tracking-tight">{useCase.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{useCase.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-foreground">See the recipe <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
