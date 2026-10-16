"use client"

import * as React from "react"

import { CsvExportGuard } from "@/registry/default/csv-export-guard/csv-export-guard"

const ROWS = [
  { name: "Priya Sharma", phone: "+91 98765 43210", order: "4012888888881881", size: "3-4", note: "Gift wrap", refund: -250 },
  { name: "Rahul Verma", phone: "09822012345", order: "4012888888881899", size: "5-6", note: '=HYPERLINK("http://evil.example","Invoice")', refund: 0 },
  { name: "Zoë Fernandes", phone: "+91 90040 11223", order: "4012888888881907", size: "M", note: "-", refund: 120 },
]
const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "order", label: "Order ID" },
  { key: "size", label: "Kids size" },
  { key: "note", label: "Note" },
  { key: "refund", label: "Refund" },
]

export function Demo() {
  const [last, setLast] = React.useState<string>()
  return (
    <div className="grid w-full max-w-md gap-2">
      <CsvExportGuard rows={ROWS} columns={COLUMNS} filename="orders.csv" onExport={(csv) => setLast(csv.split("\r\n")[2])} />
      <p aria-live="polite" className="min-h-5 truncate font-mono text-xs text-muted-foreground">{last && `Row 2: ${last}`}</p>
    </div>
  )
}
