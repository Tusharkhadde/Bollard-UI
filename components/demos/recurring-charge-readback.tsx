"use client"

import * as React from "react"

import { RecurringChargeReadback, type RecurringChargeReadbackProps } from "@/registry/default/recurring-charge-readback/recurring-charge-readback"

const PLANS: Record<string, { label: string; button: string; props: Pick<RecurringChargeReadbackProps, "amount" | "interval" | "trialEndsAt" | "intro"> }> = {
  intro: { label: "Intro offer", button: "Subscribe for ₹99/month", props: { amount: 499, intro: { amount: 99, periods: 3 } } },
  trial: { label: "Free trial", button: "Start free trial", props: { amount: 499, trialEndsAt: "2026-10-21T10:00:00+05:30" } },
  yearly: { label: "Yearly", button: "Get Pro for ₹499/mo", props: { amount: 5988, interval: "year" } },
}

export function Demo() {
  const [plan, setPlan] = React.useState("intro")
  const id = React.useId()
  const current = PLANS[plan]
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div role="radiogroup" aria-label="Plan" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs">
        {Object.entries(PLANS).map(([key, p]) => (
          <button key={key} type="button" role="radio" aria-checked={plan === key} onClick={() => setPlan(key)} className="rounded-md px-2 py-1.5 text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-xs">
            {p.label}
          </button>
        ))}
      </div>
      <button type="button" aria-describedby={id} className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {current.button}
      </button>
      <RecurringChargeReadback id={id} {...current.props} buttonLabel={current.button} now="2026-10-14T10:00:00+05:30" timeZone="Asia/Kolkata" />
    </div>
  )
}
