"use client"

import * as React from "react"

import { TextDiff } from "@/registry/default/text-diff/text-diff"

const before =
  "Customers can cancel within 30 days for a full refund. Payouts go to Acme Traders Pvt Ltd, account ending 4417."
// The edit a reviewer skims past: a shorter refund window, a new account, and a doubled space in the payee name.
const after =
  "Customers can cancel within 14 days for a full refund. Payouts go to Acme  Traders Pvt Ltd, account ending 4471."

export function Demo() {
  const [view, setView] = React.useState<"inline" | "split">("inline")

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <div role="group" aria-label="Diff view" className="inline-flex self-start rounded-md border p-0.5 text-xs">
        {(["inline", "split"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className="h-7 rounded-sm px-3 font-medium capitalize text-muted-foreground outline-none aria-pressed:bg-accent aria-pressed:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {option}
          </button>
        ))}
      </div>
      <TextDiff before={before} after={after} view={view} />
    </div>
  )
}
