"use client"

import * as React from "react"

import { cleanRows, RepeatRows, type RepeatField, type RepeatRow } from "@/registry/default/repeat-rows/repeat-rows"

const fields: RepeatField[] = [
  { name: "name", label: "Name", placeholder: "Full name" },
  { name: "email", label: "Email", placeholder: "name@company.com", type: "email" },
]

export function Demo() {
  const [guests, setGuests] = React.useState<RepeatRow[]>([
    { name: "Priya Sharma", email: "priya@acme.in" },
    { name: "Rahul Mehta", email: "rahul@acme.in" },
    { name: "", email: "" },
    { name: "Priya S", email: " Priya@Acme.in" },
  ])
  const count = cleanRows(guests, fields).length

  return (
    <form className="grid w-full max-w-md gap-4" onSubmit={(event) => event.preventDefault()}>
      <RepeatRows label="Guests" itemLabel="Guest" fields={fields} value={guests} onValueChange={setGuests} uniqueBy={["email"]} min={1} max={5} />
      <button type="submit" className="h-9 w-fit rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Send {count} {count === 1 ? "invite" : "invites"}
      </button>
    </form>
  )
}
