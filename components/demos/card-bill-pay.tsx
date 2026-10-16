"use client"

import * as React from "react"

import { CardBillPay } from "@/registry/default/card-bill-pay/card-bill-pay"

// 14 Oct 2026, bill due 18 Oct: the cardholder has picked "Minimum".
const NOW = new Date(2026, 9, 14, 10).getTime()
const statement = { totalDue: 48250.4, minimumDue: 2413, dueDate: "2026-10-18", statementDate: "2026-09-28" }

export function Demo() {
  const [result, setResult] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-2">
      <CardBillPay
        statement={statement}
        defaultValue={2413}
        now={NOW}
        options={{ monthlyRate: 3.75, lateFee: (owed) => (owed > 25000 ? 1300 : owed > 10000 ? 1000 : 500) }}
        onPay={async (amount) => {
          await new Promise((resolve) => setTimeout(resolve, 600))
          setResult(`Paid ₹${amount.toLocaleString("en-IN")}`)
        }}
      />
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
    </div>
  )
}
