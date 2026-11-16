import type { Metadata } from "next"
import Link from "next/link"

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
import { SitePreview } from "@/components/site/landing/site-preview"
import { UseCasePaths } from "@/components/site/landing/use-case-paths"
import { JsonLd } from "@/components/site/json-ld"
import { catalog, categories } from "@/lib/catalog"
import { HOME_FAQS } from "@/lib/home-faq"
import { FLOWS, flowHref, kitFor } from "@/lib/kits"
import { SITE_URL } from "@/lib/site"

const homeTitle = "shadcn React Components for Safer Forms & Risky Actions"
const homeDescription =
  "Copy-paste shadcn components for React form validation, email typo checks, and confirm dialogs that make risky actions easier to review."

export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: { title: homeTitle, description: homeDescription, url: "/", locale: "en_US" },
  twitter: { title: homeTitle, description: homeDescription },
}

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
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: "Bollard UI",
            url: SITE_URL,
            description: homeDescription,
            publisher: { "@id": `${SITE_URL}/#organization` },
            inLanguage: "en-US",
          },
          {
            "@type": "SoftwareSourceCode",
            "@id": `${SITE_URL}/#software-source-code`,
            name: "Bollard UI",
            description: homeDescription,
            url: SITE_URL,
            license: "https://opensource.org/license/mit",
            isAccessibleForFree: true,
            programmingLanguage: ["TypeScript", "React"],
            runtimePlatform: "React",
          },
          {
            "@type": "FAQPage",
            mainEntity: HOME_FAQS.map(({ question, answer }) => ({
              "@type": "Question",
              name: question,
              acceptedAnswer: { "@type": "Answer", text: answer },
            })),
          },
        ],
      }} />
      <Hero />
      <SitePreview />
      <Stats total={total} categories={categories.length} />
      <UseCasePaths />
      <IntegrationPaths />
      <StarterPacks />
      <Bento items={bentoItems} total={total} />
      <DisastersPrevented />
      <Flows flows={flows} />
      <HowItWorks />
      <WhyNot />
      <section aria-labelledby="comparison-guides-heading" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="comparison-guides-heading" className="text-xl font-semibold tracking-tight">Choose the tools that fit your React form</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Bollard UI vs Zod validation", "/guides/bollard-ui-vs-zod-validation"],
            ["Bollard UI vs React Hook Form", "/guides/bollard-ui-vs-react-hook-form"],
            ["Bollard UI vs confirm dialogs", "/guides/bollard-ui-vs-confirm-dialogs"],
          ].map(([label, href]) => <li key={href}><Link href={href} className="block rounded-xl border p-4 text-sm font-medium transition-colors hover:border-border-strong hover:bg-surface">{label}<span className="mt-1 block text-xs font-normal text-muted-foreground">See where the tools complement each other.</span></Link></li>)}
        </ul>
      </section>
      <Faq />
      <Cta />
    </main>
  )
}
