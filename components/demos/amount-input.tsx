"use client"

import * as React from "react"

import { AmountInput } from "@/registry/default/amount-input/amount-input"

export function Demo() {
  // One zero too many: the rent is usually ₹25,000.
  const [rent, setRent] = React.useState<number | null>(250000)

  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <AmountInput label="Monthly rent" value={rent} onValueChange={setRent} typical={25000} />
      <AmountInput label="Invoice total" locale="en-US" currency="USD" defaultValue={1250.5} />
      <p className="text-xs text-muted-foreground">
        Rent sent to the server: <span className="font-mono tabular-nums text-foreground">{rent ?? "empty"}</span>
      </p>
    </form>
  )
}
