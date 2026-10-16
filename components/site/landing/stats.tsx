import { cn } from "@/lib/utils"

import { container } from "./section-heading"

/**
 * A row of true facts under the hero, in hairline cells (in place of a logo wall).
 * `total` comes from the registry at build time; nothing here is a guess.
 * Four equal cells, each with the same inner padding; once the strip is narrower than
 * the viewport (72rem) it closes with side hairlines so it reads as one framed row.
 */
export function Stats({ total, categories }: { total: number; categories: number }) {
  const stats = [
    { value: total.toLocaleString("en-US"), label: "components", note: `across ${categories} categories` },
    { value: "MIT", label: "licensed", note: "free for commercial use" },
    { value: "shadcn", label: "CLI", note: "one command, no package" },
    { value: "React 19", label: "+ Tailwind v4", note: "TypeScript, SSR-safe" },
  ]
  return (
    <section aria-label="At a glance" className="border-y">
      <ul className={cn(container, "grid grid-cols-2 px-0 sm:px-0 lg:grid-cols-4 min-[72rem]:border-x")}>
        {stats.map((stat, i) => (
          <li
            key={stat.label}
            className={cn(
              "flex min-w-0 flex-col gap-1 px-4 py-6 sm:px-6 sm:py-7",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t lg:border-t-0",
              i === 2 && "lg:border-l",
            )}
          >
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-2xl font-semibold tracking-[-0.03em] tabular-nums sm:text-3xl">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </p>
            <p className="text-[13px] text-muted-foreground">{stat.note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
