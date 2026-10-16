"use client"

import * as React from "react"

import { StaleAttachmentCheck, type StaleFile } from "@/registry/default/stale-attachment-check/stale-attachment-check"

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const NOW = at(14, 11)

const attached: StaleFile[] = [
  { id: "a1", name: "report_v2.pdf", modified: at(13, 18) },
  { id: "a2", name: "minutes_2026-10-03.docx", modified: at(3, 17) },
  { id: "a3", name: "Q3 budget.xlsx", modified: at(12, 10) },
]

const folder: StaleFile[] = [
  ...attached,
  { id: "n1", name: "report_v3_final.pdf", modified: at(14, 9, 40) },
  { id: "n2", name: "minutes_2026-10-10.docx", modified: at(10, 16) },
  { id: "n3", name: "notes.txt", modified: at(14, 8) },
]

export function Demo() {
  const [sent, setSent] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-3">
      <p className="truncate text-sm">
        <span className="text-muted-foreground">Subject: </span>Q3 report and minutes, 10 Oct
      </p>
      <StaleAttachmentCheck
        defaultValue={attached}
        nearby={folder}
        subject="Q3 report and minutes, 10 Oct"
        now={NOW}
        locale="en-IN"
        onSend={(files) => setSent(files.map((file) => file.name).join(", "))}
      />
      {sent && <p className="text-xs text-muted-foreground">Sent with {sent}</p>}
    </div>
  )
}
