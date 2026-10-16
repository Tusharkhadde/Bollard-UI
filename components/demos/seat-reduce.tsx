"use client"

import * as React from "react"

import { SeatReduce, type SeatMember, type SeatReduction } from "@/registry/default/seat-reduce/seat-reduce"

const MIN = 60_000
const DAY = 86_400_000
const INVITES = [
  { id: "i1", email: "ankit@acme.in" },
  { id: "i2", email: "zoya@acme.in" },
]

export function Demo() {
  const [team, setTeam] = React.useState<{ members: SeatMember[]; renewsAt: number } | null>(null)
  const [result, setResult] = React.useState<SeatReduction | null>(null)
  const [run, setRun] = React.useState(0)

  React.useEffect(() => {
    const now = Date.now()
    const renew = new Date(now)
    renew.setMonth(renew.getMonth() + 1, 1)
    setTeam({
      renewsAt: renew.getTime(),
      members: [
        { id: "u1", name: "Tushar Khadde", role: "owner", lastActive: now - 2 * MIN },
        { id: "u2", name: "Priya Nair", role: "admin", lastActive: now - 4 * DAY, work: "Billing settings and 3 projects" },
        { id: "u3", name: "Rahul Mehta", role: "member", lastActive: now - 5 * MIN, work: "14 docs and 2 projects" },
        { id: "u4", name: "Arjun Rao", role: "member", lastActive: now - 47 * DAY, work: "6 docs" },
        { id: "u5", name: "Meera Iyer", role: "member", lastActive: null },
        { id: "u6", name: "Sara Khan", role: "member", lastActive: now - 3 * DAY, work: "9 docs" },
        { id: "u7", name: "Dev Patel", role: "member", lastActive: now - 21 * DAY, work: "2 docs" },
        { id: "u8", name: "Kavya Joshi", role: "member", lastActive: now - 2 * 3_600_000, work: "11 docs" },
        { id: "u9", name: "Rohan Das", role: "member", lastActive: now - 9 * DAY, work: "1 project" },
        { id: "u10", name: "Neha Gupta", role: "member", lastActive: now - DAY - 5 * 3_600_000, work: "5 docs" },
      ],
    })
  }, [run])

  if (!team) return <div className="h-96 w-full max-w-md" />
  if (result)
    return (
      <div className="space-y-2 text-center text-sm">
        <p>
          Lowered to {result.seats} seats: {result.cancelInvites.length} {result.cancelInvites.length === 1 ? "invite" : "invites"} cancelled, {result.remove.length} {result.remove.length === 1 ? "person loses" : "people lose"} access at renewal.
        </p>
        <button
          type="button"
          onClick={() => {
            setResult(null)
            setRun((n) => n + 1)
          }}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30"
        >
          Run the demo again
        </button>
      </div>
    )

  return (
    <SeatReduce
      key={run}
      seats={12}
      defaultValue={8}
      members={team.members}
      invites={INVITES}
      pricePerSeat={600}
      currency="INR"
      locale="en-IN"
      renewsAt={team.renewsAt}
      onConfirm={(r) => new Promise<void>((resolve) => setTimeout(() => (setResult(r), resolve()), 600))}
      onCancel={() => setRun((n) => n + 1)}
    />
  )
}
