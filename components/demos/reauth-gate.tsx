"use client"

import * as React from "react"
import { Download, KeyRound, Trash2 } from "lucide-react"

import { ReauthGate } from "@/registry/default/reauth-gate/reauth-gate"

const row =
  "inline-flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"

export function Demo() {
  const [log, setLog] = React.useState("Demo password: bollard")
  const ref = React.useRef<HTMLDivElement>(null)

  // Open on the catch: a sensitive action was just clicked.
  React.useEffect(() => {
    const timer = setTimeout(() => ref.current?.querySelector<HTMLButtonElement>("[data-first]")?.click(), 30)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div ref={ref} className="grid w-full max-w-md gap-3">
      <ReauthGate
        methods={["password", "passkey", "pin"]}
        duration={2 * 60_000}
        verify={({ method, secret }) =>
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(method === "passkey" || secret === (method === "pin" ? "2468" : "bollard")), 500),
          )
        }
      >
        {(protect) => (
          <div className="grid gap-2 rounded-lg border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">Security</p>
            <button data-first type="button" className={row} onClick={() => protect("download your recovery codes", () => setLog("Recovery codes downloaded."))}>
              <Download aria-hidden className="size-4" /> Download recovery codes
            </button>
            <button type="button" className={row} onClick={() => protect("add an SSH key", () => setLog("SSH key “laptop” added."))}>
              <KeyRound aria-hidden className="size-4" /> Add SSH key
            </button>
            <button type="button" className={`${row} text-red-700 dark:text-red-400`} onClick={() => protect("remove a teammate's admin role", () => setLog("Admin role removed from Arjun."))}>
              <Trash2 aria-hidden className="size-4" /> Remove Arjun as admin
            </button>
          </div>
        )}
      </ReauthGate>
      <p aria-live="polite" className="text-center text-xs text-muted-foreground">{log}</p>
    </div>
  )
}
