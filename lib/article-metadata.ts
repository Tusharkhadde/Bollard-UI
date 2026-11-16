import { SITE_URL } from "@/lib/site"

export const ARTICLE_DATE_PUBLISHED = "2026-11-16"
export const ARTICLE_DATE_MODIFIED = "2026-11-16"
export const ARTICLE_AUTHOR = "Tushar Khadde"

const ARTICLE_PATHS: Record<string, string> = {
  "React Form Validation for India: Aadhaar, UPI & More": "/guides/react-india-form-validation",
  "Type to Confirm Dialogs in React: Safer Destructive Actions": "/guides/react-type-to-confirm-dialog",
  "Email Typo Detection in React Forms: Suggest, Don’t Rewrite": "/guides/react-email-typo-detection",
  "Human-in-the-Loop AI Agent Approvals in React": "/guides/human-in-the-loop-ai-agent-approvals",
  "Bollard UI vs Zod Validation: Use Both Where They Fit": "/guides/bollard-ui-vs-zod-validation",
  "Bollard UI vs React Hook Form: A Complementary Pair": "/guides/bollard-ui-vs-react-hook-form",
  "Bollard UI vs Confirm Dialogs: Choose the Right Review": "/guides/bollard-ui-vs-confirm-dialogs",
}

export function articlePathForTitle(title: string) {
  return ARTICLE_PATHS[title]
}

export function articleSchema(path: string, headline: string, description: string) {
  const url = `${SITE_URL}${path}`
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    datePublished: ARTICLE_DATE_PUBLISHED,
    dateModified: ARTICLE_DATE_MODIFIED,
    author: { "@type": "Person", name: ARTICLE_AUTHOR },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: { "@type": "Organization", name: "Bollard UI", url: SITE_URL },
  }
}
