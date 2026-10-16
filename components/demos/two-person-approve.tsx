"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { TwoPersonApprove, type Person } from "@/registry/default/two-person-approve/two-person-approve"

const rahul: Person = { id: "u_rahul", name: "Rahul" }
const priya: Person = { id: "u_priya", name: "Priya" }
const arjun: Person = { id: "u_arjun", name: "Arjun" }

const PLAN = `-- prod-db-1 · payments
BEGIN;
DELETE FROM payments_archive
  WHERE created_at < '2024-01-01';
-- est. 1,284,019 rows
COMMIT;`
const EDITED = PLAN.replace("'2024-01-01'", "'2025-01-01'").replace("1,284,019", "3,902,446")

export function Demo() {
  const [times, setTimes] = React.useState<{ requestedAt: number; expiresAt: number }>()
  const [viewer, setViewer] = React.useState<Person>(rahul)
  const [plan, setPlan] = React.useState(PLAN)
  const [log, setLog] = React.useState("Viewing as the requester: approving is blocked.")

  React.useEffect(() => {
    const now = Date.now()
    setTimes({ requestedAt: now - 18 * 60_000, expiresAt: now + 42 * 60_000 })
  }, [])

  if (!times) return null

  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Viewing as</span>
        <div role="group" aria-label="Viewing as" className="inline-flex rounded-md border p-0.5">
          {[rahul, priya].map((person) => (
            <button
              key={person.id}
              type="button"
              aria-pressed={viewer.id === person.id}
              onClick={() => {
                setViewer(person)
                setLog(person.id === rahul.id ? "Viewing as the requester: approving is blocked." : "Viewing as an approver.")
              }}
              className={cn(
                "h-7 rounded-sm px-2.5 font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                viewer.id === person.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {person.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={plan === EDITED}
          onClick={() => setPlan(EDITED)}
          className="ml-auto h-7 rounded-md border px-2.5 font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        >
          Rahul edits the plan
        </button>
      </div>
      <TwoPersonApprove
        title="Purge old payments in production"
        plan={plan}
        requester={rahul}
        approvers={[rahul, priya, arjun]}
        currentUser={viewer}
        requestedAt={times.requestedAt}
        expiresAt={times.expiresAt}
        onApprove={({ fingerprint }) =>
          new Promise<void>((resolve) => setTimeout(() => {
            setLog(`Approved plan #${fingerprint}.`)
            resolve()
          }, 700))
        }
        onReject={({ reason }) => setLog(`Rejected: ${reason}`)}
      />
      <p aria-live="polite" className="text-center text-xs text-muted-foreground">{log}</p>
    </div>
  )
}
