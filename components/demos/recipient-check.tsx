"use client"

import * as React from "react"

import { RecipientCheck, type Recipient } from "@/registry/default/recipient-check/recipient-check"

const contacts = [
  { name: "Priya Sharma", email: "priya.sharma@acme.com" },
  { name: "Rahul Mehta", email: "rahul@acme.com" },
  { name: "Dana Reyes", email: "dana@northwind.io" },
]

const initial: Recipient[] = [
  { name: "Rahul Mehta", email: "rahul@acme.com" },
  { name: "Priya Sharma", email: "priya.sharma@gmail.com" },
  { email: "finance@acrne.com" },
  { email: "dana@northwind.io" },
  { email: "vikram@gmial.com" },
]

const team = Array.from({ length: 44 }, (_, i) => ({ email: `team${i + 1}@acme.com` }))

export function Demo() {
  const [recipients, setRecipients] = React.useState<Recipient[]>(initial)

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <RecipientCheck
        label="To"
        value={recipients}
        onValueChange={setRecipients}
        internalDomains={["acme.com"]}
        contacts={contacts}
        warnAt={25}
      />
      <button
        type="button"
        onClick={() => setRecipients((current) => [...current, ...team.filter((t) => !current.some((c) => c.email === t.email))])}
        className="self-start rounded-md border bg-background px-3 py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Add the whole team list
      </button>
    </div>
  )
}
