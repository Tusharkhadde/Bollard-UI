"use client"

import * as React from "react"

import { AadhaarInput } from "@/registry/default/aadhaar-input/aadhaar-input"

const chip = "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
const samples = [
  ["A VID", "9183 6472 0581 7348"],
  ["Enrolment slip", "1001/12345/67890 15/01/2024 10:30:45"],
  ["Starts with 1", "1918 3627 0535"],
  ["Correct", "4918 3627 0535"],
] as const

export function Demo() {
  // Opens with two neighbouring digits swapped; masked, so only the check digit catches it.
  const [value, setValue] = React.useState("491836720535")
  const [accept, setAccept] = React.useState<"aadhaar" | "vid">("aadhaar")
  return (
    <div className="w-full max-w-sm space-y-3">
      <AadhaarInput value={value} onValueChange={setValue} accept={accept} onAcceptChange={setAccept} name="aadhaar" />
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">Try:</span>
        {samples.map(([label, sample]) => (
          <button key={label} type="button" className={chip} onClick={() => { setAccept("aadhaar"); setValue(sample) }}>{label}</button>
        ))}
      </div>
    </div>
  )
}
