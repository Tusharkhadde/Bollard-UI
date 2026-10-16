"use client"

import * as React from "react"
import { Send, Trash2 } from "lucide-react"

import { HoldToConfirm } from "@/registry/default/hold-to-confirm/hold-to-confirm"

export function Demo() {
  const [log, setLog] = React.useState("A quick click does nothing. Press and hold.")

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        <HoldToConfirm
          variant="destructive"
          pendingLabel="Deleting…"
          confirmedLabel="Deleted"
          onConfirm={() =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                setLog("Workspace deleted.")
                resolve()
              }, 700),
            )
          }
        >
          <Trash2 aria-hidden className="size-4" /> Delete workspace
        </HoldToConfirm>
        <HoldToConfirm
          variant="outline"
          duration={800}
          confirmedLabel="Published"
          onConfirm={() => setLog("Post published.")}
        >
          <Send aria-hidden className="size-4" /> Publish post
        </HoldToConfirm>
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
