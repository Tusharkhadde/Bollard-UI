"use client"

import * as React from "react"

import { SessionList, type Session } from "@/registry/default/session-list/session-list"

const minutes = (n: number) => n * 60_000

const build = (now: number): Session[] => [
  { id: "s1", device: "Chrome on MacBook Air", kind: "desktop", location: "Pune, India", country: "IN", lastActive: now, current: true },
  { id: "s2", device: "Safari on iPhone 15", kind: "phone", location: "Mumbai, India", country: "IN", lastActive: now - minutes(42) },
  { id: "s3", device: "Firefox on Windows", kind: "desktop", location: "Lagos, Nigeria", country: "NG", ip: "102.89.34.7", lastActive: now - minutes(60 * 5) },
  { id: "s4", device: "Chrome on Galaxy Tab", kind: "tablet", location: "Pune, India", country: "IN", lastActive: now - minutes(60 * 24 * 9) },
]

export function Demo() {
  const [sessions, setSessions] = React.useState<Session[]>()
  React.useEffect(() => setSessions(build(Date.now())), [])
  if (!sessions) return <div className="h-80 w-full max-w-md" />
  const remove = (ids: string[]) => new Promise<void>((resolve) => setTimeout(() => {
    setSessions((list) => list?.filter((s) => !ids.includes(s.id)))
    resolve()
  }, 500))

  return sessions.some((s) => s.current) ? (
    <SessionList sessions={sessions} onRevoke={(id) => remove([id])} onRevokeOthers={remove} />
  ) : (
    <div className="flex w-full max-w-md items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">You signed out of this device.</span>
      <button type="button" onClick={() => setSessions(build(Date.now()))} className="rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Reset demo
      </button>
    </div>
  )
}
