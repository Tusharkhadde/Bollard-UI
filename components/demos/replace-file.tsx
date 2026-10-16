"use client"

import * as React from "react"

import { ReplaceFile, type ConflictChoices, type FileConflict } from "@/registry/default/replace-file/replace-file"

const thumb = (from: string, to: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="40" height="40" fill="url(#g)"/><text x="20" y="25" font-family="sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  )}`

const CONFLICTS: FileConflict[] = [
  {
    existing: { name: "hero.png", size: 1_284_000, modified: "2026-10-11T09:40:00Z", preview: thumb("#f97316", "#db2777", "v3") },
    incoming: { name: "hero.png", size: 1_102_000, modified: "2026-10-02T16:05:00Z", preview: thumb("#64748b", "#334155", "v2") },
  },
  {
    existing: { name: "banner.jpg", size: 846_000, modified: "2026-10-12T11:20:00Z", preview: thumb("#0ea5e9", "#6366f1", "new") },
    incoming: { name: "banner.jpg", size: 846_000, modified: "2026-09-30T08:00:00Z", preview: thumb("#94a3b8", "#475569", "old") },
  },
  {
    existing: { name: "pricing.pdf", size: 212_000, modified: "2026-09-21T10:00:00Z" },
    incoming: { name: "pricing.pdf", size: 238_000, modified: "2026-10-13T07:15:00Z" },
  },
  {
    existing: { name: "logo.svg", size: 4_100, modified: "2026-08-01T12:00:00Z" },
    incoming: { name: "logo.svg", size: 4_100, modified: "2026-08-01T12:00:00Z" },
  },
]

const ALL_REPLACE: ConflictChoices = Object.fromEntries(CONFLICTS.map((c) => [c.incoming.name, "replace"]))

export function Demo() {
  const [done, setDone] = React.useState<string | null>(null)
  const [run, setRun] = React.useState(0)

  if (done) {
    return (
      <div className="space-y-2 text-center text-sm">
        <p>{done}</p>
        <button
          type="button"
          onClick={() => {
            setDone(null)
            setRun((n) => n + 1)
          }}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Run the demo again
        </button>
      </div>
    )
  }

  return (
    <ReplaceFile
      key={run}
      conflicts={CONFLICTS}
      otherCount={3}
      existingNames={["hero (1).png"]}
      defaultValue={ALL_REPLACE}
      formatDate={(d) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
      onContinue={(result) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            setDone(result.map((r) => `${r.name}: ${r.savedAs ? `kept both as ${r.savedAs}` : r.action}`).join(" · "))
            resolve()
          }, 600),
        )
      }
    />
  )
}
