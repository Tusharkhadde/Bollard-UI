"use client"

import * as React from "react"

import { TaxRegimeCompare, type TaxInput } from "@/registry/default/tax-regime-compare/tax-regime-compare"

export function Demo() {
  // Sticking with the old regime "because of 80C" — and claiming more 80C than counts.
  const [value, setValue] = React.useState<TaxInput>({
    salary: 1800000, basic: 900000, hra: 360000, rent: 240000, city: "Pune",
    d80C: 200000, d80D: 25000, regime: "old",
  })
  return <TaxRegimeCompare value={value} onValueChange={setValue} />
}
