"use client"

import * as React from "react"

import { BulkRunner } from "@/registry/default/bulk-runner/bulk-runner"

const users = Array.from({ length: 500 }, (_, index) => `user${String(index + 1).padStart(3, "0")}@northwind.in`)
const attempts = new Map<string, number>()

/** Deterministic fake mailer: a few addresses fail on the first try, two are permanently bad. */
function sendEmail(address: string, signal: AbortSignal) {
  const n = Number(address.slice(4, 7))
  const attempt = (attempts.get(address) ?? 0) + 1
  attempts.set(address, attempt)
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (n % 97 === 0) reject(new Error("Invalid address"))
      else if (n % 41 === 0 && attempt === 1) reject(new Error("Mailbox full"))
      else if (n % 67 === 0 && attempt === 1) reject(new Error("Timed out"))
      else resolve()
    }, 25 + (n % 7) * 8)
    signal.addEventListener("abort", () => clearTimeout(timer))
  })
}

export function Demo() {
  const [run, setRun] = React.useState(0)

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <BulkRunner
        key={run}
        title="Email 500 users: October invoice"
        items={users}
        run={sendEmail}
        autoStart
        doneVerb="emailed"
        untouchedText="were not emailed"
      />
      <button
        type="button"
        onClick={() => {
          attempts.clear()
          setRun((value) => value + 1)
        }}
        className="rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Restart demo
      </button>
    </div>
  )
}
