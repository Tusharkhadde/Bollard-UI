"use client"

import * as React from "react"

import { MiddleTruncate } from "@/registry/default/middle-truncate/middle-truncate"

const items = [
  { label: "File", value: "invoice_2026_october_acme_corp_reviewed_final_v3.pdf" },
  { label: "File", value: "invoice_2026_october_acme_corp_reviewed_final_v4.pdf" },
  { label: "Wallet", value: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", mono: true },
  { label: "Order", value: "ord_01J9ZK7Q4M8XW2N6T3BVRC5HDY", mono: true },
  { label: "Path", value: "src/components/registry/default/middle-truncate/middle-truncate.tsx", mono: true },
]

export function Demo() {
  const [width, setWidth] = React.useState(260)
  const sliderId = React.useId()

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <label htmlFor={sliderId}>Width</label>
        <input
          id={sliderId}
          type="range"
          min={120}
          max={440}
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
          className="flex-1 accent-(--primary)"
        />
        <span className="w-12 text-right tabular-nums">{width}px</span>
      </div>
      <ul className="max-w-full space-y-2 rounded-lg border bg-card p-3 text-sm" style={{ width }}>
        {items.map((item) => (
          <li key={item.value} className="flex items-baseline gap-2">
            <span className="w-12 shrink-0 text-xs text-muted-foreground">{item.label}</span>
            <MiddleTruncate value={item.value} className={item.mono ? "flex-1 font-mono text-[13px]" : "flex-1"} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Select and copy a row: you get the full value, not the ellipsis.</p>
    </div>
  )
}
