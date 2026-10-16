"use client"

import * as React from "react"
import { ScreenShare } from "lucide-react"

import { PresenterModeProvider, PresenterToggle, PresentingBar, Sensitive } from "@/registry/default/presenter-mode/presenter-mode"

function ShareButton() {
  const [stream, setStream] = React.useState<MediaStream>()
  const toggle = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream.getTracks().forEach((track) => track.dispatchEvent(new Event("ended")))
      return setStream(undefined)
    }
    try {
      setStream(await navigator.mediaDevices.getDisplayMedia({ video: true }))
    } catch {
      // Picker dismissed.
    }
  }
  return (
    <button type="button" onClick={() => void toggle()} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium shadow-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30">
      <ScreenShare aria-hidden className="size-4" />
      {stream ? "Stop sharing" : "Share screen"}
    </button>
  )
}

const rows: [string, React.ReactNode][] = [
  ["Email", <Sensitive key="e" kind="email">ananya.rao@northwind.in</Sensitive>],
  ["Monthly spend", <Sensitive key="a" kind="amount">₹48,200.00</Sensitive>],
  ["API key", <Sensitive key="k" kind="key" className="font-mono text-xs">sk_live_51Hc9fQ2xT7</Sensitive>],
]

export function Demo() {
  return (
    <PresenterModeProvider defaultValue>
      <div className="grid w-full max-w-sm gap-3">
        <PresentingBar />
        <div className="rounded-xl border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <PresenterToggle />
            <ShareButton />
          </div>
          <dl className="grid gap-2.5 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="font-medium">Ananya Rao</dd>
            </div>
            {rows.map(([term, value]) => (
              <div key={term} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{term}</dt>
                <dd className="min-w-0 truncate tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </PresenterModeProvider>
  )
}
