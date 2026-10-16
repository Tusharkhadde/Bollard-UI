"use client"

import * as React from "react"

import { FxSendReceive, type FxAmountValue, type FxCharges, type FxReadback } from "@/registry/default/fx-send-receive/fx-send-receive"

// A freelancer's EUR 1,200 invoice paid from a US dollar account, with the invoice figure typed into "You send".
// Rate and fees are illustrative, shaped like a typical bank quote.
const QUOTE = { rate: 0.8612, fixedFee: 4.5, percentFee: 0.45, intermediaryFee: 20, ourFee: 18 }

export function Demo() {
  const [value, setValue] = React.useState<FxAmountValue>({ side: "send", amount: 1200 })
  const [charges, setCharges] = React.useState<FxCharges>("SHA")
  const [read, setRead] = React.useState<FxReadback | null>(null)

  return (
    <div className="grid w-full max-w-md gap-2">
      <FxSendReceive
        from="USD"
        to="EUR"
        quote={QUOTE}
        expected={{ amount: 1200, currency: "EUR" }}
        recipientName="Lena"
        value={value}
        onValueChange={(v, r) => {
          setValue(v)
          setRead(r)
        }}
        charges={charges}
        onChargesChange={setCharges}
        locale="en-US"
      />
      <p className="px-1 text-xs text-muted-foreground">
        Fixed side: <span className="font-medium text-foreground">{value.side === "send" ? "what you send" : "what Lena receives"}</span> · charges {charges}
        {read && read.problems.length === 0 ? " · ready to pay" : ""}
      </p>
    </div>
  )
}
