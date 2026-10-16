"use client"

import * as React from "react"

import { ReplyAllGuard, type ReplySource } from "@/registry/default/reply-all-guard/reply-all-guard"

const scenarios: Record<string, { label: string; subject: string; message: ReplySource }> = {
  thread: {
    label: "Big thread",
    subject: "Re: Q3 offsite venue",
    message: {
      from: '"Priya Shah" <priya@acme.com>',
      to: "all-staff@acme.com",
      cc: '"Sam Lee" <sam@northwind.io>, kai.ono@northwind.io, "Ravi Kumar" <ravi@acme.com>, meera.k@gmail.com',
    },
  },
  bcc: {
    label: "You were BCC'd",
    subject: "Re: Contract renewal",
    message: {
      from: '"Dana Reyes" <dana@acme.com>',
      to: '"Sam Lee" <sam@northwind.io>',
      cc: '"Ravi Kumar" <ravi@acme.com>',
    },
  },
}

export function Demo() {
  const [key, setKey] = React.useState<keyof typeof scenarios>("thread")
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  const scenario = scenarios[key]
  return (
    <div className="w-full max-w-md space-y-3">
      <div role="group" aria-label="Example" className="flex flex-wrap gap-1.5">
        {Object.entries(scenarios).map(([k, s]) => (
          <button key={k} type="button" aria-pressed={k === key} onClick={() => setKey(k as keyof typeof scenarios)} className="h-7 rounded-md border px-2.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-accent">
            {s.label}
          </button>
        ))}
      </div>
      <p className="truncate text-sm"><span className="text-muted-foreground">Reply all · </span>{scenario.subject}</p>
      <ReplyAllGuard
        key={key}
        message={scenario.message}
        me="tushar@acme.com"
        orgDomains={["acme.com"]}
        listSizes={{ "all-staff@acme.com": 1240 }}
        myLists={["all-staff@acme.com"]}
        returnFocusRef={bodyRef}
      />
      <textarea ref={bodyRef} aria-label="Reply" rows={3} placeholder="Write your reply…" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30" />
    </div>
  )
}
