"use client"

import * as React from "react"

import { PreflightChecklist, type PreflightCheck } from "@/registry/default/preflight-checklist/preflight-checklist"

const commits = ["a1f3c9e", "b7d2e04"]

function after<T>(ms: number, value: T, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), ms)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new Error("Cancelled"))
    })
  })
}

export function Demo() {
  const [index, setIndex] = React.useState(0)
  const [log, setLog] = React.useState("A new commit resets the manual ticks.")
  const fixed = index === 1

  const checks = React.useMemo<PreflightCheck[]>(
    () => [
      { id: "tests", label: "Tests pass", run: (signal) => after(700, { pass: true, reason: "412 passed in 38s" }, signal) },
      {
        id: "bundle",
        label: "Bundle under 500 KB",
        run: (signal) =>
          after(1100, fixed ? { pass: true, reason: "468 KB" } : { pass: false, reason: "512 KB: 12 KB over budget (charts.js grew)" }, signal),
      },
      { id: "migrations", label: "Migrations reviewed", description: "2 pending: add_index_orders, drop_legacy_flags" },
      { id: "oncall", label: "On-call knows this is going out" },
    ],
    [fixed]
  )

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <PreflightChecklist
        checks={checks}
        revision={commits[index]}
        actionLabel="Deploy to production"
        onAction={() => new Promise<void>((resolve) => setTimeout(() => { setLog(`Deployed ${commits[index]}`); resolve() }, 900))}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span aria-live="polite">{log}</span>
        <button type="button" onClick={() => setIndex((value) => (value + 1) % commits.length)} className="inline-flex h-8 shrink-0 items-center rounded-md border bg-background px-3 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Push a new commit
        </button>
      </div>
    </div>
  )
}
