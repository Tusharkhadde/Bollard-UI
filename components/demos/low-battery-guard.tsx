"use client"

import * as React from "react"
import { Clapperboard, LoaderCircle } from "lucide-react"

import { LowBatteryGuard } from "@/registry/default/low-battery-guard/low-battery-guard"

export function Demo() {
  const [charging, setCharging] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const battery = { level: 0.18, charging, dischargingTime: charging ? Infinity : 30 * 60 }

  return (
    <div className="w-full max-w-xl space-y-3">
      {!exporting && <LowBatteryGuard task="the export" minutes={45} battery={battery} onProceed={() => setExporting(true)} />}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-4 text-sm">
        <Clapperboard aria-hidden className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Wedding film · 4K</p>
          <p className="text-xs text-muted-foreground">{exporting ? "Exporting… about 45 min" : "Export takes about 45 min"}</p>
        </div>
        {exporting ? (
          <LoaderCircle aria-label="Exporting" className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            onClick={() => setExporting(true)}
            className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Export
          </button>
        )}
      </div>
      <div className="flex justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={() => setCharging((value) => !value)}
          className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {charging ? "Unplug charger" : "Plug in charger"}
        </button>
        <button
          type="button"
          onClick={() => {
            setExporting(false)
            setCharging(false)
          }}
          className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset demo
        </button>
      </div>
    </div>
  )
}
