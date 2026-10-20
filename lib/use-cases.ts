export type UseCase = {
  slug: "safe-payments" | "danger-zone" | "agent-approvals"
  eyebrow: string
  title: string
  description: string
  pack: string
  packLabel: string
  components: readonly { name: string; title: string; reason: string }[]
  checks: readonly string[]
}

export const USE_CASES: readonly UseCase[] = [
  {
    slug: "safe-payments",
    eyebrow: "Payments and checkout",
    title: "Let people catch the extra zero before money moves.",
    description: "Add amount readbacks, duplicate-submit protection and recipient checks to the moments where a small form mistake is expensive.",
    pack: "fintech-pack",
    packLabel: "Install the fintech pack",
    components: [
      { name: "amount-input", title: "Amount Input", reason: "Flags an amount that is far from the expected value and spells it out." },
      { name: "duplicate-payment-guard", title: "Duplicate Payment Guard", reason: "Stops a second payment submission while the first one is still in flight." },
      { name: "payee-check", title: "Payee Check", reason: "Makes the recipient visible before a transfer is confirmed." },
    ],
    checks: ["Show the entered amount in plain language.", "Block repeat submits while a payment is pending.", "Ask for a deliberate confirmation before sending."],
  },
  {
    slug: "danger-zone",
    eyebrow: "Destructive account actions",
    title: "Make destructive actions understandable before they happen.",
    description: "Replace habitual confirmation dialogs with readbacks, typed acknowledgements and recovery windows that match the consequence of the action.",
    pack: "danger-zone-pack",
    packLabel: "Install the danger-zone pack",
    components: [
      { name: "type-to-confirm", title: "Type to Confirm", reason: "Requires a deliberate typed acknowledgement for irreversible actions." },
      { name: "account-deletion-readback", title: "Account Deletion Readback", reason: "Names what will be removed before an account is deleted." },
      { name: "undo-toast", title: "Undo Toast", reason: "Leaves a short, visible recovery path after a reversible change." },
    ],
    checks: ["Name the data or access that will change.", "Match the confirmation strength to the consequence.", "Keep a recovery route where the action can be undone."],
  },
  {
    slug: "agent-approvals",
    eyebrow: "AI agent safety",
    title: "Keep a human in the loop when an agent can cause real change.",
    description: "Show the action, scope and consequence before an agent sends a message, changes data or uses a sensitive value.",
    pack: "agent-pack",
    packLabel: "Install the agent-safety pack",
    components: [
      { name: "agent-action-approve", title: "Agent Action Approve", reason: "Presents an agent action for explicit human approval." },
      { name: "ai-paste-guard", title: "AI Paste Guard", reason: "Warns before sensitive or accidental content is pasted into an AI tool." },
      { name: "undo-toast", title: "Undo Toast", reason: "Makes reversible automation easy to correct immediately." },
    ],
    checks: ["Expose what the agent will do and where.", "Require a person to approve consequential actions.", "Offer undo when the action can be safely reversed."],
  },
]

export function useCaseBySlug(slug: string) {
  return USE_CASES.find((useCase) => useCase.slug === slug)
}
