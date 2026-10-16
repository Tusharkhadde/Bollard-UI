import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Toc } from "@/components/site/toc"
import { cn } from "@/lib/utils"

export const inlineCode = "rounded-md border bg-surface px-1.5 py-0.5 font-mono text-[12.5px] text-foreground"
export const proseLink =
  "rounded-sm text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** A docs page: breadcrumb, eyebrow, title, lead, then sections, with "On this page" on xl screens. */
export function DocPage({
  title,
  lead,
  eyebrow = "Docs",
  sections = [],
  children,
}: {
  title: string
  lead?: React.ReactNode
  eyebrow?: string
  sections?: { id: string; label: string }[]
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-12 px-4 pt-8 pb-16 sm:px-8 lg:px-10 lg:pt-10 xl:gap-16">
      <main id="top" className="min-w-0 flex-1 xl:max-w-[46rem] 2xl:max-w-[52rem]">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
            <li>
              <Link href="/docs" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                Docs
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3.5 shrink-0 opacity-60" />
            </li>
            <li aria-current="page" className="truncate text-foreground">
              {title}
            </li>
          </ol>
        </nav>
        <header className="space-y-3">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            <span aria-hidden className="h-px w-4 bg-brand" />
            {eyebrow}
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[2.25rem]">{title}</h1>
          {lead && <p className="max-w-[65ch] text-base leading-relaxed text-pretty text-muted-foreground">{lead}</p>}
        </header>
        <div className="pt-2">{children}</div>
      </main>
      {sections.length > 0 && (
        <aside className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-24">
            <Toc sections={sections} />
          </div>
        </aside>
      )}
    </div>
  )
}

/** h2 section with a hover "#" anchor, matching the component pages. */
export function DocSection({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-20 space-y-4 pt-10", className)}>
      <h2 id={`${id}-heading`} className="group text-xl font-semibold tracking-[-0.02em]">
        <a href={`#${id}`} className="rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {title}
          <span aria-hidden className="ml-2 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground">
            #
          </span>
        </a>
      </h2>
      {children}
    </section>
  )
}

/** Body copy at docs size. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3 text-[15px] leading-7 text-pretty text-foreground/85 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5", className)}>
      {children}
    </div>
  )
}

/** A quiet bordered note. */
export function Note({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "brand" }) {
  return (
    <div role="note" className={cn("rounded-xl border px-4 py-3.5 text-[14.5px] leading-6 text-pretty sm:px-5", tone === "brand" ? "border-brand/40 bg-brand/[0.06]" : "bg-surface")}>
      {children}
    </div>
  )
}
