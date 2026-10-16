"use client"

import * as React from "react"

import { UpiIdInput, type UpiVerification } from "@/registry/default/upi-id-input/upi-id-input"

// A pretend UPI directory standing in for a validate-VPA call.
const directory: Record<string, string> = {
  "rohan.sharma@okaxis": "ROHAN SHARMA",
  "9876543210@ybl": "PRIYA MEHTA",
  "kumarstores@ybl": "RAVI VERMA",
}
const verify = (vpa: string) =>
  new Promise<UpiVerification>((resolve) => setTimeout(() => resolve(directory[vpa] ? { valid: true, name: directory[vpa] } : { valid: false }), 300))

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
      <UpiIdInput key={preset} label="Pay to UPI ID" defaultValue={value} expectedName={expectedName} verify={verify} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p, i) => (
          <button key={p.label} type="button" aria-pressed={i === preset} onClick={() => setPreset(i)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent aria-pressed:text-foreground">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
