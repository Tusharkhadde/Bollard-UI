"use client"

import * as React from "react"

import { ReplacePreview } from "@/registry/default/replace-preview/replace-preview"

const START = `Cat food ships free this week.
Browse the CAT TOYS category for more.
Every cat gets a name tag. See catalog p. 4.`

export function Demo() {
  const [text, setText] = React.useState(START)
  return (
    <div className="grid w-full max-w-md gap-3">
      <label className="grid gap-1.5 text-sm font-medium">
        Product copy
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm font-normal shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </label>
      <ReplacePreview value={text} onValueChange={setText} defaultFind="cat" defaultReplace="dog" />
    </div>
  )
}
