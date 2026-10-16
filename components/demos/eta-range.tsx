"use client"

import * as React from "react"

import { EtaRange } from "@/registry/default/eta-range/eta-range"

const TIMES = {
  "3:35 pm": new Date("2026-10-13T15:35:00+05:30"),
  "4:10 pm": new Date("2026-10-13T16:10:00+05:30"),
}

export function Demo() {
  const [time, setTime] = React.useState<keyof typeof TIMES>("3:35 pm")
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Ordering Tue at</span>
        <div role="group" aria-label="Order time" className="flex gap-1 rounded-md border p-0.5">
          {(Object.keys(TIMES) as (keyof typeof TIMES)[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={time === t}
              onClick={() => setTime(t)}
              className="h-8 rounded-sm px-3 font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <EtaRange
        now={TIMES[time]}
        timeZone="Asia/Kolkata"
        cutoff="16:00"
        transit={[0.05, 0.25, 0.5, 0.15, 0.05]}
        previous={{ earliest: "2026-10-15", latest: "2026-10-16" }}
        reason="Carrier backlog after the long weekend"
      />
    </div>
  )
}
