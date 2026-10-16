"use client"

import { QrShare } from "@/registry/default/qr-share/qr-share"

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-2">
      <p className="text-sm font-medium">Table card for the launch event</p>
      <QrShare
        defaultValue="http://localhost:3000/rsvp/launch-2026?utm_source=print&utm_medium=qr&utm_campaign=launch-week-table-cards&utm_content=table-12"
        publicOrigin="https://acme.events"
      />
    </div>
  )
}
