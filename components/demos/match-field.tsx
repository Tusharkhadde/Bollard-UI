"use client"

import * as React from "react"

import { MatchField } from "@/registry/default/match-field/match-field"

export function Demo() {
  const [ready, setReady] = React.useState(false)

  return (
    <form className="grid w-full max-w-sm gap-4" onSubmit={(event) => event.preventDefault()}>
      {/* Two digits swapped near the end: the classic slip when copying from a passbook. */}
      <MatchField
        kind="account"
        defaultValue="50100234567812"
        defaultConfirmValue="50100234567182"
        hint="Digits only. It's hidden once you move on."
        onMatchChange={setReady}
      />
      <button
        type="submit"
        disabled={!ready}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Add beneficiary
      </button>
    </form>
  )
}
