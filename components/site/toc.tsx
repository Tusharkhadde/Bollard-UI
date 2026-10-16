"use client"

import * as React from "react"
import { ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

/** "On this page" with scroll-spy, shadcn-docs style: quiet list, the current section in full colour with a short amber tick. */
export function Toc({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = React.useState<string | undefined>(sections[0]?.id)
  React.useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current: string | undefined = sections[0]?.id
      for (const { id } of sections) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < 140) current = id
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections.at(-1)?.id
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [sections])

  return (
    <nav aria-label="On this page" className="text-[13px]" data-toc>
      <p className="mb-3 font-medium text-foreground">On this page</p>
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const current = active === section.id
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "relative block rounded-sm py-1 pl-3 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  current && "text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 left-0 h-3.5 w-px -translate-y-1/2 bg-border transition-colors",
                    current && "w-0.5 rounded-full bg-brand",
                  )}
                />
                {section.label}
              </a>
            </li>
          )
        })}
      </ul>
      <a
        href="#top"
        onClick={(event) => {
          event.preventDefault()
          window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
        }}
        className="mt-5 inline-flex items-center gap-1.5 rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowUp className="size-3.5" aria-hidden />
        Back to top
      </a>
    </nav>
  )
}
