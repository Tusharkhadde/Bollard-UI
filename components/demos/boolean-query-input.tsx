"use client"

import * as React from "react"

import { BooleanQueryInput } from "@/registry/default/boolean-query-input/boolean-query-input"

const presets = [
  { label: "AND + OR", value: "java OR python AND remote" },
  { label: "Open quote", value: '"senior developer AND (react OR vue)' },
  { label: "Curly quotes", value: "“product manager” AND fintech" },
  { label: "lowercase or", value: "designer or illustrator NOT intern" },
  { label: "NOT + OR", value: "engineer NOT junior OR intern" },
]

export function Demo() {
  const [query, setQuery] = React.useState(presets[0].value)
  return (
    <div className="grid w-full max-w-md gap-3">
      <BooleanQueryInput label="Search candidates" value={query} onValueChange={setQuery} placeholder='e.g. ("product manager" OR PM) AND fintech' />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Try:
        {presets.map((p) => (
          <button key={p.label} type="button" onClick={() => setQuery(p.value)} className="rounded-md border px-2 py-1 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
