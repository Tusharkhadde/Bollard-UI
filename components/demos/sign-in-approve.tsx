"use client"

import * as React from "react"

import { SignInApprove, type SignInRequest } from "@/registry/default/sign-in-approve/sign-in-approve"

export function Demo() {
  const [request, setRequest] = React.useState<SignInRequest>()
  const [log, setLog] = React.useState("")
  const start = () => {
    const now = Date.now()
    setLog("")
    setRequest({ location: "Lagos, Nigeria", unusualLocation: true, device: "Chrome on Windows", app: "Acme Admin", requestedAt: now, expiresAt: now + 120_000, recentRequests: 4 })
  }
  React.useEffect(start, [])
  if (!request) return <div className="h-96 w-full max-w-sm" />

  return (
    <div className="grid w-full max-w-sm gap-2">
      <SignInApprove
        key={String(request.requestedAt)}
        request={request}
        onApprove={(number) => new Promise((resolve) => setTimeout(() => resolve(number === "47"), 400))}
        onDeny={(reason) => setLog(`Denied (${reason}).`)}
        onSecure={() => setLog("Opening password reset…")}
      />
      <p className="flex items-center justify-between text-xs text-muted-foreground">
        <span aria-live="polite">{log || "The sign-in screen shows 47."}</span>
        <button type="button" onClick={start} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">Reset demo</button>
      </p>
    </div>
  )
}
