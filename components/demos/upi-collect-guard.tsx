"use client"

import * as React from "react"

import { UpiCollectGuard } from "@/registry/default/upi-collect-guard/upi-collect-guard"

export function Demo() {
  const [result, setResult] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-2">
      <UpiCollectGuard
        request={{
          name: "Rahul Sharma",
          vpa: "9876543210@ybl",
          amount: 4999,
          note: "OLX advance for sofa. Enter PIN to receive money",
        }}
        contacts={["mom@okaxis", "bescom.bill@icici"]}
        onPay={async () => {
          await new Promise((resolve) => setTimeout(resolve, 500))
          setResult("Opening UPI PIN…")
        }}
        onDecline={async () => {
          await new Promise((resolve) => setTimeout(resolve, 400))
          setResult("Declined. Nothing was sent.")
        }}
      />
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
    </div>
  )
}
