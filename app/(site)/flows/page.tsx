import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, ArrowRight } from "lucide-react"

import { JsonLd } from "@/components/site/json-ld"
import { catalog } from "@/lib/catalog"
import { FLOWS } from "@/lib/kits"
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Application Flows & Mistake Prevention",
  description: "Browse 341 React guardrail components grouped by flow: checkout, sign-up, danger zone, settings, dev tools, India, scheduling, and forms.",
  alternates: { canonical: "/flows" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `Application Flows & Mistake Prevention | ${SITE_NAME}`,
    description: "Browse 341 React guardrail components grouped by flow: checkout, sign-up, danger zone, settings, dev tools, India, scheduling, and forms.",
    url: absoluteUrl("/flows"),
  },
}

export default function FlowsIndexPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Flows", item: absoluteUrl("/flows") },
        ],
      },
      {
        "@type": "CollectionPage",
        name: "Application Flows & Mistake Prevention",
        description: "Browse copy-paste React components that stop expensive user mistakes across key application flows.",
        url: absoluteUrl("/flows"),
      },
    ],
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <JsonLd data={structuredData} />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          <li>
            <Link href="/" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              Home
            </Link>
          </li>
          <li aria-hidden><ChevronRight className="size-3.5 shrink-0 opacity-60" /></li>
          <li aria-current="page" className="truncate text-foreground font-medium">
            Flows
          </li>
        </ol>
      </nav>

      <header className="space-y-4 border-b pb-8">
        <p className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          <span aria-hidden className="h-px w-4 bg-brand" />
          Browse by User Journey
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl text-foreground">
          Application Flows & Form Guardrails
        </h1>
        <div className="rounded-xl border border-brand/40 bg-brand/[0.04] p-5">
          <p className="text-[15.5px] leading-relaxed text-foreground/90 font-medium">
            Bollard UI components are organized by the moment mistakes happen in production: during checkout, sign-up, destructive account changes, communication, or cloud operations. Explore dedicated flow hubs to find guardrails for your screen.
          </p>
        </div>
      </header>

      <div className="grid gap-6 pt-8 sm:grid-cols-2 lg:grid-cols-3">
        {FLOWS.map((flow) => {
          const count = catalog.filter((item) => (item.flows ?? []).includes(flow.id)).length
          const href = flow.id === "india" ? "/india" : `/flows/${flow.id}`
          return (
            <Link
              key={flow.id}
              href={href}
              className="group flex flex-col justify-between rounded-xl border p-6 transition-colors hover:border-border-strong hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">
                  {count} components
                </span>
                <h2 className="text-xl font-semibold text-foreground group-hover:underline">
                  {flow.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Stop expensive user mistakes during {flow.label.toLowerCase()} before form submission.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-foreground pt-4 border-t">
                Explore flow <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
