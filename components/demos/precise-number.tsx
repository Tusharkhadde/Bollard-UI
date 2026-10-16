"use client"

import { PreciseNumber } from "@/registry/default/precise-number/precise-number"

const rows = [
  { label: "Annual revenue", node: <PreciseNumber value={123456789} currency="INR" toggleable /> },
  { label: "Pending payouts", node: <PreciseNumber value={9999999} currency="INR" /> },
  { label: "Series B raise", node: <PreciseNumber value={1234567890} currency="USD" toggleable /> },
  { label: "Monthly visitors", node: <PreciseNumber value={4567890} /> },
  { label: "Uptime (30 days)", node: <PreciseNumber value={0.996} format="percent" /> },
  { label: "Refund rate", node: <PreciseNumber value={0.0004} format="percent" edge="bound" /> },
]

export function Demo() {
  return (
    <div className="w-full max-w-sm space-y-4 pt-6">
      <dl className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right">{row.node}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        A plain compact formatter shows ₹99,99,999 as ₹1 Cr and 99.6% uptime as 100%. Hover or focus a number for the exact value.
      </p>
    </div>
  )
}
