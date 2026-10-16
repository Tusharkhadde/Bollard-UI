"use client"

import * as React from "react"

import { DimensionInput, type DimensionValue } from "@/registry/default/dimension-input/dimension-input"

const presets: { label: string; value: DimensionValue }[] = [
  { label: "Inches as cm", value: { w: "14", h: "22", d: "9", unit: "cm" } },
  { label: "Airline order", value: { w: "55", h: "40", d: "23", unit: "cm" } },
  { label: "Extra digit", value: { w: "35", h: "55", d: "230", unit: "cm" } },
]

export function Demo() {
  const [dims, setDims] = React.useState(presets[0].value)
  return (
    <div className="grid w-full max-w-sm gap-3">
      <DimensionInput label="Cabin bag size" category="carry-on" value={dims} onValueChange={setDims} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => setDims(p.value)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {p.label}
          </button>
        ))}
        <span>or paste “16 x 12 x 8 in”</span>
      </div>
    </div>
  )
}
