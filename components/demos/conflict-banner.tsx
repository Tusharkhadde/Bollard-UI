"use client"

import * as React from "react"

import { ConflictBanner } from "@/registry/default/conflict-banner/conflict-banner"

const yours = "Launch is planned for 14 November. Marketing owns the press release and the landing page."
const theirs = "Launch is planned for 21 November after QA sign-off. Marketing owns the press release."

export function Demo() {
  const [resolved, setResolved] = React.useState<"mine" | "theirs">()
  const [editedAt, setEditedAt] = React.useState<number>()
  React.useEffect(() => setEditedAt(Date.now() - 2 * 60_000), [])

  return (
    <div className="w-full max-w-xl space-y-3">
      {resolved || editedAt === undefined ? (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">
            {resolved === "mine" ? "Saved your version over Priya's." : resolved ? "Loaded Priya's version." : ""}
          </span>
          {resolved && (
            <button
              type="button"
              onClick={() => setResolved(undefined)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Reset demo
            </button>
          )}
        </div>
      ) : (
        <ConflictBanner
          yourVersion={yours}
          theirVersion={theirs}
          editor="Priya"
          editedAt={editedAt}
          onKeepMine={() => setResolved("mine")}
          onUseTheirs={() => setResolved("theirs")}
        />
      )}
      <div className="rounded-xl border bg-background p-4 text-sm leading-relaxed">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Release notes</p>
        {resolved === "theirs" ? theirs : yours}
      </div>
    </div>
  )
}
