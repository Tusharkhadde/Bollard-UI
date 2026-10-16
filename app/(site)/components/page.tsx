import type { Metadata } from "next"

import { Finder } from "@/components/site/finder"
import { catalogItems, registryBase } from "@/lib/catalog"

export const metadata: Metadata = {
  title: "Components",
  description:
    "Search Bollard UI by the mistake you want to stop or the screen you're building: checkout, sign-up, settings, danger zone, India and more.",
}

export default function ComponentsPage() {
  return (
    <main className="px-4 py-8 sm:px-8 lg:py-10">
      <header className="mb-5 max-w-3xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Components</h1>
        <p className="text-pretty text-muted-foreground">
          {catalogItems.length} components. Search by name or by the mistake you want to stop, or browse by flow below.
        </p>
      </header>
      <Finder registryBase={registryBase} />
    </main>
  )
}
