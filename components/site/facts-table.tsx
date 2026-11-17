import { type FactRow } from "@/lib/facts"

export function FactsTable({
  facts,
  title = "Technical Facts & Specifications",
  caption = "Technical specifications, licensing, and limitations",
  className,
}: {
  facts: FactRow[]
  title?: string
  caption?: string
  className?: string
}) {
  return (
    <div className={className || "space-y-3"}>
      {title && (
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      )}
      <div className="overflow-x-auto rounded-xl border bg-surface/50">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface text-xs text-muted-foreground border-b">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium w-1/3">
                Property
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium w-2/3">
                Specification
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {facts.map((row) => (
              <tr key={row.property} className="align-top">
                <th
                  scope="row"
                  className="px-4 py-2.5 font-medium text-foreground text-xs sm:text-sm"
                >
                  {row.property}
                </th>
                <td className="px-4 py-2.5 text-muted-foreground text-xs sm:text-sm">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
