import { Section, SectionHeading } from "./section-heading"

const scenarios = [
  ["A transfer draft", "A reviewer spots one extra zero before a fictional customer sends a monthly supplier payment."],
  ["A workspace cleanup", "A typed readback makes a fictional team pause before removing the only owner from a workspace."],
  ["An agent request", "A human sees that a fictional agent action reaches production data and chooses not to approve it."],
]

export function DisastersPrevented() {
  return (
    <Section labelledBy="disasters-prevented-heading">
      <SectionHeading id="disasters-prevented-heading" eyebrow="Disasters Prevented" title="Small pauses prevent expensive mistakes.">
        Fictional scenarios, not customer claims. Bollard contributes a clear moment to review; your product’s server-side controls still enforce the decision.
      </SectionHeading>
      <ol className="mt-8 grid gap-3 md:grid-cols-3">
        {scenarios.map(([title, copy], index) => <li key={title} className="border-l-2 border-brand bg-surface p-4"><span className="font-mono text-xs text-muted-foreground">0{index + 1}</span><h3 className="mt-2 text-sm font-medium">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy}</p></li>)}
      </ol>
    </Section>
  )
}
