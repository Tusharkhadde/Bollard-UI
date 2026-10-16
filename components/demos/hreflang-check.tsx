"use client"

import { HreflangCheck } from "@/registry/default/hreflang-check/hreflang-check"

const pricingPages = [
  "<!-- https://acme.com/en/pricing -->",
  '<link rel="canonical" href="https://acme.com/en/pricing">',
  '<link rel="alternate" hreflang="en" href="https://acme.com/en/pricing">',
  '<link rel="alternate" hreflang="en-UK" href="https://acme.com/en-gb/pricing">',
  '<link rel="alternate" hreflang="de" href="https://acme.com/de/preise">',
  "",
  "<!-- https://acme.com/de/preise -->",
  '<link rel="canonical" href="https://acme.com/en/pricing">',
  '<link rel="alternate" hreflang="de" href="/de/preise">',
  '<link rel="alternate" hreflang="en" href="https://acme.com/en/pricing/">',
].join("\n")

export function Demo() {
  return <HreflangCheck defaultValue={pricingPages} rows={7} />
}
