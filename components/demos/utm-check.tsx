"use client"

import * as React from "react"

import { UtmCheck } from "@/registry/default/utm-check/utm-check"

const knownValues = { utm_source: ["facebook", "instagram", "newsletter"], utm_campaign: ["diwali_sale"] }

export function Demo() {
  const [placement, setPlacement] = React.useState<"ad" | "blog">("ad")
  return (
    <div className="grid w-full max-w-md gap-3">
      <div role="radiogroup" aria-label="Where the link goes" className="flex w-fit gap-1 rounded-md border p-0.5 text-xs">
        {(["ad", "blog"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={placement === p}
            onClick={() => setPlacement(p)}
            className="h-7 rounded-sm px-2.5 font-medium text-muted-foreground aria-checked:bg-accent aria-checked:text-foreground"
          >
            {p === "ad" ? "Facebook ad" : "Post on acme.in"}
          </button>
        ))}
      </div>
      <UtmCheck
        defaultValue="https://acme.in/diwali?utm_source=Facebook&utm_medium=social ads&utm_campaign=Diwali-Sale"
        knownValues={knownValues}
        placedOn={placement === "blog" ? ["acme.in"] : []}
      />
    </div>
  )
}
