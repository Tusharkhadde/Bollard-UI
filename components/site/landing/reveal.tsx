"use client"

import * as React from "react"
import { motion, MotionConfig, useReducedMotion } from "motion/react"

/**
 * A gentle fade and 12px rise the first time content scrolls into view.
 * Starts at 40% opacity, never invisible, so a capture or a slow hydrate still
 * shows the content. Server and client render the same element. With reduced
 * motion the rise is dropped and only a quick opacity change remains.
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
        viewport={{ once: true, amount: 0.15, margin: "0px 0px -40px 0px" }}
        transition={reduced ? { duration: 0.15 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
      >
        {children}
      </Tag>
    </MotionConfig>
  )
}
