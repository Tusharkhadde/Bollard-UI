"use client"

import * as React from "react"

import { NamesakeSelect, type NamesakeOption } from "@/registry/default/namesake-select/namesake-select"

const patients: NamesakeOption[] = [
  { id: "p-1042", label: "Ravi Kumar", details: { "Date of birth": "12 Mar 1988", City: "Pune", MRN: "1042" } },
  { id: "p-1187", label: "Ravi Kumar", details: { "Date of birth": "3 Jul 1991", City: "Mumbai", MRN: "1187" } },
  { id: "p-0931", label: "Meera Iyer", details: { "Date of birth": "21 Jan 1975", City: "Pune", MRN: "0931" } },
  { id: "p-1203", label: "KUMAR, Ravi", details: { "Date of birth": "30 Nov 1962", City: "Nashik", MRN: "1203" } },
  { id: "p-0877", label: "Anita Desai", details: { "Date of birth": "8 Aug 1990", City: "Pune" } },
  { id: "p-0878", label: "Anita Desai", details: { "Date of birth": "8 Aug 1990", City: "Pune" } },
  { id: "p-0412", label: "Arjun Mehta", details: { "Date of birth": "17 Feb 2001", City: "Thane", MRN: "0412" } },
]

export function Demo() {
  const [patient, setPatient] = React.useState<string | null>("p-1042")

  return (
    <div className="grid w-full max-w-sm gap-3">
      <NamesakeSelect label="Attach lab report to patient" options={patients} value={patient} onValueChange={setPatient} />
      <p className="text-xs text-muted-foreground">
        Three records are called Ravi Kumar. Clear the field and pick one, or try Anita Desai.
      </p>
    </div>
  )
}
