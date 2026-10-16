"use client"

import * as React from "react"

import { SessionTimeout } from "@/registry/default/session-timeout/session-timeout"

export function Demo() {
  const [signedIn, setSignedIn] = React.useState(false)
  const [note, setNote] = React.useState("Demo timings: idle for 3 s and the warning opens, 15 s before sign-out.")

  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border bg-background p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Expense report</p>
        <span className="text-xs text-muted-foreground">{signedIn ? "Signed in as Priya" : "Signed out"}</span>
      </div>
      <textarea
        aria-label="Expense notes"
        defaultValue="Client dinner with Acme, 12 Oct. Taxi from airport, receipts attached…"
        rows={3}
        className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {note}
      </p>
      <button
        type="button"
        onClick={() => {
          setSignedIn((value) => !value)
          setNote(signedIn ? "You signed out." : "Now keep your mouse and keyboard still for 3 s.")
        }}
        className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {signedIn ? "Sign out" : "Sign in and go idle"}
      </button>
      <SessionTimeout
        disabled={!signedIn}
        timeout={18_000}
        warnBefore={15_000}
        announceAt={[15, 10, 5]}
        channel="bollard-ui-demo-session"
        onKeepAlive={() =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setNote("Session extended. Your draft is safe.")
              resolve()
            }, 500),
          )
        }
        onSignOut={() => {
          setSignedIn(false)
          setNote("You signed out.")
        }}
        onExpire={() => {
          setSignedIn(false)
          setNote("Signed out after inactivity.")
        }}
      />
    </div>
  )
}
