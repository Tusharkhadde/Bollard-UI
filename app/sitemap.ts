import type { MetadataRoute } from "next"

import { catalog } from "@/lib/catalog"
import { GUIDES } from "@/lib/guides"
import { SITE_URL } from "@/lib/site"
import { USE_CASES } from "@/lib/use-cases"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/components`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/docs`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/start-here`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/agent-safety`, changeFrequency: "weekly", priority: 0.85 },
    ...["changelog", "quality", "security", "license"].map((page) => ({ url: `${SITE_URL}/${page}`, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...catalog.map((item) => ({ url: `${SITE_URL}/components/${item.name}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...GUIDES.map((guide) => ({ url: `${SITE_URL}/guides/${guide.slug}`, changeFrequency: "monthly" as const, priority: 0.75 })),
    ...USE_CASES.map((useCase) => ({ url: `${SITE_URL}/use-cases/${useCase.slug}`, changeFrequency: "monthly" as const, priority: 0.85 })),
  ]
}
