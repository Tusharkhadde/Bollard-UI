import Image from "next/image"
import Link from "next/link"

import { buttonPrimary } from "@/components/site/button-styles"
import { Section, SectionHeading } from "./section-heading"

export function SitePreview() {
  return (
    <Section labelledBy="site-preview-heading" className="bg-surface/50">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-16">
        <div>
          <SectionHeading id="site-preview-heading" eyebrow="A look around" title="Safety patterns, ready to explore.">
            Browse focused components, try the interactive examples, and copy the install command that fits your project.
          </SectionHeading>
          <Link href="/components" className={`${buttonPrimary} mt-7`}>
            Explore the components
          </Link>
        </div>
        <figure className="overflow-hidden rounded-xl border bg-background shadow-[0_24px_70px_-36px_rgb(0_0_0/0.5)]">
          <Image
            src="/images/website-preview.png"
            width={875}
            height={768}
            sizes="(max-width: 1023px) 100vw, 64vw"
            alt="Bollard UI homepage preview showing the navigation, component search, and an interactive transfer safety example."
            className="block h-auto w-full"
          />
          <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            A snapshot of the Bollard UI homepage and transfer-safety preview.
          </figcaption>
        </figure>
      </div>
    </Section>
  )
}
