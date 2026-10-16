"use client"

import { RecurrenceScope, type Occurrence } from "@/registry/default/recurrence-scope/recurrence-scope"

// Weekly stand-up on Tuesdays at 09:30, 8 Sep to 24 Nov 2026, and on with no end date.
const occurrences: Occurrence[] = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 8 + i * 7)).toISOString().slice(0, 10)
  return { id: date, start: `${date}T09:30` }
})
occurrences[7].overrides = ["time"] // 27 Oct moved to 11:00 for the offsite
occurrences[9].overrides = ["title"] // 10 Nov renamed "Stand-up + demo"

export function Demo() {
  return (
    <RecurrenceScope
      title="Team stand-up"
      occurrences={occurrences}
      editingId="2026-10-20"
      changes={["time"]}
      fieldLabels={{ time: "start time", title: "title" }}
      continues
      today="2026-10-13"
      defaultValue="following"
      onCancel={() => {}}
      onConfirm={() => new Promise((resolve) => setTimeout(resolve, 600))}
    />
  )
}
