"use client"

import * as React from "react"

import { ReorderReadback, type ReorderItem } from "@/registry/default/reorder-readback/reorder-readback"

const gateways: ReorderItem[] = [
  { id: "upi", label: "UPI intent", description: "Pinned by finance · always offered first", pinned: true },
  { id: "razorpay", label: "Razorpay", description: "Cards and netbanking · 1.9% fee" },
  { id: "cashfree", label: "Cashfree", description: "Cards · 1.75% fee" },
  { id: "stripe", label: "Stripe", description: "International cards · 2.9% fee" },
  { id: "paypal", label: "PayPal", description: "Wallet · 4.4% fee" },
]
const saved = gateways.map((g) => g.id)
// Opens mid-mistake: PayPal, the most expensive, was just dragged to the top of the card fallbacks.
const slipped = ["upi", "paypal", "razorpay", "cashfree", "stripe"]

export function Demo() {
  const [order, setOrder] = React.useState(slipped)

  return (
    <div className="grid w-full max-w-md grid-cols-1 gap-2">
      <p className="text-sm font-medium">Payment fallback order</p>
      <ReorderReadback
        label="Payment fallback order"
        items={gateways}
        value={order}
        onValueChange={setOrder}
        baseline={saved}
        describePosition={(i, total) => (i === 1 ? "the first gateway tried for cards" : i === total - 1 ? "the last resort" : `fallback ${i}`)}
      />
      <p className="text-xs text-muted-foreground">Drag by the grip, or click it and use the arrows. Try moving a gateway above UPI.</p>
    </div>
  )
}
