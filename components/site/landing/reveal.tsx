"use client"

import * as React from "react"
import { motion, MotionConfig, useReducedMotion } from "motion/react"

/**
 * A gentle fade and 12px rise as content scrolls into view, reversed when it
 * scrolls away (once: false). Starts at 40% opacity, never invisible, so a
 * capture or a slow hydrate still shows the content.
 *
 * The server and client always render the same element (no hydration
 * mismatch). For reduced motion, MotionConfig "user" drops the rise entirely
 * and only a quick opacity change remains.
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
  const Tag = as === "li" ? motion.li : as === "section" ? motion.section : motion.div
  return (
    <MotionConfig reducedMotion="user">
      <Tag
        className={className}
        initial={{ opacity: 0.4, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.15, margin: "0px 0px -40px 0px" }}
        transition={reduced ? { duration: 0.15 } : { duration: 0.45, ease: [0.25, 0.1, 0.25, 1], delay }}
      >
        {children}
      </Tag>
    </MotionConfig>
  )
}
