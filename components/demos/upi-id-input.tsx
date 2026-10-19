"use client"

import * as React from "react"

import { UpiIdInput } from "@/registry/default/upi-id-input/upi-id-input"
import { verifyDemoUpi } from "./upi-id-input-directory"

const presets = [
  { label: "Typo'd handle", value: "rohan.sharma@okaxsi", expectedName: "Rohan Sharma" },
  { label: "+91 number", value: "919876543210@ybl", expectedName: "Priya Mehta" },
  { label: "Swapped QR", value: "upi://pay?pa=kumarstores@ybl&pn=Kumar%20Stores&am=450" },
  { label: "@gpay", value: "rohan.sharma@gpay", expectedName: "Rohan Sharma" },
]

export function Demo() {
  const [preset, setPreset] = React.useState(0)
  const { value, expectedName } = presets[preset]
  return (
    <div className="grid w-full max-w-sm gap-3">
      <UpiIdInput key={preset} label="Pay to UPI ID" defaultValue={value} expectedName={expectedName} verify={verifyDemoUpi} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p, i) => (
          <button key={p.label} type="button" aria-pressed={i === preset} onClick={() => setPreset(i)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground">
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">This preview checks three sample IDs only. Your UPI ID is not sent anywhere or checked against a live directory.</p>
    </div>
  )
}
