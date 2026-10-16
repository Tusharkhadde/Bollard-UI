"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { PassengerNameInput, type IdName, type PassengerName } from "@/registry/default/passenger-name-input/passenger-name-input"

const CASES: { id: string; label: string; idName?: IdName; value: PassengerName; format?: "repeat" | "fnu" }[] = [
  { id: "title", label: "Title + middle name", idName: { given: "Tushar Satish", surname: "Khadde" }, value: { title: "", given: "Mr Tushar", surname: "Khadde" } },
  { id: "single", label: "One-name ID", value: { title: "MS", given: "Lakshmi", surname: "" } },
  { id: "umlaut", label: "Umlaut", idName: { given: "Jürgen", surname: "Müller" }, value: { title: "MR", given: "Müller", surname: "Jürgen" } },
]

export function Demo() {
  const [pick, setPick] = React.useState(CASES[0])
  const [name, setName] = React.useState(pick.value)
  return (
    <div className="grid w-full max-w-md gap-4">
      <div role="group" aria-label="Example passenger" className="flex flex-wrap gap-1.5">
        {CASES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={pick.id === c.id}
            onClick={() => {
              setPick(c)
              setName(c.value)
            }}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
              pick.id === c.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <PassengerNameInput key={pick.id} value={name} onValueChange={setName} idName={pick.idName} singleNameFormat={pick.format} messages={{ legend: "Adult 1 · as on passport" }} />
    </div>
  )
}
