"use client"

import * as React from "react"

import { IfscInput } from "@/registry/default/ifsc-input/ifsc-input"
import { lookupDemoIfsc } from "./ifsc-input-directory"

const banks = ["ICICI Bank", "HDFC Bank", "Axis Bank", "Union Bank of India", "State Bank of India"]
const presets = [
  { label: "O for 0", value: "HDFCO001234" },
  { label: "AXIS prefix", value: "AXIS0000102" },
  { label: "O in branch", value: "UTIB0000IO2" },
  { label: "Valid Union IFSC", value: "UBIN0532207", bank: "Union Bank of India" },
]

export function Demo() {
  const [bank, setBank] = React.useState("ICICI Bank")
  const [ifsc, setIfsc] = React.useState(presets[0].value)
  return (
    <div className="grid w-full max-w-sm gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="demo-bank" className="text-sm font-medium">Payee&apos;s bank</label>
        <select
          id="demo-bank"
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {banks.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
      <IfscInput value={ifsc} onValueChange={setIfsc} lookup={lookupDemoIfsc} expectedBank={bank} onUseBank={(_, name) => setBank(name)} requiredRail="RTGS" />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => { setIfsc(p.value); if (p.bank) setBank(p.bank) }} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">This preview checks a few sample branches offline. Other IFSCs need a live lookup; they aren&apos;t assumed invalid.</p>
    </div>
  )
}
