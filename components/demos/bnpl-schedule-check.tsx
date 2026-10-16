"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { BnplScheduleCheck, payInN, paydaysEvery, type BnplPlan } from "@/registry/default/bnpl-schedule-check/bnpl-schedule-check"

// A $250 pay-in-4 on Thu 15 Oct 2026, fortnightly paydays on Fridays, a card that runs out in October
// and two plans already running. Late fees follow Afterpay US: up to $8 per missed payment, capped at 25% of the order.
const PLAN = payInN(250, "2026-10-15", 4, 14)
const PAYDAYS = paydaysEvery("2026-10-02", 14, "2026-12-31")
const OTHERS: BnplPlan[] = [
  { name: "Sneakers", instalments: [{ date: "2026-10-28", amount: 35 }, { date: "2026-11-11", amount: 35 }] },
  { name: "Phone case", instalments: [{ date: "2026-10-31", amount: 12.5 }] },
]

export function Demo() {
  const [done, setDone] = React.useState<string | null>(null)
  if (done)
    return (
      <div className="grid w-full max-w-md gap-2">
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden className="size-4" />
          {done}
        </p>
        <button type="button" onClick={() => setDone(null)} className="w-fit text-xs text-muted-foreground underline underline-offset-2">
          Start again
        </button>
      </div>
    )

  return (
    <BnplScheduleCheck
      instalments={PLAN}
      currency="USD"
      locale="en-US"
      weekStartsOn={0}
      paydays={PAYDAYS}
      others={OTHERS}
      card={{ label: "Visa •• 4242", expires: "10/26" }}
      bankLabel="checking account"
      lateFee={{ perMissed: 8, capPercent: 25 }}
      onConfirm={async (v) => {
        await new Promise((r) => setTimeout(r, 700))
        setDone(`Plan confirmed, paying from ${v.source === "bank" ? "checking" : "Visa •• 4242"}. Last payment ${v.dates.at(-1)}.`)
      }}
    />
  )
}
