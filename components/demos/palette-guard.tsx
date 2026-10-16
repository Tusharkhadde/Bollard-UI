"use client"

import * as React from "react"

import { PaletteGuard, type Series } from "@/registry/default/palette-guard/palette-guard"

const DATA = [
  [42, 18, 24, 6],
  [48, 21, 27, 8],
  [55, 23, 30, 7],
  [61, 26, 33, 9],
]

export function Demo() {
  const [series, setSeries] = React.useState<Series[]>([
    { label: "Revenue", color: "#1f77b4" },
    { label: "Costs", color: "#ff7f0e" },
    { label: "Profit", color: "#2ca02c" },
    { label: "Refunds", color: "#d62728" },
  ])
  return (
    <div className="grid w-full max-w-sm gap-3">
      <svg viewBox="0 0 280 72" role="img" aria-label="Quarterly revenue, costs, profit and refunds" className="w-full">
        {DATA.map((quarter, q) =>
          quarter.map((v, s) => (
            <rect key={`${q}-${s}`} x={q * 70 + s * 14 + 6} y={68 - v} width={12} height={v} rx={2} fill={series[s].color} className="transition-[fill] duration-300" />
          )),
        )}
      </svg>
      <PaletteGuard value={series} onValueChange={setSeries} />
    </div>
  )
}
