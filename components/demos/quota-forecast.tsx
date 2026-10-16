"use client"

import * as React from "react"

import { QuotaForecast } from "@/registry/default/quota-forecast/quota-forecast"

// Fixed dates keep the demo deterministic: 12½ days into an October billing period.
const periodStart = "2026-10-01T00:00:00"
const resetsAt = "2026-11-01T00:00:00"
const now = "2026-10-13T12:00:00"
const gb = (value: number) => `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })} GB`

export function Demo() {
  const [calls, setCalls] = React.useState(5_800)
  const [limit, setLimit] = React.useState(10_000)

  return (
    <div className="w-full max-w-sm space-y-6">
      <QuotaForecast
        label="API calls"
        used={calls}
        limit={limit}
        periodStart={periodStart}
        resetsAt={resetsAt}
        now={now}
        atLimit="At the limit, new calls fail with a 429 error until {reset}."
        actionLabel="Raise limit"
        onAction={() => setLimit(25_000)}
      />
      <QuotaForecast
        label="Storage"
        used={18.2}
        limit={50}
        periodStart={periodStart}
        resetsAt={resetsAt}
        now={now}
        formatValue={gb}
        atLimit="At the limit, uploads pause. Nothing is deleted."
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCalls((value) => value + 1_500)}
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        >
          Run batch job (+1,500 calls)
        </button>
        <button
          type="button"
          onClick={() => {
            setCalls(5_800)
            setLimit(10_000)
          }}
          className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset demo
        </button>
      </div>
    </div>
  )
}
