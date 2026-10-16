"use client"

import * as React from "react"

import { UnambiguousDate, type DateOrder } from "@/registry/default/unambiguous-date/unambiguous-date"

const COLUMN = ["04/11/2026", "06/09/2026", "08/12/2026"]

// Fixed "today" so the demo renders the same everywhere: 13 Oct 2026.
const TODAY = new Date(2026, 9, 13)

export function Demo() {
  const [typed, setTyped] = React.useState("03/10/2026")
  // One answer for the whole column: pick a reading on any row and the others follow.
  const [columnOrder, setColumnOrder] = React.useState<"DMY" | "MDY" | null>(null)
  const resolveColumn = (reading: { order: DateOrder } | null) =>
    setColumnOrder(reading && reading.order !== "YMD" ? reading.order : null)

  return (
    <div className="w-full max-w-sm space-y-4">
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Renewal</dt>
        <dd>
          <UnambiguousDate value={new Date(2026, 9, 18)} now={TODAY} showWeekday />
        </dd>
        <dt className="text-muted-foreground">Last payment</dt>
        <dd>
          <UnambiguousDate value="2026-10-12" now={TODAY} />
        </dd>
        <dt className="text-muted-foreground">Contract end</dt>
        <dd>
          <UnambiguousDate value="25/12/2026" now={TODAY} />
        </dd>
      </dl>
      <div className="space-y-2 rounded-lg border p-3">
        <label htmlFor="demo-typed-date" className="text-sm font-medium">
          Type a date as it arrived in a CSV
        </label>
        <input
          id="demo-typed-date"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className="h-9 w-full rounded-md border bg-transparent px-3 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
        {typed.trim() && <UnambiguousDate value={typed} now={TODAY} />}
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">“Due” column from an import</p>
        <ul className="space-y-2">
          {COLUMN.map((value) => (
            <li key={value}>
              <UnambiguousDate value={value} now={TODAY} order={columnOrder} onResolve={resolveColumn} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
