"use client"

import * as React from "react"

import { trackDocsVisit, trackGithubClick } from "@/lib/analytics"

/**
 * Global click tracking for GA4. Page views need no component: the `gtag('config')`
 * call in the root layout records the initial load, and GA4's enhanced measurement
 * (on by default for every web data stream) records a page_view for browser history
 * events, which covers Next.js client-side navigations. A manual page_view push was
 * measured to be deduplicated away by gtag.js anyway.
 *
 * GitHub and docs links appear across the header, footer, drawer, palette and landing
 * sections, so they are tracked with one document-level listener instead of wiring up
 * every component. Everything is best-effort: if analytics is blocked or not loaded,
 * `window.gtag` is undefined and these handlers no-op — the site is never affected.
 */
export function Analytics() {
  React.useEffect(() => {
    // Capture phase, so soft navigations and stopPropagation elsewhere can't hide clicks.
    const onClick = (event: MouseEvent) => {
      try {
        if (event.button !== 0) return
        const target = event.target instanceof Element ? event.target : null
        const anchor = target?.closest?.("a[href]")
        if (!anchor) return
        const href = anchor.getAttribute("href") ?? ""
        const label = (anchor.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 100) || undefined
        if (href.includes("github.com")) {
          trackGithubClick({ url: href, label })
        } else if (href === "/docs" || href.startsWith("/docs/") || href.startsWith("/docs#") || href.startsWith("/guides")) {
          trackDocsVisit({ path: href, label })
        }
      } catch {
        // Analytics must never break navigation.
      }
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  return null
}
