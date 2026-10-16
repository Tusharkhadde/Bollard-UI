"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion, MotionConfig, useReducedMotion, type Variants } from "motion/react"

import { buttonPrimary } from "@/components/site/button-styles"
import { InstallCommand } from "@/components/site/install-command"
import { COMPAT, TAGLINE } from "@/lib/site"
import { cn } from "@/lib/utils"

import { HeroPreview } from "./hero-preview"
import { container } from "./section-heading"

const ease = [0.22, 1, 0.36, 1] as const
const group: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }
const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

/**
 * The landing hero: announcement pill, a centred headline and actions on a
 * masked hairline grid, then the framed product window with a faint amber glow.
 */
export function Hero({ registryBase }: { registryBase: string }) {
  const reduced = !!useReducedMotion()
  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="hero-heading" className="relative isolate">
        <div aria-hidden className="bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]" />
        <div className={cn(container, "pt-14 pb-16 sm:pt-24 sm:pb-24")}>
          <motion.div variants={group} initial="hidden" animate="show" className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <motion.div variants={item}>
              <Link
                href="/components/agent-action-approve"
                className="group inline-flex h-7 items-center gap-2 rounded-full border bg-background/70 pr-2.5 pl-1 text-xs text-muted-foreground outline-none backdrop-blur transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-foreground uppercase">New</span>
                AI agent safety components
                <ArrowRight aria-hidden className="size-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            </motion.div>
            <motion.h1
              variants={item}
              id="hero-heading"
              className="mt-6 text-[2.5rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-[4.25rem]"
            >
              {TAGLINE}
            </motion.h1>
            <motion.p variants={item} className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:mt-6 sm:text-lg">
              Copy-paste React components that catch wrong amounts, leaked secrets, typo&apos;d emails and accidental deletes, before they ship.
            </motion.p>
            <motion.div variants={item} className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link href="/components" className={buttonPrimary}>
                Browse components <ArrowRight aria-hidden />
              </Link>
              <InstallCommand
                registryBase={registryBase}
                name="amount-input"
                className="min-h-10 w-full min-w-0 rounded-lg py-1 sm:w-[34rem] [&_button]:h-7 [&_button]:rounded-md"
              />
            </motion.div>
            <motion.p variants={item} className="mt-3 font-mono text-[11.5px] text-muted-foreground">
              Needs {COMPAT}.{" "}
              <Link href="/docs" className="underline decoration-border underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Setup guide
              </Link>
            </motion.p>
          </motion.div>

          <div className="relative mt-14 sm:mt-20">
            <div aria-hidden className="glow-brand pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-[min(56rem,100%)] -translate-x-1/2 opacity-60 blur-2xl dark:opacity-40" />
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.3 }}
            >
              <HeroPreview />
            </motion.div>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}
