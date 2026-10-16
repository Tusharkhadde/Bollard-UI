"use client"

import * as React from "react"

import { ArchiveOrDelete, type RemovalChoice, type RemovalItem } from "@/registry/default/archive-or-delete/archive-or-delete"

const ITEMS: RemovalItem[] = [
  { label: "2,431 messages", archive: { kind: "changed", text: "Read-only, still searchable" }, delete: { kind: "lost", text: "Erased for everyone" } },
  { label: "86 files", archive: { kind: "kept", text: "Kept, links keep working" }, delete: { kind: "lost", text: "Erased, links break" } },
  { label: "14 members", archive: { kind: "changed", text: "Removed, can rejoin" }, delete: { kind: "lost", text: "Removed for good" } },
  { label: "#launch-2025 name", archive: { kind: "kept", text: "Reserved" }, delete: { kind: "changed", text: "Free for reuse" } },
  { label: "Storage", archive: { kind: "changed", text: "Still counts toward your 5 GB" }, delete: { kind: "kept", text: "1.2 GB freed" } },
  { label: "Audit log", archive: { kind: "kept", text: "Kept for 1 year" }, delete: { kind: "kept", text: "Kept for 1 year" } },
]

export function Demo() {
  const [done, setDone] = React.useState<RemovalChoice | null>(null)
  const [run, setRun] = React.useState(0)

  if (done) {
    return (
      <div className="space-y-2 text-center text-sm">
        <p>{done === "archive" ? "#launch-2025 was archived. Unarchive it from Settings › Channels." : "#launch-2025 was deleted forever."}</p>
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
    <ArchiveOrDelete
      key={run}
      name="#launch-2025"
      items={ITEMS}
      archiveSummary="Reversible. Unarchive anytime from Settings."
      deleteSummary="Permanent. Nobody can undo this, including support."
      onConfirm={(choice) => new Promise<void>((resolve) => setTimeout(() => {
        setDone(choice)
        resolve()
      }, 600))}
      onCancel={() => setRun((n) => n + 1)}
    />
  )
}
