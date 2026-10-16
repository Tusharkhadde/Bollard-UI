"use client"

import * as React from "react"

import { LeaveRequestCheck } from "@/registry/default/leave-request-check/leave-request-check"

const HOLIDAYS = [{ date: "2026-12-25", name: "Christmas" }]
const TEAM = [{ name: "Priya", start: "2026-12-28", end: "2026-12-31" }]

export function Demo() {
  return (
    <LeaveRequestCheck
      defaultValue={{ start: "2026-12-24", end: "2026-12-29", startPart: "full", endPart: "half" }}
      holidays={HOLIDAYS}
      team={TEAM}
      teamLimit={3}
      balance={4}
      policy={{ sandwich: true }}
      onSubmit={() => new Promise((resolve) => setTimeout(resolve, 600))}
    />
  )
}
