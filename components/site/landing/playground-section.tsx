"use client"

import * as React from "react"

import { Deferred } from "./deferred"
import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

const BreakIt = React.lazy(() => import("@/components/site/playground/break-it").then((mod) => ({ default: mod.BreakIt })))

/** Same footprint as the loaded playground, so nothing below moves when it mounts. */
function Placeholder() {
  return (
    <div aria-hidden className="grid gap-4">
      <div className="h-8 w-56 rounded-full border bg-background" />
      <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="flex gap-2 overflow-hidden lg:flex-col">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[3.75rem] min-w-[9.5rem] shrink-0 rounded-xl bg-surface lg:min-w-0" />
          ))}
        </div>
        <div className="h-[25.5rem] rounded-2xl border bg-card sm:h-[24.5rem]" />
      </div>
    </div>
  )
}

/** Section 3: "Try to break it", the interactive playground, loaded as it nears the viewport. */
export function PlaygroundSection() {
  return (
    <Section id="playground" labelledBy="playground-heading" className="bg-surface/40">
      <Reveal>
        <SectionHeading id="playground-heading" eyebrow="Playground" title="Try to break it.">
          Five real components, five classic mistakes. Make each one and watch the guard catch it, then copy the one you need.
        </SectionHeading>
      </Reveal>
      <Deferred margin="500px 0px" className="mt-10" fallback={<Placeholder />}>
        <BreakIt />
      </Deferred>
    </Section>
  )
}
