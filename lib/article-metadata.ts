import { SITE_URL, SAME_AS_PROFILES } from "@/lib/site"

export const ARTICLE_DATE_PUBLISHED = "2026-11-16"
export const ARTICLE_DATE_MODIFIED = "2026-11-17"
export const ARTICLE_AUTHOR = "Tushar Khadde"

const ARTICLE_PATHS: Record<string, string> = {
  "React Form Validation for India: Aadhaar, UPI & More": "/guides/react-india-form-validation",
  "React Form Validation for India: Aadhaar and UPI": "/guides/react-india-form-validation",
  "React Form Validation for India: Aadhaar & UPI": "/guides/react-india-form-validation",
  "Type to Confirm Dialogs in React: Safer Destructive Actions": "/guides/react-type-to-confirm-dialog",
  "React Type to Confirm Dialogs for Safety": "/guides/react-type-to-confirm-dialog",
  "Email Typo Detection in React Forms: Suggest, Don’t Rewrite": "/guides/react-email-typo-detection",
  "React Email Typo Detection: Suggest, Don't Edit": "/guides/react-email-typo-detection",
  "Human-in-the-Loop AI Agent Approvals in React": "/guides/human-in-the-loop-ai-agent-approvals",
  "Bollard UI vs Zod Validation: Use Both Where They Fit": "/guides/bollard-ui-vs-zod-validation",
  "Bollard UI vs Zod: Complementary Validation": "/guides/bollard-ui-vs-zod-validation",
  "Bollard UI vs React Hook Form: A Complementary Pair": "/guides/bollard-ui-vs-react-hook-form",
  "Bollard UI vs Confirm Dialogs: Choose the Right Review": "/guides/bollard-ui-vs-confirm-dialogs",
  "Bollard UI vs Confirm Dialogs: Which to Choose": "/guides/bollard-ui-vs-confirm-dialogs",
  "Prevent Duplicate Form Submissions in React: Safe Submits": "/guides/react-prevent-duplicate-form-submit",
  "Prevent Duplicate Form Submissions in React": "/guides/react-prevent-duplicate-form-submit",
  "Prevent Duplicate Form Submits in React": "/guides/react-prevent-duplicate-form-submit",
}

export function articlePathForTitle(title: string) {
  return ARTICLE_PATHS[title]
}

export function articleSchema(path: string, headline: string, description: string) {
  const url = `${SITE_URL}${path}`
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#publisher`,
        name: "Bollard UI",
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
        founder: {
          "@type": "Person",
          "@id": `${SITE_URL}/#author`,
          name: ARTICLE_AUTHOR,
          url: "https://github.com/Tusharkhadde",
          sameAs: SAME_AS_PROFILES,
        },
        sameAs: SAME_AS_PROFILES,
      },
      {
        "@type": "TechArticle",
        "@id": `${url}#article`,
        headline,
        description,
        url,
        datePublished: ARTICLE_DATE_PUBLISHED,
        dateModified: ARTICLE_DATE_MODIFIED,
        author: { "@id": `${SITE_URL}/#publisher` },
        publisher: { "@id": `${SITE_URL}/#publisher` },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "Bollard UI",
          url: SITE_URL,
        },
      },
    ],
  }
}
