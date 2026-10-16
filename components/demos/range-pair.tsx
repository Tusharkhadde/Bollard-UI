"use client"

import { RangePair } from "@/registry/default/range-pair/range-pair"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <RangePair kind="date" label="Trip dates" maxSpan={60} defaultValue={{ from: "2026-12-28", to: "2026-01-03" }} />
      <RangePair label="Price (₹)" maxSpan={20000} defaultValue={{ from: "500", to: "50000" }} />
      <RangePair kind="date" label="Hotel stay" fromLabel="Check-in" toLabel="Check-out" exclusiveEnd defaultValue={{ from: "2026-11-14", to: "2026-11-14" }} />
    </form>
  )
}
