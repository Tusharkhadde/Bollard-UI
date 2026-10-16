"use client"

import * as React from "react"

import { GraceSend } from "@/registry/default/grace-send/grace-send"

export function Demo() {
  const [log, setLog] = React.useState("Press Send, then change your mind.")

  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="space-y-2 rounded-xl border bg-background p-4 text-sm">
        <p className="flex gap-2 border-b pb-2">
          <span className="text-muted-foreground">To</span> all-staff@northwind.in
        </p>
        <p className="flex gap-2 border-b pb-2">
          <span className="text-muted-foreground">Subject</span> Office closed Friday
        </p>
        <p className="leading-relaxed text-muted-foreground">Hi all, the office will be closed this Friday for the Diwali break…</p>
      </div>
      <GraceSend
        onSend={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setLog("Sent to 84 people.")
              resolve()
            }, 800),
          )
        }
      />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
