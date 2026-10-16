"use client"

import * as React from "react"

import { CtcBreakdownInput } from "@/registry/default/ctc-breakdown-input/ctc-breakdown-input"

export function Demo() {
  return (
    <div className="w-full max-w-sm space-y-2">
      <p className="text-xs text-muted-foreground">Offer from a Series B startup · “₹24 LPA”</p>
      <CtcBreakdownInput defaultValue={{ ctc: 2_400_000, variable: 400_000, esop: 300_000, joiningBonus: 200_000, pf: 21_600 }} />
    </div>
  )
}
