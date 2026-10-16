"use client"

import * as React from "react"

import { ImportPreview, type ImportField } from "@/registry/default/import-preview/import-preview"

const fields: ImportField[] = [
  { key: "name", label: "Name", required: true, aliases: ["Full name", "Contact name"] },
  { key: "email", label: "Email", required: true, type: "email", aliases: ["E-mail", "Email address"] },
  { key: "phone", label: "Phone", type: "phone", aliases: ["Mobile", "Phone number"] },
  { key: "company", label: "Company", aliases: ["Organisation", "Organization"] },
]

const FIRST = ["Priya", "Rahul", "Ananya", "Vikram", "Sneha", "Arjun", "Meera", "Kabir", "Isha", "Rohan", "Diya", "Aarav"]
const LAST = ["Sharma", "Patil", "Iyer", "Khan", "Desai", "Rao", "Kulkarni", "Mehta", "Nair", "Joshi", "Gupta"]
const ORGS = ["Acme Labs", "Bluepeak", "Northwind", "Kite & Co", "Lumen Health"]

// A real-looking export: a title line, headings, 419 contacts and a few problems.
const heading = ["Full name", "E-mail", "Contact", "Organisation"]
const contacts = Array.from({ length: 412 }, (_, i) => {
  const first = FIRST[i % FIRST.length]
  const last = LAST[(i * 7) % LAST.length]
  return [`${first} ${last}`, `${first}.${last}${i}@example.com`.toLowerCase(), `+91 98${String(220000 + i * 37).padStart(8, "0")}`, ORGS[i % ORGS.length]]
})
const rows: string[][] = [
  ["Contacts export, October 2026", "", "", ""],
  heading,
  ...contacts.slice(0, 200),
  heading,
  ...contacts.slice(200),
  ["Neha Verma", "neha.verma@example", "+91 98765 43210", "Bluepeak"],
  ["Sanjay Rao", "sanjay rao@example.com", "+91 98111 22334", "Acme Labs"],
  [" Priya Sharma", "Priya.Sharma0@Example.com ", "+91 98002 20000", "Acme Labs"],
  ["Rahul Mehta", "rahul.mehta1@example.com", "+91 98002 20037", "Bluepeak"],
  ["Tara Bose", "tara.bose@example.com", "+91 98222 10101", "Northwind"],
  ["Dev Malhotra", "dev.malhotra@example.com", "+91 98333 20202", "Kite & Co"],
]
const existing = new Set(["tara.bose@example.com", "dev.malhotra@example.com"])

export function Demo() {
  const [done, setDone] = React.useState<number>()
  return (
    <div className="grid w-full max-w-md gap-3">
      <ImportPreview
        fileName="contacts-oct.csv"
        rows={rows}
        fields={fields}
        uniqueKey="email"
        isExisting={(key) => existing.has(key)}
        onImport={async (records) => {
          await new Promise((r) => setTimeout(r, 600))
          setDone(records.length)
        }}
      />
      {done !== undefined && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{done} contacts imported.</p>}
    </div>
  )
}
