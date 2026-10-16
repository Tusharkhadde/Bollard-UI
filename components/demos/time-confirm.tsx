"use client"

import { TimeConfirm } from "@/registry/default/time-confirm/time-confirm"

const zones = ["America/New_York", "Europe/London", "Asia/Tokyo"]

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-4">
      <TimeConfirm label="Launch call" date="2026-10-13" timeZone="Asia/Kolkata" zones={zones} defaultValue="12" />
      <TimeConfirm label="Release freeze" date="2026-10-13" timeZone="Asia/Kolkata" zones={zones} defaultValue="11:30 pm" />
      <TimeConfirm label="Server maintenance" date="2026-03-08" timeZone="America/New_York" zones={["Asia/Kolkata"]} defaultValue="2:30 am" />
      <TimeConfirm label="Nightly backup" date="2026-11-01" timeZone="America/New_York" defaultValue="1:30 am" />
    </div>
  )
}
