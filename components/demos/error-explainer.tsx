"use client"

import * as React from "react"

import { ErrorExplainer } from "@/registry/default/error-explainer/error-explainer"

const stack = `POST /v1/payments 504 Gateway Timeout (30012 ms)
  at fetchJson (checkout/api.ts:41:11)
  at async submitPayment (checkout/pay.ts:88:5)
upstream: payments-gw-2.ap-south-1`

const scenarios = {
  payment: "Payment timed out",
  rate: "Rate limited",
  session: "Signed out",
} as const

export function Demo() {
  const [scenario, setScenario] = React.useState<keyof typeof scenarios>("payment")
  const [note, setNote] = React.useState("")
  const occurredAt = Date.UTC(2026, 9, 13, 8, 47)

  return (
    <div className="grid w-full max-w-md gap-3">
      <div role="group" aria-label="Scenario" className="flex flex-wrap gap-1.5">
        {Object.entries(scenarios).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={scenario === key}
            onClick={() => {
              setScenario(key as keyof typeof scenarios)
              setNote("")
            }}
            className="h-8 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent aria-pressed:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {label}
          </button>
        ))}
      </div>

      {scenario === "payment" && (
        <ErrorExplainer
          key="payment"
          code={504}
          explanation={{ title: "We didn't hear back about your payment of ₹2,499" }}
          message="Gateway Timeout"
          details={stack}
          referenceId="PAY-7Q4K-2M9X"
          occurredAt={occurredAt}
          idempotent={false}
          onCheckStatus={() => setNote("Checked: the payment went through. Order #48213 is confirmed, nothing to retry.")}
          onRetry={() => Promise.reject(new Error("still timing out"))}
          onContact={() => setNote("Opening support with the reference attached…")}
        />
      )}
      {scenario === "rate" && (
        <ErrorExplainer
          key="rate"
          code={429}
          message="Too Many Requests"
          details="Retry-After: 12"
          referenceId="REQ-91F0-CC2A"
          occurredAt={occurredAt}
          retryAfter={12}
          onRetry={() => setNote("Retried after the wait. Report exported.")}
        />
      )}
      {scenario === "session" && (
        <ErrorExplainer key="session" code={401} message="invalid_token: JWT expired at 2026-10-13T08:30:00Z" referenceId="AUTH-3B1D-0E77" onFix={() => setNote("Opening sign-in, your draft is kept.")} />
      )}
      <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
