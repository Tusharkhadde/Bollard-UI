# Bollard UI SEO & AEO Audit v2: Entity, Facts & Answer Layer

**Date:** November 17, 2026  
**Subject:** Bollard UI (`https://bollard-ui.vercel.app`)  
**Scope:** Evaluation of current SEO/AEO/GEO foundation against the required "entity + answer + facts" layer for Google, Bing, ChatGPT Search, Perplexity, Claude, and Gemini.

---

## 1. Current State Assessment

In the earlier phase, the technical base was significantly upgraded:
- **Indexability & Crawlability:** `app/robots.ts` explicitly allows Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, and Google-Extended. Vercel deployment returns HTTP 200 without bot-blocking challenges.
- **Sitemap Coverage:** `app/sitemap.ts` generates 380 clean, deduplicated URLs (341 components, 8 flow hubs, 4 use-case recipes, 13 guides, and 14 static pages) with deterministic `lastModified` dates derived from git history (`lib/component-dates.json`).
- **Clean Routing:** Query-parameter flow routes (`/components?flow=checkout`) were upgraded to path-based flow hubs (`/flows/checkout`, `/flows/signup-login`, etc.) with their own metadata and component listings.
- **Metadata Strictness:** `scripts/check-metadata.mjs` enforces build-time gates (titles ≤ 65 chars, descriptions ≤ 160 chars, zero duplicates, self-referencing canonicals, H1 presence) across all 56 static HTML output pages.
- **Initial Answer-First Layout:** Component pages feature a 30–60 word answer block below the `<h1>`, question-style `<h2>` headings, and version metadata.
- **Deep Guides:** 8 long-form guides (e.g. `react-prevent-duplicate-form-submit`, `react-india-form-validation`, `react-type-to-confirm-dialog`, Zod/RHF comparisons) exist with rich technical copy, code examples, and comparison tables.
- **Machine-Readable Layer:** Route handler at `/components/[name].md` (via rewrite to `/api/components/[name]`) and `/llms.txt` serve raw documentation to AI coding agents.

---

## 2. Gap Analysis: Missing or Weak Areas

Despite strong crawlability and clean metadata, the repository requires a dedicated **"entity + answer + facts" layer** to eliminate entity ambiguity and enable authoritative citations by AI answer engines:

### A. Entity Graph & JSON-LD
1. **Isolated Schemas vs. Cohesive Graph:** `app/layout.tsx` injects an isolated `Organization` script, while individual pages render separate `<JsonLd>` scripts. This results in disconnected nodes rather than a single, coherent `@graph` per page.
2. **Missing Canonical Anchor (`#publisher`):** Schema nodes across component and guide pages duplicate publisher details rather than referencing a stable `@id` (`#publisher`).
3. **Missing `#library` Entity:** The homepage lacks a comprehensive `SoftwareSourceCode` node with `@id: "#library"`, `alternateName` (`["Bollard UI", "bollard-ui", "@bollard registry"]`), explicit `softwareRequirements` ("React 19+, Tailwind CSS v4, shadcn CLI"), free offer (`offers: { price: 0 }`), and automated `dateModified`.
4. **Disambiguation Deficiency:** Neither schema nor visible page copy contains the unambiguous `disambiguatingDescription`:
   > *"Bollard UI is an independent open-source React component library for preventing user input mistakes, unrelated to physical bollards or other products with a similar name."*
5. **Component & Guide Schema Linking:** Component pages do not declare `isPartOf: { "@id": "#library" }`, and guides use generic `Article` instead of `TechArticle` anchored to `#publisher`.
6. **Hard Rule Violation (Personal Email):** `lib/site.ts`, `about/page.tsx`, and `security/page.tsx` expose `tusharkhadde06@gmail.com`. The hard rules strictly forbid personal emails in JSON-LD or page source, requiring GitHub Issues / Security Advisory links instead.

### B. Facts Layer
1. **Absence of Visible Facts Table:** Neither the homepage, `/docs`, nor component pages render a structured, quotable "Facts" table.
2. **No Single Source of Truth for Quantitative Facts:** Component and category counts are computed ad-hoc, creating risks of drift between homepage marketing copy and documentation.
3. **Quotable Fact Consistency:** Technical facts (license, price, requirements, SSR support, test status, limitations) need a central canonical definition and consistent presentation.

### C. Answer-First Q&A & Component FAQs
1. **Missing Per-Component FAQs:** While the homepage has `HOME_FAQS`, individual component pages lack a visible FAQ of 4–8 questions phrased as real user queries ("How do I stop an extra zero in a payment field in React?").
2. **Duplication Guard:** Component FAQs must be programmatically derived from unique registry fields (mistakes prevented, props, SSR behavior, accessibility, alternatives) to prevent generic boilerplate. A build gate must verify that no two component pages share >50% of FAQ text.

### D. Intent Ownership (`docs/query-map.md`)
1. While `docs/keyword-map.md` exists, a refined `docs/query-map.md` is needed to explicitly establish 1:1 ownership for high-intent niche queries (India forms, duplicate submits, currency extra zeros, destructive confirmations, AI agent approvals).

### E. Technical Hygiene & Verification
1. **HTTP Security Headers:** `next.config.ts` lacks standard security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`).
2. **IndexNow:** Bing IndexNow key file (`public/<token>.txt`) and submission script are missing.
3. **Automated Verification Suite:** Need automated build-time gates in `scripts/`:
   - No-JS raw HTML render validation (H1, answer block, facts table, FAQ, install command, JSON-LD)
   - Hidden-content scanner (failing on hidden text or links)
   - Schema-visibility alignment check
   - Future date validator
   - Broken internal link checker

---

## 3. Implementation Plan

1. **Phase 1: Entity Graph (JSON-LD)**
   - Unify per-page JSON-LD into a single `@graph` with stable `#publisher`, `#website`, and `#library` IDs.
   - Add visible `disambiguatingDescription` to homepage and `/docs`.
   - Update component schemas (`isPartOf: #library`) and guides (`TechArticle`).
   - Remove personal email references; point exclusively to GitHub Issues and Advisories.
2. **Phase 2: Facts Block**
   - Create `lib/facts.ts` with canonical numbers, requirements, and limitations.
   - Build `<FactsTable>` component and place visibly on Homepage, `/docs`, and component pages.
   - Add build check ensuring homepage and docs agree on catalog statistics.
3. **Phase 3: Answer-First Q&A & Component FAQs**
   - Implement `generateComponentFaq(item)` generating 4–8 distinct questions per component.
   - Render visible accordion FAQ on component pages and flow hubs.
   - Add FAQ duplication test in build scripts.
4. **Phase 4: Intent Ownership & Query Map**
   - Produce `docs/query-map.md` mapping winnable queries 1:1 with owning URLs.
5. **Phase 5: Freshness & Automation**
   - Automate `dateModified` from `lib/component-dates.json` and git.
   - Add future date rejection in build checks.
6. **Phase 6: Crawl Access & Technical Hygiene**
   - Add HTTP security headers to `next.config.ts`.
   - Add Bing IndexNow key and script.
   - Verify Core Web Vitals on key pages.
7. **Phase 7: Verification Suite**
   - Create integrated test script `scripts/verify-seo-aeo.mjs` executing all 5 mandatory checks and failing build on violations.
8. **Phase 8: Measurement & Off-Page Deliverables**
   - Update `docs/ai-visibility-prompts.md` and `docs/offpage-checklist.md`.
