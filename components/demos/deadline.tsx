"use client"

import { Deadline } from "@/registry/default/deadline/deadline"

// Tue 13 Oct 2026, 10:30 AM in Pune.
const NOW = Date.UTC(2026, 9, 13, 5, 0)

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <Deadline label="Tax filing" due={Date.UTC(2026, 9, 14, 4, 0)} ownerTimeZone="America/New_York" viewerTimeZone="Asia/Kolkata" now={NOW} />
      <Deadline label="Invoice #1042" due={Date.UTC(2026, 9, 12, 12, 30)} ownerTimeZone="Asia/Kolkata" viewerTimeZone="Asia/Kolkata" now={NOW} />
      <Deadline label="Client proposal" due={Date.UTC(2026, 9, 15, 11, 30)} ownerTimeZone="Europe/London" viewerTimeZone="Asia/Kolkata" now={NOW} />
      <Deadline label="Hackathon" due="2026-10-18" ownerTimeZone="Etc/GMT+12" viewerTimeZone="Asia/Kolkata" now={NOW} />
    </div>
  )
}
