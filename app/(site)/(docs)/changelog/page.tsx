import type { Metadata } from "next"
import Link from "next/link"

import { DocPage, Prose, proseLink } from "@/components/site/doc-page"
import { readRepoFile, renderMarkdown } from "@/lib/markdown"
import { REPO_PUBLIC } from "@/lib/site"

const description = "What changed in Bollard UI, release by release, and which components each change touches."

export const metadata: Metadata = {
  title: "Changelog",
  description,
  alternates: { canonical: "/changelog" },
  openGraph: { title: "Changelog · Bollard UI", description, url: "/changelog" },
}

export default function ChangelogPage() {
  const source = readRepoFile("CHANGELOG.md") ?? "# Changelog\n\nNo entries yet."
  // While the repository is private, links into it would 404, so they render as plain text.
  const { blocks, headings } = renderMarkdown(source, { allowLink: (url) => REPO_PUBLIC || !url.includes("github.com/Tusharkhadde/") })
  return (
    <DocPage
      title="Changelog"
      lead={
        <>
          Components live in your project, so changes never reach your copy on their own. Each entry names what it touches;{" "}
          <Link className={proseLink} href="/docs#updating">
            here is how to update
          </Link>
          .
        </>
      }
      sections={headings}
    >
      <Prose className="pt-4">{blocks}</Prose>
    </DocPage>
  )
}
