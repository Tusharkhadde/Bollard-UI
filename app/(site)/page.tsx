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
import { FactsTable } from "@/components/site/facts-table"
import { catalog, categories } from "@/lib/catalog"
import { getSiteFacts } from "@/lib/facts"
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
  const bentoItems = catalog.map((item) => ({ name: item.name, title: item.title, headline: item.headline ?? item.description }))

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
      <section aria-labelledby="featured-guides-heading" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 id="featured-guides-heading" className="text-xl font-semibold tracking-tight">Practical React form safety guides</h2>
          <Link href="/guides" className="text-sm font-medium text-muted-foreground hover:text-foreground">Browse all guides →</Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Prevent Duplicate Submissions", "/guides/react-prevent-duplicate-form-submit", "Eliminate double clicks, duplicate charges, and lost timeout state with safe submits."],
            ["India Form Validation", "/guides/react-india-form-validation", "Guide entry for Aadhaar, IFSC, UPI IDs, PIN codes, and lakh-aware numbers."],
            ["Type to Confirm Dialogs", "/guides/react-type-to-confirm-dialog", "Require conscious intent for irreversible actions with accessible typed phrases."],
          ].map(([label, href, detail]) => (
            <li key={href}>
              <Link href={href} className="block rounded-xl border p-4 text-sm font-medium transition-colors hover:border-border-strong hover:bg-surface">
                {label}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="about-bollard-heading" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 border-t border-border/50">
        <div className="max-w-3xl space-y-3">
          <h2 id="about-bollard-heading" className="text-xl font-semibold tracking-tight">
            About Bollard UI
          </h2>
          <p className="text-[15px] leading-7 text-muted-foreground">
            Bollard UI is an open-source registry of copy-paste React components built by{" "}
            <a href="https://github.com/Tusharkhadde" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4 hover:text-foreground/80">
              Tushar Khadde
            </a>{" "}
            (<a href="https://x.com/devtushark" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4 hover:text-foreground/80">@devtushark</a>) to stop expensive user mistakes in web applications. Unlike schema validation libraries like Zod that enforce types on submit or blur, and unlike generic modal dialogs that people dismiss on autopilot, Bollard UI provides proactive, inline UX guardrails—catching extra zeros in currency fields, detecting mistyped email domains, and requiring typed confirmations for destructive actions—right inside your existing shadcn and Tailwind setup. Learn more on our{" "}
            <Link href="/about" className="text-foreground underline underline-offset-4 hover:text-foreground/80">
              about page
            </Link>
            .
          </p>
        </div>
      </section>
      <section aria-labelledby="facts-heading" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 border-t border-border/50">
        <h2 id="facts-heading" className="text-xl font-semibold tracking-tight text-foreground mb-4">
          Bollard UI Facts & Technical Specifications
        </h2>
        <FactsTable facts={getSiteFacts()} title="" />
      </section>
      <Faq />
      <Cta />
    </main>
  )
}
