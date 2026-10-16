"use client"

import * as React from "react"

import { BulkSendGuard } from "@/registry/default/bulk-send-guard/bulk-send-guard"

// 7:00 PM in India: Singapore and Los Angeles are in quiet hours.
const now = new Date("2026-10-14T13:30:00Z")

export function Demo() {
  const [log, setLog] = React.useState("")

  return (
    <div className="w-full max-w-sm space-y-2">
      <p className="text-xs text-muted-foreground">Diwali offer · “Get 20% off till Sunday…”</p>
      <BulkSendGuard
        channel="whatsapp"
        now={now}
        audience={{
          total: 13_812,
          optedOut: 1_212,
          invalid: 120,
          byTimeZone: { "Asia/Kolkata": 8_950, "Asia/Dubai": 1_340, "Asia/Singapore": 1_260, "Europe/London": 410, "America/Los_Angeles": 520 },
        }}
        costPerMessage={0.86}
        lastSend={{ count: 3_020, at: "2026-10-02T08:00:00Z" }}
        fallbackTimeZone="Asia/Kolkata"
        onSend={(plan) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setLog(`Queued ${plan.now.toLocaleString("en-IN")} now${plan.held.length ? `, ${plan.held.reduce((s, h) => s + h.count, 0).toLocaleString("en-IN")} for the morning` : ""}.`)
              resolve()
            }, 700),
          )
        }
      />
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {log}
      </p>
    </div>
  )
}
