import type { Metadata } from "next"
import Link from "next/link"

import { DocPage, DocSection, Prose, proseLink, inlineCode } from "@/components/site/doc-page"
import { JsonLd } from "@/components/site/json-ld"
import { SITE_URL, GITHUB_URL, TWITTER_HANDLE, CONTACT_EMAIL } from "@/lib/site"

const aboutTitle = "About Bollard UI"
const aboutDescription =
  "Learn about Bollard UI, the open-source React component registry created by Tushar Khadde to stop expensive user mistakes in forms and risky actions."

export const metadata: Metadata = {
  title: aboutTitle,
  description: aboutDescription,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `${aboutTitle} | Bollard UI`,
    description: aboutDescription,
    url: "/about",
  },
  twitter: {
    title: `${aboutTitle} | Bollard UI`,
    description: aboutDescription,
  },
}

export default function AboutPage() {
  return (
    <DocPage
      eyebrow="About"
      title="About Bollard UI"
      lead="Bollard UI is an open-source registry of copy-paste React components designed to catch expensive human mistakes in forms, checkouts, and destructive actions before they happen."
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "AboutPage",
              "@id": `${SITE_URL}/about#webpage`,
              url: `${SITE_URL}/about`,
              name: "About Bollard UI",
              description: aboutDescription,
              isPartOf: { "@id": `${SITE_URL}/#website` },
            },
            {
              "@type": "Person",
              "@id": `${SITE_URL}/#author`,
              name: "Tushar Khadde",
              url: "https://github.com/Tusharkhadde",
              sameAs: [
                "https://github.com/Tusharkhadde",
                `https://x.com/${TWITTER_HANDLE.replace("@", "")}`,
              ],
              jobTitle: "Creator & Maintainer",
              worksFor: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "Bollard UI",
              url: SITE_URL,
              logo: `${SITE_URL}/icon.svg`,
              founder: { "@id": `${SITE_URL}/#author` },
              sameAs: [
                GITHUB_URL,
                `https://x.com/${TWITTER_HANDLE.replace("@", "")}`,
              ],
            },
          ],
        }}
      />

      <div className="space-y-12 pt-8">
        <DocSection id="creator" title="Who builds Bollard UI">
          <Prose>
            <p>
              Bollard UI is conceived, designed, and maintained by{" "}
              <a
                href="https://github.com/Tusharkhadde"
                target="_blank"
                rel="noreferrer"
                className={proseLink}
              >
                Tushar Khadde
              </a>{" "}
              (
              <a
                href={`https://x.com/${TWITTER_HANDLE.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className={proseLink}
              >
                {TWITTER_HANDLE}
              </a>
              ).
            </p>
            <p>
              The project was born out of real-world production incidents where simple typos or ambiguous UI prompts caused substantial financial loss, customer churn, and database corruption. Rather than treating safety as an afterthought or burying users under generic warning popups, Bollard UI provides deliberate, ergonomic front-end guardrails that feel native to modern React workflows.
            </p>
          </Prose>
        </DocSection>

        <DocSection id="mission" title="The mission: Stopping preventable UI disasters">
          <Prose>
            <p>
              In maritime and civil engineering, a <em>bollard</em> is a sturdy, grounded post designed to prevent vehicles from colliding into pedestrian zones and to moor ships safely against unexpected surges.
            </p>
            <p>
              Bollard UI serves the exact same role in web software: it acts as a sturdy structural guardrail for risky user interactions. Typical points of failure include:
            </p>
            <ul>
              <li>
                <strong>Currency inputs:</strong> Users inadvertently typing an extra zero (turning $1,000 into $10,000) or misreading commas and decimal points across international numbering systems.
              </li>
              <li>
                <strong>Email signups:</strong> Prospective customers mistyping common domains (such as <code className={inlineCode}>gmial.com</code> or <code className={inlineCode}>con</code> instead of <code className={inlineCode}>com</code>), resulting in failed signups and undelivered receipts.
              </li>
              <li>
                <strong>Destructive operations:</strong> Engineers or admins deleting entire customer workspaces because a popup asked &quot;Are you sure?&quot; and their finger clicked OK on autopilot.
              </li>
              <li>
                <strong>Duplicate submissions:</strong> Buyers double-clicking purchase buttons during momentary network latency, triggering dual credit card charges.
              </li>
            </ul>
          </Prose>
        </DocSection>

        <DocSection id="differences" title="How Bollard UI differs from validation and dialogs">
          <Prose>
            <p>
              It is common to confuse UX guardrails with schema validation or modal dialogs, but they address entirely different failure modes:
            </p>
            <ul>
              <li>
                <strong>Complementary to Zod:</strong> Zod validates shape and type constraints at form boundaries (e.g. &quot;is this string an integer?&quot;). It cannot detect whether a valid $10,000 transfer was intended to be $1,000. Bollard UI warns the user before submission about surprising values while keeping Zod schemas intact.
              </li>
              <li>
                <strong>Complementary to React Hook Form:</strong> React Hook Form manages form state, dirty tracking, and submission event lifecycles. Bollard UI components are drop-in UI controls that seamlessly plug into React Hook Form via standard props or <code className={inlineCode}>Controller</code>.
              </li>
              <li>
                <strong>Superior to generic confirm dialogs:</strong> Generic &quot;Are you sure?&quot; modals condition users to click the primary action without reading. Bollard UI utilizes cognitive friction—such as requiring users to type the exact repository slug or hold a button for three seconds—forcing conscious intent for irreversible actions.
              </li>
            </ul>
          </Prose>
        </DocSection>

        <DocSection id="architecture" title="Architecture and engineering principles">
          <Prose>
            <p>
              Bollard UI follows modern React and web platform best practices:
            </p>
            <ul>
              <li>
                <strong>Copy-paste ownership:</strong> Like shadcn/ui, code lives directly in your repository. You own the markup, styling, and behavior. There are no black-box node_modules dependencies.
              </li>
              <li>
                <strong>Built for modern React:</strong> Fully compatible with React 19+, Next.js App Router Server Components, Vite, and Tailwind CSS v4.
              </li>
              <li>
                <strong>Full accessibility:</strong> Every component is engineered with appropriate WAI-ARIA attributes, focus traps, screen-reader announcements, and keyboard navigability.
              </li>
              <li>
                <strong>Server-first security boundary:</strong> Client guardrails assist honest users; they never substitute for server authorization, cryptographic signatures, or database constraints.
              </li>
            </ul>
          </Prose>
        </DocSection>

        <DocSection id="license-contact" title="License and contact">
          <Prose>
            <p>
              Bollard UI is 100% open-source and released under the{" "}
              <Link className={proseLink} href="/license">
                MIT License
              </Link>
              . You are free to use it in commercial applications, open-source projects, or internal tools without restriction.
            </p>
            <p>
              To report security vulnerabilities, share feedback, or propose component patterns, reach out directly at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={proseLink}>
                {CONTACT_EMAIL}
              </a>{" "}
              or open an issue on the{" "}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className={proseLink}
              >
                GitHub repository
              </a>
              .
            </p>
          </Prose>
        </DocSection>
      </div>
    </DocPage>
  )
}
