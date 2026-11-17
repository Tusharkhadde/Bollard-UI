import type { MetadataRoute } from "next"

import { catalog } from "@/lib/catalog"
import { GUIDES } from "@/lib/guides"
import { ARTICLE_DATE_MODIFIED } from "@/lib/article-metadata"
import { SITE_URL } from "@/lib/site"
import { USE_CASES } from "@/lib/use-cases"

const LAST_MODIFIED = new Date(`${ARTICLE_DATE_MODIFIED}T00:00:00Z`)
const SEO_GUIDES = [
  "react-india-form-validation",
  "react-type-to-confirm-dialog",
  "react-email-typo-detection",
  "human-in-the-loop-ai-agent-approvals",
  "bollard-ui-vs-zod-validation",
  "bollard-ui-vs-react-hook-form",
  "bollard-ui-vs-confirm-dialogs",
]

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/components", changeFrequency: "weekly" as const, priority: 0.9 },
    { path: "/playground", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/docs", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/start-here", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/guides", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/agent-safety", changeFrequency: "weekly" as const, priority: 0.85 },
    { path: "/india", changeFrequency: "monthly" as const, priority: 0.85 },
    ...["changelog", "quality", "security", "license"].map((page) => ({ path: `/${page}`, changeFrequency: "monthly" as const, priority: 0.4 })),
  ]
  return [
    ...pages.map((page) => ({ url: `${SITE_URL}${page.path}`, lastModified: LAST_MODIFIED, changeFrequency: page.changeFrequency, priority: page.priority })),
    ...catalog.map((item) => ({ url: `${SITE_URL}/components/${item.name}`, lastModified: LAST_MODIFIED, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...GUIDES.map((guide) => ({ url: `${SITE_URL}/guides/${guide.slug}`, lastModified: LAST_MODIFIED, changeFrequency: "monthly" as const, priority: 0.75 })),
    ...SEO_GUIDES.map((slug) => ({ url: `${SITE_URL}/guides/${slug}`, lastModified: LAST_MODIFIED, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...USE_CASES.map((useCase) => ({ url: `${SITE_URL}/use-cases/${useCase.slug}`, lastModified: LAST_MODIFIED, changeFrequency: "monthly" as const, priority: 0.85 })),
  ]
}
