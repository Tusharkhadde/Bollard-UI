import type { MetadataRoute } from "next"

import { catalog } from "@/lib/catalog"
import { SITE_URL } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/components`, changeFrequency: "weekly", priority: 0.9 },
    ...catalog.map((item) => ({ url: `${SITE_URL}/components/${item.name}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ]
}
