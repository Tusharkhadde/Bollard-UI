"use client"

import * as React from "react"

import { RollbackPreview } from "@/registry/default/rollback-preview/rollback-preview"

export function Demo() {
  const [times, setTimes] = React.useState<{ current: number; target: number; v41: number }>()
  const [done, setDone] = React.useState(false)
  React.useEffect(() => {
    const now = Date.now()
    setTimes({ current: now - 40 * 60_000, target: now - 3 * 86_400_000, v41: now - 26 * 3_600_000 })
  }, [])

  if (!times) return <div className="h-96 w-full max-w-md" />
  if (done)
    return (
      <div className="flex w-full max-w-md items-center justify-between rounded-xl border px-4 py-3 text-sm">
        <span>Production is on v40.</span>
        <button type="button" onClick={() => setDone(false)} className="rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
          Reset demo
        </button>
      </div>
    )

  return (
    <RollbackPreview
      className="max-w-md"
      current={{ id: "v42", deployedAt: times.current, label: "Gift notes" }}
      target={{ id: "v40", deployedAt: times.target, label: "Pricing page v2" }}
      skipped={[{ id: "v41", deployedAt: times.v41 }]}
      reverts={["Gift notes at checkout (v42)", "Faster search index (v41)", "PAYMENTS_TIMEOUT 8s → 20s"]}
      stays={["Migration 0193 dropped orders.legacy_code", "1,204 webhooks already sent to Shiprocket"]}
      written={[{ label: "orders", count: 318, note: "v40 ignores their gift notes" }, { label: "sign-ups", count: 52 }]}
      onConfirm={() => new Promise<void>((resolve) => setTimeout(() => (setDone(true), resolve()), 700))}
    />
  )
}
