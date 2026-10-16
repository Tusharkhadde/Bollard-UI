"use client"

import * as React from "react"
import { CircleCheck, PlayCircle } from "lucide-react"

import { DataCostNotice, type ConnectionInfo } from "@/registry/default/data-cost-notice/data-cost-notice"

const mobile: ConnectionInfo = { type: "cellular", effectiveType: "4g", downlink: 4.5, rtt: 90, saveData: false }
const weak: ConnectionInfo = { ...mobile, effectiveType: "3g", downlink: 1.2, rtt: 300 }
const wifi: ConnectionInfo = { type: "wifi", effectiveType: "4g", downlink: 10, rtt: 25, saveData: false }

export function Demo() {
  const [onWifi, setOnWifi] = React.useState(false)
  const [weakSignal, setWeakSignal] = React.useState(false)
  const [choice, setChoice] = React.useState<"full" | "lighter">()

  return (
    <div className="w-full max-w-xl space-y-3">
      {choice ? (
        <p className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground">
          <CircleCheck aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
          {choice === "lighter" ? "Downloading 480p (120 MB)" : "Downloading 1080p (480 MB)"}
        </p>
      ) : (
        <DataCostNotice
          label="1080p"
          bytes={480e6}
          lighter={{ label: "480p · same lecture", bytes: 120e6 }}
          connection={onWifi ? wifi : weakSignal ? weak : mobile}
          onChoose={setChoice}
        />
      )}
      <div className="flex items-center gap-3 rounded-xl border bg-background p-4 text-sm">
        <PlayCircle aria-hidden className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Lecture 7 · Graph algorithms</p>
          <p className="text-xs text-muted-foreground">1 h 12 min · save for offline</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 text-xs whitespace-nowrap">
        <button
          type="button"
          onClick={() => setWeakSignal((value) => !value)}
          className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {weakSignal ? "Signal back" : "Weak signal"}
        </button>
        <button
          type="button"
          onClick={() => setOnWifi((value) => !value)}
          className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {onWifi ? "Mobile data" : "Join Wi-Fi"}
        </button>
        <button
          type="button"
          onClick={() => {
            setChoice(undefined)
            setOnWifi(false)
            setWeakSignal(false)
          }}
          className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset demo
        </button>
      </div>
    </div>
  )
}
