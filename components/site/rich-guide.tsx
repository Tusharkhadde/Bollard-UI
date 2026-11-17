import Link from "next/link"

import { DocPage } from "@/components/site/doc-page"
import { ArticleByline } from "@/components/site/article-byline"
import { JsonLd } from "@/components/site/json-ld"
import { PackageCommand } from "@/components/site/package-command"
import { articlePathForTitle, articleSchema } from "@/lib/article-metadata"

export type RichGuideSection = {
  title: string
  paragraphs: string[]
  code?: { filename: string; source: string }
  table?: {
    caption?: string
    headers: string[]
    rows: string[][]
  }
}

export function RichGuideArticle({
  title,
  eyebrow = "React guide",
  lead,
  sections,
  components = [],
  related = [],
}: {
  title: string
  eyebrow?: string
  lead: string
  sections: RichGuideSection[]
  components?: { name: string; label: string }[]
  related?: { href: string; label: string }[]
}) {
  return (
    <DocPage eyebrow={eyebrow} title={title} lead={lead}>
      <JsonLd data={articleSchema(articlePathForTitle(title) ?? "/guides", title, lead)} />
      <ArticleByline />
      {components[0] && (
        <div className="pt-6">
          <PackageCommand kind="shadcn" args={`add @bollard/${components[0].name}`} label={`Copy install command for ${components[0].label}`} />
        </div>
      )}
      <div className="space-y-10 pt-8">
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`guide-section-${index}`} className="space-y-4">
            <h2 id={`guide-section-${index}`} className="text-xl font-semibold tracking-tight">{section.title}</h2>
            <div className="space-y-4 text-[15px] leading-7 text-pretty text-muted-foreground">
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph.replace(/<[^>]*>/g, "")}</p>)}
            </div>
            {section.table && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
                  {section.table.caption && <caption className="sr-only">{section.table.caption}</caption>}
                  <thead className="bg-surface text-xs text-muted-foreground">
                    <tr className="border-b">
                      {section.table.headers.map((h, i) => (
                        <th key={i} scope="col" className="px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {section.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="align-top">
                        {row.map((cell, cIdx) => (
                          cIdx === 0 ? (
                            <th key={cIdx} scope="row" className="px-4 py-3 font-medium text-foreground">{cell}</th>
                          ) : (
                            <td key={cIdx} className="px-4 py-3 text-muted-foreground">{cell}</td>
                          )
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {section.code && (
              <div className="overflow-x-auto rounded-xl border bg-zinc-950 p-4 text-zinc-100">
                <p className="mb-3 font-mono text-xs text-zinc-400">{section.code.filename}</p>
                <pre className="text-[13px] leading-6"><code>{section.code.source}</code></pre>
              </div>
            )}
          </section>
        ))}
        {(components.length > 0 || related.length > 0) && (
          <nav aria-label="Related resources" className="space-y-4 border-t pt-8">
            <h2 className="text-lg font-semibold">Explore related components and guides</h2>
            <ul className="flex flex-wrap gap-2">
              {components.map((component) => (
                <li key={component.name}><Link className="rounded-md border px-3 py-2 text-sm underline-offset-4 hover:underline" href={`/components/${component.name}`}>{component.label}</Link></li>
              ))}
              {related.map((item) => (
                <li key={item.href}><Link className="rounded-md border px-3 py-2 text-sm underline-offset-4 hover:underline" href={item.href}>{item.label}</Link></li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </DocPage>
  )
}
