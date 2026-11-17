import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  const commonDisallow = ["/api/", "/preview/"]

  return {
    rules: [
      // Explicitly allowed search engine and AI answer engine web crawlers
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "Google-Extended",
          // Training bots: default allowed below; to opt out of AI model training, move "GPTBot" to a separate disallow rule
          "GPTBot",
        ],
        allow: "/",
        disallow: commonDisallow,
      },
      // General web crawler fallback rule
      {
        userAgent: "*",
        allow: "/",
        disallow: commonDisallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
