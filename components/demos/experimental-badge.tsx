"use client"

import * as React from "react"
import { Inbox } from "lucide-react"

import { ExperimentalBadge } from "@/registry/default/experimental-badge/experimental-badge"

export function Demo() {
  const [smart, setSmart] = React.useState(true)

  return (
    <div className="min-h-80 w-full max-w-sm overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Inbox aria-hidden className="size-4 text-muted-foreground" />
        <h3 className="font-medium">{smart ? "Smart inbox" : "Inbox"}</h3>
        {smart && (
          <ExperimentalBadge
            feature="Smart inbox"
            defaultOpen
            risks={[
              {
                kind: "data",
                text: "Auto-sorted folders may be reset while we tune the model. Your emails are never deleted.",
              },
              { kind: "change", text: "Which emails count as “Important” will change week to week." },
            ]}
            feedbackHref="#feedback"
            switchBackNote="Your folders stay here for when you come back."
            onSwitchBack={() => new Promise<void>((resolve) => setTimeout(() => (setSmart(false), resolve()), 700))}
          />
        )}
      </div>
      <ul className="divide-y text-sm">
        {["Priya: Q3 invoice attached", "Aman: Flight moved to 6:40", "Ritu: Lunch Thursday?"].map((mail) => (
          <li key={mail} className="px-4 py-3 text-muted-foreground">
            {mail}
          </li>
        ))}
      </ul>
      {!smart && (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Back on the stable inbox.{" "}
          <button
            type="button"
            onClick={() => setSmart(true)}
            className="rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Try Smart inbox again
          </button>
        </p>
      )}
    </div>
  )
}
