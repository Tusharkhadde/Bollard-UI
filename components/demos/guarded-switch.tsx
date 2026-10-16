"use client"

import * as React from "react"

import { GuardedSwitch } from "@/registry/default/guarded-switch/guarded-switch"

export function Demo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <GuardedSwitch
        label="Maintenance mode"
        onEffect="Site goes offline for all 12,400 users"
        offEffect="Site comes back online for all 12,400 users"
      />
      <GuardedSwitch
        label="Kill switch: card payments"
        tone="black"
        defaultValue
        onText="accepting payments"
        offText="payments paused"
        onEffect="Checkout accepts cards again in 3 regions"
        offEffect="Every checkout stops taking cards in 3 regions"
        onValueChange={() => new Promise<void>((resolve) => setTimeout(resolve, 700))}
      />
      <p className="text-center text-xs text-muted-foreground">Click a switch: the cover takes the first click.</p>
    </div>
  )
}
