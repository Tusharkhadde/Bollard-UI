"use client"

import * as React from "react"

import { ProgressHeartbeat } from "@/registry/default/progress-heartbeat/progress-heartbeat"

/** Upload speed per second (% of the file), uneven like a real connection. */
const PACE = [1.2, 0.6, 1.5, 0.9, 0.3, 1.4, 1.1, 0.5, 1.6, 0.8, 0.2, 1.3, 0.7, 1.2, 0.4]

interface ExportJob {
  value: number
  done: boolean
  cancelled: boolean
  startedAt?: number
  lastProgressAt?: number
}

export function Demo() {
  const [job, setJob] = React.useState<ExportJob>({ value: 62, done: false, cancelled: false })
  const [upload, setUpload] = React.useState({ value: 0, beat: 0 })
  const timer = React.useRef<ReturnType<typeof setInterval>>(undefined)

  React.useEffect(() => {
    // The export stalled 41 seconds before the page opened; the upload starts fresh.
    const t = Date.now()
    setJob((j) => ({ ...j, startedAt: t - 95_000, lastProgressAt: t - 41_000 }))
    const id = setInterval(
      () => setUpload((u) => (u.value >= 100 ? u : { value: Math.min(100, u.value + PACE[u.beat % PACE.length]), beat: u.beat + 1 })),
      1000,
    )
    return () => {
      clearInterval(id)
      clearInterval(timer.current)
    }
  }, [])

  const retry = () => {
    clearInterval(timer.current)
    setJob((j) => ({ ...j, lastProgressAt: Date.now() }))
    // The server reaches 100% of rows, then spends a moment writing the file: the bar holds at 99% until done.
    timer.current = setInterval(() => {
      setJob((j) => {
        if (j.value >= 100) {
          clearInterval(timer.current)
          return { ...j, done: true }
        }
        return { ...j, value: Math.min(100, j.value + 8), lastProgressAt: Date.now() }
      })
    }, 700)
  }

  return (
    <div className="grid w-full max-w-sm gap-5">
      {job.cancelled ? (
        <p className="flex h-15 items-center justify-between rounded-md border px-3 text-sm text-muted-foreground">
          Export cancelled.
          <button
            type="button"
            onClick={() => setJob({ value: 62, done: false, cancelled: false, startedAt: Date.now() - 95_000, lastProgressAt: Date.now() - 41_000 })}
            className="h-8 rounded-md border px-3 text-sm font-medium text-foreground hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Reset demo
          </button>
        </p>
      ) : (
        <ProgressHeartbeat
          label="Exporting 12,480 rows to CSV"
          value={job.value}
          done={job.done}
          startedAt={job.startedAt}
          lastProgressAt={job.lastProgressAt}
          onRetry={retry}
          onCancel={() => setJob((j) => ({ ...j, cancelled: true }))}
        />
      )}
      <ProgressHeartbeat label="Uploading launch-video.mp4" value={upload.value} heartbeat={upload.beat} />
    </div>
  )
}
