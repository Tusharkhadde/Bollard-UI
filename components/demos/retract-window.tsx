"use client"

import * as React from "react"

import { RetractWindow } from "@/registry/default/retract-window/retract-window"

// Sent 75 s ago: 45 seconds of Undo Send left.
const SENT = new Date("2026-10-14T13:28:45Z")
const NOW = new Date("2026-10-14T13:30:00Z")

export function Demo() {
  const [log, setLog] = React.useState("")

  return (
    <div className="grid w-full max-w-sm gap-2">
      <RetractWindow
        sentAt={SENT}
        now={NOW}
        timeZone="Asia/Kolkata"
        policy="imessage"
        editsUsed={1}
        recipients={[
          { id: "p", name: "Priya", read: true },
          { id: "r", name: "Rahul", canRetract: false },
          { id: "a", name: "Anu" },
        ]}
        onEdit={() => setLog("Editing…")}
        onUnsend={() => new Promise<void>((resolve) => setTimeout(resolve, 700))}
        onDeleteForMe={() => setLog("Deleted from this phone only.")}
        onSendCorrection={() => setLog("Writing a correction…")}
      >
        Salary bands for the team are in the sheet, 18–24 LPA. Sharing with HR only.
      </RetractWindow>
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">{log}</p>
    </div>
  )
}
