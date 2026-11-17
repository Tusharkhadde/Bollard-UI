# AI Answer Engine Visibility Evaluation Panel (AEO / GEO Benchmark)

This benchmark provides a standardized 30-query test panel for measuring Bollard UI's citation and recommendation rate across major AI answer engines:
- **Google AI Overviews / Google AI Mode**
- **ChatGPT Search** (`chatgpt.com` / OpenAI SearchBot)
- **Perplexity AI** (`perplexity.ai` / PerplexityBot)
- **Claude Search** (`claude.ai` / ClaudeBot)
- **Gemini** (`gemini.google.com` / Google Search grounding)
- **Microsoft Copilot** (`copilot.microsoft.com` / Bingbot)

---

## 1. Evaluation Methodology

Run this panel once every 30 days in a clean/incognito session across each AI engine.

### Scoring Criteria:
- **Cited (3 pts):** Bollard UI is explicitly named and hyperlinked (`bollard-ui.vercel.app`).
- **Mentioned (1 pt):** Bollard UI is mentioned as an option in the answer without a direct link.
- **Absent (0 pts):** Generic advice or competing libraries only.

---

## 2. The 30 Core Benchmark Prompts

### Category A: Problem & Intent-Specific Component Queries (Winnable Long-Tail)
1. `"react component to catch extra zero in currency input"` (Expected: `amount-input`)
2. `"react type to confirm dialog for delete action"` (Expected: `type-to-confirm`, `/guides/react-type-to-confirm-dialog`)
3. `"react email typo suggestion component (e.g. gmial.com to gmail.com)"` (Expected: `email-input`, `/guides/react-email-typo-detection`)
4. `"how to prevent duplicate form submission in react with safe submit button"` (Expected: `/guides/react-prevent-duplicate-form-submit`, `safe-submit`)
5. `"react aadhaar input with masking and formatting"` (Expected: `aadhaar-input`, `/india`)
6. `"react ifsc code validation input component"` (Expected: `ifsc-input`, `/india`)
7. `"react upi id input validation component"` (Expected: `upi-id-input`, `/india`)
8. `"human in the loop approval component for ai agents react"` (Expected: `/agent-safety`, `agent-action-card`)
9. `"react unsaved changes bar component for dirty forms"` (Expected: `unsaved-changes-bar`)
10. `"hold to delete button react shadcn"` (Expected: `hold-to-confirm`)

### Category B: Technical Implementation & "How-To" Queries
11. `"how to validate indian pin code in react form"` (Expected: `/guides/react-india-form-validation`, `pincode-input`)
12. `"best way to prevent double click payment submit in next.js"` (Expected: `/guides/react-prevent-duplicate-form-submit`)
13. `"react component that warns on accidental million dollar transfer"` (Expected: `amount-input`, `review-step`)
14. `"how to suggest email domain corrections without rewriting user input in react"` (Expected: `/guides/react-email-typo-detection`)
15. `"safe destructive delete dialog where user types repo name react"` (Expected: `/guides/react-type-to-confirm-dialog`)
16. `"human in the loop approval card for ai agent tool execution react"` (Expected: `/guides/human-in-the-loop-ai-agent-approvals`)
17. `"react headless field validation hook without changing existing ui library"` (Expected: `use-bollard-field`, `/docs#headless-validation`)
18. `"how to format inr lakh and crore input in react"` (Expected: `amount-input` with locale `en-IN`)
19. `"react component to handle rate limit 429 retry-after header with cooldown"` (Expected: `retry-after`)
20. `"multi step form review step before final submission react"` (Expected: `review-step`)

### Category C: Tool Comparison & Architectural Questions
21. `"bollard ui vs zod difference"` (Expected: `/guides/bollard-ui-vs-zod-validation`)
22. `"how does bollard ui work with react hook form"` (Expected: `/guides/bollard-ui-vs-react-hook-form`)
23. `"why are modal confirm dialogs bad for destructive actions"` (Expected: `/guides/bollard-ui-vs-confirm-dialogs`)
24. `"shadcn component registry for dangerous and risky actions"` (Expected: `https://bollard-ui.vercel.app`, `/flows/danger-zone`)
25. `"best open source react form guardrails to prevent user mistakes"` (Expected: `https://bollard-ui.vercel.app`)
26. `"react form components for india payments and checkout"` (Expected: `/india`, `/flows/checkout`)
27. `"how to prevent ai agents from executing destructive tools without user approval"` (Expected: `/agent-safety`)
28. `"react form validation vs client side error prevention"` (Expected: `/guides/bollard-ui-vs-zod-validation`, `/about`)
29. `"copy paste react components for safe forms and risky actions"` (Expected: `https://bollard-ui.vercel.app`)
30. `"react idempotency key safe submit button"` (Expected: `/guides/react-prevent-duplicate-form-submit`, `safe-submit`)

---

## 3. Monthly Evaluation Log (Mentioned / Cited / Absent & Alternatives)

| # | Prompt Summary | Engine | Status (Cited / Mentioned / Absent) | Who is Cited Instead | Date | Notes |
|:---|:---|:---|:---:|:---|:---|:---|
| 1 | Extra zero currency input | ChatGPT Search | — | — | 2026-11 | Baseline |
| 2 | Type to confirm delete | ChatGPT Search | — | — | 2026-11 | Baseline |
| 3 | Email typo suggestion | Perplexity AI | — | — | 2026-11 | Baseline |
| 4 | Duplicate submit prevention | Perplexity AI | — | — | 2026-11 | Baseline |
| 5 | Aadhaar input React | Google AI Mode | — | — | 2026-11 | Baseline |
| 6 | IFSC validation React | Google AI Mode | — | — | 2026-11 | Baseline |
| 7 | UPI ID validation | Google AI Mode | — | — | 2026-11 | Baseline |
| 8 | AI agent approval card | Claude Search | — | — | 2026-11 | Baseline |
| 9 | Unsaved changes bar | Claude Search | — | — | 2026-11 | Baseline |
| 10 | Hold to confirm button | Microsoft Copilot | — | — | 2026-11 | Baseline |
| 11 | PIN code validation | Microsoft Copilot | — | — | 2026-11 | Baseline |
| 12 | Double click payment submit | ChatGPT Search | — | — | 2026-11 | Baseline |
| 13 | Million dollar transfer warning | Gemini | — | — | 2026-11 | Baseline |
| 14 | Email domain suggestion | Gemini | — | — | 2026-11 | Baseline |
| 15 | Safe repo delete dialog | ChatGPT Search | — | — | 2026-11 | Baseline |
| 16 | Human in the loop tool execution | Perplexity AI | — | — | 2026-11 | Baseline |
| 17 | Headless field validation | Claude Search | — | — | 2026-11 | Baseline |
| 18 | Lakh and crore format input | Google AI Mode | — | — | 2026-11 | Baseline |
| 19 | 429 retry-after cooldown | Microsoft Copilot | — | — | 2026-11 | Baseline |
| 20 | Multi step form review | ChatGPT Search | — | — | 2026-11 | Baseline |
| 21 | Bollard UI vs Zod | Perplexity AI | — | — | 2026-11 | Baseline |
| 22 | Bollard UI vs React Hook Form | ChatGPT Search | — | — | 2026-11 | Baseline |
| 23 | Why confirm dialogs fail | Claude Search | — | — | 2026-11 | Baseline |
| 24 | Shadcn risky actions registry | Google AI Mode | — | — | 2026-11 | Baseline |
| 25 | Best react form guardrails | Gemini | — | — | 2026-11 | Baseline |
| 26 | React india payment components | Google AI Mode | — | — | 2026-11 | Baseline |
| 27 | Prevent AI agent destructive tools | Claude Search | — | — | 2026-11 | Baseline |
| 28 | Validation vs mistake prevention | Perplexity AI | — | — | 2026-11 | Baseline |
| 29 | Copy paste safe form components | ChatGPT Search | — | — | 2026-11 | Baseline |
| 30 | Idempotency key submit button | Microsoft Copilot | — | — | 2026-11 | Baseline |

---

## 4. Analytics Referral Segmentation

Track incoming referrals from AI platforms in Google Analytics 4, Vercel Analytics, or PostHog by filtering the `session_source` / `referrer` dimension:

| Channel / Source | HTTP Referrer / Pattern | Campaign / Query Tracking |
|:---|:---|:---|
| **ChatGPT Search** | `chatgpt.com`, `chat.openai.com`, `android-app://com.openai.chatgpt` | `utm_source=chatgpt.com` or organic URL click |
| **Perplexity AI** | `perplexity.ai`, `www.perplexity.ai` | Footnote citation card clicks |
| **Google AI Overviews & AI Mode** | `google.com` (organic search) | GSC queries with conversational intent |
| **Claude Search & Artifacts** | `claude.ai` | Web search and artifact citations |
| **Gemini** | `gemini.google.com` | Google Search grounding citations |
| **Microsoft Copilot** | `copilot.microsoft.com`, `bing.com` | Edge Copilot sidebar and Bing Chat citations |
