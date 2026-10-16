"use client"

import * as React from "react"

import { DangerZone, DangerZoneAction } from "@/registry/default/danger-zone/danger-zone"

export function Demo() {
  const [log, setLog] = React.useState("A stray click on Delete just hit the lock.")
  const deleteRef = React.useRef<HTMLLIElement>(null)

  // Open on the catch: a click on a locked action, which only points at Unlock.
  React.useEffect(() => {
    deleteRef.current?.querySelector("button")?.click()
  }, [])

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <DangerZone timeout={30}>
        <DangerZoneAction
          title="Transfer ownership"
          consequence="Moves acme-web to another team. You lose admin access."
          actionLabel="Transfer"
          onAction={() => setLog("Transfer started. The zone locked again.")}
        />
        <DangerZoneAction
          title="Archive project"
          consequence="Read-only for everyone. You can unarchive it later."
          actionLabel="Archive"
          onAction={() => setLog("Project archived. The zone locked again.")}
        />
        <DangerZoneAction
          ref={deleteRef}
          title="Delete project"
          consequence="Deletes 214 issues and 3 deployments for good. This can't be undone."
          actionLabel="Delete"
          pendingLabel="Deleting…"
          onAction={() =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                setLog("Project deleted. The zone locked again.")
                resolve()
              }, 800),
            )
          }
        />
      </DangerZone>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
