"use client"

import * as React from "react"

import { MENS_SHOES, SizeFitPicker, WOMENS_CLOTHING } from "@/registry/default/size-fit-picker/size-fit-picker"

export function Demo() {
  const [tab, setTab] = React.useState<"shoes" | "kurta">("shoes")
  const [shoe, setShoe] = React.useState<string | null>("7")
  return (
    <div className="grid w-full max-w-sm gap-4">
      <div role="tablist" aria-label="Product" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs">
        {(["shoes", "kurta"] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className="rounded-md px-2 py-1.5 text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-xs">
            {t === "shoes" ? "Nike Pegasus 41" : "Saanjh cotton kurta"}
          </button>
        ))}
      </div>
      {tab === "shoes" ? (
        <SizeFitPicker
          key="shoes"
          chart={MENS_SHOES}
          brand="Nike"
          usual={{ size: "8", system: "UK", brand: "Nike" }}
          defaultSystem="US"
          value={shoe}
          onValueChange={setShoe}
          available={["5", "6", "7", "8", "9", "10", "12"]}
        />
      ) : (
        <SizeFitPicker
          key="kurta"
          chart={WOMENS_CLOTHING}
          valueSystem="IN"
          defaultSystem="IN"
          brand="Saanjh"
          usual={{ size: "M", system: "IN", brand: "Zara" }}
          fitOffset={1}
        />
      )}
    </div>
  )
}
