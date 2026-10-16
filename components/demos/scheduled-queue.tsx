"use client"

import * as React from "react"

import { hourIn, nextHourIn, ScheduledQueue, type ScheduledItem } from "@/registry/default/scheduled-queue/scheduled-queue"

// Keep the demo's "about to go" row out of quiet hours whatever time it is for the viewer.
const daytimeZone = (t: number) =>
  ["Asia/Kolkata", "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney"].find((z) => {
    const h = hourIn(t, z)
    return h >= 9 && h < 20
  }) ?? "Asia/Kolkata"

export function Demo() {
  const [items, setItems] = React.useState<ScheduledItem[]>()
  const [log, setLog] = React.useState("")

  React.useEffect(() => {
    const now = Date.now()
    const soon = now + 4 * 60_000
    setItems([
      { id: "sms", title: "Order shipped SMS", detail: "1,240 customers", at: soon, timeZone: daytimeZone(soon) },
      { id: "uae", title: "Diwali offer · UAE list", detail: "8,900 contacts", at: nextHourIn(now + 3_600_000, 2, "Asia/Dubai") + 15 * 60_000, timeZone: "Asia/Dubai" },
      { id: "digest", title: "Weekly digest", detail: "All staff", at: now - 12 * 60_000, timeZone: "Asia/Kolkata" },
      { id: "invoice", title: "Invoice reminders", detail: "42 clients", at: nextHourIn(now + 6 * 3_600_000, 11, "Asia/Kolkata"), timeZone: "Asia/Kolkata" },
    ])
  }, [])

  if (!items) return <div className="h-96 w-full max-w-md" />
  const title = (id: string) => items.find((i) => i.id === id)?.title
  const drop = (id: string) => setItems((list) => list?.filter((i) => i.id !== id))

  return (
    <div className="w-full max-w-md space-y-2">
      <ScheduledQueue
        items={items}
        onCancel={(id) => (setLog(`Cancelled “${title(id)}”.`), drop(id))}
        onSendNow={(id) => (setLog(`Sent “${title(id)}”.`), drop(id))}
        onReschedule={(id, at) => {
          setLog(`Moved “${title(id)}”.`)
          setItems((list) => list?.map((i) => (i.id === id ? { ...i, at } : i)))
        }}
      />
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {log}
      </p>
    </div>
  )
}
