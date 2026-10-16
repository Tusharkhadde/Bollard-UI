"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { ActingAsBanner, OrgContextChip } from "@/registry/default/acting-as-banner/acting-as-banner"

export function Demo() {
  const [acting, setActing] = React.useState(true)
  const [expiresAt, setExpiresAt] = React.useState<Date>()

  React.useEffect(() => {
    if (acting) setExpiresAt(new Date(Date.now() + 42 * 60_000))
  }, [acting])

  return (
    <div className="h-64 w-full max-w-lg overflow-auto rounded-xl border bg-background">
      {acting ? (
        <ActingAsBanner
          subject={{ name: "Priya Sharma", email: "priya@acme.com" }}
          org="Acme Corp"
          actor="Rahul from Support"
          expiresAt={expiresAt}
          onSwitchBack={() =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                setActing(false)
                resolve()
              }, 700),
            )
          }
        />
      ) : (
        <div className="flex items-center justify-between border-b px-4 py-2 text-sm text-muted-foreground">
          Back to your own account.
          <button
            type="button"
            onClick={() => setActing(true)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Impersonate again
          </button>
        </div>
      )}
      <div className="space-y-3 p-4 text-sm">
        <p className="font-medium">Project settings · Q3 Launch</p>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-8 rounded-md bg-muted/60" />
        ))}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-3 text-sm font-medium text-white outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Trash2 aria-hidden className="size-4" /> Delete project <OrgContextChip org="Acme Corp" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Remove member <OrgContextChip org="Globex Ltd" actingAs={acting ? "Priya" : undefined} preposition="from" />
          </button>
        </div>
      </div>
    </div>
  )
}
