"use client"

import * as React from "react"

import { SecretField } from "@/registry/default/secret-field/secret-field"

export function Demo() {
  const [pasted, setPasted] = React.useState("")

  return (
    <div className="w-full max-w-md space-y-3">
      <SecretField label="Secret key" value="sk_live_51NcBollardUiExampleKey8f2a" />
      <SecretField label="Test key" value="sk_test_51NcBollardUiSandboxKey3c9d" />
      <div>
        <label htmlFor="secret-field-demo-paste" className="text-xs text-muted-foreground">
          Click a masked key, press Ctrl+C (⌘C), then paste here
        </label>
        <input
          id="secret-field-demo-paste"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder="STRIPE_SECRET_KEY="
          spellCheck={false}
          className="mt-1.5 h-9 w-full rounded-md border bg-transparent px-3 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
    </div>
  )
}
