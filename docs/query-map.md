# Bollard UI Query-to-URL Map (AEO & SEO 1:1 Intent Ownership)

**Version:** 2.0.0  
**Updated:** November 17, 2026  
**Principle:** For every target query, exactly one owning URL. No two URLs target the same primary query.

---

## 1. Top 30 High-Intent Queries (Winnable Long-Tail Focus)

| # | Target Search Query | Owning URL | Search Intent | Failure Prevented / Purpose |
|---|:---|:---|:---:|:---|
| 1 | **react amount input component** | `/components/amount-input` | `install` | Flags 10x extra-zero errors in currency fields |
| 2 | **react type to confirm dialog** | `/components/type-to-confirm` | `install` | Stops accidental autopilot deletion of critical resources |
| 3 | **react email typo detection** | `/components/email-input` | `how-to` | Catches domain typos like gmial.com before signup submission |
| 4 | **react duplicate submit prevention** | `/guides/react-prevent-duplicate-form-submit` | `how-to` | Locks submit buttons and manages idempotency keys |
| 5 | **react unsaved changes warning** | `/components/unsaved-changes-bar` | `how-to` | Warns users before navigating away from dirty forms |
| 6 | **react upi id validation** | `/components/upi-id-input` | `how-to` | Validates Indian UPI VPA syntax with verified payee display |
| 7 | **aadhaar input react** | `/components/aadhaar-input` | `install` | 12-digit Aadhaar input with Verhoeff checksum & masking |
| 8 | **ifsc validation react** | `/components/ifsc-input` | `how-to` | Validates 11-character Indian financial codes and bank branch |
| 9 | **human in the loop approval component for ai agents react** | `/agent-safety` | `how-to` | Requires explicit user review before AI agents execute tools |
| 10 | **react form validation for india** | `/guides/react-india-form-validation` | `informational` | Complete guide for Aadhaar, IFSC, UPI, PIN, and lakh amounts |
| 11 | **react prevent duplicate payment** | `/components/duplicate-payment-guard` | `how-to` | Blocks repeat card transactions on slow or retry connections |
| 12 | **react prevent pasting secrets into form** | `/components/secret-paste-guard` | `how-to` | Intercepts accidental pasting of API keys and bearer tokens |
| 13 | **react otp paste input** | `/components/otp-paste-input` | `install` | Dispatches multi-digit SMS OTP paste across discrete cells |
| 14 | **react auto restore form draft** | `/components/draft-restore` | `how-to` | Preserves and recovers unsubmitted form state on reload |
| 15 | **react environment badge staging production** | `/components/environment-badge` | `install` | Prevents engineers from executing actions in production by mistake |
| 16 | **react unambiguous date format component** | `/components/unambiguous-date` | `install` | Eliminates international MM/DD versus DD/MM confusion |
| 17 | **react hold to confirm button** | `/components/hold-to-confirm` | `install` | Replaces modal popups with 2-second press-and-hold confirmation |
| 18 | **react undo toast notification** | `/components/undo-toast` | `install` | Provides a 5-10 second window to revert destructive actions |
| 19 | **react india pincode validation input** | `/components/pincode-input` | `how-to` | Validates 6-digit postal PIN codes and displays delivery area |
| 20 | **react phone input with country code** | `/components/phone-input` | `install` | International dial code selector with normalized E.164 output |
| 21 | **react password input with strength indicator** | `/components/password-input` | `install` | Evaluates password entropy and dictionary checks in the browser |
| 22 | **react danger zone settings component** | `/components/danger-zone` | `install` | Isolated, styled danger zone container for irreversible mutations |
| 23 | **headless react form validation hook** | `/components/use-bollard-field` | `how-to` | Validates existing UI controls without replacing design systems |
| 24 | **react card expiry date input** | `/components/card-expiry-input` | `install` | Formats MM/YY and prevents checkout submit with expired cards |
| 25 | **react active sessions management component** | `/components/session-list` | `install` | Surfaces active logins, IP addresses, and revoke triggers |
| 26 | **react account deletion confirmation readback** | `/components/account-deletion-readback` | `how-to` | Summarizes deleted data and workspaces before permanent delete |
| 27 | **react reauthentication gate modal** | `/components/reauth-gate` | `how-to` | Prompts for re-auth before changing sensitive email or password |
| 28 | **react reply all warning guard** | `/components/reply-all-guard` | `how-to` | Warns before broadcasting emails to large distribution lists |
| 29 | **react email recipient check component** | `/components/recipient-check` | `how-to` | Highlights external recipient domains on internal threads |
| 30 | **react force push confirmation component** | `/components/force-push-confirm` | `install` | Guards git force push executions in developer consoles |

---

## 2. Niche Intent Clusters & Topic Hubs

### Cluster 1: India Form Validation & Payments (`/india`)
- **Owning Hub:** `/india`
  - *Primary Query:* `react india form components`
- **Topic Guide:** `/guides/react-india-form-validation`
  - *Primary Query:* `react form validation for india`
- **Key Components:**
  - `/components/aadhaar-input` → `aadhaar input react`
  - `/components/ifsc-input` → `ifsc validation react`
  - `/components/upi-id-input` → `react upi id validation`
  - `/components/pincode-input` → `react india pincode validation input`

### Cluster 2: Payment Safety & Checkout (`/flows/checkout`)
- **Owning Hub:** `/flows/checkout`
  - *Primary Query:* `react checkout components for payment safety`
- **Topic Guide:** `/guides/react-prevent-duplicate-form-submit`
  - *Primary Query:* `react duplicate submit prevention`
- **Key Components:**
  - `/components/amount-input` → `react amount input component`
  - `/components/safe-submit` → `react safe submit button`
  - `/components/card-expiry-input` → `react card expiry date input`
  - `/components/duplicate-payment-guard` → `react prevent duplicate payment`

### Cluster 3: Destructive Actions & Danger Zones (`/flows/danger-zone`)
- **Owning Hub:** `/flows/danger-zone`
  - *Primary Query:* `react danger zone components for destructive actions`
- **Topic Guide:** `/guides/react-type-to-confirm-dialog`
  - *Primary Query:* `react type to confirm dialog tutorial`
- **Key Components:**
  - `/components/type-to-confirm` → `react type to confirm dialog`
  - `/components/hold-to-confirm` → `react hold to confirm button`
  - `/components/undo-toast` → `react undo toast notification`
  - `/components/account-deletion-readback` → `react account deletion confirmation readback`

### Cluster 4: AI Agent Approvals & Safety (`/agent-safety`)
- **Owning Hub:** `/agent-safety`
  - *Primary Query:* `human in the loop approval component for ai agents react`
- **Topic Guide:** `/guides/human-in-the-loop-ai-agent-approvals`
  - *Primary Query:* `human in the loop ai agent approvals guide react`
- **Key Components:**
  - `/components/agent-action-approve` → `react ai agent action approval`
  - `/components/agent-action-card` → `react ai agent tool execution card`
  - `/components/agent-budget-guard` → `react ai agent token budget guard`

### Cluster 5: Sign-up, Login & Email Typos (`/flows/signup-login`)
- **Owning Hub:** `/flows/signup-login`
  - *Primary Query:* `react signup and login validation components`
- **Topic Guide:** `/guides/react-email-typo-detection`
  - *Primary Query:* `react email typo detection guide`
- **Key Components:**
  - `/components/email-input` → `react email typo detection`
  - `/components/otp-paste-input` → `react otp paste input`
  - `/components/password-strength-meter` → `react password input with strength indicator`

---

## 3. Tool Comparison & Architecture Guides

| Comparison Guide | Owning URL | Primary Target Query | Tradeoff Summary |
|---|:---|:---|:---|
| **Bollard UI vs Zod** | `/guides/bollard-ui-vs-zod-validation` | `bollard ui vs zod difference` | Complementary: Bollard UI handles inline visual UX guardrails; Zod handles schema parsing at boundaries. |
| **Bollard UI vs React Hook Form** | `/guides/bollard-ui-vs-react-hook-form` | `how does bollard ui work with react hook form` | Complementary: RHF manages form state and submit events; Bollard UI provides drop-in guarded UI inputs. |
| **Bollard UI vs Confirm Dialogs** | `/guides/bollard-ui-vs-confirm-dialogs` | `why are confirm dialogs bad for destructive actions` | Intentional friction: Generic modals cause confirmation fatigue; Bollard UI uses typed phrases and hold gestures. |
