"use client"

import * as React from "react"

import { UpiAutopayReview, type Mandate } from "@/registry/default/upi-autopay-review/upi-autopay-review"

const NOW = new Date(2026, 9, 14, 10).getTime()

const sent: Mandate = {
  merchant: "StreamMax Media Pvt Ltd",
  merchantVpa: "streammax.autopay@okicici",
  maxAmount: 9999,
  amountRule: "max",
  frequency: "aspresented",
  start: NOW,
  end: null,
}

export function Demo() {
  const [result, setResult] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-2">
      <UpiAutopayReview
        defaultValue={sent}
        plan={{ name: "StreamMax Premium", price: 199, frequency: "monthly", merchant: "StreamMax" }}
        now={NOW}
        onApprove={async (mandate) => {
          await new Promise((resolve) => setTimeout(resolve, 600))
          setResult(`Approved: up to ₹${mandate.maxAmount}, ${mandate.frequency}`)
        }}
        onDecline={() => setResult("Declined")}
      />
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
    </div>
  )
}
