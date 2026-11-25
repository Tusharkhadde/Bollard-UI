import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, ArrowRight } from "lucide-react"

import { ComponentFaqSection } from "@/components/site/component-faq"
import { JsonLd } from "@/components/site/json-ld"
import { PackageCommand } from "@/components/site/package-command"
import { catalog } from "@/lib/catalog"
import { FLOWS, kitFor, type FlowId } from "@/lib/kits"
import { absoluteUrl, SAME_AS_PROFILES, SITE_NAME, SITE_URL } from "@/lib/site"

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

const FLOW_FAQS: Record<string, { question: string; answer: string }[]> = {
  checkout: [
    {
      question: "How do I prevent double-clicks from charging customers twice in React?",
      answer: "Use Safe Submit (`safe-submit`) to lock the submit button the instant it is clicked and generate an idempotency key header. Install with `npx shadcn@4.21.0 add @bollard/safe-submit`. Limitation: the payment gateway and backend must process the idempotency key to prevent network replays.",
    },
    {
      question: "How do I catch extra zeros in currency input fields?",
      answer: "Amount Input (`amount-input`) compares the entered number to a typical baseline and warns if the user entered 10x or 100x the expected magnitude. Install with `npx shadcn@4.21.0 add @bollard/amount-input`. Limitation: does not enforce bank balance or credit limits.",
    },
    {
      question: "How do I validate card expiration dates before payment submission?",
      answer: "Card Expiry Input (`card-expiry-input`) auto-formats MM/YY and flags expired dates immediately. Install with `npx shadcn@4.21.0 add @bollard/card-expiry-input`. Limitation: does not verify bank card status or account validity.",
    },
    {
      question: "How do I show customers a clear readback of line items before checkout?",
      answer: "Review Step (`review-step`) displays a final confirmation summary table before checkout. Install with `npx shadcn@4.21.0 add @bollard/review-step`. Limitation: prices and inventory must still be verified on the server.",
    },
  ],
  "signup-login": [
    {
      question: "How do I detect email domain typos like gmial.com in React?",
      answer: "Email Input (`email-input`) suggests known domain corrections like gmail.com without rewriting what the user typed. Install with `npx shadcn@4.21.0 add @bollard/email-input`. Limitation: format checking does not guarantee the mailbox is active or owned by the registrant.",
    },
    {
      question: "How do I prevent OTP paste errors in authentication flows?",
      answer: "OTP Paste Input (`otp-paste-input`) splits pasted verification codes across discrete inputs without dropping digits. Install with `npx shadcn@4.21.0 add @bollard/otp-paste-input`. Limitation: OTP generation and rate limiting must be managed by your auth provider.",
    },
    {
      question: "How do I warn users about weak or compromised passwords?",
      answer: "Password Policy Input (`password-policy-input`) checks password rules and mismatches locally. Install with `npx shadcn@4.21.0 add @bollard/password-policy-input`. Limitation: do not rely on client rules alone; enforce policy in the backend.",
    },
    {
      question: "How do I handle international phone numbers and prefixes?",
      answer: "Phone Input (`phone-input`) standardizes country dialing codes and E.164 formats. Install with `npx shadcn@4.21.0 add @bollard/phone-input`. Limitation: does not confirm line connectivity without SMS verification.",
    },
  ],
  "danger-zone": [
    {
      question: "Why are standard 'Are you sure?' confirm dialogs ineffective for destructive actions?",
      answer: "Users develop confirmation fatigue and automatically click OK without reading the prompt text. Use Type to Confirm (`type-to-confirm`) to require typing the resource slug. Install with `npx shadcn@4.21.0 add @bollard/type-to-confirm`. Limitation: typed input is a UI guard, not permission authorization.",
    },
    {
      question: "How do I prevent stray clicks on high-risk admin buttons?",
      answer: "Hold to Confirm (`hold-to-confirm`) requires pressing and holding the button for 2-3 seconds before triggering. Install with `npx shadcn@4.21.0 add @bollard/hold-to-confirm`. Limitation: long presses can be simulated by automated scripts.",
    },
    {
      question: "How do I provide a safe undo window after deletion?",
      answer: "Undo Toast (`undo-toast`) delays permanent deletion by 5 to 10 seconds, allowing users to cancel an accidental click. Install with `npx shadcn@4.21.0 add @bollard/undo-toast`. Limitation: requires soft-delete or staging queues on the backend.",
    },
    {
      question: "How do I clearly display which resources will be affected by a destructive action?",
      answer: "Account Deletion Readback (`account-deletion-readback`) itemizes deleted workspaces, members, and data before confirming. Install with `npx shadcn@4.21.0 add @bollard/account-deletion-readback`. Limitation: actual cascade deletion logic belongs in database transactions.",
    },
  ],
  "account-settings": [
    {
      question: "How do I warn users when they navigate away from an unsaved form?",
      answer: "Unsaved Changes Bar (`unsaved-changes-bar`) monitors dirty form state and shows a persistent warning bar before page unloads. Install with `npx shadcn@4.21.0 add @bollard/unsaved-changes-bar`. Limitation: browser tab crashes cannot be intercepted.",
    },
    {
      question: "How do I confirm email changes with re-authentication?",
      answer: "Email Change Guard (`email-change-guard`) makes email updates explicit and reversible. Install with `npx shadcn@4.21.0 add @bollard/email-change-guard`. Limitation: ownership and session verification must be enforced on the backend.",
    },
    {
      question: "How do I safely show active sessions and revoke devices?",
      answer: "Session List (`session-list`) displays device type, IP, and location for active logins with instant revoke triggers. Install with `npx shadcn@4.21.0 add @bollard/session-list`. Limitation: session token revocation must be handled by your session store or Redis.",
    },
    {
      question: "How do I prevent accidental timezone mismatches in user profiles?",
      answer: "Timezone Picker (`timezone-picker`) detects browser and saved timezone choices for profile flows. Install with `npx shadcn@4.21.0 add @bollard/timezone-picker`. Limitation: users traveling between regions must explicitly confirm changes.",
    },
  ],
  forms: [
    {
      question: "How do I prevent form drafts from being lost on accidental reload?",
      answer: "Draft Restore (`draft-restore`) saves form values to local storage and offers a one-click restore prompt on return. Install with `npx shadcn@4.21.0 add @bollard/draft-restore`. Limitation: do not cache sensitive data like credit cards or SSNs in browser storage.",
    },
    {
      question: "How do I track form submission progress and highlight missing required fields?",
      answer: "Form Progress (`form-progress`) indicates completion percentages and directs focus to incomplete fields on submit. Install with `npx shadcn@4.21.0 add @bollard/form-progress`. Limitation: complex business validation rules still require schema validation.",
    },
    {
      question: "How do I handle hidden form fields submitting stale values?",
      answer: "Hidden Field Guard (`hidden-field-guard`) checks hidden and conditional inputs to ensure clean payloads. Install with `npx shadcn@4.21.0 add @bollard/hidden-field-guard`. Limitation: always filter received payloads on the API layer.",
    },
    {
      question: "How do I prevent users from submitting a form before uploads finish?",
      answer: "Upload Wait (`upload-wait`) disables submit buttons while background file uploads are actively processing. Install with `npx shadcn@4.21.0 add @bollard/upload-wait`. Limitation: failed uploads must provide a clear retry option.",
    },
  ],
  messaging: [
    {
      question: "How do I prevent accidental 'Reply All' emails to company-wide distribution lists?",
      answer: "Reply All Guard (`reply-all-guard`) alerts when an email reply expands the recipient audience. Install with `npx shadcn@4.21.0 add @bollard/reply-all-guard`. Limitation: mail server routing rules enforce final delivery.",
    },
    {
      question: "How do I catch accidentally pasted API keys or secrets before sending messages?",
      answer: "Secret Paste Guard (`secret-paste-guard`) detects regex patterns matching AWS keys, GitHub tokens, and private keys. Install with `npx shadcn@4.21.0 add @bollard/secret-paste-guard`. Limitation: proprietary or custom token formats may require custom regex patterns.",
    },
    {
      question: "How do I alert users when sending messages to external domains?",
      answer: "External Link (`external-link`) flags links that leave the expected trusted scope. Install with `npx shadcn@4.21.0 add @bollard/external-link`. Limitation: email aliases must be resolved by your email server.",
    },
    {
      question: "How do I remind users about forgotten attachments mentioned in text?",
      answer: "Attachment Nudge (`attachment-nudge`) reminds users when draft text mentions an attachment without a file. Install with `npx shadcn@4.21.0 add @bollard/attachment-nudge`. Limitation: it does not verify that an attached file contains the correct contents.",
    },
  ],
  devtools: [
    {
      question: "How do I prevent executing dangerous database commands against production?",
      answer: "Environment Badge (`environment-badge`) displays prominent visual banners and confirmation steps for production environments. Install with `npx shadcn@4.21.0 add @bollard/environment-badge`. Limitation: cloud IAM permissions and read-only database replicas are required for security.",
    },
    {
      question: "How do I stop accidental git force-pushes in web developer portals?",
      answer: "Force Push Confirm (`force-push-confirm`) requires explicit typing and reason entry before running force pushes. Install with `npx shadcn@4.21.0 add @bollard/force-push-confirm`. Limitation: Git branch protection rules must be configured in your Git provider.",
    },
    {
      question: "How do I prevent runaway database queries in internal SQL runners?",
      answer: "SQL Guard (`sql-guard`) checks SQL statements for missing WHERE clauses and destructive patterns. Install with `npx shadcn@4.21.0 add @bollard/sql-guard`. Limitation: database statement timeouts must be configured on the database engine.",
    },
    {
      question: "How do I warn developers before pasting shell commands from untrusted sites?",
      answer: "Curl Pipe Guard (`curl-pipe-guard`) detects shell pipelines that may execute downloaded code. Install with `npx shadcn@4.21.0 add @bollard/curl-pipe-guard`. Limitation: developers must review pasted script contents.",
    },
  ],
  scheduling: [
    {
      question: "How do I prevent confusion between MM/DD and DD/MM date formats?",
      answer: "Unambiguous Date (`unambiguous-date`) writes months out as words (e.g. '04 Apr 2026') to eliminate ambiguity. Install with `npx shadcn@4.21.0 add @bollard/unambiguous-date`. Limitation: canonical timestamps must still be formatted as ISO 8601 (YYYY-MM-DD).",
    },
    {
      question: "How do I prevent scheduling meetings across conflicting timezones?",
      answer: "Meeting Time Spread (`meeting-time-spread`) compares attendee timezones and flags poor meeting windows. Install with `npx shadcn@4.21.0 add @bollard/meeting-time-spread`. Limitation: calendar availability APIs must verify actual free/busy slots.",
    },
    {
      question: "How do I detect overlapping bookings in appointment forms?",
      answer: "Event Overlap (`event-overlap`) flags double-booked time windows in real time. Install with `npx shadcn@4.21.0 add @bollard/event-overlap`. Limitation: backend booking APIs must use serializable database transactions to prevent race conditions.",
    },
    {
      question: "How do I validate recurring schedule frequencies?",
      answer: "Recurring Charge Readback (`recurring-charge-readback`) displays the next charge schedule before saving. Install with `npx shadcn@4.21.0 add @bollard/recurring-charge-readback`. Limitation: recurrence end dates must be bounded on the server.",
    },
  ],
  india: [
    {
      question: "How do I validate 12-digit Aadhaar numbers without violating UIDAI privacy rules?",
      answer: "Aadhaar Input (`aadhaar-input`) groups 12 digits into 4-digit blocks, masks the first 8 digits, and validates the Verhoeff checksum. Install with `npx shadcn@4.21.0 add @bollard/aadhaar-input`. Limitation: client format checks do not verify identity; government OTP verification is required.",
    },
    {
      question: "How do I validate Indian IFSC bank codes in React?",
      answer: "IFSC Input (`ifsc-input`) ensures the 11-character format (4 letters, 0, 6 characters) and displays the resolved bank branch name. Install with `npx shadcn@4.21.0 add @bollard/ifsc-input`. Limitation: bank branch directories change; payment gateways must verify routing eligibility.",
    },
    {
      question: "How do I validate UPI IDs without falsely rejecting valid custom domains?",
      answer: "UPI ID Input (`upi-id-input`) validates the username@bank format and looks up verified payee names before payment. Install with `npx shadcn@4.21.0 add @bollard/upi-id-input`. Limitation: NPCI handle lists change; never block a well-formed handle solely because it is unlisted in client code.",
    },
    {
      question: "How do I format currency amounts with Indian Lakh and Crore numbering?",
      answer: "Amount Input (`amount-input`) formatted with `locale=\"en-IN\"` displays ₹5,00,000 correctly and catches misplaced extra zeros. Install with `npx shadcn@4.21.0 add @bollard/amount-input`. Limitation: server must validate transfer amounts in paise.",
    },
  ],
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
  const flowFaqs = FLOW_FAQS[slug] || []

  const structuredData = {
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
          { "@type": "ListItem", position: 2, name: "Flows", item: `${SITE_URL}/flows` },
          { "@type": "ListItem", position: 3, name: flow.label, item: absoluteUrl(canonicalPath) },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl(canonicalPath)}#webpage`,
        name: info.title,
        description: info.answer,
        url: absoluteUrl(canonicalPath),
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#publisher` },
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
      ...(flowFaqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              "@id": `${absoluteUrl(canonicalPath)}#faq`,
              mainEntity: flowFaqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
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

      {/* Frequently Asked Questions */}
      {flowFaqs.length > 0 && (
        <section aria-labelledby="flow-faq-heading" className="mt-14 border-t pt-10 space-y-4">
          <h2 id="flow-faq-heading" className="text-xl font-semibold tracking-tight text-foreground">
            Frequently Asked Questions about {flow.label} Guardrails
          </h2>
          <ComponentFaqSection faqs={flowFaqs} componentTitle={flow.label} />
        </section>
      )}

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
