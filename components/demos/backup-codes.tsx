"use client"

import * as React from "react"

import { BackupCodes } from "@/registry/default/backup-codes/backup-codes"

const codes = ["4F9K-2M7Q", "8XWN-3PDR", "T6HC-9VJA", "2RBE-K5YM", "Q7ZD-4NTS", "M3UF-8GXK", "W9PA-6CRE", "H2KV-7DQN", "B5TM-3WYF", "N8JR-2EHU"]

export function Demo() {
  const [done, setDone] = React.useState(false)
  return done ? (
    <div className="flex w-full max-w-md items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">Two-step sign-in is on, and your codes are saved.</span>
      <button type="button" onClick={() => setDone(false)} className="rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Reset demo
      </button>
    </div>
  ) : (
    <BackupCodes codes={codes} account="Acme · tushar@example.com" fileName="acme-recovery-codes.txt" warnOnLeave={false} onContinue={() => setDone(true)} />
  )
}
