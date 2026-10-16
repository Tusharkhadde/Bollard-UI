"use client"

import { BillingPeriodInput } from "@/registry/default/billing-period-input/billing-period-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-5" onSubmit={(event) => event.preventDefault()}>
      <BillingPeriodInput
        label="Pro plan price"
        defaultValue={{ amount: "5,988", period: "month" }}
        reference={{ amount: 499, period: "month", label: "the current Pro price" }}
      />
      <BillingPeriodInput
        label="Team plan price"
        seats={5}
        defaultValue={{ amount: "2,495", period: "month", basis: "seat" }}
        reference={{ amount: 499, period: "month", basis: "seat", label: "the Pro seat price" }}
      />
    </form>
  )
}
