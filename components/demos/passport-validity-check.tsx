"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { PassportValidityCheck, type PassportDetails, type Trip } from "@/registry/default/passport-validity-check/passport-validity-check"

const PLACES = [
  { id: "schengen", label: "Paris" },
  { id: "singapore", label: "Singapore" },
  { id: "south-africa", label: "Cape Town" },
]
const TRIP: Trip = { arrival: "2027-01-10", departure: "2027-02-14" }

export function Demo() {
  const [place, setPlace] = React.useState(PLACES[0].id)
  const [trip, setTrip] = React.useState<Trip>(TRIP)
  const [passport, setPassport] = React.useState<PassportDetails>({ expiry: "2027-04-30", issued: "2017-02-20", blankPages: 1 })
  return (
    <div className="grid w-full max-w-md gap-3">
      <div role="group" aria-label="Destination" className="flex flex-wrap gap-1.5">
        {PLACES.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={place === p.id}
            onClick={() => {
              setPlace(p.id)
              setTrip(TRIP)
            }}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              place === p.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Trip: {String(trip.arrival)} → {String(trip.departure)}
      </p>
      <PassportValidityCheck destination={place} trip={trip} onTripChange={setTrip} value={passport} onValueChange={setPassport} />
    </div>
  )
}
