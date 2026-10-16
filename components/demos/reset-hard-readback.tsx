"use client"

import * as React from "react"

import { ResetHardReadback } from "@/registry/default/reset-hard-readback/reset-hard-readback"

const DIRTY = [
  "# branch.oid 9c41e7ab2d5f08c3a1e6b7d94f20c8e15a3b6d72",
  "# branch.head feature/checkout",
  "# branch.upstream origin/feature/checkout",
  "# branch.ab +2 -0",
  "1 .M N... 100644 100644 100644 1a2b3c4 1a2b3c4 src/checkout/PayButton.tsx",
  "1 M. N... 100644 100644 100644 5d6e7f8 9a0b1c2 src/lib/upi.ts",
  "1 A. N... 000000 100644 100644 0000000 3d4e5f6 src/checkout/retry.ts",
  "? notes/todo.md",
  "! .env.local",
  "! node_modules/",
  "! .next/",
].join("\n")
const CLEAN = DIRTY.split("\n").filter((l) => !l.startsWith("1 ")).join("\n")
const NUMSTAT = "38\t12\tsrc/checkout/PayButton.tsx\n9\t2\tsrc/lib/upi.ts\n64\t0\tsrc/checkout/retry.ts"
const COMMANDS = ["git reset --hard origin/main", "git clean -fdx", "git checkout -- .", "git stash drop"]

export function Demo() {
  const [command, setCommand] = React.useState(COMMANDS[0])
  const [status, setStatus] = React.useState(DIRTY)
  const [log, setLog] = React.useState("")
  const wait = (fn: () => void) => new Promise<void>((resolve) => setTimeout(() => (fn(), resolve()), 700))

  return (
    <div className="grid w-full max-w-lg gap-2">
      <div className="flex flex-wrap gap-1.5" aria-label="Commands">
        {COMMANDS.map((c) => (
          <button key={c} type="button" aria-pressed={command === c} onClick={() => (setCommand(c), setStatus(DIRTY), setLog(""))} className="rounded-md border px-2 py-1 font-mono text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:font-medium">
            {c.replace(/^git /, "")}
          </button>
        ))}
      </div>
      <ResetHardReadback
        command={command}
        status={status}
        numstat={NUMSTAT}
        commits={"e07d55b Retry UPI collect on timeout\n5be0d13 Show amount in words on confirm\n1f2a9e0 Bump checkout copy"}
        stashes={[{ ref: "stash@{0}", sha: "4b8e2a1c9d7f3e5a0b6c8d2e4f1a3b5c7d9e0f2a", message: "On feature/checkout: half-done coupon field", files: [{ path: "src/checkout/Coupon.tsx", added: 41, removed: 3 }, { path: "src/lib/coupon.ts", added: 18, removed: 0 }] }]}
        onStash={(cmd) => wait(() => (setLog(`Ran: ${cmd}`), setStatus(CLEAN)))}
        onConfirm={(cmd) => wait(() => setLog(`Ran: ${cmd}`))}
        onCancel={() => setLog("Cancelled. Nothing ran.")}
      />
      <p aria-live="polite" className="min-h-4 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{log}</p>
    </div>
  )
}
