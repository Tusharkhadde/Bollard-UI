import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { DocPage, DocSection, Note, Prose, proseLink } from "@/components/site/doc-page"
import { PackageCommand } from "@/components/site/package-command"
import { GUIDES, guideFor } from "@/lib/guides"

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
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideFor((await params).slug)
  if (!guide) notFound()
  return (
    <DocPage eyebrow="Implementation guide" title={guide.title} lead={guide.description} sections={[{ id: "solution", label: "The component" }, { id: "install", label: "Install" }, { id: "implementation", label: "Implementation" }]}>
      <DocSection id="solution" title="The mistake this stops">
        <Note tone="brand">{guide.mistake}</Note>
        <Prose><p>{guide.outcome}</p><p><Link href={`/components/${guide.component}`} className={proseLink}>Read the {guide.componentTitle} component docs</Link> for its live preview, API, accessibility notes, dependencies, and limitations.</p></Prose>
      </DocSection>
      <DocSection id="install" title="Install the component">
        <PackageCommand kind="add" args={`https://bollard-ui.vercel.app/r/${guide.component}.json`} label={`Copy install command for ${guide.componentTitle}`} />
      </DocSection>
      <DocSection id="implementation" title="Use it safely">
        <Prose><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol></Prose>
      </DocSection>
    </DocPage>
  )
}
