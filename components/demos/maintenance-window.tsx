"use client"

import * as React from "react"

import { MaintenanceTaskButton, MaintenanceWindow } from "@/registry/default/maintenance-window/maintenance-window"

const previews = { soon: 18, during: -6, after: -40 } as const

export function Demo() {
  const [preview, setPreview] = React.useState<keyof typeof previews>("soon")
  const [base, setBase] = React.useState<number>()
  const [draft, setDraft] = React.useState("Q3 invoices: chase Kirana Co and Mehta Traders before Friday")
  const [started, setStarted] = React.useState(false)
  React.useEffect(() => setBase(Date.now()), [])
  if (base === undefined) return null

  // Starts 18 min from now and lasts 30 min; the buttons shift the clock to preview each phase.
  const start = base + previews[preview] * 60_000
  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="flex gap-1 text-xs" role="group" aria-label="Preview phase">
        {(Object.keys(previews) as (keyof typeof previews)[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={preview === key}
            onClick={() => setPreview(key)}
            className="h-7 rounded-md border px-2 font-medium capitalize transition-colors hover:bg-accent aria-pressed:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {key}
          </button>
        ))}
      </div>
      <MaintenanceWindow start={start} end={start + 30 * 60_000} hasUnsavedChanges={draft.length > 0}>
        <div className="grid gap-3 rounded-lg border bg-background p-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed md:text-sm dark:bg-input/30"
            />
          </label>
          <MaintenanceTaskButton estimateMinutes={45} onStart={() => setStarted(true)} anywayLabel="Export anyway">
            Export all invoices
          </MaintenanceTaskButton>
          {started && <p className="text-xs text-muted-foreground">Export started.</p>}
        </div>
      </MaintenanceWindow>
    </div>
  )
}
