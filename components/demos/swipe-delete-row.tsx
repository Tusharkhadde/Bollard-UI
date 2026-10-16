"use client"

import * as React from "react"

import { SwipeDeleteRow } from "@/registry/default/swipe-delete-row/swipe-delete-row"

const invoices = [
  { id: "1042", client: "Northwind Traders", amount: "₹48,200", due: "Due 20 Oct" },
  { id: "1043", client: "Fabrikam Studio", amount: "₹12,750", due: "Due 24 Oct" },
  { id: "1044", client: "Contoso Foods", amount: "₹3,980", due: "Paid" },
]

export function Demo() {
  const [rows, setRows] = React.useState(invoices)

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {rows.map((row) => (
        <SwipeDeleteRow
          key={row.id}
          itemLabel={`Invoice #${row.id}`}
          onDelete={() => setRows((current) => current.filter((item) => item.id !== row.id))}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-medium">{row.client}</p>
            <p className="shrink-0 text-sm tabular-nums">{row.amount}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            #{row.id} · {row.due}
          </p>
        </SwipeDeleteRow>
      ))}
      {rows.length < invoices.length ? (
        <button
          type="button"
          onClick={() => setRows(invoices)}
          className="mx-auto rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset demo
        </button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">Swipe a row left past the line, or use its trash button.</p>
      )}
    </div>
  )
}
