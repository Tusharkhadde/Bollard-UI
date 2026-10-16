"use client"

import * as React from "react"

import { BulkScopeConfirm } from "@/registry/default/bulk-scope-confirm/bulk-scope-confirm"

const names = [
  "Invoice INV-2041.pdf",
  "Brand guidelines v3",
  "Client deck: Northwind",
  "Q2 board notes",
  "Onboarding checklist",
  "Pricing experiments",
]

export function Demo() {
  const [extra, setExtra] = React.useState(0)
  const [log, setLog] = React.useState("Starts on this page only. Switch to All matching, then add matches.")

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <BulkScopeConfirm
        action="Archive"
        noun={["file", "files"]}
        page={{
          count: 25,
          sample: names,
          breakdown: [
            { label: "you own", count: 23 },
            { label: "you don't own", count: 2, risky: true },
          ],
        }}
        all={{
          count: 1248 + extra,
          sample: names,
          breakdown: [
            { label: "you own", count: 1233 + extra },
            { label: "you don't own", count: 12, risky: true },
            { label: "shared with clients", count: 3, risky: true },
          ],
        }}
        pendingLabel="Archiving…"
        onConfirm={(scope) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setLog(
                scope === "page" ? "Archived 25 files on this page." : `Archived all ${1248 + extra} matching files.`,
              )
              resolve()
            }, 800),
          )
        }
        onCancel={() => setLog("Cancelled. Nothing was archived.")}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite" className="min-w-0 flex-1 basis-40">
          {log}
        </span>
        <button
          type="button"
          onClick={() => setExtra((value) => value + 3)}
          className="inline-flex h-8 shrink-0 items-center rounded-md border bg-background px-3 font-medium text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Simulate 3 new matches
        </button>
      </div>
    </div>
  )
}
