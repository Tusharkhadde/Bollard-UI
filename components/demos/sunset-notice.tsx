"use client"

import * as React from "react"

import { SunsetNotice } from "@/registry/default/sunset-notice/sunset-notice"

const storageKey = "cui-sunset-demo"

/** A response from a deprecated endpoint: deprecated 60 days ago, sunset in 6 days at 23:59:59 UTC. */
function demoResponseHeaders(now: number) {
  const today = new Date(now)
  const sunset = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 6, 23, 59, 59))
  return new Headers({
    Deprecation: `@${Math.floor((now - 60 * 86_400_000) / 1000)}`,
    Sunset: sunset.toUTCString(),
    Link: '<https://developer.example.com/orders/v2-migration>; rel="deprecation"; type="text/html"',
  })
}

export function Demo() {
  const [headers, setHeaders] = React.useState<Headers>()
  const [snoozed, setSnoozed] = React.useState<number>()
  const [run, setRun] = React.useState(0)
  React.useEffect(() => setHeaders(demoResponseHeaders(Date.now())), [])

  const reset = () => {
    Object.keys(localStorage).forEach((key) => key.startsWith(storageKey) && localStorage.removeItem(key))
    setSnoozed(undefined)
    setRun((value) => value + 1)
  }

  return (
    <div className="w-full max-w-xl space-y-3">
      {headers && (
        <SunsetNotice
          key={run}
          subject="Orders API v1"
          headers={headers}
          storageKey={storageKey}
          onSnooze={setSnoozed}
          stops={["Creating orders with POST /v1/orders", "Webhooks in the v1 payload format"]}
        />
      )}
      <div className="rounded-xl border bg-background p-4 font-mono text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 font-sans font-medium">GET /v1/orders · 200 OK</p>
        {headers && ["deprecation", "sunset"].map((name) => <p key={name} className="break-all">{name}: {headers.get(name)}</p>)}
      </div>
      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
        {snoozed !== undefined && <span>Snoozed until {snoozed} {snoozed === 1 ? "day" : "days"} before</span>}
        <button
          type="button"
          onClick={reset}
          className="rounded-md border px-2 py-1 text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset demo
        </button>
      </div>
    </div>
  )
}
