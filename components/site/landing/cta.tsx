import { ArrowRight } from "lucide-react"

import { buttonOutline, buttonPrimary } from "@/components/site/button-styles"
import { GithubIcon } from "@/components/site/github-icon"
import { REPO_PUBLIC, REPO_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

import { InstallPill } from "./install-pill"
import { Reveal } from "./reveal"
import { container, sectionAnchor } from "./section-heading"
import { TrackedLink } from "./tracked-link"

/** Section 9: the closing call to action, with the install command one click from the clipboard. */
export function Cta() {
  return (
    <section id="get-started" aria-labelledby="cta-heading" className={cn(sectionAnchor, "border-t")}>
      <div className={cn(container, "py-16 sm:py-24")}>
        <Reveal className="relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-14 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="landing-aurora absolute inset-0 opacity-80" />
            <div className="landing-grid absolute inset-0" />
          </div>
          <span aria-hidden className="hazard-stripes-sm mx-auto mb-6 block h-1 w-10 rounded-full" />
          <h2 id="cta-heading" className="landing-ink mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
            Put a guard rail where the mistake happens.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Start with one field. It takes a minute, and the code is yours.
          </p>
          <div className="mt-8 flex justify-center">
            <InstallPill name="amount-input" surface="final-cta" />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <TrackedLink href="/components" cta="browse_components" surface="final-cta" className={cn(buttonPrimary, "h-11 px-5")}>
              Browse components <ArrowRight aria-hidden />
            </TrackedLink>
            {REPO_PUBLIC ? (
              <TrackedLink href={REPO_URL} cta="star_github" surface="final-cta" className={cn(buttonOutline, "h-11 px-5")}>
                <GithubIcon /> Star on GitHub
              </TrackedLink>
            ) : (
              <TrackedLink href="/docs" cta="read_docs" surface="final-cta" className={cn(buttonOutline, "h-11 px-5")}>
                Read the docs
              </TrackedLink>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
