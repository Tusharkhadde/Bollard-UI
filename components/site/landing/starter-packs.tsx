"use client"

import { CopyButton } from "@/components/site/copy-button"
import { trackStarterPackCopy } from "@/lib/analytics"
import { Section, SectionHeading } from "./section-heading"

const PACKS = [
  ["fintech-pack", "Fintech", "Payments, transfers and high-stakes amounts.", ["amount-input", "duplicate-payment-guard", "bank-transfer-timing"], 4],
  ["agent-pack", "Agent", "Human-in-the-loop checks for AI actions.", ["agent-action-approve", "ai-paste-guard", "undo-toast"], 3],
  ["danger-zone-pack", "Danger zone", "Destructive changes with a recovery path.", ["danger-zone", "type-to-confirm", "account-deletion-readback"], 5],
  ["india-pack", "India", "India-aware IDs, payments and amounts.", ["phone-input", "aadhaar-input", "ifsc-input"], 6],
  ["checkout-pack", "Checkout", "A safer payment submit.", ["amount-input", "safe-submit", "duplicate-payment-guard"], 5],
  ["signup-login-pack", "Sign-up", "Catch account setup errors.", ["email-input", "password-input", "username-input"], 6],
  ["account-settings-pack", "Settings", "Review sensitive account changes.", ["email-change-guard", "session-list", "unsaved-changes-bar"], 5],
  ["forms-pack", "Forms", "Save drafts and catch errors.", ["draft-restore", "unsaved-changes-bar", "error-summary"], 6],
  ["messaging-pack", "Messaging", "Check what and where you send.", ["reply-all-guard", "recipient-check", "attachment-nudge"], 5],
  ["devtools-pack", "Dev tools", "Guard infrastructure actions.", ["environment-badge", "kube-context-guard", "force-push-confirm"], 6],
  ["scheduling-pack", "Scheduling", "Clarify dates and time zones.", ["unambiguous-date", "timezone-picker", "time-confirm"], 6],
] as const

export function StarterPacks({ registryBase }: { registryBase: string }) {
  return (
    <Section id="starter-packs" labelledBy="starter-packs-heading">
      <SectionHeading id="starter-packs-heading" eyebrow="Starter packs" title="Install guardrails by workflow.">
        One command brings the related components into your project. Start here, then browse the full catalog below.
      </SectionHeading>
      <ul className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
        {PACKS.map(([name, label, description, components, count]) => (
          <li key={name} className="flex min-w-0 items-start justify-between gap-3 bg-background p-4 sm:p-5">
            <div className="min-w-0"><h3 className="min-h-5 text-sm font-medium">{label}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p><p className="mt-3 font-mono text-[11px] text-muted-foreground">{count} components · {components.join(", ")}</p></div>
            <CopyButton value={`npx shadcn@latest add @bollard/${name}`} label={`Copy ${label} pack install command`} onCopy={() => trackStarterPackCopy(name)} className="h-8 shrink-0 px-2.5 text-[11px]">Copy</CopyButton>
          </li>
        ))}
      </ul>
    </Section>
  )
}
