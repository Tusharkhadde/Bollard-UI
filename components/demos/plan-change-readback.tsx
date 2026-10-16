"use client"

import { PlanChangeReadback } from "@/registry/default/plan-change-readback/plan-change-readback"

export function Demo() {
  return (
    <PlanChangeReadback
      current={{ name: "Team", price: 1999, interval: "month" }}
      next={{ name: "Starter", price: 499, interval: "month" }}
      periodStart="2026-10-01T00:00:00+05:30"
      periodEnd="2026-11-01T00:00:00+05:30"
      now="2026-10-13T10:00:00+05:30"
      timeZone="Asia/Kolkata"
      defaultTiming="now"
      lose={["SSO and audit log", "Priority support"]}
      limits={[
        { label: "Seats", used: 8, limit: 3, effect: "The 5 most recently added members lose access.", destructive: true },
        { label: "Storage", used: 14, limit: 10, unit: "GB", effect: "Uploads pause until you're under; nothing is deleted." },
      ]}
      onConfirm={() => new Promise((resolve) => setTimeout(resolve, 900))}
    />
  )
}
