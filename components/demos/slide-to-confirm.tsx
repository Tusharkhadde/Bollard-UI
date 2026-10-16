"use client"

import * as React from "react"

import { SlideToConfirm } from "@/registry/default/slide-to-confirm/slide-to-confirm"

export function Demo() {
  const [log, setLog] = React.useState("A tap or a short swipe won't pay. Drag all the way.")

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      <SlideToConfirm
        label="Slide to pay ₹499"
        pendingLabel="Paying…"
        confirmedLabel="Paid ₹499"
        resetAfter={2500}
        onConfirm={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setLog("Payment sent to Chai Point.")
              resolve()
            }, 900),
          )
        }
      />
      <SlideToConfirm
        variant="destructive"
        size="sm"
        label="Slide to end session"
        confirmedLabel="Session ended"
        resetAfter={2500}
        onConfirm={() => setLog("Session ended on all devices.")}
      />
      <p aria-live="polite" className="text-center text-xs text-muted-foreground">
        {log}
      </p>
    </div>
  )
}
