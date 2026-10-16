"use client"

import * as React from "react"

import { DisabledReason, type BlockedReason } from "@/registry/default/disabled-reason/disabled-reason"

const inputClass =
  "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

export function Demo() {
  const [title, setTitle] = React.useState("")
  const [summary, setSummary] = React.useState("")
  const [access, setAccess] = React.useState<"none" | "requested" | "granted">("none")
  const [published, setPublished] = React.useState(false)
  const titleRef = React.useRef<HTMLInputElement>(null)
  const summaryRef = React.useRef<HTMLInputElement>(null)

  // Priya approves a moment after the request, so the demo can reach "ready".
  React.useEffect(() => {
    if (access !== "requested") return
    const timer = setTimeout(() => setAccess("granted"), 1500)
    return () => clearTimeout(timer)
  }, [access])

  const empty = [!title.trim() && titleRef, !summary.trim() && summaryRef].filter(Boolean) as React.RefObject<HTMLInputElement | null>[]
  const reasons: BlockedReason[] = []
  if (access === "none") reasons.push({ id: "access", message: "You need Editor access", actionLabel: "Ask Priya", onAction: () => setAccess("requested") })
  if (access === "requested") reasons.push({ id: "waiting", message: "Waiting for Priya to grant Editor access" })
  if (empty.length)
    reasons.push({
      id: "fields",
      message: `Fill ${empty.length} required ${empty.length === 1 ? "field" : "fields"}`,
      actionLabel: "Show me",
      onAction: () => empty[0].current?.focus(),
    })

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex items-center justify-between gap-3 overflow-hidden rounded-lg border bg-background px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Release notes</p>
          <p className="text-xs text-muted-foreground">{published ? "Published to the changelog" : "Draft"}</p>
        </div>
        <DisabledReason reasons={published ? [] : reasons} side="bottom" align="end" defaultOpen heading="Can't publish yet">
          <button
            type="button"
            onClick={() => setPublished(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {published ? "Published" : "Publish"}
          </button>
        </DisabledReason>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="dr-title" className="text-sm font-medium">Title</label>
        <input id="dr-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="v2.4: faster search" className={inputClass} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="dr-summary" className="text-sm font-medium">Summary</label>
        <input id="dr-summary" ref={summaryRef} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One line for the email" className={inputClass} />
      </div>
    </div>
  )
}
