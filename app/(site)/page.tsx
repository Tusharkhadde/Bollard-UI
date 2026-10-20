import type { Metadata } from "next"

import { Bento } from "@/components/site/landing/bento"
import { Cta } from "@/components/site/landing/cta"
import { Faq } from "@/components/site/landing/faq"
import { Flows } from "@/components/site/landing/flows"
import { Hero } from "@/components/site/landing/hero"
import { IntegrationPaths } from "@/components/site/landing/integration-paths"
import { HowItWorks } from "@/components/site/landing/how-it-works"
import { Stats } from "@/components/site/landing/stats"
import { WhyNot } from "@/components/site/landing/why-not"
import { DisastersPrevented } from "@/components/site/landing/disasters-prevented"
import { StarterPacks } from "@/components/site/landing/starter-packs"
import { catalog, categories, registryBase } from "@/lib/catalog"
import { FLOWS, flowHref, kitFor } from "@/lib/kits"

export const metadata: Metadata = { alternates: { canonical: "/" } }

export default function Home() {
  const total = catalog.length
  const flows = FLOWS.map((flow) => ({
    id: flow.id,
    label: flow.label,
    href: flowHref(flow.id),
    blurb: kitFor(flow.id)?.blurb,
    count: catalog.filter((item) => item.flows?.includes(flow.id)).length,
  })).filter((flow) => flow.count > 0)
  const bentoItems = catalog.map((item) => ({ name: item.name, title: item.title, headline: item.headline ?? item.description }))

  return (
    <main className="overflow-x-clip">
      <Hero registryBase={registryBase} />
      <Stats total={total} categories={categories.length} />
      <IntegrationPaths registryBase={registryBase} />
      <StarterPacks registryBase={registryBase} />
      <Bento items={bentoItems} total={total} registryBase={registryBase} />
      <DisastersPrevented />
      <Flows flows={flows} />
      <HowItWorks registryBase={registryBase} />
      <WhyNot />
      <Faq />
      <Cta registryBase={registryBase} />
    </main>
  )
}
