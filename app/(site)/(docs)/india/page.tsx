import type { Metadata } from "next"
import Link from "next/link"

import { DocPage } from "@/components/site/doc-page"
import { JsonLd } from "@/components/site/json-ld"
import { catalog } from "@/lib/catalog"
import { absoluteUrl, SAME_AS_PROFILES, SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "India Form Components for React",
  description: "Browse React components for Aadhaar, IFSC, UPI IDs, PIN codes, +91 phone numbers and lakh-aware INR amounts.",
  alternates: { canonical: "/india" },
}

export default function IndiaPage() {
  const components = catalog.filter((item) => (item.flows ?? []).includes("india"))
  return (
    <DocPage eyebrow="India" title="India-aware form components" lead="A focused collection for common Indian form and payment details. These components guide entry and review; authoritative identity, address and payment checks still belong to your server or provider.">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#publisher`,
              name: "Bollard UI",
              url: SITE_URL,
              logo: `${SITE_URL}/icon.svg`,
              sameAs: SAME_AS_PROFILES,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "India Forms", item: absoluteUrl("/india") },
              ],
            },
            {
              "@type": "CollectionPage",
              "@id": `${absoluteUrl("/india")}#webpage`,
              name: "India Form Components for React",
              description: "Browse React components for Aadhaar, IFSC, UPI IDs, PIN codes, +91 phone numbers and lakh-aware INR amounts.",
              url: absoluteUrl("/india"),
              isPartOf: { "@id": `${SITE_URL}/#website` },
              publisher: { "@id": `${SITE_URL}/#publisher` },
            },
          ],
        }}
      />
      <div className="space-y-7 pt-8">
        <p className="max-w-3xl text-[15px] leading-7 text-muted-foreground">Start with the practical guide to <Link className="underline underline-offset-4 hover:text-foreground" href="/guides/react-india-form-validation">React form validation for India</Link>. It covers Aadhaar privacy, IFSC and UPI verification boundaries, six-digit PIN codes, +91 phone entry and lakh-aware amounts with examples.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {components.map((item) => (
            <li key={item.name}><Link href={`/components/${item.name}`} className="group block rounded-xl border p-4 transition-colors hover:border-border-strong hover:bg-surface">
              <span className="font-medium group-hover:underline">{item.title}</span>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.summary ?? item.description}</p>
            </Link></li>
          ))}
        </ul>
      </div>
    </DocPage>
  )
}
