"use client"

import * as React from "react"

import { ConsentGroup, type ConsentChoices, type ConsentItem, type ConsentRecord } from "@/registry/default/consent-group/consent-group"

const items: ConsentItem[] = [
  { id: "terms", label: "Terms and Privacy Policy", description: "Needed to run your account.", required: true, readback: "the Terms and Privacy Policy" },
  { id: "news", label: "Product news by email", description: "About two emails a month. Unsubscribe any time." },
  { id: "partners", label: "Offers from partners", description: "We share your email with selected partners." },
  { id: "analytics", label: "Usage analytics", description: "Anonymous stats on which features you use." },
]

export function Demo() {
  const [choices, setChoices] = React.useState<ConsentChoices>({ terms: true, news: true })
  const [record, setRecord] = React.useState<ConsentRecord>()

  return (
    <form className="grid w-full max-w-sm gap-4" onSubmit={(event) => event.preventDefault()}>
      <ConsentGroup
        items={items}
        version="2026-10"
        value={choices}
        name="consent"
        onValueChange={(next, entry) => {
          setChoices(next)
          setRecord(entry)
        }}
      />
      {record && (
        <details className="rounded-md border px-3 py-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Stored record</summary>
          <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed">{JSON.stringify(record, null, 2)}</pre>
        </details>
      )}
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Create account
      </button>
    </form>
  )
}
