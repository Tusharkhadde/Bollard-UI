"use client"

import { DobInput } from "@/registry/default/dob-input/dob-input"

export function Demo() {
  return (
    <form className="grid w-full max-w-sm gap-4" onSubmit={(event) => event.preventDefault()}>
      <DobInput label="Your date of birth" hint="For example, 27 3 1990" defaultValue="2026-03-14" today="2026-10-13" />
      <DobInput label="Account holder's date of birth" hint="Try 23 4 1990, or paste 04/11/1990." minAge={18} defaultValue="2009-01-20" today="2026-10-13" />
    </form>
  )
}
