"use client"

import Link from "next/link"
import type * as React from "react"

import { trackCtaClick } from "@/lib/analytics"

/**
 * A Next.js link (or in-page anchor) that records a `cta_click` with a fixed name.
 * In-page anchors (`#playground`) scroll smoothly unless the visitor prefers reduced motion.
 */
export function TrackedLink({
  href,
  cta,
  surface,
  className,
  children,
}: {
  href: string
  cta: string
  surface: string
  className?: string
  children: React.ReactNode
}) {
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    trackCtaClick({ cta, surface })
    if (!href.startsWith("#")) return
    const target = document.getElementById(href.slice(1))
    if (!target) return
    event.preventDefault()
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    history.replaceState(null, "", href)
  }

  if (href.startsWith("#")) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  )
}
