"use client"

import * as React from "react"

import { PrivateModeNotice, type StorageReport } from "@/registry/default/private-mode-notice/private-mode-notice"

const PRIVATE: StorageReport = { risk: "private", confidence: "likely", signals: ["storage quota is unusually small"] }
const field =
  "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

export function Demo() {
  const [notes, setNotes] = React.useState(
    "Day 2: ferry to Alibaug at 7:15, book the 4 pm return.\nAsk Meera about the homestay deposit.",
  )
  const [real, setReal] = React.useState(false)
  const [found, setFound] = React.useState<string>()
  const report = real ? undefined : PRIVATE

  return (
    <div className="w-full max-w-sm space-y-3">
      <PrivateModeNotice
        report={report}
        hasUnsavedWork={notes.trim().length > 0}
        exportData={() => notes}
        exportFilename="trip-notes.txt"
        onReport={(r) =>
          real &&
          setFound(r.risk === "ok" ? "This browser keeps data normally." : `This browser: ${r.risk} (${r.confidence}).`)
        }
      />
      <div className="space-y-3 rounded-xl border bg-background p-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Trip notes (draft)</span>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
        </label>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked className="size-4 accent-current" />
            Remember me on this device
          </label>
          <PrivateModeNotice variant="inline" report={report} className="pl-6" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {found ?? "Showing a simulated private window."}{" "}
        {!real && (
          <button
            type="button"
            onClick={() => setReal(true)}
            className="rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Check this browser
          </button>
        )}
      </p>
    </div>
  )
}
