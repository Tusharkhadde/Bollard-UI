"use client"

import * as React from "react"

import { ForcePushConfirm, type RemoteCommit } from "@/registry/default/force-push-confirm/force-push-confirm"

const HOUR = 3_600_000

const commits = (base?: number): RemoteCommit[] => [
  { sha: "9c41e7ab2d5f08c3a1e6b7d94f20c8e15a3b6d72", message: "Handle UPI timeout on the confirm screen\n\nCo-authored-by: Rahul Mehta <rahul@acme.dev>", author: { name: "Priya Shah", email: "priya@acme.dev" }, date: base && base - 2 * HOUR },
  { sha: "5be0d13f8c27a9e4b61d0f3c85e2a7b94d1c6f08", message: "Retry webhook on 502 from the gateway", author: { name: "Priya Shah", email: "priya@acme.dev" }, date: base && base - 5 * HOUR },
  { sha: "1f2a9e0c4417b3d8e5a26c9f0b7d4e1a3c8f5b29", message: "WIP: tidy checkout styles", author: { name: "Tushar Khadde", email: "48211+tushar@users.noreply.github.com" }, date: base && base - 26 * HOUR },
]

export function Demo() {
  const [base, setBase] = React.useState<number>()
  const [tip, setTip] = React.useState("9c41e7ab2d5f08c3a1e6b7d94f20c8e15a3b6d72")
  const [done, setDone] = React.useState("")
  React.useEffect(() => setBase(Date.now()), [])

  return (
    <div className="w-full max-w-lg space-y-2">
      <ForcePushConfirm
        branch="feature/checkout"
        remoteSha={tip}
        lost={commits(base)}
        me={{ emails: ["tushar@users.noreply.github.com"] }}
        protectedBranches={["main", "release/*"]}
        otherBranches={["main", "develop"]}
        onCancel={() => setDone("Cancelled. Nothing was pushed.")}
        onConfirm={({ command }) => new Promise<void>((resolve) => setTimeout(() => (setDone(`Ran: ${command}`), resolve()), 700))}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button type="button" onClick={() => setTip("e07d55b913c4a8f2d6e0b1a7c3f9d5e28b4a6c10")} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Simulate a new push by Priya
        </button>
        {done && <span className="min-w-0 [overflow-wrap:anywhere]">{done}</span>}
      </div>
    </div>
  )
}
