"use client"

import * as React from "react"

import { MoveReadback, type MoveLocation } from "@/registry/default/move-readback/move-readback"

const FROM: MoveLocation = {
  path: ["Acme", "Marketing", "Drafts"],
  visibility: "Marketing team",
  viewers: 12,
  visibilityFrom: 1,
  settings: { Retention: "Kept forever", Comments: "Team only" },
}

const DESTINATIONS: Record<string, MoveLocation> = {
  public: {
    path: ["Acme", "Public", "Launch kit"],
    visibility: "Public",
    viewers: 40,
    visibilityFrom: 1,
    settings: { Retention: "Kept forever", Comments: "Anyone can comment" },
  },
  legal: {
    path: ["Acme", "Legal", "Review"],
    visibility: "Legal",
    viewers: 4,
    visibilityFrom: 1,
    settings: { Retention: "Deleted after 7 years", Comments: "Team only" },
  },
}

export function Demo() {
  const [dest, setDest] = React.useState<keyof typeof DESTINATIONS>("public")
  const [done, setDone] = React.useState<string | null>(null)

  if (done) {
    return (
      <div className="space-y-2 text-center text-sm">
        <p>{done}</p>
        <button
          type="button"
          onClick={() => setDone(null)}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Run the demo again
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg space-y-3">
      <div role="group" aria-label="Destination" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {(["public", "legal"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={dest === key}
            onClick={() => setDest(key)}
            className="h-8 flex-1 rounded-md px-3 font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
          >
            To {DESTINATIONS[key].path[1]}
          </button>
        ))}
      </div>
      <MoveReadback
        items={[{ name: "Q3 pricing.pdf", pathLinks: 4, directShares: 2 }]}
        from={FROM}
        to={DESTINATIONS[dest]}
        onCancel={() => setDest("public")}
        onMove={({ keepRedirect }) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setDone(`Moved to ${DESTINATIONS[dest].path.join(" / ")}${keepRedirect ? ", with a redirect at the old path" : ""}.`)
              resolve()
            }, 600),
          )
        }
      />
    </div>
  )
}
