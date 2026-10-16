"use client"

import * as React from "react"

import { LinkTextCheck } from "@/registry/default/link-text-check/link-text-check"

const START = `Pune React meetup is on 24 October. To see the venue map and parking, [click here](https://maps.example.com/pune-react-venue).

Slides from last time: https://drive.example.com/drive/folders/1AbC9xYz-meetup-slides

[Register](https://lu.ma/pune-react-oct) before Friday. Speakers, [register](https://forms.example.com/speaker-signup) too.

[Read more](https://devtushar.tech/blog/pune-react-meetup)`

export function Demo() {
  const [markdown, setMarkdown] = React.useState(START)
  return (
    <div className="grid w-full max-w-md gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Event post (Markdown)</span>
        <textarea
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          rows={6}
          spellCheck={false}
          className="w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </label>
      <LinkTextCheck markdown={markdown} onMarkdownChange={setMarkdown} />
    </div>
  )
}
