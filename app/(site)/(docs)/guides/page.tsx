import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { DocPage } from "@/components/site/doc-page"
import { GUIDES } from "@/lib/guides"

const description = "Practical React and shadcn/ui guides for preventing duplicate submissions, safer deletes, email mistakes, UPI input problems and async field errors."

export const metadata: Metadata = {
  title: "React form and safety guides",
  description,
  alternates: { canonical: "/guides" },
  openGraph: { title: "React form and safety guides · Bollard UI", description, url: "/guides" },
}

export default function GuidesPage() {
  return (
    <DocPage eyebrow="Guides" title="Build safer React forms and actions" lead="Start with the problem you are implementing. Each guide points to a working component, explains the boundary between client guidance and server enforcement, and ends with the exact install command.">
      <ul className="grid gap-3 pt-8 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link href={`/guides/${guide.slug}`} className="group flex h-full flex-col gap-2 rounded-xl border p-4 outline-none transition-colors hover:border-border-strong hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span className="flex items-start justify-between gap-3 text-sm font-medium">
                <span>{guide.title}</span>
                <ArrowRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none" />
              </span>
              <span className="text-[13px] leading-5 text-muted-foreground">{guide.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DocPage>
  )
}
