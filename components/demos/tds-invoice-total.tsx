"use client"

import { TdsInvoiceTotal } from "@/registry/default/tds-invoice-total/tds-invoice-total"

export function Demo() {
  return (
    <TdsInvoiceTotal
      invoiceDate="2026-10-14"
      defaultValue={{
        fee: 50000,
        kind: "professional",
        payer: "business",
        gstRegistered: true,
        gstRate: 18,
        panShared: true,
        paidThisYear: 40000,
        clientTds: 5900,
      }}
    />
  )
}
