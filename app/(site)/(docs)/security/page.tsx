import type { Metadata } from "next"
import Link from "next/link"

import { DocPage, DocSection, Note, Prose, inlineCode, proseLink } from "@/components/site/doc-page"
import { catalog, registryBase } from "@/lib/catalog"
import { CONTACT_EMAIL, REPO_PUBLIC, REPO_URL, SECURITY_HREF } from "@/lib/site"

const description =
  "How to report a vulnerability in Bollard UI privately, what is in scope, and why UI guard rails never replace server-side enforcement."

export const metadata: Metadata = {
  title: "Security",
  description,
  alternates: { canonical: "/security" },
  openGraph: { title: "Security · Bollard UI", description, url: "/security" },
}

const sections = [
  { id: "report", label: "Report a vulnerability" },
  { id: "scope", label: "Scope" },
  { id: "versions", label: "Supported versions" },
  { id: "guard-rails", label: "Guard rails vs enforcement" },
]

export default function SecurityPage() {
  const withServerNote = catalog.filter((item) => item.server)
  return (
    <DocPage title="Security" lead="Please report security problems privately. Bollard UI components are UX guard rails; your server still has the final say." sections={sections}>
      <DocSection id="report" title="Report a vulnerability">
        <Prose>
          <p>
            Don&apos;t post security problems publicly. Email{" "}
            <a className={proseLink} href={SECURITY_HREF}>
              {CONTACT_EMAIL}
            </a>{" "}
            with &ldquo;Bollard UI security&rdquo; in the subject
            {REPO_PUBLIC ? (
              <>
                , or use{" "}
                <a className={proseLink} href={`${REPO_URL}/security/advisories/new`}>
                  GitHub&apos;s private vulnerability reporting
                </a>
              </>
            ) : null}
            . Include:
          </p>
          <ul>
            <li>the component (or the docs site) and when you installed it,</li>
            <li>what an attacker can do and how,</li>
            <li>steps or a minimal example to reproduce it.</li>
          </ul>
          <p>
            You can expect an acknowledgement within 3 working days and an update on the fix within 14 days. Once a fix ships you&apos;ll be credited in the{" "}
            <Link className={proseLink} href="/changelog">
              changelog
            </Link>
            , unless you&apos;d rather stay anonymous.
          </p>
        </Prose>
      </DocSection>

      <DocSection id="scope" title="Scope">
        <Prose>
          <p>
            <strong className="font-medium text-foreground">In scope:</strong> a component that leaks data it was meant to protect (for example a secret field
            or paste guard that exposes the value), cross-site scripting through component props or rendered content, and anything in the docs site or
            registry files that could harm visitors or people installing components.
          </p>
          <p>
            <strong className="font-medium text-foreground">Out of scope:</strong> components used in ways their docs warn against, a guard rail being
            bypassed by someone who controls the browser (that is expected; see below), and issues in third-party dependencies (report those upstream, and
            tell us if a component needs updating).
          </p>
          <p>
            Several demos contain fake, deliberately invalid keys (such as <code className={inlineCode}>AKIAIOSFODNN7EXAMPLE</code>) to show secret detection.
            They aren&apos;t real credentials.
          </p>
        </Prose>
      </DocSection>

      <DocSection id="versions" title="Supported versions">
        <Prose>
          <p>
            Components are source you copy, so fixes land in the registry at <code className={inlineCode}>{registryBase}&lt;name&gt;.json</code>. Only the
            latest version of each component is supported. To pick up a fix, re-run the add command for that component and review the diff (
            <Link className={proseLink} href="/docs#updating">
              how to update
            </Link>
            ).
          </p>
        </Prose>
      </DocSection>

      <DocSection id="guard-rails" title="Guard rails vs enforcement">
        <Note tone="brand">
          Everything here runs in the user&apos;s browser. A cooldown, a type-to-confirm dialog, a two-person approval screen or a secret-paste warning helps
          honest users avoid mistakes; it cannot stop someone who edits the page, opens a new tab, clears storage or calls your API directly.
        </Note>
        <Prose>
          <p>Enforce the same rule on the server, where it can&apos;t be skipped:</p>
          <ul>
            <li>validation and database constraints for values,</li>
            <li>authorization and re-authentication checks for sensitive actions,</li>
            <li>rate limits and cooldowns for repeat actions,</li>
            <li>idempotency keys for payments and other submits that must happen once,</li>
            <li>approvals recorded and checked by the backend for two-person rules and agent tool calls.</li>
          </ul>
          {withServerNote.length > 0 && (
            <p>
              Component pages with a server-side note say exactly what to enforce. For example:{" "}
              {withServerNote.slice(0, 8).map((item, i) => (
                <span key={item.name}>
                  {i > 0 && ", "}
                  <Link className={proseLink} href={`/components/${item.name}#limitations`}>
                    {item.title}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </Prose>
      </DocSection>
    </DocPage>
  )
}
