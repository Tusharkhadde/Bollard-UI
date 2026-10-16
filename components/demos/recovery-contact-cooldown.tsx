"use client"

import * as React from "react"

import { RecoveryContactCooldown } from "@/registry/default/recovery-contact-cooldown/recovery-contact-cooldown"

const HOUR = 3_600_000

export function Demo() {
  // The clock is read after mount so the demo renders the same on the server and the client.
  const [requestedAt, setRequestedAt] = React.useState<number>()
  const [run, setRun] = React.useState(0)
  React.useEffect(() => setRequestedAt(Date.now() - 48 * 60_000), [])
  const restart = (msLeft: number) => {
    setRequestedAt(Date.now() - 48 * HOUR + msLeft)
    setRun((n) => n + 1)
  }
  return (
    <div className="grid w-full max-w-sm min-w-0 gap-3">
      <RecoveryContactCooldown
        key={run}
        previous="tushar.k@gmail.com"
        next="recover.acct77@proton.me"
        requestedAt={requestedAt}
        onCancel={() => new Promise((resolve) => setTimeout(resolve, 600))}
        onReport={() => {}}
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        Preview:
        <button type="button" onClick={() => restart(47 * HOUR + 12 * 60_000)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">Just requested</button>
        <button type="button" onClick={() => restart(8_000)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">Last seconds</button>
      </div>
    </div>
  )
}
