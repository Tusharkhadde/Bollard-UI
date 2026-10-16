"use client"

import * as React from "react"

import { CutoffPicker } from "@/registry/default/cutoff-picker/cutoff-picker"

// Mon 19 Oct 2026, 10:48:20 AM at a Pune bakery; the shopper is in Los Angeles (Sun 18 Oct, 10:18 PM).
const START = Date.UTC(2026, 9, 19, 5, 18, 20)
const holidays = [{ date: "2026-10-20", name: "Dussehra" }]

export function Demo() {
  const [offset, setOffset] = React.useState(0)
  const [elapsed, setElapsed] = React.useState(0)
  const [date, setDate] = React.useState("2026-10-19")

  React.useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - started), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="grid w-full max-w-md gap-3">
      <CutoffPicker
        storeTimeZone="Asia/Kolkata"
        userTimeZone="America/Los_Angeles"
        cutoff="12:00"
        holidays={holidays}
        now={START + offset + elapsed}
        value={date}
        onValueChange={setDate}
      />
      <button type="button" onClick={() => setOffset((o) => o + 75 * 60_000)} className="h-8 w-fit rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
        Skip ahead 1 h 15 min
      </button>
    </div>
  )
}
