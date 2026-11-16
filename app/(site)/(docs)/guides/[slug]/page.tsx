import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ArticleByline } from "@/components/site/article-byline"
import { DocPage, DocSection, Note, Prose, proseLink } from "@/components/site/doc-page"
import { CodeBlock } from "@/components/site/code-block"
import { JsonLd } from "@/components/site/json-ld"
import { PackageCommand } from "@/components/site/package-command"
import { articleSchema } from "@/lib/article-metadata"
import { GUIDES, guideFor } from "@/lib/guides"
import { highlight } from "@/lib/highlight"
import { SITE_URL } from "@/lib/site"

export const dynamicParams = false

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = guideFor((await params).slug)
  if (!guide) return {}
  const path = `/guides/${guide.slug}`
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: { type: "article", title: `${guide.title} · Bollard UI`, description: guide.description, url: path },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description, images: [`${SITE_URL}/opengraph-image`] },
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideFor((await params).slug)
  if (!guide) notFound()
  const example = { path: `${guide.component}.tsx`, source: guide.example, lines: guide.example.split("\n").length, code: highlight(guide.example) }
  return (
    <DocPage eyebrow="Implementation guide" title={guide.title} lead={guide.description} sections={[{ id: "solution", label: "The component" }, { id: "example", label: "React example" }, { id: "install", label: "Install" }, { id: "implementation", label: "Implementation" }]}>
      <JsonLd data={articleSchema(`/guides/${guide.slug}`, guide.title, guide.description)} />
      <ArticleByline />
      <DocSection id="solution" title="The mistake this stops">
        <Note tone="brand">{guide.mistake}</Note>
        <Prose><p>{guide.outcome}</p><p><Link href={`/components/${guide.component}`} className={proseLink}>Read the {guide.componentTitle} component docs</Link> for its live preview, API, accessibility notes, dependencies, and limitations.</p></Prose>
      </DocSection>
      <DocSection id="example" title={`React example: ${guide.componentTitle}`}>
        <Prose><p>Install the component, connect it to the action in your app, and keep the server responsible for validating and authorizing the request.</p></Prose>
        <CodeBlock files={[example]} />
      </DocSection>
      <DocSection id="install" title="Install the component">
        <PackageCommand kind="add" args={`${SITE_URL}/r/${guide.component}.json`} label={`Copy install command for ${guide.componentTitle}`} />
      </DocSection>
      <DocSection id="implementation" title="Use it safely">
        <Prose><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol></Prose>
      </DocSection>
    </DocPage>
  )
}
