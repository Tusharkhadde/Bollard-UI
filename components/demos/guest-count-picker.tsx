"use client"

import * as React from "react"

import { GuestCountPicker, type GuestIssue } from "@/registry/default/guest-count-picker/guest-count-picker"

// A family booking two rooms at a hotel where children are 2–12 and rooms sleep 3.
export function Demo() {
  const [issues, setIssues] = React.useState<GuestIssue[]>([])
  return (
    <div className="grid w-full max-w-sm gap-3">
      <GuestCountPicker
        aria-label="Guests"
        limits={{ maxChildAge: 12, maxPerRoom: 3 }}
        defaultValue={{ adults: 3, childAges: [13, 6], infants: 1, rooms: [{ adults: 3, children: 1, infants: 1 }, { adults: 0, children: 1, infants: 0 }] }}
        onIssuesChange={setIssues}
      />
      <button
        type="button"
        disabled={issues.length > 0}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        See rooms
      </button>
    </div>
  )
}
