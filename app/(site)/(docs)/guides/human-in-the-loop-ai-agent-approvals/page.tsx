import type { Metadata } from "next"

import { RichGuideArticle } from "@/components/site/rich-guide"

const title = "Human-in-the-Loop AI Agent Approvals in React"
const description = "Design human approval for consequential AI agent tool calls with a React review surface, scoped decisions, server enforcement and an audit trail."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guides/human-in-the-loop-ai-agent-approvals" },
  openGraph: { title: `${title} | Bollard UI`, description, url: "/guides/human-in-the-loop-ai-agent-approvals", type: "article" },
  twitter: { title: `${title} | Bollard UI`, description, card: "summary_large_image" },
}

const sections = [
  {
    title: "Start with the existing approval lifecycle",
    paragraphs: [
      "Bollard’s AI agent safety quickstart at /agent-safety covers the core lifecycle: a tool request is checked against policy, a person reviews the proposed action, and the runtime enforces the decision before resuming. This guide builds on that foundation with the implementation details teams need when a review crosses a browser, an agent worker and a privileged service. Keep the quickstart as the source for installation and the basic component API; use this page to reason about binding, expiry, retries and audit records.",
      "A review surface should make the proposed effect legible. Show the tool name, target resource, meaningful arguments, requested scope and any irreversible consequence. Avoid presenting a broad JSON blob as if visibility alone made it reviewable. Summarize important fields in plain language and let a reviewer inspect raw details when that helps them assess the call.",
    ],
  },
  {
    title: "Bind approval to an immutable proposal",
    paragraphs: [
      "An approval should refer to one pending proposal, not to a general session or a future action. Persist a unique call ID with the authenticated actor, tool name, normalized arguments, target, policy version and creation time. Store a digest of the canonical proposal or an immutable record so that changing a URL or amount after approval cannot silently change what will execute.",
      "The browser sends the decision for that call ID to your application service. The service loads the pending proposal itself and compares the reviewer, scope and state with the stored record. Do not accept a client-supplied tool payload as the source of truth when resuming execution.",
    ],
    code: { filename: "Approval decision request", source: `type DecisionRequest = {\n  callId: string\n  decision: \"approve\" | \"deny\"\n}\n\nasync function decide(request: DecisionRequest) {\n  return fetch(\"/api/agent/pending-calls/decision\", {\n    method: \"POST\",\n    headers: { \"Content-Type\": \"application/json\" },\n    body: JSON.stringify(request),\n  })\n}` },
  },
  {
    title: "Enforce the decision at the side-effect boundary",
    paragraphs: [
      "The service that performs the tool action must verify that the decision is approved, current and scoped to the exact proposal. Re-check the reviewer’s authorization, the resource’s current state and applicable policy immediately before execution. A user may lose a role after approving; a deployment target may change; or the agent may retry with different arguments. Fail closed when any of those comparisons fail.",
      "A React approval component is not an authorization system. Treat its state as presentation only. The server should reject missing, denied, expired, replayed or mismatched decisions and should never allow a hidden form field or browser flag to bypass the approval boundary.",
    ],
  },
  {
    title: "Expire pending decisions and handle retries safely",
    paragraphs: [
      "A pending approval can become stale while a person is away. Give it a clear expiry and explain why a new review is needed when the target, arguments or policy change. Do not silently carry approval forward to a modified proposal. Keep the denial and timeout paths explicit so the agent knows whether it should stop, ask a new question or provide a safe alternative.",
      "Execution can succeed even if the worker loses its network response. Use an idempotency key tied to the approved call and store the execution outcome. On retry, return the existing result instead of repeating a payment, deployment, message send or data deletion. Distinguish “still running” from “failed” and give the reviewer a way to check status rather than approve a duplicate action.",
    ],
  },
  {
    title: "Keep an audit record useful to an investigation",
    paragraphs: [
      "Record who proposed the call, which policy evaluated it, who reviewed it, what decision they made, when they made it, which proposal version they saw, and what execution result followed. Make the record append-only or otherwise tamper-evident according to your system’s requirements. Keep sensitive tool arguments out of broad application logs; use a protected audit store with access controls and retention limits.",
      "The interface can help reviewers understand scope, but it should not leak secrets just because a tool payload contains them. Redact credentials and private values from the summary, identify what has been omitted, and offer an appropriately protected inspection route if the reviewer needs more detail. The audit trail should preserve the decision context without turning every secret into a permanent plaintext record.",
    ],
  },
  {
    title: "Test the boundary as well as the dialog",
    paragraphs: [
      "Exercise approval, denial, timeout, stale policy, modified arguments, changed permissions, duplicate browser submissions, worker retries and a lost response after successful execution. Test two reviewers racing to decide the same proposal and ensure only the allowed state transition wins. Verify the action endpoint directly, without the UI, so a test proves that the service—not the button—enforces the rule.",
      "For the component setup, API shape and basic lifecycle, continue with the AI agent safety quickstart. The agent approvals recipe maps the related Bollard components. These pages complement one another: the quickstart gets the review surface connected; this guide focuses on durable, scoped execution.",
    ],
  },
]

export default function HumanApprovalGuide() {
  return <RichGuideArticle title={title} lead="A review dialog can make a proposed agent action understandable. Safe execution also needs a durable proposal, a scoped decision and enforcement beside the tool that changes state." sections={sections} components={[{ name: "agent-action-approve", label: "Agent Action Approve" }, { name: "two-person-approve", label: "Two Person Approve" }, { name: "ai-paste-guard", label: "AI Paste Guard" }]} related={[{ href: "/agent-safety", label: "AI agent safety quickstart" }, { href: "/use-cases/agent-approvals", label: "Agent approval recipe" }]} />
}
