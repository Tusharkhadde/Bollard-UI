"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buttonOutline, buttonPrimary } from "@/components/site/button-styles"
import { cn } from "@/lib/utils"
import { HeroPreview } from "./hero-preview"
import { container } from "./section-heading"

export function Hero() {
  function goPlayground() {
    const target = document.getElementById("playground")
    target?.scrollIntoView({ behavior: "smooth" })
    target?.focus({ preventScroll: true })
  }
  return <section aria-labelledby="hero-heading" className="relative isolate"><div aria-hidden className="bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]" /><div className={cn(container, "grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[.85fr_1.15fr] lg:py-20")}>
    <div className="max-w-xl"><h1 id="hero-heading" className="text-[2.65rem] font-semibold leading-[1.03] tracking-[-.05em] text-balance sm:text-6xl">Catch the mistake before your users make it.</h1><p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">Small, real-time guardrails help people catch costly mistakes before they submit.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="#components" className={buttonPrimary}>Browse components <ArrowRight aria-hidden /></Link><button type="button" onClick={goPlayground} className={buttonOutline}>Try it live</button></div><code className="mt-4 inline-block max-w-full truncate rounded-lg border bg-background px-3 py-2 font-mono text-xs">npx shadcn add @bollard/amount-input</code><Link href="/components/use-bollard-field" className="mt-3 block text-sm text-muted-foreground underline underline-offset-4">Keep your controls. Add field validation.</Link></div>
    <div className="min-w-0"><HeroPreview /></div>
  </div></section>
}
