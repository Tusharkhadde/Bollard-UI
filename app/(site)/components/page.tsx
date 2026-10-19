import type { Metadata } from "next"
import Link from "next/link"

import { Finder } from "@/components/site/finder"
import { catalogItems, categories, registryBase } from "@/lib/catalog"
import { FLOWS } from "@/lib/kits"

const description =
  "Search Bollard UI by the mistake you want to stop or the screen you're building: checkout, sign-up, settings, danger zone, India and more."

export const metadata: Metadata = {
  title: "Components",
  description,
  alternates: { canonical: "/components" },
  openGraph: { title: "Components · Bollard UI", description, url: "/components" },
  twitter: { card: "summary_large_image", title: "Components · Bollard UI", description },
}

export default function ComponentsPage() {
  return (
    <main className="px-4 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-10">
      <div className="max-w-[68rem]">
        <header className="mb-8 max-w-3xl">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <span aria-hidden className="h-px w-4 bg-brand" />
            Docs
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-[2.25rem]">Components</h1>
          <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
            Search by name or by the mistake you want to stop, or browse by where it happens. {catalogItems.length} copy-paste components in{" "}
            {categories.length} categories; a component can appear in several of the {FLOWS.length} flows. New here?{" "}
            <Link href="/start-here" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
              Start with the essentials
            </Link>
            .
          </p>
          <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
            Styled components use shadcn theme tokens with Tailwind v4. The headless hook works with any React UI library. All target React 19+;{" "}
            <Link href="/docs#nextjs" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">framework setup notes</Link> cover Next.js and Vite.
          </p>
        </header>
        <Finder registryBase={registryBase} />
      </div>
    </main>
  )
}
