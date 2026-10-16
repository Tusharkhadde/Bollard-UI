"use client"

import * as React from "react"

import { EditLock } from "@/registry/default/edit-lock/edit-lock"

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed md:text-sm dark:bg-input/30"

export function Demo() {
  const [status, setStatus] = React.useState("Approved by Priya")

  return (
    <div className="w-full max-w-md space-y-2">
      <p className="text-xs text-muted-foreground">
        PO-2291 · <span aria-live="polite">{status}</span>
      </p>
      <EditLock lockedBy="Priya" relockAfter={30_000} onEdit={() => setStatus("Needs re-approval")}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 space-y-1.5">
            <span className="font-medium">Vendor</span>
            <input className={field} defaultValue="Shree Packaging Pvt Ltd" />
          </label>
          <label className="space-y-1.5">
            <span className="font-medium">Amount (₹)</span>
            <input className={field} inputMode="decimal" defaultValue="1,84,500" />
          </label>
          <label className="space-y-1.5">
            <span className="font-medium">Due</span>
            <input className={field} defaultValue="30 Oct 2026" />
          </label>
        </div>
      </EditLock>
    </div>
  )
}
