"use client"

import * as React from "react"

import { SmsSegments } from "@/registry/default/sms-segments/sms-segments"

const draft =
  "Hi Priya, your order #4821 is packed and ships tomorrow. We’ll text the tracking link once the courier picks it up. Reply STOP to opt out or HELP for support. Thanks, Kirana Co"

export function Demo() {
  const [recipients, setRecipients] = React.useState(1250)
  return (
    <div className="grid w-full max-w-sm gap-3">
      <SmsSegments rows={5} label="Order update SMS" defaultValue={draft} recipients={recipients} pricePerSegment={0.2} currency="INR" locale="en-IN" />
      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        Recipients
        <select
          value={recipients}
          onChange={(event) => setRecipients(Number(event.target.value))}
          className="h-8 rounded-md border bg-transparent px-2 text-sm text-foreground shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {[1, 250, 1250, 10000].map((n) => (
            <option key={n} value={n}>{n.toLocaleString("en-IN")}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
