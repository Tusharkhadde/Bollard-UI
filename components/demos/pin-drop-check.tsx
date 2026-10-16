"use client"

import * as React from "react"

import { PinDropCheck, type LatLng, type PinSurface } from "@/registry/default/pin-drop-check/pin-drop-check"

const address = "Flat 302, Lotus Residency, Baner Road, Pune 411045"
const addressPoint = { lat: 18.559, lng: 73.7868 }

// Three places a thumb might drop the pin, and what a real geo helper would say about each.
const SPOTS: { label: string; point: LatLng; surface: PinSurface }[] = [
  { label: "Highway", point: { lat: 18.5662, lng: 73.7741 }, surface: "highway" },
  { label: "River", point: { lat: 18.5528, lng: 73.8015 }, surface: "water" },
  { label: "Gate", point: { lat: 18.5593, lng: 73.7871 }, surface: "land" },
]
const classify = (p: LatLng) => SPOTS.find((s) => s.point.lat === p.lat && s.point.lng === p.lng)?.surface ?? "land"

export function Demo() {
  const [pin, setPin] = React.useState<LatLng>(SPOTS[0].point)
  const [choice, setChoice] = React.useState<"pin" | "address" | null>(null)
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div role="group" aria-label="Move the pin (demo)" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        Drop pin at
        {SPOTS.map((s) => (
          <button
            key={s.label}
            type="button"
            aria-pressed={pin === s.point}
            onClick={() => {
              setPin(s.point)
              setChoice(null) // a new pin needs a fresh answer
            }}
            className="h-7 rounded-md border px-2 font-medium text-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent"
          >
            {s.label}
          </button>
        ))}
      </div>
      <PinDropCheck
        pin={pin}
        address={address}
        addressPoint={addressPoint}
        pincode="411045"
        pincodeCenter={{ lat: 18.5603, lng: 73.7853 }}
        pincodeRadius={1500}
        accuracy={30}
        classify={classify}
        value={choice}
        onValueChange={setChoice}
      />
    </div>
  )
}
