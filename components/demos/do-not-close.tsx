"use client"

import * as React from "react"

import { DoNotClose, type OperationStatus } from "@/registry/default/do-not-close/do-not-close"

// Uneven chunk sizes so the estimate has something to smooth.
const steps = [0.03, 0.01, 0.04, 0.01, 0.02, 0.05, 0.01, 0.03]

const button =
  "h-8 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function Demo() {
  const [status, setStatus] = React.useState<OperationStatus>("idle")
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    if (status !== "active") return
    let tick = 0
    const id = setInterval(() => {
      tick++
      setProgress((p) => Math.min(1, p + steps[tick % steps.length]))
    }, 500)
    return () => clearInterval(id)
  }, [status])

  React.useEffect(() => {
    if (status === "active" && progress >= 1) setStatus("done")
  }, [status, progress])

  const start = () => {
    setProgress(0)
    setStatus("active")
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <DoNotClose
        status={status}
        progress={progress}
        label="Uploading 312 invoices (48 MB)"
        doneLabel="All 312 invoices uploaded"
        error="The connection dropped. Retry uploads only the invoices that are missing."
        onRetry={start}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={status === "active"} onClick={start}>
          {status === "idle" ? "Start upload" : "Upload again"}
        </button>
        <button type="button" className={button} disabled={status !== "active"} onClick={() => setStatus("error")}>
          Drop the connection
        </button>
      </div>
      <p className="text-xs text-muted-foreground">While it runs, try closing the tab or look at the tab title.</p>
    </div>
  )
}
