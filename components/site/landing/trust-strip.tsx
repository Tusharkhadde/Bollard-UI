/** A quiet row of true facts under the hero. The count comes from the catalog at build time. */
export function TrustStrip({ total }: { total: number }) {
  const facts = [`${total} components`, "Built for shadcn/ui", "React 19", "Tailwind v4", "TypeScript", "MIT licensed"]
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
      <ul aria-label="At a glance" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-6 text-sm text-muted-foreground">
        {facts.map((fact, i) => (
          <li key={fact} className="flex items-center gap-3 whitespace-nowrap">
            {i > 0 && (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            )}
            <span className={i === 0 ? "font-bold text-foreground tabular-nums" : undefined}>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
