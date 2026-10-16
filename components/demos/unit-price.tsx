"use client"

import * as React from "react"

import { UnitPrice, type PriceOption } from "@/registry/default/unit-price/unit-price"

const teas: PriceOption[] = [
  { id: "250", name: "Assam tea", price: 140, size: 250, unit: "g", multiBuy: { count: 3, price: 435 } },
  { id: "450", name: "Masala chai", price: 245, size: 450, unit: "g", was: { size: 500, price: 245 } },
  { id: "500", name: "Assam tea", price: 265, size: 500, unit: "g" },
  { id: "1000", name: "Assam tea", price: 560, size: 1, unit: "kg" },
]

export function Demo() {
  const [picked, setPicked] = React.useState("1000")
  return (
    <div className="grid w-full max-w-md gap-2">
      <UnitPrice options={teas} value={picked} onValueChange={setPicked} />
      <p role="status" className="text-center text-xs text-muted-foreground">
        In cart: {teas.find((t) => t.id === picked)?.name} {picked === "1000" ? "1 kg" : `${picked} g`}
      </p>
    </div>
  )
}
