"use client"

import * as React from "react"

import { ShiftTimeInput, type ShiftValue } from "@/registry/default/shift-time-input/shift-time-input"

const presets: { label: string; value: ShiftValue }[] = [
  { label: "9:00–5:00", value: { start: "9:00", end: "5:00", breakMinutes: 30 } },
  { label: "Night", value: { start: "22:00", end: "06:00", breakMinutes: 30 } },
  { label: "10–6", value: { start: "10", end: "6", breakMinutes: 45 } },
  { label: "Break 1", value: { start: "08:00", end: "16:30", breakMinutes: 1 } },
  { label: "26:00", value: { start: "18:00", end: "26:00", breakMinutes: 30 } },
]

export function Demo() {
  const [shift, setShift] = React.useState(presets[0].value)
  return (
    <div className="grid w-full max-w-sm gap-3">
      <ShiftTimeInput label="Monday's shift" value={shift} onValueChange={setShift} />
      <ShiftTimeInput label="Sat 24 Oct night shift · London" date="2026-10-24" timeZone="Europe/London" defaultValue={{ start: "22:00", end: "06:00", breakMinutes: 30 }} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => setShift(p.value)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
