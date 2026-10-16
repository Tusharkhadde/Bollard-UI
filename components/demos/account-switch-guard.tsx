"use client"

import * as React from "react"

import { AccountSwitchGuard, announceActiveAccount, useActiveAccount } from "@/registry/default/account-switch-guard/account-switch-guard"

const accounts = [
  { id: "acme", name: "Acme Corp" },
  { id: "tushar", name: "Tushar" },
]

export function Demo() {
  const [pageAccount, setPageAccount] = React.useState("acme")
  const [posted, setPosted] = React.useState<string>()
  const active = useActiveAccount("acme")

  // Opens with the slip already made: another tab switched to the personal account.
  React.useEffect(() => announceActiveAccount("tushar"), [])

  return (
    <div className="grid w-full max-w-md gap-3">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <span>Other tab · active account</span>
        <div className="flex gap-1" role="group" aria-label="Simulate switching in another tab">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              aria-pressed={active === account.id}
              onClick={() => announceActiveAccount(account.id)}
              className="h-7 rounded-md border px-2 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent aria-pressed:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {account.name}
            </button>
          ))}
        </div>
      </div>
      <AccountSwitchGuard
        accounts={accounts}
        pageAccountId={pageAccount}
        onAction={async (id) => {
          await new Promise((resolve) => setTimeout(resolve, 600))
          setPosted(accounts.find((a) => a.id === id)?.name)
        }}
        onSwitchPage={(id) => {
          setPageAccount(id)
          setPosted(undefined)
        }}
      >
        <label className="grid gap-1.5 p-3">
          <span className="text-sm font-medium">New post</span>
          <textarea
            rows={3}
            defaultValue="We’re hiring two frontend engineers in Pune. DMs open!"
            className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </label>
      </AccountSwitchGuard>
      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">{posted && `Posted as ${posted}.`}</p>
    </div>
  )
}
