"use client"

import * as React from "react"

import { ChangeHighlight, type ChangeValue } from "@/registry/default/change-highlight/change-highlight"

const prices = [2847.5, 2861.2, 2858.9, 2858.9, 2834.1, 2839.75]
const latencies = [182, 164, 171, 240, 198, 176]
const statuses = ["Packed", "Packed", "Shipped", "Shipped", "Out for delivery", "Out for delivery"]
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 })

const rowClass = "flex min-h-11 items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"

export function Demo() {
  const [tick, setTick] = React.useState(0)
  const [seeded, setSeeded] = React.useState(false)

  React.useEffect(() => {
    // Pretend the last visit saw 9 open orders, so the demo opens showing what moved since.
    localStorage.setItem("demo:open-orders", "9")
    setSeeded(true)
    const first = setTimeout(() => setTick(1), 300)
    const id = setInterval(() => setTick((t) => t + 1), 2400)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [])

  const at = <T,>(list: T[]) => list[tick % list.length]

  return (
    <div className="w-full max-w-sm rounded-lg border bg-background">
      <div className={rowClass}>
        <span className="text-muted-foreground">RELIANCE</span>
        <ChangeHighlight value={at(prices)} format={(v: ChangeValue) => inr.format(Number(v))} announce className="font-medium" />
      </div>
      <div className={rowClass}>
        <span className="text-muted-foreground">API latency (lower is better)</span>
        <ChangeHighlight value={at(latencies)} format={(v: ChangeValue) => `${v} ms`} goodDirection="down" />
      </div>
      <div className={rowClass}>
        <span className="text-muted-foreground">Order #4471</span>
        <ChangeHighlight value={at(statuses)} />
      </div>
      <div className={rowClass}>
        <span className="shrink-0 text-muted-foreground">Open orders</span>
        {seeded && <ChangeHighlight value={14} storageKey="demo:open-orders" className="justify-end" />}
      </div>
    </div>
  )
}
