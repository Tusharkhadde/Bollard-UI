"use client"

import * as React from "react"

import { RevisionBanner } from "@/registry/default/revision-banner/revision-banner"

const oldText = "Refunds are issued within 14 days to the original payment method. Contact support to start one."
const latestText = "Refunds are issued within 30 days to the original payment method or as store credit. Start one from your Orders page."
const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date)

export function Demo() {
  const [view, setView] = React.useState<"old" | "latest" | "restored">("old")

  if (view !== "old") {
    return (
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">
            {view === "restored" ? "Restored version 12 as version 19." : "Viewing the latest, version 18."}
          </span>
          <button
            type="button"
            onClick={() => setView("old")}
            className="rounded-md border px-2 py-1 text-xs hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Reset demo
          </button>
        </div>
        <div
          contentEditable
          suppressContentEditableWarning
          aria-label="Refund policy"
          className="rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {view === "restored" ? oldText : latestText}
        </div>
      </div>
    )
  }

  return (
    <RevisionBanner
      className="w-full max-w-md"
      revision={{ label: "Version 12", author: "Arjun", savedAt: "2026-09-03T10:00:00Z" }}
      latest={{ label: "Version 18", author: "Priya", savedAt: "2026-10-12T10:00:00Z" }}
      behind={6}
      revisionText={oldText}
      latestText={latestText}
      formatDate={formatDate}
      onGoToLatest={() => setView("latest")}
      onRestore={() => new Promise<void>((resolve) => setTimeout(() => (setView("restored"), resolve()), 700))}
    >
      <div
        contentEditable
        suppressContentEditableWarning
        aria-label="Refund policy, version 12"
        className="text-sm leading-relaxed outline-none"
      >
        {oldText}
      </div>
    </RevisionBanner>
  )
}
