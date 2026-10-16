"use client"

import * as React from "react"

import { ChequeCheck, type ChequeMode } from "@/registry/default/cheque-check/cheque-check"

// 14 Oct 2026: a cheque dated 10 Jul 2026 is past its 3 months; the one being written says 31 November.
const NOW = new Date(2026, 9, 14, 10).getTime()

export function Demo() {
  const [mode, setMode] = React.useState<ChequeMode>("receive")
  return (
    <div className="w-full max-w-md space-y-3">
      <div role="group" aria-label="Demo" className="inline-flex rounded-md border p-0.5 text-xs">
        {(["receive", "issue"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className="h-7 whitespace-nowrap rounded-sm px-2 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"
          >
            {m === "receive" ? "Depositing" : "Writing one"}
          </button>
        ))}
      </div>
      {mode === "receive" ? (
        <ChequeCheck key="receive" mode="receive" now={NOW} defaultValue={{ date: "10072026", amount: 75000 }} />
      ) : (
        <ChequeCheck key="issue" mode="issue" now={NOW} defaultValue={{ date: "31-11-26", amount: 120000 }} />
      )}
    </div>
  )
}
