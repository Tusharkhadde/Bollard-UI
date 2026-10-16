"use client"

import { LinkUnfurlCheck, type UnfurlFetcher, type UnfurlPreview } from "@/registry/default/link-unfurl-check/link-unfurl-check"

const card =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0f172a"/><circle cx="1010" cy="120" r="260" fill="#6366f1" opacity=".55"/><circle cx="1120" cy="560" r="200" fill="#22d3ee" opacity=".35"/><text x="80" y="300" fill="#fff" font-family="system-ui,sans-serif" font-size="88" font-weight="700">Acme 3.0</text><text x="80" y="390" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="40">Faster builds, fewer surprises</text></svg>`,
  )

const launch = {
  title: "Introducing Acme 3.0: faster builds, fewer surprises",
  description: "Incremental deploys, preview environments for every branch and a new CLI.",
  siteName: "Acme Blog",
}

/** Stand-in for a server route that fetches the page like an unfurl bot and runs parseOpenGraph. */
const pages: Record<string, Omit<UnfurlPreview, "url"> & { url?: string }> = {
  "staging.acme.dev/blog/launch": launch,
  "acme.com/blog/launch": { ...launch, image: card, imageWidth: 1200, imageHeight: 630 },
  "bit.ly/acme-launch": { ...launch, url: "https://acme.com/blog/launch", image: card, imageWidth: 1200, imageHeight: 630 },
  "acme.com/dashboard": { url: "https://acme.com/login?next=%2Fdashboard", title: "Sign in · Acme", siteName: "Acme" },
}

const fetchPreview: UnfurlFetcher = (url, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const { host, pathname } = new URL(url)
      const page = pages[host + pathname.replace(/\/$/, "")]
      if (page) resolve({ ...page, url: page.url ?? url })
      else reject(new Error("Not found"))
    }, 300)
    signal.addEventListener("abort", () => clearTimeout(timer))
  })

export function Demo() {
  return (
    <LinkUnfurlCheck
      label="Share in #announcements"
      defaultValue="https://staging.acme.dev/blog/launch?utm_source=newsletter&utm_medium=email"
      publicOrigin="https://acme.com"
      fetchPreview={fetchPreview}
      placeholder="https://"
      delay={250}
    />
  )
}
