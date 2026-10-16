"use client"

import * as React from "react"

import { StaleDataNotice } from "@/registry/default/stale-data-notice/stale-data-notice"

const prices = [
  { name: "Economy · BOM → DEL", price: "₹5,840" },
  { name: "Premium · BOM → DEL", price: "₹11,200" },
  { name: "Business · BOM → DEL", price: "₹24,650" },
]

export function Demo() {
  const [updatedAt, setUpdatedAt] = React.useState<number>()

  // Pretend the page was loaded 18 minutes ago.
  React.useEffect(() => setUpdatedAt(Date.now() - 18 * 60_000), [])

  return (
    <div className="w-full max-w-md space-y-3">
      {updatedAt !== undefined && (
        <StaleDataNotice
          updatedAt={updatedAt}
          maxAge={10 * 60_000}
          consequence="Prices may have changed."
          onRefresh={() =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                setUpdatedAt(Date.now())
                resolve()
              }, 800),
            )
          }
        />
      )}
      <ul className="divide-y rounded-xl border bg-background text-sm">
        {prices.map((row) => (
          <li key={row.name} className="flex items-center justify-between px-4 py-2.5">
            <span>{row.name}</span>
            <span className="font-medium tabular-nums">{row.price}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setUpdatedAt(Date.now() - 18 * 60_000)}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Make the data old again
      </button>
    </div>
  )
}
