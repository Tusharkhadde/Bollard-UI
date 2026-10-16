"use client"

import * as React from "react"

import { SecretPasteGuard, type SecretMatch } from "@/registry/default/secret-paste-guard/secret-paste-guard"

// Fake credentials, split up so repository secret scanners don't flag the demo itself.
const samples = [
  { label: "Stripe key", text: ["sk", "live", "51NzQaHFk2pLm8RwXc4Ty7Ub"].join("_") },
  { label: "GitHub token", text: "ghp" + "_" + "R7mXq2LcV9tBn4WkPz8YdHs3JfA6uE1oQiGa" },
  {
    label: "JWT",
    text: ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJ1c3JfNDIiLCJyb2xlIjoiYWRtaW4ifQ", "Hq3vJ8kLm2NpQr5StUv7WxYz9Ab"].join("."),
  },
  { label: "Random token", text: "q8Zt3VnR0pLw7XkY2bM5cJ9sHd4FgA1eUo6TiWr" },
]

export function Demo() {
  const [message, setMessage] = React.useState(
    "Deploy is failing again. Here's my env:\nAWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nREGION=ap-south-1"
  )
  const [open, setOpen] = React.useState<SecretMatch[]>([])
  const [sent, setSent] = React.useState(false)

  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <SecretPasteGuard value={message} onValueChange={setMessage} onDetect={setOpen}>
        <textarea
          aria-label="Message to support"
          rows={4}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            setSent(false)
          }}
          className="block w-full resize-none rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </SecretPasteGuard>
      <div className="flex flex-wrap items-center gap-1.5">
        {samples.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => setMessage((current) => `${current}\n${sample.text}`)}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            + {sample.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSent(true)}
          className="ml-auto h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {open.length ? `Send with ${open.length === 1 ? "a secret" : `${open.length} secrets`}` : "Send"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {sent ? "Sent." : ""}
      </p>
    </div>
  )
}
