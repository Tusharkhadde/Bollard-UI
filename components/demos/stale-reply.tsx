"use client"

import * as React from "react"

import { StaleReply, type ThreadMessage } from "@/registry/default/stale-reply/stale-reply"

const NOW = Date.UTC(2026, 9, 13, 9, 0)
const H = 3_600_000
const at = (hoursAgo: number) => NOW - hoursAgo * H

const original: ThreadMessage = { id: "m0", author: "Rohan", text: "Is checkout still timing out on UPI payments for anyone else?", sentAt: at(22 * 24) }

const filler = ["Standup moved to 10:30 tomorrow", "Who has the Figma link for onboarding?", "Lunch order going in at 1", "PR for the settings page is up", "Reminder: demo on Thursday", "Can someone review the copy deck?", "Office wifi is back", "Design crit notes are in the doc", "New hire starts Monday", "Retro board is open"]
const newer: ThreadMessage[] = [
  ...filler.map((text, i) => ({ id: `f${i}`, author: ["Aisha", "Kabir", "Meera"][i % 3], text, sentAt: at(20 * 24 - i * 40) })),
  { id: "r1", author: "Kabir", text: "Seeing the UPI timeouts at checkout too, looks like the gateway webhook", sentAt: at(19 * 24), replyTo: "m0" },
  { id: "r2", author: "Priya", text: "Checkout UPI timeouts are fixed in 2.4.1, deployed Friday", sentAt: at(3 * 24) },
  { id: "r3", author: "Rohan", text: "Thanks, checkout is fast again on my side", sentAt: at(2 * 24) },
  { id: "r4", author: "Meera", text: "Shipping the release notes later today", sentAt: at(5) },
]

export function Demo() {
  const [target, setTarget] = React.useState<ThreadMessage>(original)
  const [draft, setDraft] = React.useState("Same here, any update?")
  const [dismissed, setDismissed] = React.useState(false)

  return (
    <div className="w-full max-w-md space-y-3">
      {target === original && !dismissed && (
        <StaleReply
          replyingTo={original}
          newer={newer}
          now={NOW}
          onReplyToLatest={setTarget}
          onQuote={(message) => {
            setDraft(`> ${message.author}: ${message.text}\n\n${draft}`)
            setDismissed(true)
          }}
          onDismiss={() => setDismissed(true)}
        />
      )}
      <div className="rounded-lg border bg-background p-3">
        <p className="mb-1.5 truncate text-xs text-muted-foreground">
          Replying to <span className="font-medium text-foreground">{target.author}</span>: {target.text}
        </p>
        <textarea
          aria-label="Reply"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        {(target !== original || dismissed) && (
          <button
            type="button"
            onClick={() => {
              setTarget(original)
              setDismissed(false)
              setDraft("Same here, any update?")
            }}
            className="mt-2 rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Reset demo
          </button>
        )}
      </div>
    </div>
  )
}
