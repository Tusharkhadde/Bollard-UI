import { ArrowDown, ArrowRight } from "lucide-react"

import { buttonOutline, buttonPrimary } from "@/components/site/button-styles"
import { cn } from "@/lib/utils"

import { HeroDemo } from "./hero-demo"
import { InstallPill } from "./install-pill"
import { container } from "./section-heading"
import { TrackedLink } from "./tracked-link"

/**
 * The homepage hero. The copy is server-rendered and visible on first paint (no entrance
 * animation hides it); the right-hand demo is real Bollard components on an autoplaying timeline,
 * already showing a caught mistake on first paint.
 */
export function HomeHero({ total }: { total: number }) {
  return (
    <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-aurora absolute inset-0" />
        <div className="landing-grid absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
      </div>
      <div className={cn(container, "pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24")}>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] xl:gap-16">
          <div className="flex min-w-0 flex-col items-start">
            <p className="inline-flex items-center gap-2 rounded-full border bg-background/70 py-1 pr-3 pl-1.5 text-xs text-muted-foreground backdrop-blur">
              <span className="rounded-full bg-brand/15 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-brand uppercase">MIT</span>
              {total} open-source React components
            </p>
            <h1
              id="hero-heading"
              className="landing-ink mt-5 max-w-[15ch] text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[3.75rem] xl:text-[4.25rem]"
            >
              Catch the mistake before your users make it.
            </h1>
            <p className="mt-5 max-w-[34rem] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              Drop-in shadcn components that spot the extra zero, the mistyped email and the risky agent action, while there&apos;s still time to fix it.
            </p>
            <div className="mt-7 flex w-full flex-wrap items-center gap-3">
              <TrackedLink href="/components" cta="browse_components" surface="hero" className={cn(buttonPrimary, "h-11 px-5")}>
                Browse components <ArrowRight aria-hidden />
              </TrackedLink>
              <TrackedLink href="#playground" cta="try_it_live" surface="hero" className={cn(buttonOutline, "h-11 bg-background/70 px-5 backdrop-blur")}>
                Try it live <ArrowDown aria-hidden />
              </TrackedLink>
            </div>
            <InstallPill name="amount-input" surface="hero" className="mt-5" />
          </div>
          <HeroDemo className="min-w-0" />
        </div>
      </div>
    </section>
  )
}
