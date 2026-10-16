"use client"

import * as React from "react"

import { ImpactPreview, type ImpactGroup } from "@/registry/default/impact-preview/impact-preview"

const ACME: ImpactGroup[] = [
  {
    noun: "invoice",
    count: 12,
    outcome: "deleted",
    sample: ["INV-2041 · ₹48,000", "INV-2039 · ₹12,500", "INV-2033 · ₹7,200"],
  },
  {
    noun: "member",
    count: 3,
    outcome: "deleted",
    sample: ["Priya Nair (Owner)", "Rahul Mehta", "Sara Khan"],
    note: "Their personal accounts stay; only access to Acme is removed.",
  },
  { noun: "webhook", count: 1, outcome: "deleted", sample: ["https://hooks.acme.in/billing"] },
  {
    noun: "API key",
    count: 2,
    outcome: "detached",
    sample: ["ci-deploy", "zapier-sync"],
    note: "Keys keep working for other workspaces they belong to.",
  },
  { noun: "audit log", count: 1, outcome: "kept", note: "Retained for 7 years for compliance." },
  { noun: "draft", count: 0, outcome: "deleted" },
]

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new Error("aborted"))
    })
  })

export function Demo() {
  const [failNext, setFailNext] = React.useState(false)
  const [run, setRun] = React.useState(0)
  const [deleted, setDeleted] = React.useState(false)

  if (deleted) {
    return (
      <div className="space-y-2 text-center text-sm">
        <p>Acme and 16 items were deleted.</p>
        <button
          type="button"
          onClick={() => setDeleted(false)}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Run the demo again
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <ImpactPreview
        key={run}
        name="Acme"
        load={async (signal) => {
          await wait(900, signal)
          if (failNext) throw new Error("Network error")
          return ACME
        }}
        onConfirm={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setDeleted(true)
              resolve()
            }, 700),
          )
        }
        onCancel={() => setRun((n) => n + 1)}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={failNext}
          onChange={(event) => {
            setFailNext(event.target.checked)
            setRun((n) => n + 1)
          }}
        />
        Simulate a failed lookup
      </label>
    </div>
  )
}
