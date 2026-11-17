# Bollard UI Off-Page SEO & AEO Action Plan

This document outlines the actionable off-page steps, indexation workflows, and ecosystem distribution tasks for the project maintainer (**Tushar Khadde** / `@devtushark`).

---

## 1. Search Engine Console Setup & Indexation

### Google Search Console
- [ ] Log in to [Google Search Console](https://search.google.com/search-console).
- [ ] Add property `https://bollard-ui.vercel.app` (URL prefix or Domain property).
- [ ] Confirm ownership via the meta tag rendered in the `<head>` (`process.env.GOOGLE_SITE_VERIFICATION`).
- [ ] Submit sitemap URL: `https://bollard-ui.vercel.app/sitemap.xml`.
- [ ] Inspect and manually request indexing for the primary seed URLs:
  - `https://bollard-ui.vercel.app/`
  - `https://bollard-ui.vercel.app/about`
  - `https://bollard-ui.vercel.app/india`
  - `https://bollard-ui.vercel.app/flows`
  - `https://bollard-ui.vercel.app/guides/react-prevent-duplicate-form-submit`
  - `https://bollard-ui.vercel.app/guides/react-india-form-validation`
  - `https://bollard-ui.vercel.app/guides/react-type-to-confirm-dialog`
  - `https://bollard-ui.vercel.app/guides/bollard-ui-vs-zod-validation`

### Bing Webmaster Tools & IndexNow
- [ ] Log in to [Bing Webmaster Tools](https://www.bing.com/webmasters).
- [ ] Import the verified property directly from Google Search Console.
- [ ] Submit `https://bollard-ui.vercel.app/sitemap.xml`.
- [ ] Verify that Bingbot crawls and surfaces Bollard UI in Microsoft Copilot / Bing Chat results.

---

## 2. GitHub Repository Optimization (High-Authority Entity Anchor)

GitHub is one of the highest-authority entity anchors recognized by Google Knowledge Graph, OpenAI, and Claude.

- [ ] Repository: `https://github.com/Tusharkhadde/Bollard-UI`
- [ ] **About / Description**:
  > "341 copy-paste React components (shadcn CLI install) that stop expensive user mistakes in forms and risky actions."
- [ ] **Website Field**: Set strictly to `https://bollard-ui.vercel.app`.
- [ ] **Repository Topics**: Add all 12 target topics:
  `react`, `nextjs`, `shadcn`, `tailwindcss`, `form-validation`, `accessibility`, `typescript`, `ui-components`, `human-in-the-loop`, `design-system`, `input-validation`, `geo`
- [ ] **README Header**:
  Include direct links to the documentation:
  ```markdown
  [![Website](https://img.shields.io/badge/docs-bollard--ui.vercel.app-blue)](https://bollard-ui.vercel.app)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  ```
- [ ] When ready to open source code visibility, set `REPO_PUBLIC = true` in `lib/site.ts`.

---

## 3. Machine-Readable & AI Agent Discovery

- [ ] Submit `https://bollard-ui.vercel.app/llms.txt` to the curated directory at [llmstxt.org](https://llmstxt.org).
- [ ] Confirm that OpenAI's `OAI-SearchBot`, `ChatGPT-User`, Perplexity's `PerplexityBot`, and Anthropic's `ClaudeBot` receive HTTP 200 without challenge barriers (already configured in `robots.ts`).
- [ ] Run monthly evaluation prompts from `scripts/ai-visibility-prompts.md`.

---

## 4. Ecosystem & Directory Submissions

Target directories with high developer trust and organic authority:

- [ ] **shadcn Community Directories:**
  - Submit Bollard UI to [shadcn/ui Community Registries](https://ui.shadcn.com).
  - Submit to [Awesome shadcn/ui](https://github.com/shadcn-ui/awesome-shadcn-ui).
  - List on [shadcn.directory](https://shadcn.directory).
- [ ] **React & Open Source Directories:**
  - [Daily.dev](https://daily.dev) (share technical launch post).
  - [Best of JS](https://bestofjs.org) (submit repo once public).
  - [LibHunt React](https://react.libhunt.com).
- [ ] **Launch Platforms:**
  - Product Hunt: Schedule launch with demo videos of "Disasters Prevented" (e.g., catching extra zero on $10,000 transfer).
  - Hacker News Show HN: *"Show HN: Bollard UI – 341 React guardrails for forms and risky actions"* (Focus on UX philosophy: why schema validation alone doesn't prevent accidental extra zeros or double submits).

---

## 5. High-Value Community Answering (Natural Backlinks & GEO Training)

Answer questions where developers actively experience the problem Bollard UI solves:

- [ ] **Reddit (r/reactjs, r/nextjs, r/webdev):**
  - Share the guide on *"Preventing duplicate form submits and double charges in React"* with full source and architectural explanation.
  - Share the guide on *"Building accessible Type-to-Confirm dialogs for destructive actions"*.
- [ ] **Stack Overflow:**
  - Search for questions:
    - *"How to format and validate Indian currency Lakh and Crore in React input"*
    - *"How to suggest email domain corrections like gmial in React"*
    - *"Prevent double click submit in Next.js Server Actions"*
    - *"Accessible type to confirm delete button React"*
  - Provide complete, runnable code in the answer, referencing Bollard UI as a copy-paste open-source reference.

---

## 6. Monthly Monitoring Routine

1. **Week 1:** Check Google Search Console > Performance > Queries. Identify queries with high impressions but low CTR; adjust titles and opening answer blocks in `docs/keyword-map.md`.
2. **Week 2:** Run `node scripts/check-metadata.mjs` before any content or code release to prevent title/description bloat or duplicates.
3. **Week 3:** Execute the 30-prompt panel in `scripts/ai-visibility-prompts.md` across ChatGPT, Perplexity, Claude, and Gemini. Log citation score.
4. **Week 4:** Review Webmaster coverage report for 404s, redirect chains, or non-indexed canonicals.
