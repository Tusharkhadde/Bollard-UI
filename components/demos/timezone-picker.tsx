"use client"

import { TimezonePicker } from "@/registry/default/timezone-picker/timezone-picker"

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <TimezonePicker label="Meeting time zone" defaultValue="Europe/London" deviceTimeZone="Asia/Kolkata" />
      <p className="text-xs text-muted-foreground">Try typing IST, PST or MST.</p>
    </div>
  )
}
