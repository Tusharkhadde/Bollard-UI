"use client"

import * as React from "react"

import { QuantityStepper } from "@/registry/default/quantity-stepper/quantity-stepper"

export function Demo() {
  const [cart, setCart] = React.useState(2)
  return (
    <div className="grid w-full max-w-sm gap-4">
      <QuantityStepper label="Coffee beans, 250 g" value={cart} onValueChange={setCart} typical={2} max={500} stock={250} />
      <QuantityStepper label="Conference tickets" max={10} stock={7} typical={1} />
      <QuantityStepper label="Paper cups, packs of 50" min={50} step={50} max={1000} defaultValue={100} />
      <QuantityStepper label="Limited-edition print" stock={0} />
      <p className="text-xs text-muted-foreground">
        Type 20 or 100 in the first field, 9 in the second, 120 in the cups, or hold + to speed up. Cart:{" "}
        <span className="font-medium text-foreground tabular-nums">{cart}</span>
      </p>
    </div>
  )
}
