"use client"

import * as React from "react"

import { EnvironmentBadge, useEnvironmentGuard } from "@/registry/default/environment-badge/environment-badge"

const envs = ["production", "staging", "development", "eu-prod-2", "sandbox-7"] as const

export function Demo() {
  const [env, setEnv] = React.useState<(typeof envs)[number]>("production")
  const [markTab, setMarkTab] = React.useState(false)
  const [log, setLog] = React.useState("Nothing run yet")
  const { guard, dialog, needsConfirm } = useEnvironmentGuard({ env })

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-xl border bg-background">
      <EnvironmentBadge env={env} detail="ap-south-1 · orders-db" prefixTitle={markTab} markFavicon={markTab} />
      <EnvironmentBadge env={env} variant="ribbon" className="top-11 hidden sm:block" />
      <div className="space-y-4 p-5 text-sm sm:pr-20">
        <div className="flex items-center gap-2">
          <span className="font-medium">Orders admin</span>
          <EnvironmentBadge env={env} variant="badge" />
        </div>
        <div className="flex flex-wrap gap-1">
          {envs.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setEnv(name)}
              aria-pressed={env === name}
              className="h-7 rounded-md border px-2 font-mono text-xs aria-pressed:bg-accent aria-pressed:font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={markTab} onChange={(event) => setMarkTab(event.target.checked)} className="accent-primary" />
          Mark the tab title and favicon
        </label>
        <button
          type="button"
          onClick={guard("Purge the CDN cache", () => setLog(`Cache purged in ${env}`))}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Purge CDN cache
        </button>
        <p className="text-xs text-muted-foreground">
          {needsConfirm ? "Asks first in production. " : "Runs instantly here. "}
          <span aria-live="polite">{log}</span>
        </p>
      </div>
      {dialog}
    </div>
  )
}
