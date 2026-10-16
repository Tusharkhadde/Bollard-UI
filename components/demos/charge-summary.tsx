"use client"

import * as React from "react"

import { ChargeSummary } from "@/registry/default/charge-summary/charge-summary"

export function Demo() {
  const [trial, setTrial] = React.useState(false)
  const [inclusive, setInclusive] = React.useState(false)
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={inclusive} onChange={(event) => setInclusive(event.target.checked)} className="size-4 accent-(--primary)" />
        Prices already include GST
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={trial} onChange={(event) => setTrial(event.target.checked)} className="size-4 accent-(--primary)" />
        Start with a 14-day free trial
      </label>
      <ChargeSummary
        now="2026-10-13T10:00:00+05:30"
        timeZone="Asia/Kolkata"
        trialEndsAt={trial ? "2026-10-27T10:00:00+05:30" : undefined}
        lines={
          trial
            ? [{ label: "Pro plan, monthly", amount: 499 }]
            : [
                { label: "Pro plan, monthly", amount: 499 },
                { label: "Credit for unused Starter time", amount: -120, recurring: false },
                { label: "One-time setup fee", amount: 49, recurring: false },
              ]
        }
        taxes={[{ label: "GST", rate: 18, inclusive }]}
      />
    </div>
  )
}
