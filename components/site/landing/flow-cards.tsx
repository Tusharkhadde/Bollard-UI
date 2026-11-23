"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Check, TriangleAlert } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

export type FlowCard = { id: string; label: string; count: number; blurb?: string; href: string }

/** One tiny caught-mistake story per flow: what was entered, what the guard asks, the fix. */
const PREVIEWS: Record<string, { field: string; wrong: string; flag: string; right: string }> = {
  checkout: { field: "Amount", wrong: "₹2,40,000", flag: "Extra zero?", right: "₹24,000" },
  "signup-login": { field: "Email", wrong: "sam@gmial.con", flag: "Did you mean gmail.com?", right: "sam@gmail.com" },
  "account-settings": { field: "New email", wrong: "sam@oldjob.com", flag: "Confirm from the old address", right: "Change pending" },
  "danger-zone": { field: "Type to delete", wrong: "acme/prod", flag: "Doesn't match acme/production", right: "Delete locked" },
  forms: { field: "Draft", wrong: "Tab closed", flag: "Unsaved changes", right: "Draft restored" },
  messaging: { field: "Reply", wrong: "Reply all · 48", flag: "48 people get this", right: "Reply to Sam" },
  devtools: { field: "kubectl", wrong: "context: prod", flag: "This is production", right: "Switched to staging" },
  scheduling: { field: "Date", wrong: "03/04", flag: "3 April or 4 March?", right: "Fri, 3 Apr" },
  india: { field: "IFSC", wrong: "SBIN0O01234", flag: "Letter O, not zero", right: "SBIN0001234" },
}

type Phase = "idle" | "wrong" | "flag" | "right"

function Preview({ id, playing }: { id: string; playing: boolean }) {
  const reduce = useReducedMotion()
  const story = PREVIEWS[id]
  const [phase, setPhase] = React.useState<Phase>("idle")

  React.useEffect(() => {
    // Reduced motion: a still of the caught mistake, no sequence.
    if (reduce) {
      setPhase("flag")
      return
    }
    if (!playing) {
      setPhase("idle")
      return
    }
    setPhase("wrong")
    const timers = [window.setTimeout(() => setPhase("flag"), 450), window.setTimeout(() => setPhase("right"), 1500)]
    return () => timers.forEach(window.clearTimeout)
  }, [playing, reduce])

  if (!story) return null
  const shown = phase === "right" ? story.right : story.wrong
  const flagged = phase === "flag"

  return (
    <div aria-hidden className="relative h-[4.25rem] overflow-hidden rounded-lg border bg-surface px-3 py-2.5">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{story.field}</p>
      <div className="mt-1 flex h-6 items-center gap-2">
        <span
          className={cn(
            "truncate font-mono text-[13px] transition-colors duration-300",
            phase === "idle" && "text-muted-foreground",
            (phase === "wrong" || flagged) && "text-foreground underline decoration-amber-500 decoration-wavy underline-offset-4",
            phase === "right" && "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {shown}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          {flagged && (
            <motion.span
              key="flag"
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex min-w-0 items-center gap-1 truncate rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
            >
              <TriangleAlert className="size-3 shrink-0" />
              <span className="truncate">{story.flag}</span>
            </motion.span>
          )}
          {phase === "right" && (
            <motion.span
              key="ok"
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            >
              <Check className="size-3" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Card({ flow }: { flow: FlowCard }) {
  const ref = React.useRef<HTMLAnchorElement>(null)
  const [playing, setPlaying] = React.useState(false)
  const [run, setRun] = React.useState(0)

  // Touch screens have no hover: play the preview once as the card scrolls into view.
  React.useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia("(hover: hover)").matches || !("IntersectionObserver" in window)) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setPlaying(true)
      },
      { threshold: 0.7 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const start = () => {
    setRun((r) => r + 1)
    setPlaying(true)
  }

  return (
    <Link
      ref={ref}
      href={flow.href}
      onPointerEnter={(e) => e.pointerType === "mouse" && start()}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPlaying(false)}
      onFocus={start}
      onBlur={() => setPlaying(false)}
      className="group flex h-full flex-col gap-3 bg-background p-5 outline-none transition-colors hover:bg-surface/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:p-6"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="truncate text-[15px] font-medium tracking-tight">{flow.label}</span>
        <span className="inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
          {flow.count}
          <span className="sr-only"> components</span>
        </span>
      </span>
      <Preview key={run} id={flow.id} playing={playing} />
      {flow.blurb && <span className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{flow.blurb}</span>}
      <span className="mt-auto inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
        Browse the flow
        <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </Link>
  )
}

/** Section 5: the nine flows, each with a two-second preview of the mistake it catches. */
export function FlowCards({ flows }: { flows: FlowCard[] }) {
  return (
    <Section id="flows" labelledBy="flows-heading">
      <Reveal>
        <SectionHeading id="flows-heading" eyebrow="Browse by flow" title="Start from the screen you're building.">
          Every component is filed under the places its mistake happens. Hover a flow to see one caught.
        </SectionHeading>
      </Reveal>
      <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {flows.map((flow, i) => (
          <Reveal as="li" key={flow.id} delay={(i % 3) * 0.06} className="min-w-0 bg-background">
            <Card flow={flow} />
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}
