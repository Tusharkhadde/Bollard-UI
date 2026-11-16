import type { Metadata } from "next"

import { ComparisonGuide } from "@/components/site/comparison-guide"

const title = "Bollard UI vs Zod Validation: Use Both Where They Fit"
const description = "Compare Bollard UI and Zod: Zod describes and parses data rules, while Bollard adds React guidance for common input mistakes and risky actions."
export const metadata: Metadata = { title, description, alternates: { canonical: "/guides/bollard-ui-vs-zod-validation" }, openGraph: { title: `${title} | Bollard UI`, description, url: "/guides/bollard-ui-vs-zod-validation", type: "article" }, twitter: { title: `${title} | Bollard UI`, description, card: "summary_large_image" } }

const rows = [
  { topic: "Main job", bollard: "Visible input guardrails and review patterns in React.", other: "Schema definition, parsing and validation of application data." },
  { topic: "Where it runs", bollard: "Copied React components and a headless field hook.", other: "JavaScript/TypeScript runtime; usable on client and server." },
  { topic: "Best boundary", bollard: "Help a person notice a typo, extra zero or risky action.", other: "Decide whether submitted data matches your domain schema." },
]
const sections = [
  { title: "A schema and a useful field experience solve different problems", paragraphs: ["Zod gives a team a way to describe data shapes, parse unknown input and produce structured validation results. It is useful at API boundaries, form submission and places where a value must satisfy a domain rule. Bollard UI supplies copy-paste React controls and guardrails that help a person catch mistakes while entering or reviewing data. A Zod schema does not by itself explain a likely email typo, show an extra-zero readback, or make a destructive target clear.", "The libraries fit together: use a schema to establish what the application accepts, and add a field experience that helps someone reach a valid, intended value. A browser-side result remains a convenience. Validate again on the server before storing data or carrying out an action."], code: { filename: "Zod plus a Bollard input", source: `import { z } from "zod"\nimport { AmountInput } from "@/components/ui/amount-input"\n\nconst paymentSchema = z.object({\n  amountPaise: z.number().int().positive().max(2_000_000),\n})\n\nfunction PaymentAmount({ value, onChange }) {\n  return <AmountInput currency="INR" locale="en-IN" value={value} onValueChange={onChange} />\n}\n\n// Parse again at the trusted API boundary.\nconst payment = paymentSchema.parse(await request.json())` } },
  { title: "Keep user-intent checks separate from data validity", paragraphs: ["Some guardrails detect a plausible mistake rather than a value that is formally invalid. A transfer amount can be a valid positive integer and still be ten times larger than the person intended. An email string can pass a schema and still contain gmial.com. A typed confirmation phrase does not change the shape of a request; it makes the destructive target harder to approve by accident.", "Represent actual business rules in your schema and server. Use the UI to explain what the person is about to send, preserve a clear correction path and make the next step explicit. Avoid making the client’s warning the only protection for money movement, access changes or deletion."], code: { filename: "Validate after the field interaction", source: `async function submitPayment(raw: unknown) {\n  const parsed = paymentSchema.safeParse(raw)\n  if (!parsed.success) return { ok: false, issues: parsed.error.issues }\n\n  // Authenticate, authorize, check balance and apply idempotency here.\n  return createPayment(parsed.data)\n}` } },
]
const faqs = [
  { question: "Does Bollard UI replace Zod?", answer: "No. Zod handles schemas and parsing; Bollard provides React controls and user-facing guardrails. They are complementary." },
  { question: "Can a Zod schema validate on the server?", answer: "Yes. Parse untrusted request data at the server boundary and enforce authorization and business rules there." },
  { question: "Should I show every schema error while typing?", answer: "Choose timing based on the field. Keep feedback specific and avoid overwhelming people before they have finished entering a value." },
]

export default function ZodComparisonPage() { return <ComparisonGuide title={title} lead="Zod validates data against schemas. Bollard UI adds React field experiences that help people catch common mistakes. Most form flows benefit from both." rows={rows} sections={sections} faqs={faqs} cta={{ href: "/components", label: "Keep your validation stack and improve the field experience", detail: "Browse the form inputs and headless validation hook, then keep your existing schema as the data contract." }} /> }
