"use client"

import * as React from "react"

import { MergeRecords, type MergeField, type MergeRecordItem } from "@/registry/default/merge-records/merge-records"

const FIELDS: MergeField[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
]

const RECORDS: MergeRecordItem[] = [
  {
    id: "C-1042",
    updatedAt: "2026-03-02T10:00:00Z",
    values: { name: "Priya Sharma", email: "priya@acme.in", phone: "+91 98220 41133", company: "Acme", city: "Pune" },
    links: ["3 deals", "Stripe customer"],
  },
  {
    id: "C-2210",
    updatedAt: "2026-09-28T10:00:00Z",
    values: { name: "priya sharma", email: "priya.sharma@acme.in", phone: "", company: "Acme", city: "Mumbai" },
    links: ["1 ticket"],
  },
  {
    id: "C-3307",
    updatedAt: "2026-10-11T10:00:00Z",
    values: { name: "Priya S.", email: "", phone: "+91 90110 77821", company: "Acme", city: "" },
  },
]

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
    <MergeRecords
      key={run}
      records={RECORDS}
      fields={FIELDS}
      formatDate={(d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
      onCancel={() => setRun((n) => n + 1)}
      onMerge={(result) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            setDone(`Merged into ${result.survivorId}. ${result.discarded.length} values discarded.`)
            resolve()
          }, 600),
        )
      }
    />
  )
}
