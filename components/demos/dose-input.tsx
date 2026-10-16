"use client"

import { DoseInput } from "@/registry/default/dose-input/dose-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <DoseInput label="Warfarin" defaultValue="5.0mg" range={{ min: 1, max: 10, unit: "mg" }} />
      <DoseInput label="Levothyroxine" defaultValue="100 mg" range={{ min: 25, max: 200, unit: "mcg" }} />
      <DoseInput label="Insulin glargine" placeholder="10 units" range={{ min: 2, max: 80, unit: "units" }} />
    </form>
  )
}
