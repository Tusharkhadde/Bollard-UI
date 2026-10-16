"use client"

import * as React from "react"

import { DstShiftNotice, type DstAttendee } from "@/registry/default/dst-shift-notice/dst-shift-notice"

// 14 Oct 2026, 11:00 AM IST: Europe falls back on 25 Oct, the US a week later on 1 Nov.
const NOW = Date.UTC(2026, 9, 14, 5, 30)

const attendees: DstAttendee[] = [
  { name: "New York", timeZone: "America/New_York", count: 3 },
  { name: "London", timeZone: "Europe/London", count: 2 },
  { name: "Pune team", timeZone: "Asia/Kolkata", count: 5 },
]

export function Demo() {
  return (
    <div className="w-full max-w-md space-y-3">
      <p className="truncate text-sm">
        <span className="text-muted-foreground">Weekly sync · </span>Tuesdays 9:00 AM New York
      </p>
      <DstShiftNotice
        series={{ start: "2026-09-01T09:00", timeZone: "America/New_York", repeat: "weekly", count: 26 }}
        attendees={attendees}
        now={NOW}
        locale="en-IN"
        onApply={() => new Promise((resolve) => setTimeout(resolve, 600))}
      />
    </div>
  )
}
