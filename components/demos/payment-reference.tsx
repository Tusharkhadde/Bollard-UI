"use client"

import { PaymentReference } from "@/registry/default/payment-reference/payment-reference"

export function Demo() {
  return (
    <PaymentReference
      defaultValue="Payment for invoice #INV-2026-0142"
      expected="INV-2026-0142"
      defaultRail="neft"
      payerName="Tushar Khadde"
    />
  )
}
