"use client"

import * as React from "react"

import { InviteCheck, type ExistingInvite, type HolidayLookup, type InviteGuest } from "@/registry/default/invite-check/invite-check"

// Thu 15 Oct 2026, 3:30 PM in Pune (10:00 UTC): 6:00 AM in New York.
const START = Date.UTC(2026, 9, 15, 10, 0)

const initialGuests: InviteGuest[] = [
  { name: "Sam Ortiz", email: "sam@acme.com", timeZone: "America/New_York" },
  { name: "Lena Vogt", email: "lena@acme.co", timeZone: "Europe/Berlin" },
  { name: "Rohan Mehta", email: "rohan.mehta@gmail.com", timeZone: "Asia/Dubai" },
  { name: "Rohan (personal)", email: "rohanmehta+cal@gmail.com", timeZone: "Asia/Dubai" },
]

const existing: ExistingInvite[] = [
  { id: "evt_812", title: "Q4 roadmap sync", start: Date.UTC(2026, 9, 16, 9, 0), guests: ["sam@acme.com", "rohan.mehta@gmail.com", "lena@acme.com"] },
]

const HOLIDAYS: Record<string, Record<string, string>> = { "America/New_York": { "2026-10-12": "Indigenous Peoples' Day" } }
const holidayFor: HolidayLookup = (guest, date) => HOLIDAYS[guest.timeZone]?.[date]
const orgDomains = ["acme.com"]

export function Demo() {
  const [start, setStart] = React.useState(START)
  const [guests, setGuests] = React.useState(initialGuests)
  const [videoLink, setVideoLink] = React.useState<string>()

  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="rounded-md border px-3 py-2 text-sm">
        <p className="font-medium">Q4 roadmap sync</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(start)} IST · 45 min
          {videoLink && ` · ${videoLink}`}
        </p>
      </div>
      <InviteCheck
        title="Q4 roadmap sync"
        start={start}
        guests={guests}
        videoLink={videoLink}
        timeZone="Asia/Kolkata"
        orgDomains={orgDomains}
        existing={existing}
        holidayFor={holidayFor}
        onReschedule={(at) => setStart(at.getTime())}
        onAddVideoLink={() => setVideoLink("meet.google.com/qrx-wpta-kme")}
        onFixGuest={(email, next) => setGuests((gs) => gs.map((g) => (g.email === email ? { ...g, email: next } : g)))}
        onRemoveGuest={(email) => setGuests((gs) => gs.filter((g) => g.email !== email))}
        onOpenExisting={() => undefined}
      />
    </div>
  )
}
