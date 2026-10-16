"use client"

import * as React from "react"

import { RecoveryCheck, type IssueId, type RecoveryState } from "@/registry/default/recovery-check/recovery-check"

const DAY = 86_400_000

export function Demo() {
  const [state, setState] = React.useState<RecoveryState>()
  React.useEffect(() => {
    const now = Date.now()
    setState({
      email: { value: "tushar.k@oldcollege.edu", confirmedAt: now - 400 * DAY },
      phone: { value: "+91 75077 38781", confirmedAt: now - 20 * DAY },
      factors: [{ type: "sms", phone: "+917507738781" }],
      backupCodesLeft: 1,
    })
  }, [])
  if (!state) return <div className="h-80 w-full max-w-md" />

  const fix = (issue: IssueId) =>
    new Promise<void>((resolve) => setTimeout(resolve, 600)).then(() => {
      const now = Date.now()
      setState((s) => s && {
        ...s,
        ...(issue === "stale-email" && { email: { ...s.email!, confirmedAt: now } }),
        ...(issue === "sms-same-phone" && { factors: [...s.factors, { type: "passkey" as const }] }),
        ...(issue === "codes-low" && { backupCodesLeft: 10 }),
      })
    })

  return <RecoveryCheck state={state} onFix={fix} />
}
