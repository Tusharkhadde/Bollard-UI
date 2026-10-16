"use client"

import { SpellOut } from "@/registry/default/spell-out/spell-out"

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-6">
      <SpellOut label="Booking reference" value="K5O1ZB" />
      {/* The "ѕ" below is Cyrillic, pasted from a chat message. */}
      <SpellOut label="Guest Wi-Fi password" value="Lounge-5Gueѕt" defaultView="phonetic" />
    </div>
  )
}
