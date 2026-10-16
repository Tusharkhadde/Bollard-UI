"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { LeftoverTextCheck } from "@/registry/default/leftover-text-check/leftover-text-check"

// A product description pasted straight from a chatbot, the way Amazon listings ended up titled
// "I cannot fulfill that request" (Ars Technica, January 2024).
const PASTED = `I'm sorry, but I can't use the trademarked brand name you asked for. Here's a version without it:

Meet the [Product Name]: a 750 ml steel bottle that keeps drinks cold for 24 hours and is XX% lighter than glass. Lab tested for leaks [1]. See our [care guide](https://example.com/care).

Made by [Brand] in Pune. Ships in plastic-free packaging. TK warranty line.

Meet the [Product Name]: a 750 ml steel bottle that keeps drinks cold for 24 hours and is XX% lighter than glass. Lab tested for leaks [1]. See our [care guide](https://example.com/care).

I hope this helps! Let me know if you'd like a shorter version.`

export function Demo() {
  const [text, setText] = React.useState(PASTED)
  const [published, setPublished] = React.useState(false)

  return (
    <div className="grid w-full max-w-md gap-2">
      <label htmlFor="leftover-demo" className="text-sm font-medium">
        Product description
      </label>
      {published ? (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden className="size-4" />
          Listing published.
        </p>
      ) : (
        <LeftoverTextCheck
          id="leftover-demo"
          value={text}
          onValueChange={setText}
          rows={7}
          onPublish={async () => {
            await new Promise((r) => setTimeout(r, 600))
            setPublished(true)
          }}
        />
      )}
    </div>
  )
}
