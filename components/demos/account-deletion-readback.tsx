"use client"

import * as React from "react"

import { AccountDeletionReadback, type DeletionTeam } from "@/registry/default/account-deletion-readback/account-deletion-readback"

const START: DeletionTeam[] = [
  { id: "t1", name: "Design Team", members: 8, soleOwner: true },
  { id: "t2", name: "Marketing", members: 14 },
]

export function Demo() {
  const [teams, setTeams] = React.useState(START)
  const [done, setDone] = React.useState<"now" | "periodEnd">()
  if (done) return <p className="text-sm text-muted-foreground">{done === "now" ? "Account deleted. A restore link was sent to asha.k@example.com." : "Deletion scheduled for 2 November 2026. You can cancel it from Settings until then."}</p>
  return (
    <AccountDeletionReadback
      email="asha.k@example.com"
      items={[
        { label: "Projects and boards", detail: "42" },
        { label: "Uploaded files", detail: "1,284 · 3.2 GB" },
        { label: "Comments, history and settings" },
      ]}
      teams={teams}
      subscriptions={[
        { id: "s1", name: "Pro (iPhone)", price: "₹499/month", store: "apple", endsOn: "2026-11-02" },
        { id: "s2", name: "Extra storage", store: "web" },
      ]}
      retained={["invoices, as tax law requires"]}
      graceDays={30}
      now={new Date(2026, 9, 14, 11).getTime()}
      locale="en-IN"
      onExport={() => new Promise<void>((resolve) => setTimeout(resolve, 900))}
      onTransfer={(id) => new Promise<void>((resolve) => setTimeout(() => { setTeams((ts) => ts.map((x) => (x.id === id ? { ...x, soleOwner: false, name: `${x.name} (now owned by Ravi)` } : x))); resolve() }, 700))}
      onDelete={(timing) => new Promise<void>((resolve) => setTimeout(() => { setDone(timing.when); resolve() }, 700))}
    />
  )
}
