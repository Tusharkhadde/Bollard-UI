"use client"

import * as React from "react"

import { TimezoneMismatch, zoneCity } from "@/registry/default/timezone-mismatch/timezone-mismatch"

const storageKey = "bollard-ui-demo:timezone-choice"
const events = [
  { title: "Design standup", at: Date.UTC(2026, 9, 14, 4, 0) },
  { title: "Client call · Acme", at: Date.UTC(2026, 9, 14, 9, 30) },
]

export function Demo() {
  const [zone, setZone] = React.useState("Asia/Kolkata")
  const [ready, setReady] = React.useState(false)
  const [run, setRun] = React.useState(0)

  // Start every visit with a fresh question so the catch is visible.
  React.useEffect(() => {
    localStorage.removeItem(storageKey)
    setReady(true)
  }, [run])

  const reset = () => {
    setReady(false)
    setZone("Asia/Kolkata")
    setRun((value) => value + 1)
  }

  return (
    <div className="w-full max-w-md space-y-3">
      {ready && (
        <TimezoneMismatch
          key={run}
          accountTimeZone={zone}
          deviceTimeZone="Europe/London"
          storageKey={storageKey}
          onUseDeviceZone={setZone}
        />
      )}
      <div className="rounded-xl border bg-background p-4 text-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Tomorrow · times in {zoneCity(zone)}</p>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-xs hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Reset demo
          </button>
        </div>
        <ul className="space-y-1.5">
          {events.map((event) => (
            <li key={event.title} className="flex justify-between gap-3">
              <span>{event.title}</span>
              <span className="tabular-nums text-muted-foreground">
                {new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(event.at)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
