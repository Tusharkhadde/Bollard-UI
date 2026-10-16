"use client"

import * as React from "react"

import { MergeFieldCheck, type MergeRecipient } from "@/registry/default/merge-field-check/merge-field-check"

const first = ["Priya", "Rahul", "Ananya", "Vikram", "Sneha", "Arjun", "Meera", "Karan", "Divya", "Rohan", "Isha"]
const last = ["sharma", "mehta", "iyer", "rao", "patil", "nair", "joshi", "kapoor"]
const plans = ["Starter", "Pro", "Team"]

// 412 customers; 37 of them signed up at a kiosk with no name (a few hold a stray space).
const recipients: MergeRecipient[] = Array.from({ length: 412 }, (_, i) => ({
  email: `${first[i % first.length].toLowerCase()}.${last[i % last.length]}${i}@example.in`,
  first_name: i % 11 === 0 && i < 400 ? (i % 3 ? "" : " ") : first[i % first.length],
  plan: plans[i % plans.length],
  renewal_date: `${(i % 27) + 1} Nov`,
  account_manager: "Dana",
}))

export function Demo() {
  const [template, setTemplate] = React.useState(
    "Hi {{first_name}},\nYour {{plan}} plan renews on {{renewal_date}. Questions? Reply and {{acount_manager}} will help."
  )
  return <MergeFieldCheck value={template} onValueChange={setTemplate} recipients={recipients} />
}
