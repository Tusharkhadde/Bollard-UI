"use client"

import * as React from "react"

import {
  RevokeAccessPreview,
  type ActiveSession,
  type Reassignment,
} from "@/registry/default/revoke-access-preview/revoke-access-preview"

const OWNED = [
  { id: "d1", name: "Revenue dashboard", kind: "Dashboard · 31 viewers" },
  { id: "c1", name: "Nightly invoice export", kind: "Scheduled job" },
  { id: "p1", name: "Q4 pricing test", kind: "Project" },
]
const ASSIGNEES = [
  { id: "u_priya", name: "Priya Nair" },
  { id: "u_sara", name: "Sara Khan" },
]
const INTEGRATIONS = [
  { name: "GitHub", breaks: true, effect: "Deploys from Rahul’s OAuth grant stop" },
  { name: "Google Sheets sync", breaks: true, effect: "Nightly sync stops" },
  { name: "Slack alerts", breaks: false, effect: "Workspace bot, keeps running" },
]

export function Demo() {
  const [sessions, setSessions] = React.useState<ActiveSession[]>([])
  const [result, setResult] = React.useState<Reassignment | null>(null)
  const [run, setRun] = React.useState(0)

  React.useEffect(() => {
    const now = Date.now()
    setSessions([
      { id: "s1", device: "Chrome on macOS · Pune", lastActive: now - 3 * 60_000 },
      { id: "s2", device: "iPhone app · Mumbai", lastActive: now - 2 * 86_400_000 },
    ])
  }, [run])

  if (result) {
    const unowned = Object.values(result).filter((v) => !v).length
    return (
      <div className="space-y-2 text-center text-sm">
        <p>Rahul was removed. {unowned ? `${unowned} items are now unowned.` : "Everything Rahul owned has a new owner."}</p>
        <button
          type="button"
          onClick={() => {
            setResult(null)
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
    <RevokeAccessPreview
      key={run}
      name="Rahul Mehta"
      access={["Edit 4 projects and billing settings", "Use 2 personal API tokens"]}
      owned={OWNED}
      assignees={ASSIGNEES}
      defaultValue={{ p1: "u_sara" }}
      sessions={sessions}
      integrations={INTEGRATIONS}
      onConfirm={(reassign) => new Promise<void>((resolve) => setTimeout(() => {
        setResult(reassign)
        resolve()
      }, 600))}
      onCancel={() => setRun((n) => n + 1)}
    />
  )
}
