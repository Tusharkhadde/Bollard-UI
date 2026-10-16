"use client"

import { EmiReadback } from "@/registry/default/emi-readback/emi-readback"

export function Demo() {
  return (
    <EmiReadback
      showOtherCharges
      defaultValue={{ amount: 500000, rate: 12, rateType: "flat", tenure: 60, tenureUnit: "years", fee: 2, feeUnit: "percent", otherCharges: 4500, prepay: 100000, prepayAfter: 12 }}
    />
  )
}
