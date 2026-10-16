"use client"

import * as React from "react"
import { Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { SendTimeCheck } from "@/registry/default/send-time-check/send-time-check"

// Mon 12 Oct 2026, 01:14 UTC: 2:14 AM in London, 10:14 AM on Sports Day in Tokyo, 9:14 PM Sunday in New York.
const NOW = Date.UTC(2026, 9, 12, 1, 14)

const people = [
  { name: "Priya", timeZone: "Europe/London" },
  { name: "Kenji", timeZone: "Asia/Tokyo", holidays: [{ date: "2026-10-12", name: "Sports Day" }] },
  { name: "Sam", timeZone: "America/New_York" },
]

export function Demo() {
  const [to, setTo] = React.useState(0)
  const [scheduled, setScheduled] = React.useState<string>()
  const person = people[to]

  return (
    <div className="grid w-full max-w-sm gap-3">
      <div role="radiogroup" aria-label="Recipient" className="flex gap-1.5">
        {people.map((p, i) => (
          <button
            key={p.name}
            type="button"
            role="radio"
            aria-checked={to === i}
            onClick={() => {
              setTo(i)
              setScheduled(undefined)
            }}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              to === i ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>
      <textarea
        aria-label={`Message to ${person.name}`}
        defaultValue="Quick one: can you review the pricing doc before the client call?"
        rows={3}
        className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      />
      <SendTimeCheck
        recipient={person.name}
        timeZone={person.timeZone}
        holidays={person.holidays}
        now={NOW}
        senderTimeZone="Asia/Kolkata"
        onSchedule={(at) => setScheduled(at.toISOString())}
      >
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Send aria-hidden className="size-4" />
          Send now
        </button>
        {scheduled && (
          <span role="status" className="text-sm text-muted-foreground">
            Scheduled ✓
          </span>
        )}
      </SendTimeCheck>
    </div>
  )
}
