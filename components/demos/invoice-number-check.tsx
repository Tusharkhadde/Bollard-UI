"use client"

import * as React from "react"

import { InvoiceNumberCheck, type IssuedInvoice } from "@/registry/default/invoice-number-check/invoice-number-check"

const issued: IssuedInvoice[] = [
  { number: "SK/25-26/0187", date: "2026-03-30" },
  { number: "SK/26-27/0001", date: "2026-04-02" },
  { number: "SK/26-27/0002", date: "2026-04-09" },
  { number: "SK/26-27/0004", date: "2026-05-14" },
  { number: "SK/26-27/0005", date: "2026-06-21", cancelled: true },
  { number: "SK/26-27/0006", date: "2026-08-03" },
  { number: "SK/26-27/0007", date: "2026-10-03" },
]

export function Demo() {
  const [value, setValue] = React.useState("sk/26-27/0007")

  return (
    <div className="w-full max-w-xs space-y-3">
      <InvoiceNumberCheck value={value} onValueChange={setValue} issued={issued} date="2026-10-14" placeholder="SK/26-27/0008" />
      <p className="text-xs text-muted-foreground">Invoice dated 14 Oct 2026 · Shree Krishna Traders</p>
    </div>
  )
}
