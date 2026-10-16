"use client"

import * as React from "react"

import { RelativeDateInput } from "@/registry/default/relative-date-input/relative-date-input"

// A fixed Wednesday keeps the demo deterministic.
const TODAY = "2026-10-14"

export function Demo() {
  const [due, setDue] = React.useState<string | null>(null)
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <RelativeDateInput label="Invoice due" today={TODAY} expect="future" defaultValue="next Friday" onDateChange={setDue} />
      <RelativeDateInput label="Standup moved to" today={TODAY} defaultValue="this Monday" />
      <RelativeDateInput label="Team offsite" today={TODAY} defaultValue="in 3 weeks" />
      <p className="text-xs text-muted-foreground">
        Due date saved: <code className="font-mono text-foreground">{due ?? "nothing until you pick"}</code>. Today is Wed 14 Oct.
      </p>
    </form>
  )
}
