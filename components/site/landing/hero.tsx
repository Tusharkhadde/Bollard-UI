"use client"

import Link from "next/link"
import { ArrowRight, ScanSearch, ShieldCheck, TimerReset } from "lucide-react"
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
 * Quiet proof points that sit around the product window. They make the landing
 * screen feel alive without competing with the interactive preview, and stay
 * hidden on small screens where the product needs all the room it can get.
 */
function FloatingSignals() {
  const reduced = !!useReducedMotion()
  const signals = [
    {
      label: "Amount checked",
      detail: "One extra zero caught",
      icon: ScanSearch,
      className: "left-[8%] top-0",
      delay: 0.9,
      drift: -7,
    },
    {
      label: "Safe to retry",
      detail: "Duplicate payment blocked",
      icon: TimerReset,
      className: "right-[8%] top-0",
      delay: 1.05,
      drift: 8,
    },
    {
      label: "Action reviewed",
      detail: "Scope made visible",
      icon: ShieldCheck,
      className: "left-[12%] bottom-0",
      delay: 1.2,
      drift: 5,
    },
  ] as const

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      {signals.map(({ label, detail, icon: Icon, className, delay, drift }) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={
            reduced
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 1, scale: 1, y: [0, drift, 0] }
          }
          transition={
            reduced
              ? { duration: 0.2, delay }
              : {
                  opacity: { duration: 0.45, delay },
                  scale: { duration: 0.45, delay },
                  y: { duration: 4.4, delay: delay + 0.2, repeat: Infinity, ease: "easeInOut" },
                }
          }
          className={cn(
            "absolute z-10 flex w-40 items-center gap-2 rounded-lg border border-border-strong/80 bg-background/90 px-2.5 py-2 shadow-[0_16px_35px_-22px_rgb(0_0_0/0.55)] backdrop-blur-md lg:w-48 lg:gap-2.5 lg:px-3 lg:py-2.5 dark:bg-card/90",
            className,
          )}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand text-brand-foreground">
            <Icon className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium tracking-tight text-foreground">{label}</span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detail}</span>
          </span>
        </motion.div>
      ))}
    </div>
  )
}

/**
 * A developer-first split hero: a direct value proposition and install path
 * beside a working product preview.
 */
export function Hero() {
  const reduced = !!useReducedMotion()
  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="hero-heading" className="relative isolate">
        <div aria-hidden className="bg-grid-fade pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]" />
        <div className={cn(container, "pt-10 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24")}>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.22fr)] lg:gap-10 xl:gap-16">
            <motion.div variants={group} initial="hidden" animate="show" className="flex max-w-xl flex-col items-start text-left">
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
                className="mt-6 line-clamp-3 text-[2.6rem] leading-[1.03] font-semibold tracking-[-0.05em] text-balance sm:text-6xl lg:text-[3.8rem] xl:text-[4.25rem]"
              >
                {TAGLINE}
              </motion.h1>
              <motion.p variants={item} className="mt-5 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:mt-6 sm:text-lg">
                Copy a shadcn-styled guard rail, or add headless validation to the React controls you already use.
              </motion.p>
              <motion.div variants={item} className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <Link href="#components" className={buttonPrimary}>
                  Try the live components <ArrowRight aria-hidden />
                </Link>
              </motion.div>
              <motion.div variants={item} className="mt-3 w-full max-w-[36rem]">
                <p className="mb-2 font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground uppercase">Quick start · Amount guard</p>
                <InstallCommand name="amount-input" className="w-full min-w-0" />
              </motion.div>
              <motion.div variants={item} className="mt-3 text-sm">
                <Link href="/components/use-bollard-field" className="rounded-sm text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  Keep your controls. Add field validation.
                </Link>
              </motion.div>
              <motion.p variants={item} className="mt-3 font-mono text-[11.5px] text-muted-foreground">
                Needs {COMPAT}.{" "}
                <Link href="/docs" className="underline decoration-border underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  Setup guide
                </Link>
              </motion.p>
            </motion.div>
            <div className="relative min-w-0 lg:py-16">
              <div aria-hidden className="glow-brand pointer-events-none absolute -inset-10 -z-10 opacity-50 blur-3xl dark:opacity-35" />
              <FloatingSignals />
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease, delay: 0.3 }}
              >
                <HeroPreview className="relative z-0" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}
