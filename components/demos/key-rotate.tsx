"use client"

import * as React from "react"

import { KeyRotate, type KeyClient } from "@/registry/default/key-rotate/key-rotate"

const MIN = 60_000
const DAY = 86_400_000

export function Demo() {
  const [clients, setClients] = React.useState<KeyClient[]>([])
  const [rotatedAt, setRotatedAt] = React.useState<number>()
  const [done, setDone] = React.useState("")
  const [run, setRun] = React.useState(0)

  React.useEffect(() => {
    const now = Date.now()
    setClients([
      { id: "api", name: "Production API", lastUsedOld: now - 40_000 },
      { id: "billing", name: "Billing worker", lastUsedOld: now - 2 * MIN },
      { id: "export", name: "Weekly invoice export", lastUsedOld: now - 2 * DAY, every: 7 * DAY },
      { id: "staging", name: "Staging", lastUsedOld: now - 9 * DAY },
    ])
  }, [run])

  // Once rotated, clients pick up the new key one by one.
  React.useEffect(() => {
    if (!rotatedAt) return
    const switchTo = (id: string) => setClients((cs) => cs.map((c) => (c.id === id ? { ...c, lastUsedNew: Date.now() } : c)))
    const timers = [setTimeout(() => switchTo("api"), 2500), setTimeout(() => switchTo("billing"), 5000)]
    return () => timers.forEach(clearTimeout)
  }, [rotatedAt])

  const reset = () => {
    setDone("")
    setRotatedAt(undefined)
    setRun((n) => n + 1)
  }
  const wait = (fn: () => void) => new Promise<void>((resolve) => setTimeout(() => (fn(), resolve()), 600))

  if (done)
    return (
      <div className="space-y-2 text-center text-sm">
        <p>{done}</p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Run the demo again
        </button>
      </div>
    )

  return (
    <KeyRotate
      key={run}
      keyName="production secret key"
      clients={clients}
      defaultValue={0}
      rotatedAt={rotatedAt}
      onRotate={(overlap) => wait(() => (overlap ? setRotatedAt(Date.now()) : setDone("Old key expired. Clients still using it now get 401 errors until they're updated.")))}
      onRevokeOld={() => wait(() => setDone("Old key revoked."))}
    />
  )
}
