import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { buttonOutline, buttonPrimary } from "@/components/site/button-styles"
import { GithubIcon } from "@/components/site/github-icon"
import { InstallCommand } from "@/components/site/install-command"

import { Reveal } from "./reveal"
import { container, sectionAnchor } from "./section-heading"

/** The closing band: a framed panel on a masked grid with a faint amber glow, the install line and two actions. */
export function Cta({ registryBase, githubUrl }: { registryBase: string; githubUrl: string }) {
  return (
    <section id="get-started" aria-labelledby="cta-heading" className={`${sectionAnchor} border-t`}>
      <div className={`${container} py-20 sm:py-28`}>
        <Reveal className="relative isolate overflow-hidden rounded-2xl border bg-surface px-5 py-16 text-center sm:px-10 sm:py-24">
          <div aria-hidden className="bg-grid-fade pointer-events-none absolute inset-0 -z-10" />
          <div aria-hidden className="glow-brand pointer-events-none absolute -top-40 left-1/2 -z-10 h-80 w-[40rem] max-w-full -translate-x-1/2 opacity-50 blur-2xl dark:opacity-35" />
          <span aria-hidden className="hazard-stripes-sm mx-auto block h-1 w-10 rounded-full" />
          <h2 id="cta-heading" className="mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            Put a bollard in front of every mistake.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Add one with the shadcn CLI. The source lands in your repo, MIT licensed, so every line is yours to change.
          </p>
          <InstallCommand registryBase={registryBase} name="type-to-confirm" className="mx-auto mt-8 w-full max-w-[40rem] min-w-0 bg-background" />
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/components" className={buttonPrimary}>
              Browse components <ArrowRight aria-hidden />
            </Link>
            <a href={githubUrl} className={buttonOutline}>
              <GithubIcon /> Star on GitHub
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
