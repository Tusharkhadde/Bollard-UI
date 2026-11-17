import type { MetadataRoute } from "next"

import { catalog } from "@/lib/catalog"
import { GUIDES } from "@/lib/guides"
import { FLOWS } from "@/lib/kits"
import { ARTICLE_DATE_MODIFIED } from "@/lib/article-metadata"
import { SITE_URL } from "@/lib/site"
import { USE_CASES } from "@/lib/use-cases"
import componentDates from "@/lib/component-dates.json"

const FALLBACK_SITE_MODIFIED = new Date(`${ARTICLE_DATE_MODIFIED}T00:00:00Z`)
const DATES = componentDates as Record<string, string>

// Distinct standalone long-form and comparison guides
const SEO_GUIDES = [
  "react-india-form-validation",
  "react-type-to-confirm-dialog",
  "react-email-typo-detection",
  "react-prevent-duplicate-form-submit",
  "human-in-the-loop-ai-agent-approvals",
  "bollard-ui-vs-zod-validation",
  "bollard-ui-vs-react-hook-form",
  "bollard-ui-vs-confirm-dialogs",
]

export default function sitemap(): MetadataRoute.Sitemap {
  // Static core and documentation pages
  const staticPages = [
    { path: "/", changeFrequency: "weekly" as const, priority: 1.0 },
    { path: "/components", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/flows", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/docs", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/start-here", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/guides", changeFrequency: "weekly" as const, priority: 0.85 },
    { path: "/playground", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/agent-safety", changeFrequency: "weekly" as const, priority: 0.85 },
    { path: "/india", changeFrequency: "monthly" as const, priority: 0.85 },
    { path: "/changelog", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/quality", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/security", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/license", changeFrequency: "monthly" as const, priority: 0.4 },
  ]

  // Flow hubs (excluding 'india' which is served as /india)
  const flowHubs = FLOWS.filter((f) => f.id !== "india").map((flow) => ({
    path: `/flows/${flow.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }))

  const urls: MetadataRoute.Sitemap = []
  const seenUrls = new Set<string>()

  const addEntry = (entry: MetadataRoute.Sitemap[number]) => {
    if (!seenUrls.has(entry.url)) {
      seenUrls.add(entry.url)
      urls.push(entry)
    }
  }

  // 1. Static pages
  staticPages.forEach((p) => {
    addEntry({
      url: `${SITE_URL}${p.path}`,
      lastModified: FALLBACK_SITE_MODIFIED,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })
  })

  // 2. Flow hubs
  flowHubs.forEach((f) => {
    addEntry({
      url: `${SITE_URL}${f.path}`,
      lastModified: FALLBACK_SITE_MODIFIED,
      changeFrequency: f.changeFrequency,
      priority: f.priority,
    })
  })

  // 3. Use-case recipe pages
  USE_CASES.forEach((useCase) => {
    addEntry({
      url: `${SITE_URL}/use-cases/${useCase.slug}`,
      lastModified: FALLBACK_SITE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    })
  })

  // 4. Topic guides (dynamic registry guides & deep standalone guides)
  GUIDES.forEach((guide) => {
    addEntry({
      url: `${SITE_URL}/guides/${guide.slug}`,
      lastModified: FALLBACK_SITE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.75,
    })
  })

  SEO_GUIDES.forEach((slug) => {
    addEntry({
      url: `${SITE_URL}/guides/${slug}`,
      lastModified: FALLBACK_SITE_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    })
  })

  // 5. All 341 components with git-derived real lastModified dates
  catalog.forEach((item) => {
    const dateStr = DATES[item.name]
    const itemDate = dateStr ? new Date(`${dateStr}T00:00:00Z`) : FALLBACK_SITE_MODIFIED
    addEntry({
      url: `${SITE_URL}/components/${item.name}`,
      lastModified: itemDate,
      changeFrequency: "monthly",
      priority: item.essential ? 0.8 : 0.65,
    })
  })

  return urls
}
