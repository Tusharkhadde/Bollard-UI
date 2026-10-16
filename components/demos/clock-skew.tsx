"use client"

import * as React from "react"

import { ClockSkew, CorrectedCountdown } from "@/registry/default/clock-skew/clock-skew"

/** Pretend the device clock runs 4 min 12 s behind the server. */
const SKEW = 252_000

export function Demo() {
  const [times, setTimes] = React.useState<{ server: number; expires: number }>()

  React.useEffect(() => {
    const server = Date.now() + SKEW
    setTimes({ server, expires: server + 10 * 60_000 })
  }, [])

  return (
    <div className="w-full max-w-sm">
      <ClockSkew serverTime={times?.server} serverTimeUncertainty={800}>
        <div className="space-y-3 rounded-xl border bg-background p-4">
          <div className="space-y-1">
            <p className="font-medium">Your payment link</p>
            <p className="text-sm text-muted-foreground">
              Expires in{" "}
              {times ? <CorrectedCountdown to={times.expires} className="font-medium text-foreground" /> : "…"}
            </p>
          </div>
          <button
            type="button"
            // Same moment, device and server now agree: the remaining time must not change.
            onClick={() => setTimes((t) => t && { server: Date.now(), expires: t.expires - SKEW })}
            className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            Simulate fixing the clock
          </button>
        </div>
      </ClockSkew>
    </div>
  )
}
