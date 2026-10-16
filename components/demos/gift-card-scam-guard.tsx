"use client"

import * as React from "react"

import { GiftCardScamGuard, type GiftCardLine } from "@/registry/default/gift-card-scam-guard/gift-card-scam-guard"

const LINES: GiftCardLine[] = [{ brand: "Google Play", amount: 10_000, quantity: 5 }]
const NOTE = "Need these for client gifts today. Scratch them and send me the codes on WhatsApp, keep it confidential. Rajesh (CEO)"

export function Demo() {
  const [status, setStatus] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-3">
      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">5 × Google Play gift card, ₹10,000</p>
        <p className="mt-1 text-xs text-muted-foreground">Note: {NOTE}</p>
      </div>
      <GiftCardScamGuard
        lines={LINES}
        note={NOTE}
        firstPurchase
        currency="INR"
        locale="en-IN"
        helpUrl="https://cybercrime.gov.in"
        onCancel={() => setStatus("Order cancelled. Nothing was charged.")}
        onContinue={() => new Promise<void>((resolve) => setTimeout(() => { setStatus("Going to payment…"); resolve() }, 500))}
      />
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  )
}
