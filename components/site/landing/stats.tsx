import { cn } from "@/lib/utils"
import { Code2, Layers3, Palette, TerminalSquare } from "lucide-react"

import { container } from "./section-heading"

/**
 * A row of true facts under the hero, in hairline cells (in place of a logo wall).
 * `total` comes from the registry at build time; nothing here is a guess, and the
 * count is a footnote rather than the headline.
 * Four equal cells, each with the same inner padding; once the strip is narrower than
 * the viewport (72rem) it closes with side hairlines so it reads as one framed row.
 */
export function Stats({ total, categories }: { total: number; categories: number }) {
  const stats = [
    { value: "Source code", note: "Copied into your app", icon: Code2 },
    { value: "MIT licensed", note: "Free for commercial use", icon: Layers3 },
    { value: `${total.toLocaleString("en-US")} components`, note: `Across ${categories} categories`, icon: TerminalSquare },
    { value: "Your theme", note: "React 19 · Tailwind v4", icon: Palette },
  ]
  return (
    <section aria-label="At a glance" className="border-y">
      <ul className={cn(container, "grid grid-cols-2 px-0 sm:px-0 lg:grid-cols-4 min-[72rem]:border-x")}>
        {stats.map(({ value, note, icon: Icon }, i) => (
          <li
            key={value}
            className={cn(
              "flex min-w-0 items-start gap-3 px-4 py-5 sm:px-6 sm:py-6",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t lg:border-t-0",
              i === 2 && "lg:border-l",
            )}
          >
            <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium tracking-tight">{value}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
