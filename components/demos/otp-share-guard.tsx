"use client"

import * as React from "react"

import { OtpShareGuard } from "@/registry/default/otp-share-guard/otp-share-guard"

const chip = "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-foreground aria-pressed:bg-accent"

export function Demo() {
  const [onCall, setOnCall] = React.useState(true)
  const [sharing, setSharing] = React.useState(false)
  const [sms, setSms] = React.useState(false)
  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Simulate">
        <button type="button" aria-pressed={onCall} onClick={() => setOnCall(!onCall)} className={chip}>On a call</button>
        <button type="button" aria-pressed={sharing} onClick={() => setSharing(!sharing)} className={chip}>Screen shared</button>
        <button type="button" aria-pressed={sms} onClick={() => setSms(!sms)} className={chip}>SMS view</button>
      </div>
      <OtpShareGuard
        code="482917"
        brand="Acme Bank"
        action={{ kind: "payment", amount: 24999, payee: "Croma Electronics" }}
        expected="login"
        onCall={onCall}
        screenSharing={sharing}
        variant={sms ? "sms" : "app"}
        expiresIn={300}
        onNotMe={() => new Promise((resolve) => setTimeout(resolve, 500))}
      />
    </div>
  )
}
