import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { DocPage, proseLink } from "@/components/site/doc-page"
import { catalog } from "@/lib/catalog"
import { ESSENTIALS } from "@/lib/kits"

const description = "The Bollard UI essentials: fifteen components that cover the most common mistakes in sign-up, checkout, forms and the danger zone."

export const metadata: Metadata = {
  title: "Start here",
  description,
  alternates: { canonical: "/start-here" },
  openGraph: { title: "Start here · Bollard UI", description, url: "/start-here" },
}

export default function StartHerePage() {
  const picks = ESSENTIALS.map((name) => catalog.find((item) => item.name === name))
    .filter((item): item is (typeof catalog)[number] => !!item)
    .slice(0, 15)
  return (
    <DocPage
      eyebrow="Start here"
      title="The essentials"
      lead={
        <>
          If you add only a few components, add these. They cover the mistakes almost every app sees: typo&apos;d emails, wrong amounts, double submits,
          accidental deletes and lost drafts. New to the setup?{" "}
          <Link className={proseLink} href="/docs">
            Getting started
          </Link>{" "}
          takes two minutes.
        </>
      }
    >
      <ol className="grid gap-3 pt-8 sm:grid-cols-2">
        {picks.map((item, i) => (
          <li key={item.name} className="min-w-0">
            <Link
              href={`/components/${item.name}`}
              className="group flex h-full min-w-0 flex-col gap-1.5 rounded-xl border p-4 outline-none transition-colors hover:border-border-strong hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span className="font-mono text-[11px] text-brand tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate text-sm font-medium">{item.title}</span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
                />
              </span>
              <span className="line-clamp-3 text-[13px] leading-5 text-pretty text-muted-foreground">{item.summary ?? item.headline}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-muted-foreground">
        Then browse by the screen you&apos;re building:{" "}
        <Link className={proseLink} href="/components">
          all components
        </Link>
        .
      </p>
    </DocPage>
  )
}
