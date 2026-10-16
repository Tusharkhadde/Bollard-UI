"use client"

import * as React from "react"

import { HeadingOutline, type OutlineHeading } from "@/registry/default/heading-outline/heading-outline"

const START = `# Sinhagad monsoon trek

### What to pack

Rain jacket, two litres of water, shoes with grip.

**Getting there**

Take the PMPML bus from Swargate to Sinhagad Paytha.

##

# Booking a guide

## Costs`

export function Demo() {
  const [markdown, setMarkdown] = React.useState(START)
  const editor = React.useRef<HTMLTextAreaElement>(null)

  const jump = (heading: OutlineHeading) => {
    const el = editor.current
    if (!el || heading.line === undefined) return
    const lines = markdown.split("\n")
    const start = lines.slice(0, heading.line).reduce((sum, line) => sum + line.length + 1, 0)
    el.focus()
    el.setSelectionRange(start, start + lines[heading.line].length)
  }

  return (
    <div className="grid w-full max-w-md gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Post (Markdown)</span>
        <textarea
          ref={editor}
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          rows={7}
          spellCheck={false}
          className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </label>
      <HeadingOutline markdown={markdown} onMarkdownChange={setMarkdown} onJump={jump} />
    </div>
  )
}
