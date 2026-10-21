export interface Guide {
  slug: string
  title: string
  description: string
  component: string
  componentTitle: string
  mistake: string
  outcome: string
  steps: string[]
  installCommand: string
}

const defineGuide = (guide: Omit<Guide, "installCommand">): Guide => ({
  ...guide,
  installCommand: `npx shadcn@4.21.0 add @bollard/${guide.component}`,
})

/** Search-intent pages that connect common implementation problems to a runnable guard rail. */
export const GUIDES: Guide[] = [
  defineGuide({
    slug: "prevent-duplicate-form-submissions-react",
    title: "Prevent duplicate form submissions in React",
    description: "Add a reusable React submit guard that disables repeat sends while a request is pending and gives people a clear retry path.",
    component: "safe-submit",
    componentTitle: "Safe Submit",
    mistake: "The same form or payment is sent twice while the first request is still pending.",
    outcome: "One deliberate submission, a visible pending state, and a form that remains recoverable if the request fails.",
    steps: [
      "Install the component into your shadcn project.",
      "Pass the async save or payment handler you already use.",
      "Keep idempotency and authorization checks on the server; the UI prevents accidental repeats, not malicious requests.",
    ],
  }),
  defineGuide({
    slug: "validate-shadcn-email-input-react",
    title: "Validate a shadcn email input in React",
    description: "Catch incomplete and typo-prone email addresses with a copy-paste React field that fits shadcn styling and keeps the user’s value intact.",
    component: "email-input",
    componentTitle: "Email Input",
    mistake: "A sign-up is lost because an address such as gmial.com is saved without a useful correction path.",
    outcome: "Clear inline feedback before submit, with the final ownership and deliverability check still handled by your server.",
    steps: [
      "Install the input and place it where you would use a normal form control.",
      "Use its correction prompt as assistance, not proof that an inbox belongs to a person.",
      "Verify the address with your normal server-side email confirmation flow.",
    ],
  }),
  defineGuide({
    slug: "react-confirm-delete-dangerous-action",
    title: "Confirm a dangerous delete action in React",
    description: "Replace a vague “Are you sure?” dialog with a typed confirmation that makes the target and consequence explicit before deletion.",
    component: "type-to-confirm",
    componentTitle: "Type to Confirm",
    mistake: "A destructive action is approved on autopilot because the dialog hides what will be deleted.",
    outcome: "A deliberate confirmation step that states the exact action while preserving keyboard and screen-reader access.",
    steps: [
      "Install the confirmation component near the destructive action.",
      "Require the person to type a meaningful target or phrase before enabling deletion.",
      "Authorize and execute deletion on the server only after confirming the caller and target.",
    ],
  }),
  defineGuide({
    slug: "react-upi-id-input-validation",
    title: "Validate a UPI ID input in React",
    description: "Help people enter a well-formed UPI ID without incorrectly rejecting an unfamiliar but valid VPA in an offline client-side form.",
    component: "upi-id-input",
    componentTitle: "UPI ID Input",
    mistake: "A payment form blocks an unfamiliar UPI ID just because it is not in a local demo list.",
    outcome: "Format guidance in the browser and a clear handoff to your payment provider for real account verification.",
    steps: [
      "Install the input and use it for VPA entry.",
      "Treat a well-formed unknown ID as unverified, not invalid.",
      "Confirm the payee and payment eligibility with your PSP or provider before moving money.",
    ],
  }),
  defineGuide({
    slug: "react-field-validation-without-changing-ui-library",
    title: "Add React field validation without changing your UI library",
    description: "Use a headless field hook with shadcn/ui, HeroUI, or a custom control while retaining your existing markup, styles, and accessibility decisions.",
    component: "use-bollard-field",
    componentTitle: "useBollardField",
    mistake: "Adding validation forces a team to replace the controls and design system it already owns.",
    outcome: "Async-safe field state, accessible error wiring, and typed failure reporting while the control remains yours.",
    steps: [
      "Install the hook and connect value, blur, and aria props to your existing control.",
      "Use your current validator or schema adapter for the rule itself.",
      "Map server errors back with setError and keep the server as the source of truth.",
    ],
  }),
]

export function guideFor(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug)
}
