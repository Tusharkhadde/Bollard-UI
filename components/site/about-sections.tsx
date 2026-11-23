import Link from "next/link"

/*
 * Content that used to sit on the homepage and now lives on /about: the "Disasters prevented"
 * scenarios and the "Why not just validation or a confirm dialog?" comparison. Same words,
 * styled for a docs page.
 */

export const DISASTER_SCENARIOS = [
  ["A transfer draft", "A reviewer spots one extra zero before a fictional customer sends a monthly supplier payment."],
  ["A workspace cleanup", "A typed readback makes a fictional team pause before removing the only owner from a workspace."],
  ["An agent request", "A human sees that a fictional agent action reaches production data and chooses not to approve it."],
] as const

export const WHY_NOT_ROWS = [
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
] as const

export const COMPARISON_GUIDES = [
  ["Bollard UI vs Zod validation", "/guides/bollard-ui-vs-zod-validation"],
  ["Bollard UI vs React Hook Form", "/guides/bollard-ui-vs-react-hook-form"],
  ["Bollard UI vs confirm dialogs", "/guides/bollard-ui-vs-confirm-dialogs"],
] as const

export const FEATURED_GUIDES = [
  ["Prevent Duplicate Submissions", "/guides/react-prevent-duplicate-form-submit", "Eliminate double clicks, duplicate charges, and lost timeout state with safe submits."],
  ["India Form Validation", "/guides/react-india-form-validation", "Guide entry for Aadhaar, IFSC, UPI IDs, PIN codes, and lakh-aware numbers."],
  ["Type to Confirm Dialogs", "/guides/react-type-to-confirm-dialog", "Require conscious intent for irreversible actions with accessible typed phrases."],
] as const

export function DisastersList() {
  return (
    <>
      <p className="text-[15px] leading-7 text-pretty text-foreground/85">
        Fictional scenarios, not customer claims. Bollard contributes a clear moment to review; your product’s server-side controls still enforce the decision.
      </p>
      <ol className="grid gap-3 md:grid-cols-3">
        {DISASTER_SCENARIOS.map(([title, copy], index) => (
          <li key={title} className="rounded-r-lg border-l-2 border-brand bg-surface p-4">
            <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
            <h3 className="mt-2 text-sm font-medium">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy}</p>
          </li>
        ))}
      </ol>
    </>
  )
}

export function WhyNotList() {
  return (
    <>
      <p className="text-[15px] leading-7 text-pretty text-foreground/85">
        They answer different questions. Keep them; Bollard UI covers the gap between &ldquo;valid&rdquo; and &ldquo;what the user meant&rdquo;.
      </p>
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
        {WHY_NOT_ROWS.map((row) => (
          <li key={row.instead} className="flex min-w-0 flex-col gap-3 bg-background p-5">
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
    </>
  )
}

export function GuideLinks({ items }: { items: readonly (readonly [string, string] | readonly [string, string, string])[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {items.map(([label, href, detail]) => (
        <li key={href}>
          <Link href={href} className="block h-full rounded-xl border p-4 text-sm font-medium transition-colors hover:border-border-strong hover:bg-surface">
            {label}
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{detail ?? "See where the tools complement each other."}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
