"use client"

import { GapAwareLine, type GapAwareDatum } from "@/registry/default/gap-aware-line/gap-aware-line"

// Daily UPI payments (₹ lakh). The collector was down 6–8 Oct and on 10 Oct, 9 Oct was
// recovered on its own, 14 Oct is back-filled from the bank file, and 17 Oct was a real zero (bank holiday).
const values: (number | null)[] = [42, 45, 44, 47, 49, null, null, null, 51, null, 53, 50, 52, 55, 54, 56, 0, 58, 57, 60, 61]
const daily: GapAwareDatum[] = values.map((value, i) => ({ label: `${i + 1} Oct`, value, estimated: i === 13 }))

const week: GapAwareDatum[] = [
  { label: "Mon", value: 98.1 },
  { label: "Tue", value: 98.6 },
  { label: "Wed", value: null },
  { label: "Thu", value: 99.2 },
  { label: "Fri", value: 99.0, estimated: true },
]

export function Demo() {
  return (
    <div className="grid w-full max-w-md gap-4">
      <GapAwareLine label="Daily UPI payments, ₹ lakh" data={daily} />
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
        <div className="grid gap-0.5">
          <span className="text-xs text-muted-foreground">Uptime this week</span>
          <span className="text-lg font-semibold tabular-nums">99.0%</span>
        </div>
        <GapAwareLine variant="sparkline" label="Uptime by day, %" data={week} format={(v) => `${v}%`} className="w-28" />
      </div>
    </div>
  )
}
