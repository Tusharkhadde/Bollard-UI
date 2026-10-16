"use client"

import { CardExpiryInput } from "@/registry/default/card-expiry-input/card-expiry-input"

// Fixed dates keep the demo deterministic.
const today = new Date(2026, 9, 13)
const renewsOn = new Date(2027, 0, 12)

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
      <CardExpiryInput label="Expiry date" defaultValue="28/10" today={today} />
      <CardExpiryInput label="Card for Pro plan" defaultValue="12/26" today={today} renewsOn={renewsOn} />
    </form>
  )
}
