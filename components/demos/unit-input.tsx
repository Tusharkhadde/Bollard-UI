"use client"

import { UnitInput } from "@/registry/default/unit-input/unit-input"

export function Demo() {
  return (
    <div className="grid w-full max-w-sm gap-4">
      <UnitInput label="Height" preset="height" defaultValue="70" />
      <UnitInput label="Weight" preset="weight" defaultValue="180" />
      <UnitInput label="Temperature" preset="temperature" defaultValue="98.6" />
      <UnitInput label="Height in metres" preset="height" defaultUnit="m" defaultValue={`5'9"`} />
    </div>
  )
}
