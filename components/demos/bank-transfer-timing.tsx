"use client"

import * as React from "react"

import { BankTransferTiming, type Rail } from "@/registry/default/bank-transfer-timing/bank-transfer-timing"

const chip = "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium tabular-nums outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground aria-pressed:bg-accent"
// Fixed clock so the demo renders the same everywhere: Wed 14 Oct 2026, 14:12 India time.
const NOW = new Date("2026-10-14T14:12:00+05:30")

export function Demo() {
  // Opens on the classic slip: RTGS picked for ₹1,50,000, which every bank refuses.
  const [amount, setAmount] = React.useState(150000)
  const [rail, setRail] = React.useState<Rail>("RTGS")
  return (
    <div className="w-full max-w-md space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Amount:</span>
        {[150000, 450000, 600000].map((value) => (
          <button key={value} type="button" aria-pressed={amount === value} className={chip} onClick={() => setAmount(value)}>
            ₹{value.toLocaleString("en-IN")}
          </button>
        ))}
      </div>
      <BankTransferTiming
        amount={amount}
        rail={rail}
        onRailChange={setRail}
        payee="Meera Iyer"
        now={NOW}
        newPayee={{ addedAt: new Date("2026-10-14T13:20:00+05:30"), coolingMinutes: 30, firstDayLimit: 500000 }}
        onContinue={() => new Promise((resolve) => setTimeout(resolve, 600))}
      />
    </div>
  )
}
