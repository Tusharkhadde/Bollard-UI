"use client"

import * as React from "react"

import { OutOfOfficeCheck, type AutoReply } from "@/registry/default/out-of-office-check/out-of-office-check"

const NOW = new Date("2026-10-14T13:30:00Z") // Wed 14 Oct, 7:00 PM in India

const REPLY: AutoReply = {
  start: "2026-10-17",
  end: "2026-10-27",
  message:
    "Hi! I'm on holiday in Goa and back on Monday 27 October. For anything urgent, call me on +91 98765 43210 or write to support@acme.com.",
  audience: "everyone",
}

export function Demo() {
  const [reply, setReply] = React.useState(REPLY)

  return (
    <OutOfOfficeCheck
      value={reply}
      onValueChange={setReply}
      platform="gmail"
      timeZone="Asia/Kolkata"
      now={NOW}
      organization="Acme"
      fallbackContact="support@acme.com"
      onSave={() => new Promise<void>((resolve) => setTimeout(resolve, 600))}
    />
  )
}
