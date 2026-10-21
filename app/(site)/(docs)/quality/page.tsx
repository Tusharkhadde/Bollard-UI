import type { Metadata } from "next"
import Link from "next/link"

import { DocPage, DocSection, Prose, inlineCode, proseLink } from "@/components/site/doc-page"
import { catalog, readProps } from "@/lib/catalog"
import { readRepoFile } from "@/lib/markdown"
import { links } from "@/lib/site"

const description = "What Bollard UI is built against, which checks run on every change, and what isn't verified yet. Only facts we can back up."

export const metadata: Metadata = {
  title: "Quality",
  description,
  alternates: { canonical: "/quality" },
  openGraph: { title: "Quality · Bollard UI", description, url: "/quality" },
}

const sections = [
  { id: "versions", label: "Built against" },
  { id: "checks", label: "Checks on every change" },
  { id: "review", label: "Review" },
  { id: "docs", label: "Documentation coverage" },
  { id: "not-yet", label: "Not verified yet" },
]

/** Versions as declared in package.json (ranges, read at build time). */
function versions() {
  try {
    const pkg = JSON.parse(readRepoFile("package.json") ?? "{}") as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    return (
      [
        ["React", "react"],
        ["Next.js (docs site)", "next"],
        ["Tailwind CSS", "tailwindcss"],
        ["TypeScript", "typescript"],
        ["shadcn CLI", "shadcn"],
      ] as const
    )
      .filter(([, key]) => all[key])
      .map(([label, key]) => ({ label, range: all[key] }))
  } catch {
    return []
  }
}

export default function QualityPage() {
  const list = versions()
  const node = readRepoFile(".nvmrc")?.trim()
  const ci = readRepoFile(".github/workflows/ci.yml")
  const total = catalog.length
  const count = (pick: (item: (typeof catalog)[number]) => unknown) => catalog.filter((item) => !!pick(item)).length
  const withProps = catalog.filter((item) => (readProps(item.name)?.props.length ?? 0) > 0).length
  const coverage = [
    { label: "Props table (extracted from the source)", n: withProps },
    { label: "Short summary and “What it catches”", n: count((i) => i.summary && i.catches?.length) },
    { label: "Accessibility notes", n: count((i) => i.a11y?.length) },
    { label: "Limitations", n: count((i) => i.limits?.length) },
    { label: "Server-side enforcement note", n: count((i) => i.server) },
    { label: "Rules with a verified date and source", n: count((i) => i.rules?.verified) },
  ]
  const rulesUnverified = count((i) => i.rules && !i.rules.verified)

  return (
    <DocPage
      title="Quality"
      lead="Only what we can back up: no coverage percentages, badges or usage numbers. If something here is wrong, please tell us."
      sections={sections}
    >
      <DocSection id="versions" title="Built against">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Declared versions</caption>
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-4 py-2.5 font-medium">Tool</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Declared version</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-4 py-2.5 font-normal">{row.label}</th>
                  <td className="px-4 py-2.5 font-mono text-[12.5px]">{row.range}</td>
                </tr>
              ))}
              {node && (
                <tr>
                  <th scope="row" className="px-4 py-2.5 font-normal">Node.js (CI)</th>
                  <td className="px-4 py-2.5 font-mono text-[12.5px]">{node}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Read from the project&apos;s <code className={inlineCode}>package.json</code> when this page was built. React 18 and Tailwind v3 are not targeted.
        </p>
      </DocSection>

      <DocSection id="checks" title="Checks on every change">
        <Prose>
          {ci ? (
            <>
              <p>A CI workflow runs on every push to main and every pull request:</p>
              <ol>
                <li>
                  regenerates <code className={inlineCode}>registry.json</code> from each component&apos;s metadata and fails if the committed file is out of
                  date;
                </li>
                <li>
                  runs the unit-test suite, ESLint, and strict TypeScript checking (<code className={inlineCode}>tsc --noEmit</code>);
                </li>
                <li>
                  runs the registry build and post-processing, which produces the <code className={inlineCode}>/r/&lt;name&gt;.json</code> files the CLI installs;
                </li>
                <li>
                  installs <code className={inlineCode}>file-guard</code> from the generated local registry into a temporary shadcn consumer and type-checks its component and helper imports;
                </li>
                <li>builds the docs site and runs browser journeys for a keyboard guard interaction, theme switch and narrow viewport.</li>
              </ol>
              <p>The repository is private for now, so CI results aren&apos;t public.</p>
              <p>
                These are repository-level checks, not a claim that every component has its own passing test. The consumer smoke covers one generated component and its helper targets; the browser check covers a few critical journeys only. Documentation counts below describe what is written, not behavior coverage.
              </p>
            </>
          ) : (
            <p>Each change is type-checked and the registry is rebuilt before release.</p>
          )}
        </Prose>
      </DocSection>

      <DocSection id="review" title="Review">
        <Prose>
          <p>
            Components are written to a shared{" "}
            <Link className={proseLink} href="/docs">
              set of conventions
            </Link>{" "}
            (labels, keyboard support, polite live regions, reduced motion, SSR safety, controlled and uncontrolled use). New components arrive in batches,
            and each batch gets a separate review pass, where the source is re-read and the demo is checked in light and dark mode, before it ships. The October
            2026 audit added the summaries, limitations, accessibility notes and server notes you see on component pages.
          </p>
        </Prose>
      </DocSection>

      <DocSection id="docs" title="Documentation coverage">
        <p className="text-sm text-muted-foreground">Counted from the registry when this page was built, out of {total} components.</p>
        <ul className="divide-y overflow-hidden rounded-xl border">
          {coverage.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm sm:px-5">
              <span>{row.label}</span>
              <span className="font-mono text-[12.5px] text-muted-foreground tabular-nums">
                {row.n} / {total}
              </span>
            </li>
          ))}
        </ul>
        {rulesUnverified > 0 && (
          <p className="text-[13px] text-muted-foreground">
            {rulesUnverified} rule-bearing {rulesUnverified === 1 ? "component says" : "components say"} plainly that its rules are not yet verified.
          </p>
        )}
      </DocSection>

      <DocSection id="not-yet" title="Not verified yet">
        <Prose>
          <ul>
            <li>Browser checks cover a small critical path, not every component, assistive technology or browser engine.</li>
            <li>No published clean-install matrix across Vite, custom aliases and Windows yet.</li>
            <li>Installable registry component sources are not included in the ESLint gate yet; the current registry-wide baseline has untriaged React compiler and JSX findings.</li>
            <li>No recorded screen-reader test results; accessibility notes describe what the source does.</li>
            <li>No stable or experimental status labels yet.</li>
          </ul>
          <p>
            Found a gap?{" "}
            <a className={proseLink} href={links.issues}>
              Tell us
            </a>{" "}
            and it goes in the{" "}
            <Link className={proseLink} href="/changelog">
              changelog
            </Link>{" "}
            when it is fixed.
          </p>
        </Prose>
      </DocSection>
    </DocPage>
  )
}
