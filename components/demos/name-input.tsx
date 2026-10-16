"use client"

import { NameFields, NameInput } from "@/registry/default/name-input/name-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-3" onSubmit={(event) => event.preventDefault()}>
      <NameInput label="Account holder" defaultValue="PRIYA sharma" />
      <NameFields defaultValue={{ first: "Sharma", last: "Priya" }} />
      <NameInput label="Nominee" placeholder="maria de la cruz" hint="Try sean o'brien or anna van der berg." />
    </form>
  )
}
