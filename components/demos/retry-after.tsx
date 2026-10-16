"use client"

import * as React from "react"

import { RetryAfter, type RateLimitResponse } from "@/registry/default/retry-after/retry-after"

const limited = (seconds: number): RateLimitResponse => ({
  status: 429,
  headers: {
    "Retry-After": String(seconds),
    "RateLimit-Policy": '"messages";q=5;w=60',
    RateLimit: `"messages";r=0;t=${seconds}`,
  },
})

const field =
  "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

export function Demo() {
  const [message, setMessage] = React.useState("Hi Arjun, the venue moved to Hall B. See you at 6!")
  const [sent, setSent] = React.useState<string[]>([])
  const burst = React.useRef(0)

  // A fake API: after a 429 it lets one message through, then limits every third send.
  const send = () =>
    new Promise<RateLimitResponse | { status: number }>((resolve) =>
      setTimeout(() => {
        burst.current += 1
        if (burst.current % 3 === 0) return resolve(limited(15))
        setSent((list) => [...list, message])
        setMessage("")
        resolve({ status: 200 })
      }, 500),
    )

  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border bg-background p-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Message to the group</span>
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
      </label>
      <RetryAfter defaultResponse={limited(12)} onAction={send} disabled={!message.trim()}>
        Send message
      </RetryAfter>
      {sent.length > 0 && (
        <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">
          Sent {sent.length} {sent.length === 1 ? "message" : "messages"}.
        </p>
      )}
    </div>
  )
}
