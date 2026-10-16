"use client"

import * as React from "react"

import { ListPaste } from "@/registry/default/list-paste/list-paste"

const pasted = `Email
"Shah, Priya" <priya@acme.in>; rahul@acme.in
anil.mehta@acme.in
Rahul@ACME.in
sneha@acme
mailto:dev@acme.in, kiran@acme.in`

export function Demo() {
  const [sent, setSent] = React.useState<string[]>()

  return (
    <div className="grid w-full max-w-sm gap-3">
      <ListPaste label="Invite teammates" defaultValue={pasted} onImport={setSent} importLabel="Send {count} invites" />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {sent ? `Invited ${sent.join(", ")}.` : "Paste from a spreadsheet, an Outlook To: line or a CSV."}
      </p>
    </div>
  )
}
