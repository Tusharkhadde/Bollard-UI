"use client"

import * as React from "react"

import { PayeeCheck, type PayeeDetails, type PayeeLookupResult } from "@/registry/default/payee-check/payee-check"

// A pretend bank directory, keyed by account number.
const bank: Record<string, PayeeLookupResult> = {
  "50200012345678": { name: "Priya Sharma Traders", accountType: "business" },
  "50100098765432": { name: "Rahul Mehta", accountType: "personal" },
}
const lookup = ({ account }: { account: string }) =>
  new Promise<PayeeLookupResult>((resolve) => setTimeout(() => resolve(bank[account] ?? { status: "not-found" }), 250))

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const presets: { label: string; value: PayeeDetails; type?: "personal" | "business" }[] = [
  { label: "Close match", value: { name: "Priya Sharma", account: "50200012345678", code: "HDFC0001234" } },
  { label: "No match", value: { name: "Priya Sharma", account: "50100098765432", code: "ICIC0000456" } },
  { label: "Wrong account type", value: { name: "Rahul Mehta", account: "50100098765432", code: "ICIC0000456" }, type: "business" },
]

export function Demo() {
  const [details, setDetails] = React.useState(presets[0].value)
  const [type, setType] = React.useState<"personal" | "business">()
  const [status, setStatus] = React.useState("")
  return (
    <div className="grid w-full max-w-sm gap-3">
      <PayeeCheck
        value={details}
        onValueChange={setDetails}
        lookup={lookup}
        expectedAccountType={type}
        amount={250000}
        formatAmount={(n) => inr.format(n)}
        newPayee
        largeAmount={50000}
        onTestPayment={() => setStatus("Sent ₹1 test payment.")}
        testPaymentLabel="Send ₹1 first"
        onPay={(d, verdict) => setStatus(`Paid ${d.name} (${verdict}).`)}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => {
              setDetails(p.value)
              setType(p.type)
            }} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {p.label}
          </button>
        ))}
        <span aria-live="polite">{status}</span>
      </div>
    </div>
  )
}
