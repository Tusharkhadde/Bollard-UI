"use client"

import * as React from "react"

import { MeetingTimeSpread, type Attendee } from "@/registry/default/meeting-time-spread/meeting-time-spread"

// Tuesday 27 Oct 2026: Europe has left summer time, the US hasn't yet, so New York is 4 hours behind London.
const attendees: Attendee[] = [
  { id: "priya", name: "Priya (you)", place: "London", timeZone: "Europe/London" },
  { id: "lena", name: "Lena", place: "Berlin", timeZone: "Europe/Berlin" },
  { id: "arjun", name: "Arjun", place: "Bengaluru", timeZone: "Asia/Kolkata" },
  { id: "sam", name: "Sam", place: "New York", timeZone: "America/New_York" },
]

// The last three weekly syncs were 12:00 London, i.e. 07:00 for Sam.
const history = [{ start: "2026-10-06T11:00:00Z" }, { start: "2026-10-13T11:00:00Z" }, { start: "2026-10-20T11:00:00Z" }]

// Priya's default pick: 09:00 London, which is 05:00 in New York.
const PICKED = Date.UTC(2026, 9, 27, 9, 0)

export function Demo() {
  const [start, setStart] = React.useState(PICKED)
  return (
    <div className="grid w-full max-w-md gap-2">
      <p className="text-xs text-muted-foreground">Weekly product sync · 30 min</p>
      <MeetingTimeSpread attendees={attendees} date="2026-10-27" history={history} value={start} onValueChange={setStart} />
    </div>
  )
}
