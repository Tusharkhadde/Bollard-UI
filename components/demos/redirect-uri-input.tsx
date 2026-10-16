"use client"

import * as React from "react"

import { RedirectUriInput } from "@/registry/default/redirect-uri-input/redirect-uri-input"

const registered = ["https://app.acme.com/auth/callback", "https://staging.acme.com/auth/callback"]
const presets = ["http://app.acme.com/auth/callback", "https://*.acme.com/auth/callback", "https://app.acme.com/auth/callback#done", "http://localhost:3000/auth/callback"]

export function Demo() {
  const [uri, setUri] = React.useState("https://app.acme.com/auth/callback/")
  return (
    <div className="grid w-full max-w-md min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <RedirectUriInput value={uri} onValueChange={setUri} registered={registered} production />
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setUri(p)}
            className="max-w-full truncate rounded-md border px-2 py-1 font-mono outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
