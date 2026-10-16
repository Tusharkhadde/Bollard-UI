"use client"

import * as React from "react"

import { EventOverlap, type CalendarEvent } from "@/registry/default/event-overlap/event-overlap"

// Times in IST (UTC+5:30). Wed 14 Oct 2026.
const ist = (h: number, m = 0) => Date.UTC(2026, 9, 14, h, m) - 330 * 60_000
const NOW = Date.UTC(2026, 9, 13, 4, 30)

const events: CalendarEvent[] = [
  { id: "design", title: "Design review", start: ist(13), end: ist(14), location: "Andheri studio" },
  { id: "sprint", title: "Sprint planning", start: ist(14, 30), end: ist(15, 30) },
  { id: "london", title: "Sync with London", start: ist(15), end: ist(15, 15), timeZone: "Europe/London" },
  { id: "hack", title: "Hackathon week", start: "2026-10-12", end: "2026-10-17", allDay: true },
  { id: "ooo", title: "Out of office", start: "2026-10-15", end: "2026-10-16", allDay: true, busy: true },
]

const travel = (from: string, to: string) => ([from, to].sort().join("|") === "Andheri studio|BKC office" ? 40 : null)
const fmt = (ts: number) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(ts)

export function Demo() {
  const [draft, setDraft] = React.useState({ start: ist(14), end: ist(15), location: "BKC office" })
  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="rounded-md border px-3 py-2 text-sm">
        <p className="font-medium">Client walkthrough</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {fmt(draft.start)} · 1 h · {draft.location}
        </p>
      </div>
      <EventOverlap
        draft={draft}
        events={events}
        timeZone="Asia/Kolkata"
        travelMinutes={travel}
        now={NOW}
        onMove={(start, end) => setDraft((d) => ({ ...d, start: start.getTime(), end: end.getTime() }))}
      />
    </div>
  )
}
