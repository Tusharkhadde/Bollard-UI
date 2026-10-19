# Bollard UI adoption research

Retrieved 2026-10-19–20 using Exa for discovery and Context.dev for page extraction where noted. Notes summarize sources in my own words. A source listed as discovered-only has not yet been extracted in full by Context.dev; no validation changes are justified by snippets alone.

## Checkout

- Stripe says asynchronous payment confirmation can take several seconds; disable repeat submission while pending, show progress, and re-enable submission while presenting an error if confirmation fails. Extracted with Context.dev. [Stripe: Build a two-step confirmation](https://docs.stripe.com/payments/build-a-two-step-confirmation)
- Stripe documents idempotency for safely retrying API requests; the key belongs at the server/API boundary and does not replace UI pending-state handling. Exa discovered this primary page; Context.dev extraction returned only the page introduction in this pass, so details are **unverified here**. [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- WCAG requires automatically detected input errors to identify the field and describe the error in text. It does not prescribe a single error layout. Extracted with Context.dev. [W3C WCAG 2.2 SC 3.3.1](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
- Payment total, currency, and payment-rail-specific recovery rules must come from the merchant/payment provider; a generic UI cannot promise reversibility. [Stripe: PaymentIntents](https://docs.stripe.com/payments/payment-intents) (Exa-discovered; further source extraction needed).

## Sign-up and login

- React Hook Form supports registration, schema/resolver-based validation, and submit handlers; its docs are task-oriented and provide a runnable starting example. Extracted with Context.dev. [React Hook Form: Get Started](https://react-hook-form.com/get-started)
- Zod's `safeParse` returns a discriminated success/error result rather than throwing, and asynchronous refinements require async parsing. Extracted with Context.dev. [Zod: Basic usage](https://zod.dev/basics)
- Account recovery workflows should verify a newly changed recovery address and may retain an old recovery channel during a protective period. Google documents its own seven-day policy; do not generalize that duration to other products. Exa-discovered only. [Google Account recovery options](https://support.google.com/accounts/answer/183723?hl=en)
- Email typo suggestion rules and provider validity rules were not established from an authoritative source in this pass. Do not block based on guessed mailbox/domain heuristics; verify delivery or ownership through the product's own mechanisms.

## Account settings

- Recovery contact changes are security-sensitive, but grace periods, verification, and old-channel notifications vary by provider. Google's documented policy is product-specific, not a universal rule. [Google Account recovery options](https://support.google.com/accounts/answer/183723?hl=en) (Exa-discovered only).
- No universal official source was found for arbitrary email/phone change flows. Keep UI guidance advisory and enforce identity, authorization, verification, and uniqueness in the consuming server.

## Danger zone

- Confirmation should describe the actual action and impact, while undo is only valid when the backend can truly restore state. The initial Exa results included non-primary design material, so these are useful design leads, not verified normative rules. **Unverified** pending a primary WAI/Apple/Material/GitHub source read.
- For destructive code-hosting operations, inspect the operation-specific official GitHub/Git documentation before recommending a specific confirmation flow. This pass did not extract those documents; no behavior changes based on this note.

## Forms

- WCAG 2.2 SC 3.3.1 requires text identification/description of automatically detected input errors. WCAG 3.3.3 covers suggestions when known. Neither requires a specific UI pattern, so keep text linked to the affected control and do not rely on color alone. Extracted with Context.dev. [W3C WCAG 2.2: Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), [W3C WCAG 2.2: Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
- React Aria recommends visible labels for most fields, with descriptions available to assistive technology. It also describes native form submission and integration with form libraries. Extracted with Context.dev. [React Aria: Forms](https://react-aria.adobe.com/forms)
- The component docs can show RHF and Zod as an optional adapter example, but must not imply those packages are required by Bollard components.

## Messaging

- Recipient typos, reply-all mistakes, accidental bulk sends, and delivery errors are meaningful product risks, but no universal standard for heuristic recipient matching or send undo duration was verified here. Use non-blocking suggestions unless the sender's own data verifies the recipient; model undo only where the backend provides a real cancellation window. **Unverified**.
- Stripe/payment retry guidance does not directly establish messaging semantics; do not reuse a payment idempotency policy for email/SMS without the provider's docs.

## Developer tools

- Generic confirmation language is not proven to prevent the targeted command mistake by itself. Confirmations should be enforced by the operation boundary, not only the UI; this is an engineering recommendation awaiting primary-source evidence for each tool-specific flow. **Unverified**.
- Registry source imports and declared package dependencies can be mechanically validated using the existing `scripts/validate-registry.mjs`; this is repository evidence, not external research.

## Scheduling

- The IANA time-zone database represents location-based civil-time rules that change over time; future predictions can be affected by future government changes. IANA recommends user-facing geographic descriptions rather than expecting users to choose raw timezone identifiers unaided. Extracted with Context.dev. [IANA tz database theory](https://data.iana.org/time-zones/theory.html), [IANA tz database links and updates](https://data.iana.org/time-zones/tz-link.html)
- Do not treat a local wall-clock timestamp as a UTC instant without the intended IANA zone and a policy for ambiguous/nonexistent local times. A complete RFC-level rule audit remains to be done; no code change is made based only on this summary.

## India

- NPCI's UPI consolidated circular describes a UPI ID as a PSP-issued unique identifier, with examples shaped like `username@pspname`, and requires supported ID creation/management rules. This supports treating handles as provider-dependent, not maintaining a guessed exhaustive suffix allowlist. Exa found the official circular; Context.dev could not extract its PDF in this pass, so use as a research lead and **verify the relevant circular section before changing validation**. [NPCI: UPI Consolidated Circular (PDF)](https://www.npci.org.in/uploads/UPI_Consolidated_Circular_f9c023a0ef.pdf)
- NPCI states UPI Number is a distinct numeric payment address and describes 8–10 digit forms. It is not interchangeable with an alphanumeric UPI ID. Exa-discovered; Context.dev extraction returned an empty body. **No code change based on this source yet.** [NPCI: UPI Number](https://www.npci.org.in/product/upi/upi-number)
- RBI's FAQ describes IFSC as an 11-character alphanumeric code: first four alphabetic bank identifier characters, fifth character `0`, and the remaining six branch identifier characters. Exa found the official answer; Context.dev extracted the official FAQ page, but the retrieved response was truncated in the displayed excerpt. [RBI: NEFT FAQ](https://www.rbi.org.in/scripts/FAQDisplay.aspx?Id=60)
- India Post describes a PIN as six digits and explains the geographic meaning of the groups. Exa found the official source, but Context.dev returned no page body for the UAT URL; do not treat detailed routing claims as independently extracted yet. [India Post: PIN Code](https://uat.indiapost.gov.in/MBE/Pages/Content/Pincode.aspx)
- An Income Tax Department document says PAN has five letters, four digits, and one letter. This is official but found in an older filing template; current official format guidance still needs checking before making a validation change. [Income Tax Department: Form 15H CSV instructions (PDF)](https://eportal.incometax.gov.in/iec/foservices/assets/pdf/Instructions_for_filling_Form15H_Basic_Details.pdf)
- UIDAI's authentication document describes online identity authentication and yes/no responses; this does not by itself establish a client-side checksum algorithm. Do **not** infer that Aadhaar checksum validation is a definitive validity check from a length/checksum alone. [UIDAI: Aadhaar Authentication API](https://uidai.gov.in/images/resource/aadhaar_authentication_api_2_5.pdf)
- Exa found UIDAI's API error guidance stating that the Aadhaar check is 12 digits plus Verhoeff, and UIDAI's 2018 VID circular states VID is a 16-digit random number whose final digit is a Verhoeff checksum. Context.dev returned 404 for the official API error page and circular PDF extraction was not completed; the code must remain unchanged until those official pages can be read in full and the present implementation is audited against them. [UIDAI: API Error Handling](https://uidai.gov.in/en/916-developer-section/data-and-downloads-section/11351-api-error), [UIDAI: Virtual ID Circular (PDF)](https://uidai.gov.in/images/46Circular_for_Implementation_of_Virtual_ID_UID_Token_and_Limited_KYC_0001_compressed.pdf) (**Exa-discovered, Context.dev extraction unavailable**).
- TRAI's National Numbering Plan material describes ten-digit dialing for mobile services within India. It does not establish which individual subscriber numbers are active/assigned; preserve international input and distinguish format checks from reachability. Exa-discovered only. [TRAI: Revision of National Numbering Plan (PDF)](https://www.trai.gov.in/sites/default/files/2024-09/CP_06062024_0.pdf)
- GSTIN structure and the complete PAN format/character semantics were not independently confirmed from current primary guidance in this pass. **Unverified; leave current rules unchanged.**

## Adjacent libraries and adoption patterns

Official docs inspected or extracted:

1. [shadcn/ui forms](https://ui.shadcn.com/docs/forms) — docs frame forms around user-owned markup and form-library integrations. Context.dev extracted the documentation page, but its short result mainly exposed navigation; detailed claims need another targeted pass.
2. [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) — composable anatomy, modal/non-modal state, focus management, labelled title/description, Escape behavior. Exa and Context.dev results.
3. [React Aria Forms](https://react-aria.adobe.com/forms) — labels, descriptions, native form semantics, and optional form-library integration. Context.dev extracted.
4. [HeroUI Forms](https://heroui.com/docs/components/form) — **not yet verified in this research pass**; URL is a research lead, not a finding.
5. [React Hook Form](https://react-hook-form.com/get-started) — installation and compact runnable example. Context.dev extracted.
6. [Zod](https://zod.dev/basics) — schema parsing, typed results, explicit sync/async APIs. Context.dev extracted.
7. [Conform](https://conform.guide/) — progressive enhancement, standard HTML form markup, and schema integration. Context.dev extracted.
8. [TanStack Form](https://tanstack.com/form/latest/docs/framework/react/overview) — headless, strongly typed form-state approach. Context.dev extracted.
9. [IMask](https://imask.js.org/guide.html) — **not yet verified in this pass**; no rule inferred from the URL.

Public complaints/issues and forum discussions were not systematically sampled. Claims about recurring developer complaints are therefore **unverified**; do not encode them as findings until a dated issue/discussion URL is captured and read.

## Evidence limits and next research

- The registry includes 341 copy-paste entries and 341 demos, but external validation sources cannot certify all components. Findings must be mapped per component, and components with no governing standard should be explicitly marked not applicable.
- Context.dev's organization limit allowed one concurrent request. Parallel calls were rate-limited, then subsequent source extraction was run sequentially. Some India pages returned empty or clipped bodies.
- Do not make validation-rule changes based on snippets, unofficial sources, examples that are only provider-specific, or currently unverified claims above.
- Next: extract the relevant NPCI circular pages/sections, RBI, UIDAI, India Post, TRAI, GST and Income Tax sources; read HeroUI and IMask docs; sample primary GitHub issue threads for adoption pain; then add exact component-to-source mapping to the manifest.
