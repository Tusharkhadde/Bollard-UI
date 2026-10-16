"use client"

import { RobotsTxtGuard } from "@/registry/default/robots-txt-guard/robots-txt-guard"

const copiedFromStaging = [
  "# staging: keep out of search",
  "User-agent: *",
  "Disallow: /",
  "Dissallow: /checkout",
  "Disallow: /_next/",
  "Noindex: /account",
  "",
  "Sitemap: https://staging.acme.com/sitemap.xml",
].join("\n")

export function Demo() {
  return <RobotsTxtGuard production siteUrl="https://acme.com" defaultValue={copiedFromStaging} />
}
