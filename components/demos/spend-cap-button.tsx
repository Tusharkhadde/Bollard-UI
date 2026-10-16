"use client"

import * as React from "react"

import { SpendCapButton, type SpendPurchase } from "@/registry/default/spend-cap-button/spend-cap-button"

export function Demo() {
  const [setup, setSetup] = React.useState<{ purchases: SpendPurchase[]; midnight: number; monthEnd: number }>()
  const [spent, setSpent] = React.useState({ day: 1200, month: 6450 })
  const [log, setLog] = React.useState("")

  React.useEffect(() => {
    const now = new Date()
    setSetup({
      purchases: [{ itemId: "storage-50gb", at: now.getTime() - 3 * 60_000, amount: 499, orderId: "ORD-8812" }],
      midnight: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime(),
      monthEnd: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(),
    })
  }, [])

  if (!setup) return <div className="h-48 w-full max-w-xs" />

  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm">
        <div>
          <p className="font-medium">+50 GB storage</p>
          <p className="text-xs text-muted-foreground">Team workspace · one-time</p>
        </div>
        <span className="font-medium tabular-nums">₹499</span>
      </div>
      <SpendCapButton
        amount={499}
        itemId="storage-50gb"
        purchases={setup.purchases}
        caps={[
          { label: "Daily cap", limit: 2000, spent: spent.day, resetsAt: setup.midnight },
          { label: "Monthly cap", limit: 10000, spent: spent.month, resetsAt: setup.monthEnd },
        ]}
        onViewOrder={(id) => setLog(`Opened ${id}.`)}
        onPurchase={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setSpent((s) => ({ day: s.day + 499, month: s.month + 499 }))
              setLog("Charged ₹499.")
              resolve()
            }, 600),
          )
        }
      />
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {log}
      </p>
    </div>
  )
}
