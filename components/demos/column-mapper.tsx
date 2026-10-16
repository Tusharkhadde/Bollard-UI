"use client"

import * as React from "react"

import { ColumnMapper, type ColumnTarget, type MapperColumn, type MapperField } from "@/registry/default/column-mapper/column-mapper"

const fields: MapperField[] = [
  { key: "first", label: "First name", kind: "first-name", required: true },
  { key: "last", label: "Last name", kind: "last-name" },
  { key: "email", label: "Email", kind: "email", required: true },
  { key: "phone", label: "Phone", kind: "phone" },
  { key: "joined", label: "Signed up", kind: "date", required: true },
  { key: "company", label: "Company" },
]

// A CRM export whose saved mapping no longer fits: the sheet's columns were reordered.
const columns: MapperColumn[] = [
  { heading: "First", values: ["Sharma", "Patil", "Iyer", "Khan", "Desai", "Rao"] },
  { heading: "Surname", values: ["Priya", "Rahul", "Ananya", "Vikram", "Sneha", "Arjun"] },
  { heading: "Email", values: ["+91 98220 11234", "+91 99870 45120", "+91 90110 77821", "+91 98500 31337"] },
  { heading: "Mobile", values: ["priya@acme.in", "rahul.p@kite.co", "ananya@bluepeak.io", "vikram@lumen.health"] },
  { heading: "Joined", values: ["03/04/2024", "11/02/2024", "07/09/2023", "01/12/2024"] },
  { heading: "Company", values: ["Acme Labs", "Kite & Co", "Bluepeak", "Lumen Health"] },
  { heading: "Organisation", values: ["Acme Labs", "Kite & Co", "Bluepeak", "Lumen Health"] },
]

const saved: ColumnTarget[] = [
  { field: "first" }, { field: "last" }, { field: "email" }, { field: "phone" }, { field: null }, { field: "company" }, { field: "company" },
]

export function Demo() {
  const [done, setDone] = React.useState<string>()
  return (
    <div className="grid w-full max-w-md gap-2">
      <ColumnMapper columns={columns} fields={fields} defaultValue={saved} onContinue={(m) => setDone(`Mapped ${m.filter((x) => x.field).length} columns.`)} />
      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">{done}</p>
    </div>
  )
}
