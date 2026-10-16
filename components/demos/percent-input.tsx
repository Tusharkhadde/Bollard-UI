"use client"

import { PercentInput } from "@/registry/default/percent-input/percent-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <PercentInput label="Tip" defaultValue={0.15} base={2000} currency="INR" />
      <PercentInput label="Discount" defaultValue={150} />
      <PercentInput label="Fund expense ratio" basisPoints defaultUnit="bps" likelyMin={0} defaultValue={0.0025} base={1000000} currency="INR" />
    </form>
  )
}
