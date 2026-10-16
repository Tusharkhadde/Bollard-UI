"use client"

import * as React from "react"

import { NomineeCheck, type Nomination } from "@/registry/default/nominee-check/nominee-check"

// Opens with the common slip: shares that add to 90%, and a minor with no adult named to receive for her.
const start: Nomination = {
  mode: "simultaneous",
  nominees: [
    { id: "a", name: "Asha Rao", relation: "Spouse", share: 50 },
    { id: "b", name: "Ravi Rao", relation: "Son", share: 25 },
    { id: "c", name: "Meera Rao", relation: "Daughter", share: 15, minor: true },
  ],
}

export function Demo() {
  return <NomineeCheck holding="deposit" defaultValue={start} />
}
