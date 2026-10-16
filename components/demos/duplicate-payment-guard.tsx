"use client"

import * as React from "react"

import { DuplicatePaymentGuard, type PastPayment, type PaymentStatus } from "@/registry/default/duplicate-payment-guard/duplicate-payment-guard"

const scenarios = {
  recent: { label: "Paid 12 min ago", status: "success" as PaymentStatus, minutes: 12 },
  pending: { label: "Timed out", status: "pending" as PaymentStatus, minutes: 2 },
}

export function Demo() {
  const [scenario, setScenario] = React.useState<keyof typeof scenarios>("recent")
  const [history, setHistory] = React.useState<PastPayment[]>()
  const [log, setLog] = React.useState("")

  React.useEffect(() => {
    const s = scenarios[scenario]
    setHistory([
      { payeeId: "ravi.kumar@okaxis", amount: 2400, at: Date.now() - s.minutes * 60_000, status: s.status, reference: "UTR 428113907245" },
      { payeeId: "meera@oksbi", amount: 2400, at: Date.now() - 5 * 60_000 },
    ])
    setLog("")
  }, [scenario])

  return (
    <div className="w-full max-w-xs space-y-3">
      <div role="group" aria-label="Scenario" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs">
        {(Object.keys(scenarios) as (keyof typeof scenarios)[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={scenario === key}
            onClick={() => setScenario(key)}
            className="h-7 rounded-md px-2 font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
          >
            {scenarios[key].label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 text-sm">
        <div className="min-w-0">
          <p className="font-medium">Ravi Kumar</p>
          <p className="truncate text-xs text-muted-foreground">ravi.kumar@okaxis · Rent share</p>
        </div>
        <span className="font-medium tabular-nums">₹2,400</span>
      </div>
      {history && (
        <DuplicatePaymentGuard
          key={scenario}
          payee={{ id: "ravi.kumar@okaxis", name: "Ravi" }}
          amount={2400}
          payments={history}
          onPay={() => new Promise<void>((resolve) => setTimeout(() => (setLog("Sent ₹2,400 to Ravi."), resolve()), 700))}
          onCheckStatus={() => new Promise<PaymentStatus>((resolve) => setTimeout(() => (setLog("The bank says the first one went through."), resolve("success")), 600))}
        />
      )}
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {log}
      </p>
    </div>
  )
}
