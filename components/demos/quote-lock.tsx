"use client"

import * as React from "react"

import { QuoteLock, type Quote } from "@/registry/default/quote-lock/quote-lock"

// The page was left open: the quote it loaded has already run out, and the market moved up.
const opened: Quote = { id: "q0", amount: 15108.4, currency: "INR", validFor: 0, detail: "$180.00 at 1 USD = 83.38 INR · fee ₹99" }
const market = [
  { amount: 15381.7, rate: "84.90" },
  { amount: 15329.5, rate: "84.61" },
  { amount: 15412.3, rate: "85.07" },
]

export function Demo() {
  const calls = React.useRef(0)
  const [log, setLog] = React.useState("")

  const requote = () =>
    new Promise<Quote>((resolve) => {
      const next = market[calls.current % market.length]
      calls.current += 1
      setTimeout(
        () =>
          resolve({
            id: `q${calls.current}`,
            amount: next.amount,
            currency: "INR",
            validFor: 20_000,
            detail: `$180.00 at 1 USD = ${next.rate} INR · fee ₹99`,
          }),
        700,
      )
    })

  return (
    <div className="grid w-full max-w-sm gap-2">
      <QuoteLock
        label="You pay to send $180.00 to Maya"
        quote={opened}
        tolerance={0.5}
        locale="en-IN"
        onRequote={requote}
        onConfirm={(q) => new Promise<void>((resolve) => setTimeout(() => (setLog(`Paid with quote ${q.id}.`), resolve()), 600))}
      />
      <p role="status" className="min-h-4 text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
