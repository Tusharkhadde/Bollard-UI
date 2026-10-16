"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { BccGuard, type Recipients } from "@/registry/default/bcc-guard/bcc-guard"

// A clinic newsletter pasted into To, the way 56 Dean Street's went out in 2015. All addresses are fictional.
const FIRST = ["alex", "sam", "jordan", "chris", "taylor", "jamie", "robin", "casey", "morgan", "drew", "lee", "ash"]
const LAST = ["morgan", "okafor", "patel", "nguyen", "byrne", "kowalski", "silva", "haddad", "fraser", "lindqvist", "osei", "reyes"]
const HOSTS = ["gmail.com", "outlook.com", "icloud.com", "yahoo.co.uk", "proton.me", "btinternet.com"]

const list = Array.from({ length: 781 }, (_, i) => {
  const f = FIRST[i % 12]
  const l = LAST[(i * 5) % 12]
  const host = HOSTS[(i >> 1) % 6]
  // Most addresses carry a name; a few are anonymous.
  const local = i % 15 === 14 ? `mail${i}x` : i % 3 === 0 ? `${f[0]}${l}${i}` : `${f}.${l}${i}`
  return i === 0 ? "Alex Morgan <alex.morgan@gmail.com>" : `${local}@${host}`
})

const START: Recipients = { to: list, cc: [], bcc: [] }

export function Demo() {
  const [subject, setSubject] = React.useState("Option E: your HIV clinic news for September")
  const [sent, setSent] = React.useState<string | null>(null)

  if (sent) {
    return (
      <div className="grid w-full max-w-md gap-2">
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden className="size-4" />
          {sent}
        </p>
        <button type="button" onClick={() => setSent(null)} className="w-fit text-xs text-muted-foreground underline underline-offset-2">
          Start again
        </button>
      </div>
    )
  }

  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="grid gap-1.5">
        <label htmlFor="bcc-demo-subject" className="text-xs font-medium text-muted-foreground">
          Subject
        </label>
        <input
          id="bcc-demo-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </div>
      <BccGuard
        defaultValue={START}
        internalDomains={["soho-clinic.nhs.uk"]}
        from="news@soho-clinic.nhs.uk"
        subject={subject}
        onSend={async (v, mode) => {
          await new Promise((r) => setTimeout(r, 600))
          setSent(mode === "individually" ? `Queued ${list.length} separate emails, one per person.` : `Sent to ${v.to.length + v.cc.length + v.bcc.length} recipients.`)
        }}
      />
    </div>
  )
}
