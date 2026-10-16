"use client"

import * as React from "react"

import { SafeSubmit } from "@/registry/default/safe-submit/safe-submit"

type LogEntry = { key: string; outcome: string }

export function Demo() {
  const [dropNext, setDropNext] = React.useState(true)
  const [log, setLog] = React.useState<LogEntry[]>([])
  const charged = React.useRef(new Set<string>())
  const dropRef = React.useRef(dropNext)
  React.useEffect(() => {
    dropRef.current = dropNext
  }, [dropNext])

  // A fake payments API that dedupes on the idempotency key, like Stripe does.
  const pay = async ({ idempotencyKey }: { idempotencyKey: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 900))
    const repeat = charged.current.has(idempotencyKey)
    charged.current.add(idempotencyKey)
    const outcome = repeat ? "duplicate ignored" : "charged ₹2,499"
    if (dropRef.current) {
      setDropNext(false)
      setLog((l) => [...l, { key: idempotencyKey, outcome: `${outcome}, response lost` }])
      throw new TypeError("Network connection lost")
    }
    setLog((l) => [...l, { key: idempotencyKey, outcome }])
  }

  return (
    <form
      className="w-full max-w-sm space-y-3 rounded-xl border bg-background p-4 text-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="block space-y-1">
        <span className="font-medium">Card holder</span>
        <input
          name="holder"
          required
          defaultValue="Priya Sharma"
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        />
      </label>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SafeSubmit onSubmit={pay} pendingLabel="Paying…" successLabel="Paid">
          Pay ₹2,499
        </SafeSubmit>
        <label className="flex items-center gap-2 pt-2.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={dropNext} onChange={(e) => setDropNext(e.target.checked)} />
          Lose the next response
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Mash the button or hold Enter: the server only ever sees one request per attempt.
      </p>
      <ol className="space-y-1 rounded-md bg-muted/60 p-2 font-mono text-[11px]" aria-label="Server log">
        {log.length === 0 && <li className="text-muted-foreground">Server log is empty</li>}
        {log.map((entry, index) => (
          <li key={index}>
            {entry.key.slice(0, 8)}… → {entry.outcome}
          </li>
        ))}
      </ol>
    </form>
  )
}
