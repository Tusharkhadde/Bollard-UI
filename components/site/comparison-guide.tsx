import Link from "next/link"

import { DocPage } from "@/components/site/doc-page"

export type ComparisonFaq = { question: string; answer: string }

export function ComparisonGuide({
  title,
  lead,
  rows,
  sections,
  faqs,
  cta,
}: {
  title: string
  lead: string
  rows: { topic: string; bollard: string; other: string }[]
  sections: { title: string; paragraphs: string[]; code: { filename: string; source: string } }[]
  faqs: ComparisonFaq[]
  cta: { href: string; label: string; detail: string }
}) {
  return (
    <DocPage eyebrow="Comparison guide" title={title} lead={lead}>
      <div className="space-y-10 pt-8">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
            <caption className="sr-only">When Bollard UI and the compared tool are useful</caption>
            <thead className="bg-surface text-xs text-muted-foreground"><tr className="border-b"><th className="px-4 py-3 font-medium">Concern</th><th className="px-4 py-3 font-medium">Bollard UI</th><th className="px-4 py-3 font-medium">Complementary tool</th></tr></thead>
            <tbody className="divide-y">{rows.map((row) => <tr key={row.topic} className="align-top"><th scope="row" className="px-4 py-3 font-medium">{row.topic}</th><td className="px-4 py-3 text-muted-foreground">{row.bollard}</td><td className="px-4 py-3 text-muted-foreground">{row.other}</td></tr>)}</tbody>
          </table>
        </div>
        {sections.map((section) => (
          <section key={section.title} className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
            <div className="space-y-3 text-[15px] leading-7 text-pretty text-muted-foreground">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            <div className="overflow-x-auto rounded-xl border bg-zinc-950 p-4 text-zinc-100"><p className="mb-3 font-mono text-xs text-zinc-400">{section.code.filename}</p><pre className="text-[13px] leading-6"><code>{section.code.source}</code></pre></div>
          </section>
        ))}
        <section aria-labelledby="comparison-faq" className="space-y-4">
          <h2 id="comparison-faq" className="text-xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="divide-y border-y">{faqs.map((faq) => <details key={faq.question} className="group py-4"><summary className="cursor-pointer font-medium">{faq.question}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{faq.answer}</p></details>)}</div>
        </section>
        <aside className="rounded-xl border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold">{cta.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cta.detail}</p>
          <Link href={cta.href} className="mt-4 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">Browse components</Link>
        </aside>
      </div>
    </DocPage>
  )
}
