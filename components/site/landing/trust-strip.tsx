import { Layers3, Scale, TerminalSquare } from "lucide-react"

import { GithubIcon } from "@/components/site/github-icon"
import { fetchStarCount } from "@/components/site/github-stars"
import { REPO_URL } from "@/lib/site"
import { cn } from "@/lib/utils"

import { CountUp } from "./count-up"
import { container } from "./section-heading"

/**
 * True facts in one framed row under the hero. The star count is fetched on the server
 * and revalidated daily; when GitHub can't be reached the cell keeps a static label
 * instead of a guessed number. The component count comes from the registry itself.
 */
export async function TrustStrip({ total }: { total: number }) {
  const stars = await fetchStarCount()
  const cells = [
    {
      key: "stars",
      icon: GithubIcon,
      value: stars === null ? <span>Star on GitHub</span> : <><CountUp value={stars} /> stars</>,
      note: "Open source on GitHub",
      href: REPO_URL,
    },
    { key: "components", icon: Layers3, value: <><CountUp value={total} /> components</>, note: "In the @bollard registry" },
    { key: "license", icon: Scale, value: <span>MIT licensed</span>, note: "Free for commercial use" },
    { key: "cli", icon: TerminalSquare, value: <span>Copy-paste</span>, note: "Via the shadcn CLI" },
  ]

  return (
    <section aria-label="At a glance" className="border-y bg-background/60">
      <ul className={cn(container, "grid grid-cols-2 px-0 sm:px-0 lg:grid-cols-4 min-[72rem]:border-x")}>
        {cells.map(({ key, icon: Icon, value, note, href }, i) => {
          const body = (
            <>
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border bg-surface text-muted-foreground [&_svg]:size-4">
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight tabular-nums">{value}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{note}</span>
              </span>
            </>
          )
          const cell = "flex min-w-0 items-center gap-3 px-4 py-4 sm:px-6 sm:py-5"
          return (
            <li
              key={key}
              className={cn("min-w-0", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i === 2 && "lg:border-l")}
            >
              {href ? (
                <a href={href} className={cn(cell, "outline-none transition-colors hover:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset")}>
                  {body}
                </a>
              ) : (
                <div className={cell}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
