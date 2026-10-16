"use client"

import { DedupeKeyPicker } from "@/registry/default/dedupe-key-picker/dedupe-key-picker"

// A CRM export where the same people signed up twice, once from the app and once from the site.
const contacts = [
  { email: "priya@acme.in", name: "Priya Sharma", phone: "98220 11223", city: "Pune", signed_up: "2026-03-02 09:14" },
  { email: "Priya@Acme.in ", name: "Priya S.", phone: "98220 11223", city: "Pune", signed_up: "2026-06-18 17:40" },
  { email: "rahul.v@gmail.com", name: "Rahul Verma", phone: "99870 44556", city: "Mumbai", signed_up: "2026-01-11 12:02" },
  { email: "rahul.v@gmail.com", name: "Rahul Verma", phone: "91670 88990", city: "Mumbai", signed_up: "2026-08-29 08:55" },
  { email: "ananya@iyer.dev", name: "Ananya Iyer", phone: "", city: "Pune", signed_up: "2026-02-20 19:31" },
  { email: "kabir@mehta.co", name: "Kabir Mehta", phone: "90040 12345", city: "Pune", signed_up: "2026-04-07 10:10" },
  { email: "", name: "Sara Khan", phone: "", city: "Delhi", signed_up: "2026-05-15 14:22" },
  { email: "", name: "Dev Patel", phone: "", city: "Pune", signed_up: "2026-05-16 09:48" },
  { email: "meera@nair.in", name: "Meera Nair", phone: "98450 67890", city: "Bengaluru", signed_up: "2026-07-01 16:05" },
  { email: "arjun@rao.in", name: "Arjun Rao", phone: "97310 24680", city: "Pune", signed_up: "2026-07-23 11:37" },
]

export function Demo() {
  return (
    <DedupeKeyPicker
      rows={contacts}
      columns={["email", "phone", "city", "signed_up"]}
      defaultValue={["email", "signed_up"]}
      onApply={() => new Promise((resolve) => setTimeout(resolve, 600))}
    />
  )
}
