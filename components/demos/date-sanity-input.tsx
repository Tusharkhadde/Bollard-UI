"use client"

import { DateSanityInput } from "@/registry/default/date-sanity-input/date-sanity-input"

// A fixed "today" keeps the demo deterministic.
const TODAY = "2026-10-13"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <DateSanityInput label="Check-in" expect="future" today={TODAY} defaultValue="2062-11-08" />
      <DateSanityInput label="Client meeting" expect="future" warnWeekends today={TODAY} defaultValue="2026-10-18" />
      <DateSanityInput label="Expense date" expect="past" today={TODAY} defaultValue="2026-12-10" hint="The day on the receipt." />
    </form>
  )
}
