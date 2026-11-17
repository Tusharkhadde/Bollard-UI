import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, ArrowRight } from "lucide-react"

import { JsonLd } from "@/components/site/json-ld"
import { PackageCommand } from "@/components/site/package-command"
import { catalog } from "@/lib/catalog"
import { FLOWS, kitFor, type FlowId } from "@/lib/kits"
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site"

export const dynamicParams = false

export function generateStaticParams() {
  return FLOWS.map((flow) => ({ slug: flow.id }))
}

const FLOW_INTROS: Record<string, { eyebrow: string; title: string; answer: string; queries: string }> = {
  checkout: {
    eyebrow: "Payment & Checkout Guardrails",
    title: "React Checkout Components for Payment Safety",
    answer: "Checkout and payment components stop accidental extra zeros, duplicate submit double-charges, expired cards, and surprise totals before transactions reach your payment gateway. Each component installs with shadcn and pairs with server-side idempotency.",
    queries: "react checkout components, payment validation, extra zero prevention",
  },
  "signup-login": {
    eyebrow: "Authentication & Onboarding",
    title: "React Sign-up & Login Form Guardrails",
    answer: "Sign-up and login components catch typo-prone email addresses, unreachable phone numbers, weak passwords, and fumbled OTP paste values before accounts are created. They keep the user's input intact while guiding corrections.",
    queries: "react signup components, login validation, email typo detection",
  },
  "account-settings": {
    eyebrow: "Account Security & Preferences",
    title: "React Account Settings & Profile Guardrails",
    answer: "Account settings components guard email changes, active user sessions, recovery contacts, and unsaved form modifications. They ensure deliberate changes and re-authentication gates for high-risk account operations.",
    queries: "react account settings components, unsaved changes bar, session management",
  },
  "danger-zone": {
    eyebrow: "Destructive Action Safety",
    title: "React Danger Zone & Destructive Confirmation",
    answer: "Danger zone components replace generic 'Are you sure?' dialogs with explicit typed acknowledgements, deletion readbacks, and recovery windows. They eliminate habitual autopilot confirmation clicks on irreversible actions.",
    queries: "react type to confirm, destructive action dialog, danger zone component",
  },
  forms: {
    eyebrow: "General Data Entry",
    title: "React Form Guardrails & Mistake Prevention",
    answer: "Form validation guardrails prevent lost drafts, double submits, hidden field errors, and ambiguous date inputs. They run fast inline validation on the client while treating your server as the ultimate authority.",
    queries: "react form components, duplicate submit prevention, draft restore",
  },
  messaging: {
    eyebrow: "Communication & Collaboration",
    title: "React Messaging & Sharing Guardrails",
    answer: "Messaging guardrails warn against unintended reply-all sends, external domain recipients on internal threads, forgotten attachments, and accidentally pasted secrets or API keys before messages are broadcast.",
    queries: "react reply all warning, recipient check, secret paste guard",
  },
  devtools: {
    eyebrow: "Developer Tools & Cloud Infra",
    title: "React Dev Tools & Infrastructure Guardrails",
    answer: "Developer tools guardrails prevent running dangerous actions against production by mistake, accidental git force-pushes, unbounded database queries, and piped curl-to-bash terminal scripts.",
    queries: "react environment badge, force push confirm, kube context guard",
  },
  scheduling: {
    eyebrow: "Dates & Timezones",
    title: "React Date & Scheduling Guardrails",
    answer: "Scheduling guardrails eliminate MM/DD versus DD/MM date confusion, detect cross-timezone meeting mismatches, and flag overlapping calendar bookings before appointments are confirmed.",
    queries: "react unambiguous date, timezone picker, schedule overlap check",
  },
  india: {
    eyebrow: "India Specific Identifiers",
    title: "React Form Validation Components for India",
    answer: "India-aware form components guide formatted entry for 12-digit Aadhaar, 11-character IFSC, UPI IDs, 6-digit postal PIN codes, +91 phone numbers, and lakh/crore currency amounts.",
    queries: "react india form validation, aadhaar input, upi id validation, ifsc react",
  },
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const flow = FLOWS.find((f) => f.id === slug)
  if (!flow) return {}

  const title = `${flow.label}: React Form Guardrails`
  const description = `Copy-paste React components and guardrails for ${flow.label.toLowerCase()}. Stop expensive user mistakes before submit. MIT licensed shadcn components.`
  const canonicalPath = slug === "india" ? "/india" : `/flows/${slug}`

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(canonicalPath),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  }
}

export default async function FlowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const flow = FLOWS.find((f) => f.id === slug)
  if (!flow) notFound()

  const info = FLOW_INTROS[slug] || {
    eyebrow: "Flow Hub",
    title: `${flow.label} React Guardrails`,
    answer: `Copy-paste React components designed specifically to stop mistakes during ${flow.label.toLowerCase()}.`,
    queries: flow.label.toLowerCase(),
  }

  const items = catalog.filter((item) => (item.flows ?? []).includes(slug as FlowId))
  const kit = kitFor(slug)
  const canonicalPath = slug === "india" ? "/india" : `/flows/${slug}`

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Flows", item: `${SITE_URL}/flows` },
          { "@type": "ListItem", position: 3, name: flow.label, item: absoluteUrl(canonicalPath) },
        ],
      },
      {
        "@type": "CollectionPage",
        name: info.title,
        description: info.answer,
        url: absoluteUrl(canonicalPath),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: items.length,
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.title,
            url: absoluteUrl(`/components/${item.name}`),
          })),
        },
      },
    ],
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <JsonLd data={structuredData} />
      
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          <li>
            <Link href="/" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              Home
            </Link>
          </li>
          <li aria-hidden><ChevronRight className="size-3.5 shrink-0 opacity-60" /></li>
          <li>
            <Link href="/flows" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              Flows
            </Link>
          </li>
          <li aria-hidden><ChevronRight className="size-3.5 shrink-0 opacity-60" /></li>
          <li aria-current="page" className="truncate text-foreground font-medium">
            {flow.label}
          </li>
        </ol>
      </nav>

      {/* Header & Direct Answer Block */}
      <header className="space-y-4 border-b pb-8">
        <p className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          <span aria-hidden className="h-px w-4 bg-brand" />
          {info.eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl text-foreground">
          {info.title}
        </h1>
        {/* Direct Answer Block (AEO / GEO target) */}
        <div className="rounded-xl border border-brand/40 bg-brand/[0.04] p-5">
          <p className="text-[15.5px] leading-relaxed text-foreground/90 font-medium">
            {info.answer}
          </p>
        </div>
      </header>

      {/* Starter Pack CTA if applicable */}
      {kit && (
        <section aria-labelledby="pack-heading" className="my-8 rounded-xl border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 id="pack-heading" className="text-lg font-semibold">{kit.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{kit.blurb}</p>
            </div>
            <PackageCommand kind="add" args={`${SITE_URL}/r/${slug}-pack.json`} label={`Copy ${kit.title} install command`} />
          </div>
        </section>
      )}

      {/* Components in this flow */}
      <section aria-labelledby="components-heading" className="space-y-6 pt-4">
        <div className="flex items-baseline justify-between">
          <h2 id="components-heading" className="text-2xl font-semibold tracking-tight">
            Components in {flow.label} ({items.length})
          </h2>
          <span className="text-xs text-muted-foreground">React 19+ · Tailwind v4 · shadcn</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.name}
              href={`/components/${item.name}`}
              className="group flex flex-col justify-between rounded-xl border p-5 transition-colors hover:border-border-strong hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground group-hover:underline">{item.title}</span>
                  <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
                    {item.integration === "headless" ? "Headless" : "Styled"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                  {item.summary ?? item.description}
                </p>
              </div>

              {item.stops && (
                <div className="mt-4 flex items-center justify-between pt-3 border-t text-xs">
                  <span className="text-muted-foreground truncate max-w-[28ch]">
                    Stops: <span className="text-foreground/90">{item.stops}</span>
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Cross-linking other flow hubs */}
      <footer className="mt-16 border-t pt-8 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Explore other application flows:</h3>
        <ul className="flex flex-wrap gap-2">
          {FLOWS.filter((f) => f.id !== slug).map((f) => (
            <li key={f.id}>
              <Link
                href={f.id === "india" ? "/india" : `/flows/${f.id}`}
                className="inline-flex h-8 items-center rounded-lg border px-3 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground transition-colors"
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </footer>
    </div>
  )
}
