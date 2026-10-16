"use client"

import * as React from "react"
import { Bell, X } from "lucide-react"

import { PermissionPreAsk, type PermissionResult } from "@/registry/default/permission-pre-ask/permission-pre-ask"

const prompt = async () => "prompt" as const
const blocked = async () => "denied" as const

/** Stands in for the browser's own prompt so the demo never touches real permissions. */
export function Demo() {
  const [pending, setPending] = React.useState<(result: PermissionResult) => void>()
  const request = React.useCallback(
    () => new Promise<PermissionResult>((resolve) => setPending(() => (result: PermissionResult) => {
      setPending(undefined)
      resolve(result)
    })),
    [],
  )

  return (
    <div className="grid w-full max-w-sm gap-3">
      {pending && (
        <div role="dialog" aria-label="Simulated browser prompt" className="grid gap-2 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-2"><Bell aria-hidden className="size-4" /> shop.example wants to show notifications</p>
            <button type="button" aria-label="Close prompt" onClick={() => pending("dismissed")} className="grid size-6 place-items-center rounded-md hover:bg-accent"><X aria-hidden className="size-3.5" /></button>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => pending("denied")} className="h-8 rounded-md border px-3 font-medium hover:bg-accent">Block</button>
            <button type="button" onClick={() => pending("granted")} className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground">Allow</button>
          </div>
        </div>
      )}
      <PermissionPreAsk
        permission="notifications"
        reason="Only when your order ships or a delivery is running late. No offers, and you can turn it off anytime."
        query={prompt}
        request={request}
        browser="chrome"
      />
      <PermissionPreAsk
        permission="geolocation"
        reason="Location finds the nearest pickup point. You can also type a pincode instead."
        query={blocked}
        browser="chrome"
      />
    </div>
  )
}
