export type UseCase = {
  slug: "safe-payments" | "danger-zone" | "agent-approvals" | "signup-safety"
  eyebrow: string
  title: string
  description: string
  pack: string
  packLabel: string
  components: readonly { name: string; title: string; reason: string }[]
  checks: readonly string[]
  recipe: string
  serverBoundary: string
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
    recipe: `import { AmountInput } from "@/components/ui/amount-input"\nimport { SafeSubmit } from "@/components/ui/safe-submit"\n\n<AmountInput label="Amount (₹)" value={amount} onValueChange={setAmount} typical={10000} />\n<SafeSubmit onSubmit={() => createTransferOnServer(amount)}>Send money</SafeSubmit>`,
    serverBoundary: "The amount readback and duplicate-submit lock are client-side UX. Validate the amount, authorize the recipient, and use a server-side idempotency key in createTransferOnServer.",
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
    recipe: `import { TypeToConfirm } from "@/components/ui/type-to-confirm"\n\n<TypeToConfirm\n  open={confirmOpen}\n  onOpenChange={setConfirmOpen}\n  phrase="DELETE workspace-name"\n  description="This removes the workspace and its projects."\n  onConfirm={() => deleteWorkspaceOnServer(workspaceId)}\n/>`,
    serverBoundary: "Typed confirmation helps prevent accidental activation; it is not authorization. Re-check the actor, workspace scope, and deletion policy on the server.",
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
    recipe: `import { AgentActionApprove } from "@/components/ui/agent-action-approve"\n\n<AgentActionApprove\n  call={{ tool: "delete_file", args: { path: "/workspace/old-report.csv" }, intent: "Remove the outdated report", cwd: "/workspace" }}\n  onDecision={(decision) => recordDecisionOnServer(proposedAction.id, decision)}\n/>`,
    serverBoundary: "The approval UI is not a security boundary. Bind approval to an authenticated human, the exact action payload, and a short-lived server-side approval record before execution.",
  },
  {
    slug: "signup-safety",
    eyebrow: "Sign-up and account creation",
    title: "Catch address typos before account access is sent.",
    description: "Pair a typo-aware email field with a pending-aware submit action, then verify ownership server-side before activating the account.",
    pack: "signup-login-pack",
    packLabel: "Install the sign-up pack",
    components: [
      { name: "email-input", title: "Email Input", reason: "Suggests likely provider corrections without changing the address automatically." },
      { name: "password-policy-input", title: "Password Policy Input", reason: "Shows password requirements while a person edits the field." },
      { name: "safe-submit", title: "Safe Submit", reason: "Prevents repeated submits while the request is in progress." },
    ],
    checks: ["Let the person review any suggested email correction.", "Keep password rules aligned with server policy.", "Verify the email address before granting account access."],
    recipe: `import { EmailInput } from "@/components/ui/email-input"\nimport { SafeSubmit } from "@/components/ui/safe-submit"\n\n<EmailInput label="Work email" value={email} onValueChange={setEmail} />\n<SafeSubmit onSubmit={() => createAccountOnServer({ email, password })}>Create account</SafeSubmit>`,
    serverBoundary: "Email correction and password hints are client-side assistance. Enforce password policy, rate limits, and email verification on the server before enabling the account.",
  },
]

export function findUseCaseBySlug(slug: string) {
  return USE_CASES.find((useCase) => useCase.slug === slug)
}
