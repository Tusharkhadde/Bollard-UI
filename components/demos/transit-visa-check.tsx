"use client"

import * as React from "react"

import { TransitVisaCheck, type Layover } from "@/registry/default/transit-visa-check/transit-visa-check"

export function Demo() {
  // Mumbai → London → Toronto, booked as a cheap "self-transfer" fare.
  const [layover, setLayover] = React.useState<Partial<Layover>>({ nationality: "IN", airport: "LHR", onward: "CA", hours: 5, selfTransfer: true, separateTickets: true })
  return (
    <div className="grid w-full max-w-md gap-3">
      <p className="text-xs text-muted-foreground">Mumbai → London → Toronto · cheapest fare found</p>
      <TransitVisaCheck value={layover} onValueChange={setLayover} />
    </div>
  )
}
