"use client"

import * as React from "react"

import { LinkAccessCheck, type DocLink, type LinkAccess, type LinkFix, type Recipient } from "@/registry/default/link-access-check/link-access-check"

const recipients: Recipient[] = [
  { email: "ravi@acme.com", name: "Ravi Kumar" },
  { email: "sam@northwind.io", name: "Sam Lee" },
]

// A stand-in for the Drive / Figma APIs, keyed by the document key LinkAccessCheck reports.
const initial: Record<string, LinkAccess> = {
  "google:1Q3planXb7Ue9TkR2": { title: "Q3 launch plan", general: "restricted", canManage: true, people: { "sam@northwind.io": "view" } },
  "figma:Kp8PricingMock": { title: "Pricing page mock", general: "anyone", generalRole: "edit", canManage: true },
  "google:1BudgetSheetZx4Lm": { title: "Vendor budget", general: "organization", canManage: false, ownerName: "Dana" },
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function Demo() {
  const db = React.useRef(structuredClone(initial))
  const [text, setText] = React.useState(
    "Hi both,\r\nPlan: https://docs.google.com/document/d/1Q3planXb7Ue9TkR2/edit?usp=sharing\r\nMock: https://www.figma.com/design/Kp8PricingMock/Pricing\r\nBudget (Dana's): https://docs.google.com/spreadsheets/d/1BudgetSheetZx4Lm/edit.",
  )
  const [sent, setSent] = React.useState(false)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)

  const checkAccess = async (link: DocLink) => {
    await wait(200)
    return db.current[link.key] ?? { general: "restricted", canManage: false }
  }

  const onFix = async (fix: LinkFix) => {
    await wait(400)
    const doc = db.current[fix.link.key]
    if (fix.type === "grantView") for (const e of fix.emails) doc.people = { ...doc.people, [e]: "view" }
    if (fix.type === "companyOnly") {
      doc.general = "organization"
      for (const e of fix.alsoGrant) doc.people = { ...doc.people, [e]: "view" }
    }
    return fix.type === "requestAccess" ? undefined : { ...doc }
  }

  return (
    <div className="w-full max-w-md space-y-3">
      <p className="truncate text-sm"><span className="text-muted-foreground">To </span>Ravi Kumar, Sam Lee (northwind.io)</p>
      <textarea ref={bodyRef} aria-label="Message" rows={4} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30" />
      <LinkAccessCheck text={text} recipients={recipients} orgDomains={["acme.com"]} checkAccess={checkAccess} delay={150} onFix={onFix} returnFocusRef={bodyRef} onSend={() => setSent(true)} />
      {sent && <p className="text-xs text-muted-foreground">Sent.</p>}
    </div>
  )
}
