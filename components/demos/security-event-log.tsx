"use client"

import * as React from "react"

import { SecurityEventLog, type SecurityEvent } from "@/registry/default/security-event-log/security-event-log"

// 14 Oct 2026, 11:00 AM in Pune. Overnight, someone signed in from a new device and started locking the owner out.
const NOW = Date.UTC(2026, 9, 14, 5, 30)
const ist = (day: number, hour: number, minute: number) => Date.UTC(2026, 9, day, hour, minute) - 330 * 60_000

const events: SecurityEvent[] = [
  { id: "e1", type: "sign_in", at: ist(14, 9, 5), device: "Safari on iPhone", location: "Near Pune, India", thisDevice: true },
  { id: "e2", type: "new_device", at: ist(14, 2, 10), device: "Chrome on Windows", location: "Near Lagos, Nigeria" },
  { id: "e3", type: "two_factor_off", at: ist(14, 2, 13), device: "Chrome on Windows" },
  { id: "e4", type: "recovery_changed", at: ist(14, 2, 16), device: "Chrome on Windows", detail: "Now t•••@proton.me" },
  { id: "e5", type: "api_key_created", at: ist(14, 2, 19), device: "Chrome on Windows", detail: "“deploy-bot”" },
  { id: "e6", type: "password_changed", at: ist(13, 18, 40), device: "Safari on iPhone", thisDevice: true },
  { id: "e7", type: "passkey_added", at: ist(12, 21, 2), device: "Safari on iPhone", thisDevice: true, detail: "iCloud Keychain" },
  { id: "e8", type: "sign_in", at: ist(11, 10, 30), device: "Firefox on Mac", location: "Near Pune, India" },
]

export function Demo() {
  const [log, setLog] = React.useState<string>()
  return (
    <div className="w-full max-w-md space-y-3">
      <SecurityEventLog
        events={events}
        timeZone="Asia/Kolkata"
        now={NOW}
        locale="en-IN"
        limit={6}
        requiredRemedies={["sign_out_all"]}
        onReport={(list, remedies) => new Promise<void>((resolve) => setTimeout(() => { setLog(`Secured: ${list.length} event(s) reported · ${remedies.map((r) => r.key).join(", ")}`); resolve() }, 600))}
        onConfirm={(list) => setLog(`Confirmed ${list.length} event(s)`)}
      />
      {log && <p className="text-xs text-muted-foreground">{log}</p>}
    </div>
  )
}
