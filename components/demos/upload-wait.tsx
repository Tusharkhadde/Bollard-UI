"use client"

import * as React from "react"

import { UploadWait, type UploadItem } from "@/registry/default/upload-wait/upload-wait"

const start: UploadItem[] = [
  { id: "receipt", name: "receipt-march.pdf", status: "uploading", progress: 0.3 },
  { id: "invoice", name: "hotel-invoice.jpg", status: "uploading", progress: 0.55 },
]
/** Per-tick progress, and where the hotel invoice fails on its first try. */
const step: Record<string, number> = { receipt: 0.05, invoice: 0.03 }
const failAt = 0.9

export function Demo() {
  const formRef = React.useRef<HTMLFormElement>(null)
  const [uploads, setUploads] = React.useState(start)
  const [retried, setRetried] = React.useState(false)
  const [sent, setSent] = React.useState<string>()
  const [round, setRound] = React.useState(0)

  // Simulated uploads: each tick moves progress; the invoice fails once, then succeeds on retry.
  React.useEffect(() => {
    const id = setInterval(() => {
      setUploads((list) =>
        list.map((upload) => {
          if (upload.status !== "uploading") return upload
          const progress = Math.min(1, (upload.progress ?? 0) + (retried && upload.id === "invoice" ? 0.1 : step[upload.id]))
          if (upload.id === "invoice" && !retried && progress >= failAt) return { ...upload, status: "error" }
          return progress >= 1 ? { ...upload, status: "done", progress } : { ...upload, progress }
        }),
      )
    }, 400)
    return () => clearInterval(id)
  }, [retried])

  // The demo opens as if Submit was pressed while both files were still uploading.
  React.useEffect(() => formRef.current?.requestSubmit(), [round])

  const reset = () => {
    setUploads(start)
    setRetried(false)
    setSent(undefined)
    setRound((value) => value + 1)
  }

  return (
    <div className="grid w-full max-w-sm gap-3">
      <UploadWait
        key={round}
        ref={formRef}
        uploads={uploads}
        submitLabel="Submit claim"
        onRetry={(id) => {
          setRetried(true)
          setUploads((list) => list.map((upload) => (upload.id === id ? { ...upload, status: "uploading", progress: 0 } : upload)))
        }}
        onSubmit={async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 600))
          setSent(`${data.get("title")} with ${uploads.length} files`)
        }}
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Expense claim</span>
          <input
            name="title"
            required
            defaultValue="Client visit, Mumbai"
            className="h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </label>
      </UploadWait>
      {sent && (
        <p className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          <span className="min-w-0 truncate">Received: {sent}.</span>
          <button type="button" onClick={reset} className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Reset demo
          </button>
        </p>
      )}
    </div>
  )
}
