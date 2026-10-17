import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { buttonOutline, buttonPrimary } from "@/components/site/button-styles"
import { GithubIcon } from "@/components/site/github-icon"
import { InstallCommand } from "@/components/site/install-command"
import { COMPAT, REPO_PUBLIC, REPO_URL } from "@/lib/site"

import { Reveal } from "./reveal"
import { container, sectionAnchor } from "./section-heading"

/** A quiet closing band with the install path beside the final action. */
export function Cta({ registryBase }: { registryBase: string }) {
  return (
    <section id="get-started" aria-labelledby="cta-heading" className={`${sectionAnchor} border-t`}>
      <div className={`${container} py-16 sm:py-20`}>
        <Reveal className="grid gap-8 border-y py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,0.9fr)] lg:items-center lg:gap-16">
          <div>
            <span aria-hidden className="hazard-stripes-sm mb-5 block h-1 w-9 rounded-full" />
            <h2 id="cta-heading" className="max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
              Put a guard rail where mistakes happen.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
              Add a component with the shadcn CLI. Its source lands in your repo, MIT licensed and ready for your own changes.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/components" className={buttonPrimary}>
                Browse components <ArrowRight aria-hidden />
              </Link>
              {REPO_PUBLIC ? (
                <a href={REPO_URL} className={buttonOutline}>
                  <GithubIcon /> Star on GitHub
                </a>
              ) : (
                <Link href="/docs" className={buttonOutline}>
                  Get started
                </Link>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <InstallCommand registryBase={registryBase} name="type-to-confirm" className="w-full min-w-0 bg-background" />
            <p className="mt-2.5 font-mono text-[11.5px] text-muted-foreground">Needs {COMPAT}</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
