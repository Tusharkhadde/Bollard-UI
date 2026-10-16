"use client"

import * as React from "react"

import { TabCollision } from "@/registry/default/tab-collision/tab-collision"

const field =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed md:text-sm dark:bg-input/30"

function FakeTab({ name }: { name: string }) {
  const [amount, setAmount] = React.useState("48,500.00")
  return (
    <section aria-label={name} className="overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-muted-foreground/30" />
          <span className="size-2 rounded-full bg-muted-foreground/30" />
        </span>
        {name} · Invoice #1042
      </div>
      <div className="p-3">
        <TabCollision recordId="demo-invoice-1042" dirty={amount !== "48,500.00"}>
          <label className="grid gap-1.5 text-sm font-medium">
            Amount (₹)
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className={field} />
          </label>
        </TabCollision>
      </div>
    </section>
  )
}

export function Demo() {
  const [second, setSecond] = React.useState(false)
  // Open the same invoice in a second tab a moment later.
  React.useEffect(() => {
    const timer = setTimeout(() => setSecond(true), 150)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="grid w-full max-w-md gap-3">
      <FakeTab name="Tab 1" />
      {second && <FakeTab name="Tab 2" />}
    </div>
  )
}
