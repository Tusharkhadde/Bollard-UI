import type { Metadata } from "next"
import Link from "next/link"

import { CodeBlock } from "@/components/site/code-block"
import { DocPage, DocSection, Note, Prose, inlineCode, proseLink } from "@/components/site/doc-page"
import { InstallCommand } from "@/components/site/install-command"
import { RegistrySetup } from "@/components/site/registry-setup"
import { highlight } from "@/lib/highlight"

const description = "Add a human approval step to consequential AI agent tool calls with Bollard UI. Review the proposed action, enforce the decision at the tool boundary, then resume safely."

export const metadata: Metadata = {
  title: "AI agent safety quickstart",
  description,
  alternates: { canonical: "/agent-safety" },
  openGraph: { title: "AI agent safety quickstart · Bollard UI", description, url: "/agent-safety" },
}

const sections = [
  { id: "lifecycle", label: "Approval lifecycle" },
  { id: "install", label: "Install" },
  { id: "integration", label: "Integrate" },
  { id: "enforcement", label: "Enforce" },
]

const example = `"use client"

import { AgentActionApprove } from "@/components/ui/agent-action-approve"

export function PendingAgentAction({ call, decide }) {
  return (
    <AgentActionApprove
      call={call}
      allowedHosts={["api.example.com"]}
      onDecision={async (decision) => {
        await decide({ callId: call.id, decision })
      }}
    />
  )
}`

const code = (path: string, source: string) => ({ path, source, lines: source.split("\n").length, code: highlight(source) })

export default function AgentSafetyPage() {
  return (
    <DocPage eyebrow="Agent / human-in-the-loop" title="Add approval where an agent can cause change." lead="Bollard renders the review surface. Your agent runtime must pause before the side effect, persist the decision, and enforce it when the tool is resumed." sections={sections}>
      <DocSection id="lifecycle" title="Approval lifecycle">
        <ol className="grid gap-3 sm:grid-cols-2">
          {[
            ["1", "Tool request", "The agent proposes a consequential tool call."],
            ["2", "Policy check", "Your runtime blocks known-bad scope and decides whether review is required."],
            ["3", "Human approval", "Bollard shows the action, target, scope and consequence for an explicit decision."],
            ["4", "Execute and record", "Only an approved, current request runs. Store the decision and outcome."],
          ].map(([number, title, detail]) => (
            <li key={number} className="rounded-xl border bg-surface p-4">
              <span className="font-mono text-xs text-brand">{number}</span>
              <h3 className="mt-2 font-medium">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{detail}</p>
            </li>
          ))}
        </ol>
      </DocSection>

      <DocSection id="install" title="Install the review surface">
        <RegistrySetup className="rounded-xl border bg-surface p-5" />
        <InstallCommand name="agent-pack" className="mt-5" />
        <p className="text-sm text-muted-foreground">The pack includes <code className={inlineCode}>agent-action-approve</code>, <code className={inlineCode}>ai-paste-guard</code> and <code className={inlineCode}>undo-toast</code>.</p>
      </DocSection>

      <DocSection id="integration" title="Render the pending request">
        <Prose>
          <p>Pass a pending tool call into <code className={inlineCode}>AgentActionApprove</code>. Send its decision to your own server or agent harness, keyed to the exact pending call ID.</p>
        </Prose>
        <CodeBlock lineNumbers={false} files={[code("pending-agent-action.tsx", example)]} />
        <p className="text-sm text-muted-foreground">See the <Link href="/components/agent-action-approve" className={proseLink}>Agent Action Approve API</Link> for the call shape and available review options.</p>
      </DocSection>

      <DocSection id="enforcement" title="Enforce the decision at the tool boundary">
        <Note tone="brand">A review UI is not authorization. Reject stale, missing, denied or scope-mismatched approvals in the same service that performs the side effect.</Note>
        <Prose>
          <ul>
            <li>Bind an approval to one tool call, target and argument set.</li>
            <li>Re-check the actor&apos;s authorization, target scope and policy immediately before execution.</li>
            <li>Expire unanswered approvals and fail closed when the reviewer or policy service is unavailable.</li>
            <li>Write the decision and execution result to your audit trail.</li>
          </ul>
          <p>Use the <Link href="/use-cases/agent-approvals" className={proseLink}>agent-approval recipe</Link> for the related components and the <Link href="/playground" className={proseLink}>playground</Link> to try the interaction before integrating it.</p>
        </Prose>
      </DocSection>
    </DocPage>
  )
}
