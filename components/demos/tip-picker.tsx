"use client"

import { TipPicker } from "@/registry/default/tip-picker/tip-picker"

export function Demo() {
  return (
    <TipPicker
      subtotal={2000}
      tax={100}
      serviceCharge={{ label: "A service charge", amount: 200 }}
      defaultCustomText="250"
      defaultCustomMode="percent"
    />
  )
}
