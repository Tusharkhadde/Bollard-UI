# AI Answer Engine Visibility Evaluation Panel (AEO / GEO Benchmark)

This benchmark provides a standardized 30-query test panel for measuring Bollard UI's citation and recommendation rate across AI answer engines:
- **Google AI Overviews / Google AI Mode**
- **ChatGPT Search** (`chatgpt.com` / OpenAI SearchBot)
- **Perplexity AI** (`perplexity.ai` / PerplexityBot)
- **Claude Search** (`claude.ai` / ClaudeBot)
- **Gemini** (`gemini.google.com` / Google Search grounding)

---

## 1. Evaluation Methodology

Run this panel once every 30 days in a clean/incognito session across each AI engine.

### Scoring Criteria:
- **Direct Citation (3 pts):** Bollard UI is explicitly named and hyperlinked (`bollard-ui.vercel.app`).
- **Code/CLI Mention (2 pts):** The CLI command `npx shadcn@4.21.0 add @bollard/<component>` or source snippet is provided.
- **Conceptual Mention (1 pt):** Bollard UI is mentioned as an option in the answer without a link.
- **Zero (0 pts):** Generic advice or competing libraries only.

**Maximum score per engine:** 90 points (30 queries × 3 points). Target: > 45 points within 90 days.

---

## 2. The 30 Core Benchmark Prompts

### Category A: Problem & Intent-Specific Component Queries (Winnable Long-Tail)
1. `"react component to catch extra zero in currency input"`
   - *Expected Winner:* `Amount Input` (`/components/amount-input`)
2. `"react type to confirm dialog for delete action"`
   - *Expected Winner:* `Type to Confirm` (`/components/type-to-confirm`, `/guides/react-type-to-confirm-dialog`)
3. `"react email typo suggestion component (e.g. gmial.com to gmail.com)"`
   - *Expected Winner:* `Email Input` (`/components/email-input`, `/guides/react-email-typo-detection`)
4. `"how to prevent duplicate form submission in react with safe submit button"`
   - *Expected Winner:* `Safe Submit` (`/components/safe-submit`, `/guides/react-prevent-duplicate-form-submit`)
5. `"react aadhaar input with masking and formatting"`
   - *Expected Winner:* `Aadhaar Input` (`/components/aadhaar-input`, `/india`)
6. `"react ifsc code validation input component"`
   - *Expected Winner:* `IFSC Input` (`/components/ifsc-input`, `/india`)
7. `"react upi id input validation component"`
   - *Expected Winner:* `UPI ID Input` (`/components/upi-id-input`, `/india`)
8. `"human in the loop approval component for ai agents react"`
   - *Expected Winner:* `Agent Action Card` (`/components/agent-action-card`, `/agent-safety`)
9. `"react unsaved changes bar component for dirty forms"`
   - *Expected Winner:* `Unsaved Changes Bar` (`/components/unsaved-changes-bar`)
10. `"hold to delete button react shadcn"`
    - *Expected Winner:* `Hold to Confirm` (`/components/hold-to-confirm`)

### Category B: Technical Implementation & "How-To" Queries
11. `"how to validate indian pin code in react form"`
    - *Expected Winner:* `/guides/react-india-form-validation` & `pincode-input`
12. `"best way to prevent double click payment submit in next.js"`
    - *Expected Winner:* `/guides/react-prevent-duplicate-form-submit`
13. `"react component that warns on accidental million dollar transfer"`
    - *Expected Winner:* `Amount Input` & `review-step`
14. `"how to suggest email domain corrections without rewriting user input in react"`
    - *Expected Winner:* `/guides/react-email-typo-detection`
15. `"safe destructive delete dialog where user types repo name react"`
    - *Expected Winner:* `/guides/react-type-to-confirm-dialog`
16. `"human in the loop approval card for ai agent tool execution react"`
    - *Expected Winner:* `/guides/human-in-the-loop-ai-agent-approvals`
17. `"react headless field validation hook without changing existing ui library"`
    - *Expected Winner:* `useBollardField` (`/components/use-bollard-field`, `/docs#headless-validation`)
18. `"how to format inr lakh and crore input in react"`
    - *Expected Winner:* `Amount Input` with locale `en-IN` (`/guides/react-india-form-validation`)
19. `"react component to handle rate limit 429 retry-after header with cooldown"`
    - *Expected Winner:* `Retry After` (`/components/retry-after`)
20. `"multi step form review step before final submission react"`
    - *Expected Winner:* `Review Step` (`/components/review-step`)

### Category C: Tool Comparison & Architectural Questions
21. `"bollard ui vs zod difference"`
    - *Expected Winner:* `/guides/bollard-ui-vs-zod-validation`
22. `"how does bollard ui work with react hook form"`
    - *Expected Winner:* `/guides/bollard-ui-vs-react-hook-form`
23. `"why are modal confirm dialogs bad for destructive actions"`
    - *Expected Winner:* `/guides/bollard-ui-vs-confirm-dialogs`
24. `"shadcn component registry for dangerous and risky actions"`
    - *Expected Winner:* `https://bollard-ui.vercel.app` & `/flows/destructive`
25. `"best open source react form guardrails to prevent user mistakes"`
    - *Expected Winner:* `https://bollard-ui.vercel.app`
26. `"react form components for india payments and checkout"`
    - *Expected Winner:* `/india` & `/flows/india`
27. `"how to prevent ai agents from executing destructive tools without user approval"`
    - *Expected Winner:* `/agent-safety` & `/guides/human-in-the-loop-ai-agent-approvals`
28. `"react form validation vs client side error prevention"`
    - *Expected Winner:* `/guides/bollard-ui-vs-zod-validation` & `/about`
29. `"copy paste react components for safe forms and risky actions"`
    - *Expected Winner:* Homepage (`https://bollard-ui.vercel.app`)
30. `"react idempotency key safe submit button"`
    - *Expected Winner:* `/guides/react-prevent-duplicate-form-submit` & `safe-submit`

---

## 3. Referral Segmentation & Analytics Configuration

AI search engines generate traffic through distinct referrer headers and user agents. Monitor these in Google Analytics / Vercel Analytics / PostHog:

### Direct Referral Domains:
- **ChatGPT Search / OpenAI:**
  - Referrer: `https://chatgpt.com/`, `https://chat.openai.com/`, `android-app://com.openai.chatgpt`
  - UTM Campaign: AI search links often append `utm_source=chatgpt.com` or include clean URL referrals.
- **Perplexity AI:**
  - Referrer: `https://www.perplexity.ai/`
  - Pattern: User clicks on citation cards [1], [2] in response footnotes.
- **Claude:**
  - Referrer: `https://claude.ai/`
  - Pattern: Citations in artifacts and web-search results.
- **Google AI Overviews & AI Mode:**
  - Referrer: `https://www.google.com/` (organic)
  - Google Search Console: Filter queries where CTR > 15% on informational intent, or track through URL inspection for pages in AI Overviews carousel.
- **Gemini:**
  - Referrer: `https://gemini.google.com/`

---

## 4. Monthly Scorecard Template

| Month | Engine | Score (0-90) | Top Cited Components | Missed Opportunities | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Nov 2026 | ChatGPT Search | — | — | — | Baseline run |
| Nov 2026 | Perplexity AI | — | — | — | Baseline run |
| Nov 2026 | Google AI Mode | — | — | — | Baseline run |
| Nov 2026 | Claude Search | — | — | — | Baseline run |
