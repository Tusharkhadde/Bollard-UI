"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { MrzPasteInput } from "@/registry/default/mrz-paste-input/mrz-paste-input"

// ICAO's fictional "Utopia" specimen (Doc 9303), re-dated so the passport is still valid.
const LINE1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
const LINE2 = "L898902C36UTO7408122F3104150ZE184226B<<<<<16"
const SAMPLES = [
  { label: "Phone scan", text: `${LINE1.slice(0, 30)}KK${LINE1.slice(32, 37)}K${LINE1.slice(38)}\r\n${LINE2.replace("740812", "74O812")}` },
  { label: "Typed by hand", text: `${LINE1}\n${LINE2.replace("L898902C3", "L8989O2C3")}` },
  { label: "Old passport", text: `${LINE1}\nL898902C36UTO7408122F1204159ZE184226B<<<<<10` },
]
const TODAY = new Date(Date.UTC(2026, 9, 14))

export function Demo() {
  const [text, setText] = React.useState(SAMPLES[0].text)
  return (
    <div className="grid w-full max-w-md gap-3">
      <div role="group" aria-label="Sample" className="flex flex-wrap gap-1.5">
        {SAMPLES.map((s) => (
          <button key={s.label} type="button" aria-pressed={text === s.text} onClick={() => setText(s.text)}
            className={cn("h-8 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", text === s.text ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent")}>
            {s.label}
          </button>
        ))}
      </div>
      <MrzPasteInput value={text} onValueChange={setText} today={TODAY} />
    </div>
  )
}
