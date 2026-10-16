"use client"

import * as React from "react"

import { ShareLink, type ShareSettings } from "@/registry/default/share-link/share-link"

export function Demo() {
  const [settings, setSettings] = React.useState<ShareSettings>()
  const [url, setUrl] = React.useState("https://files.acme.app/s/q4-budget-7Hk2")

  // Starts with the risky setup: anyone with the link can edit, until 5 PM three days out.
  React.useEffect(() => {
    const at = new Date()
    at.setDate(at.getDate() + 3)
    at.setHours(17, 0, 0, 0)
    setSettings({ access: "anyone", role: "edit", expiresAt: at.getTime() })
  }, [])

  if (!settings) return <div className="h-56 w-full max-w-md" />
  return (
    <ShareLink
      key={url}
      label="Share “Q4 budget.xlsx”"
      url={url}
      organization="Acme"
      value={settings}
      onValueChange={setSettings}
      onRevoke={() => new Promise<void>((resolve) => setTimeout(resolve, 600))}
      onCreate={() => {
        setUrl("https://files.acme.app/s/q4-budget-Rm9x")
        setSettings({ access: "organization", role: "view", expiresAt: null })
      }}
    />
  )
}
