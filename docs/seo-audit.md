# Bollard UI SEO & AEO/GEO Technical Audit

**Audit Date:** November 17, 2026  
**Target Repository:** Bollard UI (`https://bollard-ui.vercel.app`)  
**Scope:** Architecture, metadata, indexing directives, search engine & AI agent visibility (Google AI Overviews, Perplexity, ChatGPT Search, Claude, Gemini).

---

## 1. Executive Summary & Existing Assets

Bollard UI is a Next.js App Router application providing a registry of 341 copy-paste React components that prevent expensive user mistakes in forms and critical workflows.

### What Already Exists & Functions Well:
1. **Next.js App Router & Metadata API**:
   - `app/layout.tsx` defines standard global metadata (`metadataBase`, `title.template`, `description`, `openGraph`, `twitter`, `robots`/`googleBot` snippet directives, and verification keys).
   - Viewport and theme colors are exported via the Next.js `Viewport` API.
   - PWA web manifest route exists at `app/manifest.ts`.
2. **Component Routes**:
   - Dynamic route `app/(site)/components/[name]/page.tsx` renders rich server-rendered documentation for all catalog components (props table, install commands, accessibility, server boundary rules, and related components).
   - Dynamic OG image generation exists at `app/(site)/components/[name]/opengraph-image.tsx`.
3. **Structured Data**:
   - Root layout contains `Organization` and `WebSite` JSON-LD.
   - Component routes render `BreadcrumbList` and `SoftwareSourceCode` JSON-LD.
   - Homepage renders `SoftwareApplication` JSON-LD.
4. **Guides & Use Cases**:
   - Deep guides exist under `app/(site)/(docs)/guides/` (including comparison pages and India validation).
   - Use cases exist under `app/(site)/use-cases/`.
5. **AI Discovery**:
   - `app/llms.txt/route.ts` serves plain text discovery for coding assistants.

---

## 2. Gap Analysis & What Is Missing

| Area | Current State | Deficit / Required Fix |
| :--- | :--- | :--- |
| **Robots Directives (`app/robots.ts`)** | Generic `userAgent: "*"` with disallows on `/api/`, `/preview/`, `/*?*`. | Missing explicit rules for search & AI crawlers (`Googlebot`, `Bingbot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`, and commented `GPTBot`). |
| **Sitemap (`app/sitemap.ts`)** | Lists static pages, catalog items, guides, and use cases with a shared hardcoded date. | Missing dedicated flow hub routes (`/flows/...`), missing per-item / git-derived `lastModified` timestamps. |
| **Flow Hubs & Clean URLs** | Flow filters currently route to `/components?flow=<id>`. | Needs indexable path-based routes (`/flows/checkout`, `/flows/danger-zone`, etc.) with unique metadata, answer-first intro, and component tables, canonicalized properly. |
| **Answer-First AEO Content** | Component pages have headings like "What it catches" and "Limitations". | Missing 30–60 word direct subject-verb-object answer blocks directly under H1, question-phrased H2 headings ("When should I use X?", "How do I install X?"), and explicit "Last updated" & version timestamps. |
| **Metadata Consistency & Guardrails** | Individual metadata functions manually generate titles and descriptions. | No automated build-time check preventing duplicate titles/descriptions, over-length titles (>65 chars), over-length descriptions (>160 chars), or missing canonicals/H1s. |
| **Structured Data Completeness** | Standard articles lack `Article`/`TechArticle` schema; FAQs on homepage lack visible-matched `FAQPage` schema. | Add `TechArticle` schema to all rich guides and `FAQPage` schema matching visible FAQs. |
| **Machine-Readable Markdown Docs** | Only `/llms.txt` exists. | Missing raw markdown endpoints (e.g. `/components/[name].md`) for AI agents. |
| **Site Constants Source of Truth** | `lib/site.ts` defines `SITE_URL` and `REPO_URL`. | Missing `SITE_NAME`, `TWITTER_HANDLE` (`@devtushark`), and canonical `absoluteUrl()` helper. |
| **Measurement & Trust Signals** | GitHub stars fetched live; email feedback in footer. | Need clear documentation for AI referral analytics segmentation (`chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `claude.ai`), replacement of plain mailto with GitHub issues/security advisories, and an AI prompt evaluation panel. |

---

## 3. Plan of Execution

- **Phase 1**: Produce comprehensive keyword map (`docs/keyword-map.md`) mapping all 341 components and flows to unique, winnable queries.
- **Phase 2**: Ensure raw server-rendered crawlability, update `app/robots.ts`, add indexable flow hubs (`/flows/[slug]`), and enrich `app/sitemap.ts`.
- **Phase 3**: Consolidate `lib/site.ts`, scale metadata generation, add build-time metadata validation script (`scripts/check-metadata.mjs`).
- **Phase 4**: Upgrade component page templates to the Answer-First format with question headings, direct answers, and version/update metadata.
- **Phase 5**: Build path-based flow hubs and ensure all comparison/guide pages exceed 700+ words with bi-directional internal linking.
- **Phase 6**: Standardize JSON-LD schemas (`Article`, `TechArticle`, `BreadcrumbList`, `SoftwareSourceCode`, `FAQPage`) strictly matching visible copy.
- **Phase 7**: Optimize Core Web Vitals (dynamic loading below fold, font swap, layout shift prevention).
- **Phase 8**: Provide markdown endpoints for developer AI agents.
- **Phase 9**: Add AI referral tracking documentation and 30-prompt monthly evaluation panel (`scripts/ai-visibility-prompts.md`).
- **Phase 10**: Deliver human off-page action plan (`docs/offpage-checklist.md`).
