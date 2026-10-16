"use client"

import * as React from "react"

import { GstInvoiceCheck, type GstCharged } from "@/registry/default/gst-invoice-check/gst-invoice-check"

const selectClass =
  "h-8 w-full min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

export function Demo() {
  const [pos, setPos] = React.useState("29")
  const [rate, setRate] = React.useState(12)
  const [charged, setCharged] = React.useState<GstCharged>({ cgst: 1260, sgst: 1260, total: 17520 })
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <label className="grid gap-1">
          Place of supply
          <select value={pos} onChange={(e) => setPos(e.target.value)} className={selectClass}>
            <option value="29">29 Karnataka</option>
            <option value="27">27 Maharashtra</option>
            <option value="04">04 Chandigarh</option>
          </select>
        </label>
        <label className="grid gap-1">
          Hosting rate
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className={selectClass}>
            <option value={12}>12%</option>
            <option value={18}>18%</option>
          </select>
        </label>
      </div>
      <GstInvoiceCheck
        supplierGstin="27AAPFU0939F1ZV"
        placeOfSupply={pos}
        invoiceDate="2026-10-14"
        lines={[
          { description: "Website design", taxableValue: 12000, rate: 18 },
          { description: "Hosting (1 year)", taxableValue: 3000, rate },
        ]}
        charged={charged}
        onFix={setCharged}
      />
    </div>
  )
}
