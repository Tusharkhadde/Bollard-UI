"use client"

import * as React from "react"

import { parseSeatMap, SeatGapCheck, type SeatIssue } from "@/registry/default/seat-gap-check/seat-gap-check"

const ROWS = parseSeatMap(`
A xxoo_ooxxo
B oxxo_xxooo
C oooo_ooooo
D ooxx_oooxx
E oooo_oxxoo
`)
const FAMILY = [{ name: "Priya" }, { name: "Rahul" }, { name: "Aarav", child: true }, { name: "Meera", child: true }]

export function Demo() {
  const [seats, setSeats] = React.useState(["C2", "C3", "C6", "C7"])
  const [issues, setIssues] = React.useState<SeatIssue[]>([])
  return (
    <div className="grid w-full max-w-sm gap-3">
      <SeatGapCheck rows={ROWS} travellers={FAMILY} value={seats} onValueChange={setSeats} onIssuesChange={setIssues} />
      <button
        type="button"
        disabled={issues.length > 0 || seats.some((s) => !s)}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        Pay for {seats.filter(Boolean).join(", ") || "seats"}
      </button>
    </div>
  )
}
