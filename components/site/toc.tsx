"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** "On this page" with scroll-spy. */
export function Toc({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = React.useState<string | undefined>(sections[0]?.id)
  React.useEffect(() => {
    const onScroll = () => {
      let current: string | undefined = sections[0]?.id
      for (const { id } of sections) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < 120) current = id
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections.at(-1)?.id
      setActive(current)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [sections])
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-2 font-medium">On this page</p>
      <ul className="space-y-1 border-l">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l border-transparent py-0.5 pl-3 text-muted-foreground transition-colors hover:text-foreground",
                active === section.id && "border-foreground font-medium text-foreground",
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
