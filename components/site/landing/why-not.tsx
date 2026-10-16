import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section-heading"

const rows = [
  {
    instead: "Schema validation",
    examples: "Zod, native required / pattern",
    answers: "Is this value allowed?",
    gap: "₹24,000 is a perfectly valid amount. So is alex@gmial.com. Validation passes both.",
    bollard: "Asks whether it is what the user meant: “10× your usual. Extra zero?”",
  },
  {
    instead: "A confirm dialog",
    examples: "“Are you sure?”",
    answers: "Did you click on purpose?",
    gap: "People learn to press OK without reading. The dialog rarely says what will actually happen.",
    bollard: "Reads back the consequence (which 1,204 rows, which account, which environment) before the click counts.",
  },
  {
    instead: "Server-side checks",
    examples: "Authorization, rate limits, constraints",
    answers: "Is this request allowed at all?",
    gap: "Still required, and Bollard UI doesn't replace them. They just answer after the request is sent.",
    bollard: "Catches the honest mistake earlier, while the user can still fix it, with the server as the real backstop.",
  },
]

/** A short, honest comparison that answers the first objection: "why not just validate, or add a confirm?" */
export function WhyNot() {
  return (
    <Section id="why-not" labelledBy="why-not-heading">
      <SectionHeading id="why-not-heading" eyebrow="Compared" title="Why not just validation or a confirm dialog?">
        They answer different questions. Keep them; Bollard UI covers the gap between &ldquo;valid&rdquo; and &ldquo;what the user meant&rdquo;.
      </SectionHeading>
      <Reveal className="mt-12">
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
          {rows.map((row) => (
            <li key={row.instead} className="flex min-w-0 flex-col gap-3 bg-background p-6">
              <div>
                <h3 className="text-[15px] font-medium tracking-tight">{row.instead}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.examples}</p>
              </div>
              <p className="font-mono text-[12px] text-muted-foreground">
                Answers: <span className="text-foreground">{row.answers}</span>
              </p>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{row.gap}</p>
              <p className="mt-auto flex gap-2 border-t pt-3 text-sm leading-relaxed text-pretty text-foreground">
                <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-brand" />
                <span>{row.bollard}</span>
              </p>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  )
}
