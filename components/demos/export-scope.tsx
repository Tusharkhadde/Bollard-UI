"use client"

import * as React from "react"

import { ExportScope, type ExportScopeData } from "@/registry/default/export-scope/export-scope"

const scope: ExportScopeData = {
  totalRows: 12480,
  pageRows: 50,
  page: 1,
  pageCount: 250,
  rowLimit: 10000,
  filters: [
    { label: "Status", value: "Paid" },
    { label: "Region", value: "West" },
  ],
  dateRange: { from: "2026-09-14", to: "2026-10-13", label: "Last 30 days" },
  columns: [
    { key: "id", label: "Invoice" },
    { key: "customer", label: "Customer" },
    { key: "email", label: "Email", pii: true },
    { key: "phone", label: "Phone", pii: true, hidden: true },
    { key: "amount", label: "Amount" },
    { key: "gstin", label: "GSTIN", hidden: true },
  ],
}

export function Demo() {
  const [done, setDone] = React.useState<string>()
  return (
    <div className="grid w-full max-w-md gap-2">
      <ExportScope
        scope={scope}
        onExport={(options, summary) => setDone(`Exported ${summary.rowCount.toLocaleString("en-IN")} rows (${options.rows === "all" ? "all pages" : options.rows}, personal data: ${options.pii}).`)}
      />
      <p role="status" className="min-h-5 text-center text-xs text-muted-foreground">{done}</p>
    </div>
  )
}
