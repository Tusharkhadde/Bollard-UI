"use client"

import * as React from "react"

import { PincodeInput, type PinPlace } from "@/registry/default/pincode-input/pincode-input"

// A pretend PIN directory in the shape createIndiaPostLookup returns, so the demo works offline.
const places: Record<string, PinPlace> = {
  "411039": { district: "Pune", state: "Maharashtra", areas: ["Bhosari", "Bhosari Gaon", "Dighi Camp"] },
  "400001": { district: "Mumbai", state: "Maharashtra", areas: ["Fort", "Mumbai GPO"] },
  "560001": { district: "Bengaluru", state: "Karnataka", areas: ["Bangalore GPO", "Vidhana Soudha"] },
}
const lookup = (pin: string) => new Promise<PinPlace | null>((resolve) => setTimeout(() => resolve(places[pin] ?? null), 300))

const states = ["Karnataka", "Maharashtra", "Delhi", "Tamil Nadu"]
const presets = [
  { label: "O for 0", value: "41103O" },
  { label: "US ZIP", value: "94103" },
  { label: "No such prefix", value: "541203" },
  { label: "Unknown PIN", value: "411999" },
]
const field = "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

export function Demo() {
  const [city, setCity] = React.useState("Mumbai")
  const [state, setState] = React.useState("Karnataka")
  const [pin, setPin] = React.useState("411039")
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <label htmlFor="demo-city" className="text-sm font-medium">City</label>
          <input id="demo-city" value={city} onChange={(e) => setCity(e.target.value)} className={field} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="demo-state" className="text-sm font-medium">State</label>
          <select id="demo-state" value={state} onChange={(e) => setState(e.target.value)} className={field}>
            {states.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <PincodeInput value={pin} onValueChange={setPin} lookup={lookup} state={state} onUseState={setState} city={city} onUseCity={setCity} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => setPin(p.value)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
