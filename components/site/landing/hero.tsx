"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion, MotionConfig, useMotionValue, useReducedMotion, useScroll, useSpring, type Variants } from "motion/react"

import { GithubIcon } from "@/components/site/github-icon"
import { InstallCommand } from "@/components/site/install-command"
import { cn } from "@/lib/utils"

import { HeroFloats } from "./hero-floats"
import { HeroPreview } from "./hero-preview"

const button =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"
const primary = cn(button, "bg-primary text-primary-foreground hover:bg-primary/90")
const outline = cn(button, "border bg-background hover:bg-muted")

const ease = [0.22, 1, 0.36, 1] as const
const textGroup: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }
const textItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

/**
 * The landing hero: a left-aligned headline and actions, then a wide example
 * app with tabs. On wide screens a few live components float around the window,
 * bobbing slowly, drifting with scroll and tilting a little toward the pointer.
 */
export function Hero({ registryBase, githubUrl }: { registryBase: string; githubUrl: string }) {
  const reduced = !!useReducedMotion()
  const stageRef = React.useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const pointerX = useSpring(rawX, { stiffness: 90, damping: 18, mass: 0.6 })
  const pointerY = useSpring(rawY, { stiffness: 90, damping: 18, mass: 0.6 })

  const onPointerMove = (event: React.PointerEvent) => {
    if (reduced || event.pointerType !== "mouse" || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    rawX.set(Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)))
    rawY.set(Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)))
  }
  const onPointerLeave = () => {
    rawX.set(0)
    rawY.set(0)
  }

  return (
    <MotionConfig reducedMotion="user">
      <section aria-labelledby="hero-heading" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6 sm:pt-20 sm:pb-28 lg:pt-24">
        <motion.div variants={textGroup} initial="hidden" animate="show" className="max-w-4xl">
          <motion.h1
            variants={textItem}
            id="hero-heading"
            className="text-[2.6rem] leading-[1.02] font-bold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.75rem]"
          >
            Build interfaces your users can&apos;t break
          </motion.h1>
          <motion.p variants={textItem} className="mt-5 max-w-2xl text-lg text-pretty text-muted-foreground sm:mt-6 sm:text-xl">
            Copy-paste React components that catch wrong amounts, leaked secrets, typo&apos;d emails and accidental deletes. Built for shadcn/ui. Open source.
          </motion.p>
          <motion.div variants={textItem} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Link href="/components" className={primary}>
                Browse components <ArrowRight aria-hidden className="size-4" />
              </Link>
              <a href={githubUrl} className={outline}>
                <GithubIcon className="size-4" /> GitHub
              </a>
            </div>
            <InstallCommand registryBase={registryBase} name="amount-input" className="h-10 w-full min-w-0 rounded-lg sm:w-[23rem] [&_button]:h-8 [&_button]:rounded-md" />
          </motion.div>
        </motion.div>

        <div ref={stageRef} className="relative mt-12 sm:mt-16">
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.35 }}
            className="relative z-0 origin-top"
          >
            <HeroPreview />
          </motion.div>
          <HeroFloats scrollY={scrollY} pointerX={pointerX} pointerY={pointerY} className="hidden xl:block" />
        </div>
      </section>
    </MotionConfig>
  )
}
