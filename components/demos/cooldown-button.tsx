"use client"

import * as React from "react"

import { CooldownButton, clearCooldown } from "@/registry/default/cooldown-button/cooldown-button"

const ID = "demo:resend-otp"

export function Demo() {
  const [run, setRun] = React.useState(0)
  const [sent, setSent] = React.useState(1)

  return (
    <div className="w-full max-w-xs space-y-3 rounded-xl border bg-background p-5">
      <div className="space-y-1">
        <p className="font-medium">Check your phone</p>
        <p className="text-sm text-muted-foreground">We sent a 6-digit code to +91 ••••• 04210. Codes sent: {sent}.</p>
      </div>
      <CooldownButton
        key={run}
        id={ID}
        startCoolingDown
        cooldowns={[10, 20, 40]}
        maxAttempts={4}
        reason="SMS can take up to a minute to arrive."
        onAction={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setSent((n) => n + 1)
              resolve()
            }, 600),
          )
        }
      >
        Resend code
      </CooldownButton>
      <p className="text-xs text-muted-foreground">
        Refresh the page: the countdown carries on.{" "}
        <button
          type="button"
          onClick={() => {
            clearCooldown(ID)
            setSent(1)
            setRun((n) => n + 1)
          }}
          className="rounded-sm underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Reset demo
        </button>
      </p>
    </div>
  )
}
