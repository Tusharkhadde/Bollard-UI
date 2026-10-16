"use client"

import * as React from "react"

import { ScheduleReadback } from "@/registry/default/schedule-readback/schedule-readback"

const presets = ["* * * * *", "0 0 31 * *", "0 0 30 2 *", "*/7 * * * *", "0 9 * * mon-fri"]

export function Demo() {
  const [cron, setCron] = React.useState("0 9 13 * 5")

  return (
    <div className="grid w-full max-w-sm gap-3">
      <ScheduleReadback label="Report schedule (server runs in UTC)" timeZone="UTC" value={cron} onValueChange={setCron} />
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>Try</span>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setCron(preset)}
            className="h-6 rounded-md border px-2 font-mono transition-colors hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  )
}
