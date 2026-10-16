"use client"

import * as React from "react"
import type { CountryCode } from "libphonenumber-js/max"

import { cn } from "@/lib/utils"
import { CallbackNumberCheck } from "@/registry/default/callback-number-check/callback-number-check"

const homes: { code: CountryCode; label: string }[] = [
  { code: "US", label: "US" },
  { code: "IN", label: "India" },
  { code: "GB", label: "UK" },
]

const calls = [
  { id: "missed", number: "+1 876 555 0142", caption: "Missed call · 1 ring · 2:13 AM", rings: 1 },
  { id: "sms", number: "+44 909 879 0000", caption: "Text: “You've won! Call to claim your prize”" },
  {
    id: "bank",
    number: "+91 98201 12345",
    caption: "Voicemail from “HDFC Bank fraud team”",
    officialName: "HDFC Bank",
    officialNumbers: ["1800 202 6161", "1800 266 4332"],
  },
]

export function Demo() {
  const [home, setHome] = React.useState<CountryCode>("US")
  const [log, setLog] = React.useState("")

  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span id="cnc-home">Your phone is in</span>
        <div role="radiogroup" aria-labelledby="cnc-home" className="flex gap-1 rounded-lg bg-muted p-1">
          {homes.map((h) => (
            <button
              key={h.code}
              type="button"
              role="radio"
              aria-checked={home === h.code}
              onClick={() => setHome(h.code)}
              className={cn(
                "h-7 rounded-md px-2.5 font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                home === h.code ? "bg-background text-foreground shadow-xs" : "hover:text-foreground",
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
      {calls.map((call) => (
        <CallbackNumberCheck
          key={call.id}
          number={call.number}
          caption={call.caption}
          rings={call.rings}
          officialName={call.officialName}
          officialNumbers={call.officialNumbers}
          homeCountry={home}
          onCall={(e164) => setLog(`Dialling ${e164}…`)}
          onDismiss={() => setLog("Not calling. Good call.")}
        />
      ))}
      <p role="status" className="min-h-4 text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
