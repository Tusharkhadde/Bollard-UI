"use client"

import * as React from "react"
import { motion, useReducedMotion } from "motion/react"

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

/**
 * A gentle fade and 12px rise the first time content scrolls into view (350ms, once).
 *
 * The server renders content fully visible, so crawlers, no-JS visitors and slow
 * hydrates always see it. On the client, only content that starts below the fold is
 * tucked away before first paint and then revealed; anything already on screen stays
 * put, so nothing flashes. With reduced motion nothing moves at all.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: "div" | "li" | "section"
}) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLElement>(null)
  const [state, setState] = React.useState<"static" | "hidden" | "shown">("static")

  useIsoLayoutEffect(() => {
    const node = ref.current
    if (!node || reduced || !("IntersectionObserver" in window)) return
    if (node.getBoundingClientRect().top < window.innerHeight) return
    setState("hidden")
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setState("shown")
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reduced])

  const Tag = as === "li" ? motion.li : as === "section" ? motion.section : motion.div
  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={className}
      initial={false}
      animate={state === "hidden" ? { opacity: 0, y: 12 } : { opacity: 1, y: 0 }}
      transition={state === "shown" ? { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay } : { duration: 0 }}
    >
      {children}
    </Tag>
  )
}
