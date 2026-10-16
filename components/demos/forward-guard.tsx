"use client"

import * as React from "react"

import { ForwardGuard, type ThreadMessage } from "@/registry/default/forward-guard/forward-guard"

const me = { name: "Priya Sharma", email: "priya@acme.com" }
const vendor = { name: "Rahul Mehta", email: "rahul@kaveri-supplies.in" }

const thread: ThreadMessage[] = [
  {
    id: "m1",
    from: vendor,
    to: [me.email],
    date: "2 Oct",
    body: "Sharing our quote for the 400 office chairs. Happy to discuss volume pricing.",
    attachments: [{ id: "a1", name: "Kaveri_quote_v1.pdf", size: "180 KB" }],
  },
  {
    id: "m2",
    from: { name: "Arjun (Finance)", email: "arjun@acme.com" },
    to: [me.email],
    date: "3 Oct",
    internal: true,
    body: "Don't go above ₹4.2L. Their v1 is padded by ~15%, we have a cheaper bid.",
    attachments: [{ id: "a2", name: "bid_comparison.xlsx", size: "42 KB" }],
  },
  {
    id: "m3",
    from: me,
    to: [vendor.email],
    cc: ["meera.k@acme.com"],
    date: "4 Oct",
    body: "Thanks Rahul. Could you get closer to ₹3.9L? Meera (meera.k@acme.com) runs facilities.",
  },
  {
    id: "m4",
    from: vendor,
    to: [me.email],
    cc: ["dana@northwind.io"],
    date: "9 Oct",
    body: "Revised quote attached at ₹4.05L, delivery in 3 weeks. Looping in Dana from our logistics partner.",
    attachments: [{ id: "a3", name: "Kaveri_quote_v2.pdf", size: "184 KB" }],
  },
]

export function Demo() {
  const [sent, setSent] = React.useState("")
  return (
    <div className="grid w-full max-w-lg gap-2">
      <p className="text-xs text-muted-foreground">
        Forwarding <span className="font-medium text-foreground">“Office chairs quote”</span> to dana@northwind.io
      </p>
      <ForwardGuard
        messages={thread}
        recipients={["dana@northwind.io"]}
        self={me.email}
        onForward={(s) => new Promise<void>((done) => setTimeout(() => (setSent(`Forwarded ${s.messageIds.length} messages, ${s.attachmentIds.length} files.`), done()), 600))}
      />
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">{sent}</p>
    </div>
  )
}
