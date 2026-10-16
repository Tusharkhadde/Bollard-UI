"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { ClickShield, type ShieldReason } from "@/registry/default/click-shield/click-shield"

const reasons: Record<ShieldReason, string> = {
  appeared: "it had only just appeared",
  moved: "a banner had just pushed it down",
  changed: "its label had just changed",
  returned: "you had only just come back to the tab",
  focused: "focus had just been moved onto it",
}

const button =
  "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function Demo() {
  const [banner, setBanner] = React.useState(false)
  const [log, setLog] = React.useState("A late banner is about to push these buttons down.")

  // The offer "loads" a moment after the page, like a real late banner.
  React.useEffect(() => {
    const timer = setTimeout(() => setBanner(true), 450)
    return () => clearTimeout(timer)
  }, [])

  const blocked = (label: string) => (reason: ShieldReason) => setLog(`Ignored a click on “${label}”: ${reasons[reason]}.`)

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Pro plan · ₹499/month</p>
        <button
          type="button"
          onClick={() => {
            setBanner(false)
            setTimeout(() => setBanner(true), 300)
          }}
          className="text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Replay the shift
        </button>
      </div>
      {banner && (
        <p className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-50">
          <Sparkles aria-hidden className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          Switch to yearly and save 2 months.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <ClickShield onBlockedClick={blocked("Cancel subscription")}>
          <button
            type="button"
            onClick={() => setLog("Subscription cancelled.")}
            className={`${button} bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60`}
          >
            Cancel subscription
          </button>
        </ClickShield>
        <ClickShield onBlockedClick={blocked("Keep plan")}>
          <button
            type="button"
            onClick={() => setLog("Kept your plan.")}
            className={`${button} border bg-background shadow-xs hover:bg-accent dark:border-input dark:bg-input/30`}
          >
            Keep plan
          </button>
        </ClickShield>
      </div>
      <p aria-live="polite" className="min-h-8 text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
