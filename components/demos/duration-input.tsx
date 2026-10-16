"use client"

import { DurationInput } from "@/registry/default/duration-input/duration-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <DurationInput label="Time on task (hours)" unit="h" defaultValue="1.50" max={12 * 3600} />
      <DurationInput label="Call length" defaultValue="1:30" />
      <DurationInput label="Estimate" hoursPerDay={8} defaultValue="2d 4h" hint="Try 90m, 1:30:00 or 15h." max={5 * 8 * 3600} />
    </form>
  )
}
