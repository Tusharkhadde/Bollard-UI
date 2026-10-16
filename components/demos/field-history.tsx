"use client"

import * as React from "react"

import { FieldHistory, type FieldVersion } from "@/registry/default/field-history/field-history"

const HOUR = 3_600_000

export function Demo() {
  const [history, setHistory] = React.useState<FieldVersion[]>()
  const [price, setPrice] = React.useState("650")

  React.useEffect(() => {
    const now = Date.now()
    setHistory([
      { value: "650", by: "Priya", at: now - 26 * HOUR },
      { value: "500", by: "You", at: now - 5 * 24 * HOUR },
      { value: "450", by: "Arjun", at: now - 16 * 24 * HOUR },
    ])
  }, [])

  if (!history) return <div className="h-64 w-full max-w-sm" />

  return (
    <div className="w-full max-w-sm">
      <FieldHistory
        label="Price per guest"
        htmlFor="guest-price"
        history={history}
        value={price}
        you="You"
        defaultOpen
        format={(v) => `₹${v}`}
        onRevert={async (value) => {
          await new Promise((resolve) => setTimeout(resolve, 400))
          setHistory((h) => [{ value, by: "You", at: Date.now() }, ...(h ?? [])])
          setPrice(value)
        }}
      >
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
          <input
            id="guest-price"
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
            className="h-9 w-full rounded-md border bg-transparent pr-3 pl-7 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </div>
      </FieldHistory>
    </div>
  )
}
