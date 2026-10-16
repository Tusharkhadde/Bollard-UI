"use client"

import * as React from "react"

import { CalendarExternalGuestGuard, type GuardedEvent } from "@/registry/default/calendar-external-guest-guard/calendar-external-guest-guard"

const EVENT: GuardedEvent = {
  title: "Q4 pricing review",
  description: "1. Renewal numbers for Orbit Logistics\r\n2. Internal only: discount floor is 18%, don't go below\r\n3. Next steps with the vendor",
  guests: [
    { email: "meera@acme.com", name: "Meera Iyer" },
    { email: "arjun@acme.com", name: "Arjun Rao" },
    { email: "ravi@orbitlogistics.in", name: "Ravi Kumar" },
    { email: "priya.sharma92@gmail.com" },
  ],
  attachments: [
    { id: "deck", name: "Q4 pricing deck", access: "anyone" },
    { id: "notes", name: "Headcount plan FY27", access: "organization" },
  ],
  recurring: true,
}

export function Demo() {
  const [event, setEvent] = React.useState(EVENT)
  const [sent, setSent] = React.useState("")

  return (
    <div className="grid w-full max-w-md gap-2">
      <p className="text-xs text-muted-foreground">Weekly · Thu 4:00 PM IST · {event.title}</p>
      <CalendarExternalGuestGuard
        value={event}
        onValueChange={setEvent}
        domains={["acme.com"]}
        organization="Acme"
        directory={[{ name: "Priya Sharma", email: "priya@acme.com" }]}
        onSend={(e) => new Promise<void>((resolve) => setTimeout(() => (setSent(`Sent to ${e.guests.length} guests.`), resolve()), 600))}
      />
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">{sent}</p>
    </div>
  )
}
