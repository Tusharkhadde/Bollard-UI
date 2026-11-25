import type { Metadata } from "next"

import { Cta } from "@/components/site/landing/cta"
import { Faq } from "@/components/site/landing/faq"
import { FlowCards } from "@/components/site/landing/flow-cards"
import { HomeHero } from "@/components/site/landing/home-hero"
import { HowItWorks } from "@/components/site/landing/how-it-works"
import { PlaygroundSection } from "@/components/site/landing/playground-section"
import { StarterPacks } from "@/components/site/landing/starter-packs"
import { TrustStrip } from "@/components/site/landing/trust-strip"
import { UseCasePaths } from "@/components/site/landing/use-case-paths"
import { WithoutWith } from "@/components/site/landing/without-with"
import { JsonLd } from "@/components/site/json-ld"
import { catalog } from "@/lib/catalog"
import { HOME_FAQS } from "@/lib/home-faq"
import { FLOWS, flowHref, kitFor } from "@/lib/kits"
import { ARTICLE_DATE_MODIFIED } from "@/lib/article-metadata"
import { GITHUB_URL, SAME_AS_PROFILES, DISAMBIGUATING_DESCRIPTION, SITE_URL } from "@/lib/site"

const homeTitle = "Bollard UI: shadcn React Components for Safer Forms"
const homeDescription =
  "Copy-paste shadcn components for React form validation, email typo checks, and confirm dialogs that make risky actions easier to review."

export const metadata: Metadata = {
  title: {
    absolute: homeTitle,
  },
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

  return (
    <main className="overflow-x-clip">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Person",
            "@id": `${SITE_URL}/#author`,
            name: "Tushar Khadde",
            url: "https://github.com/Tusharkhadde",
            sameAs: SAME_AS_PROFILES,
            jobTitle: "Creator & Maintainer",
          },
          {
            "@type": "Organization",
            "@id": `${SITE_URL}/#publisher`,
            name: "Bollard UI",
            url: SITE_URL,
            logo: `${SITE_URL}/icon.svg`,
            founder: { "@id": `${SITE_URL}/#author` },
            sameAs: SAME_AS_PROFILES,
          },
          {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: "Bollard UI",
            url: SITE_URL,
            description: homeDescription,
            publisher: { "@id": `${SITE_URL}/#publisher` },
            inLanguage: "en-US",
          },
          {
            "@type": "SoftwareSourceCode",
            "@id": `${SITE_URL}/#library`,
            name: "Bollard UI",
            alternateName: ["Bollard UI", "bollard-ui", "@bollard registry"],
            description: homeDescription,
            disambiguatingDescription: DISAMBIGUATING_DESCRIPTION,
            url: SITE_URL,
            codeRepository: GITHUB_URL,
            license: "https://opensource.org/licenses/MIT",
            programmingLanguage: "TypeScript",
            runtimePlatform: "React",
            softwareRequirements: "React 19+, Tailwind CSS v4, shadcn CLI",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            isAccessibleForFree: true,
            author: { "@id": `${SITE_URL}/#publisher` },
            publisher: { "@id": `${SITE_URL}/#publisher` },
            dateModified: `${ARTICLE_DATE_MODIFIED}T00:00:00Z`,
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
      <HomeHero total={total} />
      <TrustStrip total={total} />
      <UseCasePaths />
      <PlaygroundSection />
      <WithoutWith />
      <FlowCards flows={flows} />
      <StarterPacks />
      <HowItWorks />
      <Faq />
      <Cta />
    </main>
  )
}
